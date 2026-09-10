/**
 * 가격 기록 화면의 상태. 한 주를 놓고 드롭에 값을 매긴다.
 *
 * 히스토리 스토어(`drop-history-store`)와 형제이되 축과 성격이 다르다: 저쪽은 **전 기간 읽기
 * 전용**이고 여기는 **한 주 쓰기**다. 그래서 저장 경로(`savePrice`·`skipPrice`)가 함께 산다.
 *
 * **왜 원본 레코드를 들고 있나**. 저장이 `replaceBossDropRecords`(그룹 통째 교체)라, 한 건의
 * 가격만 고치려 해도 **같은 (ocid, boss, difficulty, periodKey) 의 나머지 드롭을 함께 넘겨야**
 * 한다. 넘기지 않으면 그 그룹의 다른 기록이 사라진다.
 *
 * **읽는 기간 키가 둘이다.** 월간 보스 드롭의 `period_key` 는 달이라 주간 키 조회에 안 걸린다.
 * 보스 수익이 그 보스를 주간 탭의 그 주에 세우므로(`filterRowsForTab`) 값을 매기는 자리도 같은
 * 주에 세운다. 어느 주인가는 `isMonthlyRowInWeek` 한 함수가 정한다.
 *
 * **창을 통째로 읽는다.** 이 화면의 화살표는 한 칸씩 걸으므로 달력의 앞뒤 두 달이 곧 갈 수 있는
 * 곳이다. 기간마다 따로 읽지 않고 저장 계층의 두 조회에 기간 키 **목록**을 넘겨 한 번에 읽은 뒤
 * 메모리에서 기간별로 가른다. 창이 열일곱 주여도 조회는 그대로 둘이다.
 *
 * @see docs/features/item-drop.md 의 `창을 조회 둘로 한 번에 읽는다`
 */

import { withSqliteTimeout } from './sqlite-guards'
import { create } from 'zustand'
import { toRecordedDrop } from './rows'
import { useBossProfitStore } from './store'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import type { BossDropRecord } from '../../storage/boss-drops'
import {
  getBossProfitRecords,
  getRecordedCharacterOcids,
  getWeeklyPeriodKeysWithRecords,
} from '../../storage/boss-profit'
import { isMonthlyRowInWeek, monthOfWeek } from '../../lib/boss/monthly-boss-week'
import { bossRecordsStamp } from './period-cache'
import { dropWindowPeriodKeys } from './period-window'
import type { BossCycle } from '../../types'
import { resolveDisplayProfiles } from '../character-profile/resolve'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import type { BossDifficulty } from '../../types'
import type { RecordedDrop } from '../../types/drops'

/** 목록의 한 줄 = 기록 한 건. 어느 보스·누구의 것인지가 함께 붙어야 값을 매길 수 있다. */
export interface DropPriceEntry {
  /** `(ocid, boss, difficulty, periodKey, dropIndex)`. 저장할 때 대상을 되찾는 키다. */
  id: string
  ocid: string
  boss: string
  difficulty: BossDifficulty
  periodKey: string
  dropIndex: number
  drop: RecordedDrop
  /** 분배 인원 스테퍼의 **기본값**. 그 행의 파티원 수다. */
  partySize: number
}

export interface DropPriceGroup {
  ocid: string
  characterName: string
  imageUrl: string | null
  entries: DropPriceEntry[]
}

interface DropPriceState {
  status: 'idle' | 'loading' | 'ready' | 'failed'
  /**
   * 지금 상태가 **어느 기간의 것인가**. 읽기를 걸 때 곧장 바뀐다.
   *
   * 화면이 `status` 만 보면 지난번 기간의 `ready` 를 이번 기간의 사실로 읽어, 기록이 있는데도
   * 빈 상태가 한 프레임 번쩍인다. 둘을 함께 봐야 **아직 안 읽었다** 와 **읽었더니 없더라** 가
   * 갈린다.
   */
  periodKey: string | null
  groups: DropPriceGroup[]
  load: (periodKey: string) => Promise<void>
  /**
   * 창을 미리 채운다. **화면 상태는 안 건드린다.** 보스 수익 화면이 부른다.
   *
   * 저쪽이 이 스토어를 부르는 방향이라야 한다. 반대로 두면 순환 의존이 된다
   * (`drop-price-store` → `store`).
   */
  warmWindow: (periodKey: string) => Promise<void>
  savePrice: (entry: DropPriceEntry, priceMeso: number, share: number) => Promise<void>
  /** 기록 안함. 값을 매기지 않기로 한 결정을 저장한다(스킵과 다르다 정정). */
  excludePrice: (entry: DropPriceEntry) => Promise<void>
}

// 히스토리와 같은 사정. 여기서 실패를 빈 배열로 바꾸면 "기록이 없습니다"라는 **거짓 빈 상태**가
// 된다. 실패는 실패로 알린다.

function entryId(record: Pick<BossDropRecord, 'ocid' | 'boss' | 'difficulty' | 'periodKey' | 'dropIndex'>): string {
  return `${record.ocid}|${record.boss}|${record.difficulty}|${record.periodKey}|${record.dropIndex}`
}

/**
 * 저장 그룹의 키. `replaceBossDropRecords` 의 단위다(`dropIndex` 는 빠진다).
 *
 * `difficulty` 를 `string` 으로 받는 것은 저장 계층이 난이도를 좁히지 않은 문자열로 들고
 * 있어서다(매칭 실패 원문명이 들어올 수 있다). 같은 키 함수를 저장 행과 화면 엔트리 양쪽에
 * 쓰려면 넓은 쪽에 맞춰야 한다.
 */
function saveGroupKey(entry: { ocid: string; boss: string; difficulty: string; periodKey: string }): string {
  return `${entry.ocid}|${entry.boss}|${entry.difficulty}|${entry.periodKey}`
}

function buildGroups(
  records: BossDropRecord[],
  characters: Map<string, { characterName: string; imageUrl: string | null }>,
  partySizes: Map<string, number>,
): DropPriceGroup[] {
  const groups: DropPriceGroup[] = []
  const indexByOcid = new Map<string, number>()

  for (const record of records) {
    const character = characters.get(record.ocid)
    // 이름을 모르는 캐릭터는 그룹을 만들지 않는다. ocid 를 이름 대신 쓰면 화면에 해시가 뜬다
    // (히스토리 스토어와 같은 규약).
    if (character === undefined) continue

    let index = indexByOcid.get(record.ocid)
    if (index === undefined) {
      index = groups.length
      indexByOcid.set(record.ocid, index)
      groups.push({ ocid: record.ocid, ...character, entries: [] })
    }
    groups[index].entries.push({
      id: entryId(record),
      ocid: record.ocid,
      boss: record.boss,
      difficulty: record.difficulty as BossDifficulty,
      periodKey: record.periodKey,
      dropIndex: record.dropIndex,
      drop: toRecordedDrop(record),
      partySize: partySizes.get(saveGroupKey(record)) ?? 1,
    })
  }

  return groups
}

/** 창 한 칸. 어느 판에서 읽었나가 함께 붙는다 */
interface WindowEntry {
  groups: DropPriceGroup[]
  stamp: string
}

/**
 * 기간별 그룹 표. 화면이 왕복해도 살아 있어야 해서 스토어 상태가 아니라 모듈 변수다.
 *
 * 판이 다른 줄은 없는 것으로 친다. 판은 보스 수익의 기간 표와 **같은 값**이라 가격 한 건을
 * 적으면 둘이 함께 낡는다.
 */
const windowCache = new Map<string, WindowEntry>()

function readWindowCache(periodKey: string, stamp: string): DropPriceGroup[] | null {
  const entry = windowCache.get(periodKey)
  return entry === undefined || entry.stamp !== stamp ? null : entry.groups
}

/**
 * 창 전체를 **조회 둘로** 읽어 표를 채운다. 실패하면 `null`.
 *
 * 실패를 빈 표로 바꾸지 않는다. 그러면 화면이 `기록이 없습니다` 라는 거짓 빈 상태를 그린다.
 */
async function fillWindowCache(periodKey: string): Promise<Map<string, DropPriceGroup[]> | null> {
  // **읽기 전에 찍는다.** 읽는 중에 들어온 변경을 본 것으로 표시하면 그 변경을 영영 놓친다.
  const stamp = bossRecordsStamp()
  const cycle: BossCycle = isMonthlyPeriodKey(periodKey) ? 'monthly' : 'weekly'
  const windowKeys = dropWindowPeriodKeys(cycle, periodKey, new Date())

  // 추적 목록으로 범위를 정하면 캐릭터를 관리 목록에서 뺀 순간 그 캐릭터의 미입력 드롭을
  // 여기서 못 고친다. 그런데 보스 수익과 가계부는 그 건수를 계속 `미입력 n` 으로 센다.
  const tracked = (await getTrackedCharacterOcids()) ?? []
  const recorded = await getRecordedCharacterOcids().catch(() => [])
  const ocids = [...new Set([...tracked, ...recorded])]
  const built = new Map<string, DropPriceGroup[]>()
  if (ocids.length === 0) {
    for (const key of windowKeys) {
      built.set(key, [])
      windowCache.set(key, { groups: [], stamp })
    }
    return built
  }

  // 주간 키로 열었으면 그 주가 속한 달도 함께 읽는다. 그 달의 월간 보스가 이 주에 설 수 있다.
  const monthKeys = cycle === 'weekly' ? [...new Set(windowKeys.map(monthOfWeek))] : []
  const queryKeys = [...new Set([...windowKeys, ...monthKeys])]

  try {
    // 드롭과 수익 기록을 함께 읽는다. 후자는 **분배 인원 기본값(파티원 수)** 과, 월간 보스가
    // 어느 주에 서는지를 정하는 처치 여부·처치일에 쓴다.
    const [allDropRecords, profitRecords, weekLists] = await Promise.all([
      withSqliteTimeout(getBossDropRecords(ocids, queryKeys)),
      withSqliteTimeout(getBossProfitRecords(ocids, queryKeys)),
      Promise.all(
        monthKeys.map(async (monthKey) =>
          [monthKey, await withSqliteTimeout(getWeeklyPeriodKeysWithRecords(ocids, monthKey))] as const,
        ),
      ),
    ])
    const weeksByMonth = new Map(weekLists)

    const partySizes = new Map(
      profitRecords.map((record) => [saveGroupKey(record), record.partySize] as const),
    )

    // 이름은 창 전체에 한 번만 묻는다. 기간마다 물으면 왕복이 창의 칸 수만큼 는다.
    const profiles = await resolveDisplayProfiles(allDropRecords.map((record) => record.ocid))
    const characters = new Map<string, { characterName: string; imageUrl: string | null }>()
    for (const [ocid, profile] of profiles) {
      characters.set(ocid, { characterName: profile.name, imageUrl: profile.imageUrl })
    }

    for (const key of windowKeys) {
      const monthKey = cycle === 'weekly' ? monthOfWeek(key) : null
      const dropRecords = allDropRecords.filter(
        (record) =>
          record.periodKey === key ||
          (monthKey !== null &&
            record.periodKey === monthKey &&
            standsInWeek(record, key, profitRecords, weeksByMonth.get(monthKey) ?? [])),
      )
      const groups = buildGroups(dropRecords, characters, partySizes)
      built.set(key, groups)
      windowCache.set(key, { groups, stamp })
    }
    return built
  } catch {
    return null
  }
}

export function clearDropWindowForTests(): void {
  windowCache.clear()
}

export const useDropPriceStore = create<DropPriceState>((set, get) => ({
  status: 'idle',
  periodKey: null,
  groups: [],

  async load(periodKey) {
    const cached = readWindowCache(periodKey, bossRecordsStamp())
    if (cached !== null) {
      set({ status: 'ready', periodKey, groups: cached })
      return
    }

    set({ status: 'loading', periodKey })
    const built = await fillWindowCache(periodKey)
    // 읽는 사이에 기간을 옮겼으면 이 답은 다른 기간의 것이다.
    if (get().periodKey !== periodKey) return
    if (built === null) {
      set({ status: 'failed', groups: [] })
      return
    }
    set({ status: 'ready', groups: built.get(periodKey) ?? [] })
  },

  async warmWindow(periodKey) {
    if (readWindowCache(periodKey, bossRecordsStamp()) !== null) return
    await fillWindowCache(periodKey)
  },

  async savePrice(entry, priceMeso, share) {
    await writePrice(get, set, entry, { priceState: 'entered', priceMeso, priceShare: share })
  },

  async excludePrice(entry) {
    await writePrice(get, set, entry, {
      priceState: 'excluded',
      priceMeso: undefined,
      priceShare: undefined,
    })
  },
}))

/** `YYYY-MM` 인가. 주간 키는 `YYYY-MM-DD` 라 길이로 갈린다(스토어가 쓰는 것과 같은 판정). */
function isMonthlyPeriodKey(periodKey: string): boolean {
  return periodKey.length === 'YYYY-MM'.length
}

/**
 * 달 키로 읽힌 이 드롭이 **보고 있는 주에 서는가**.
 *
 * 판정은 보스 수익이 쓰는 `isMonthlyRowInWeek` 하나에 맡긴다. 여기서 규칙을 새로 쓰면 저쪽에는
 * 보이는데 값은 못 매기는 주가 생긴다.
 *
 * `isComplete` 는 **그 달의 수익 기록이 있는가**다. 기록은 완료된 보스만 남으므로 그것이 곧 처치
 * 여부이고, 아직 안 잡은 월간 보스는 이번 주에 선다.
 */
function standsInWeek(
  record: BossDropRecord,
  weeklyPeriodKey: string,
  profitRecords: readonly { ocid: string; boss: string; difficulty: string; periodKey: string; defeatedOn?: string | null }[],
  weeksWithRecords: readonly string[],
): boolean {
  const profit = profitRecords.find((candidate) => saveGroupKey(candidate) === saveGroupKey(record))
  return isMonthlyRowInWeek({
    weeklyPeriodKey,
    monthlyPeriodKey: record.periodKey,
    isComplete: profit !== undefined,
    defeatedOn: profit?.defeatedOn ?? null,
    weeksWithRecords,
    now: new Date(),
  })
}

/**
 * 한 건의 가격을 고치고 그룹 전체를 다시 쓰는 저장.
 *
 * 낙관적 갱신을 하지 않는다. 쓰기가 성공한 뒤에 상태를 바꾼다. 실패하면 **던져서** 화면이
 * 토스트로 알리게 한다(조용히 삼키면 값이 저장된 줄 알고 화면을 떠난다).
 */
async function writePrice(
  get: () => DropPriceState,
  set: (partial: Partial<DropPriceState>) => void,
  entry: DropPriceEntry,
  patch: Pick<RecordedDrop, 'priceState' | 'priceMeso' | 'priceShare'>,
): Promise<void> {
  const groupKey = saveGroupKey(entry)
  const siblings = get()
    .groups.flatMap((group) => group.entries)
    .filter((candidate) => saveGroupKey(candidate) === groupKey)
    .sort((a, b) => a.dropIndex - b.dropIndex)

  const nextDrops = siblings.map((candidate) =>
    candidate.id === entry.id ? { ...candidate.drop, ...patch } : candidate.drop,
  )

  await replaceBossDropRecords(
    entry.ocid,
    entry.boss,
    entry.difficulty,
    entry.periodKey,
    nextDrops,
    new Date().toISOString(),
  )

  // 보스 수익 화면은 스택 왕복에도 마운트를 유지하므로 자기 스냅샷을 다시 읽지 않는다. 여기서
  // 알려주지 않으면 값이 새로고침해야 반영된다. 쓰기가 성공한 뒤에만 부른다. 실패한 값이 저쪽
  // 화면에 남으면 저장된 것처럼 보인다.
  useBossProfitStore
    .getState()
    .applyExternalDropEdit(entry.ocid, entry.boss, entry.difficulty, entry.periodKey, nextDrops)

  set({
    groups: get().groups.map((group) => ({
      ...group,
      entries: group.entries.map((candidate) =>
        candidate.id === entry.id ? { ...candidate, drop: { ...candidate.drop, ...patch } } : candidate,
      ),
    })),
  })
}
