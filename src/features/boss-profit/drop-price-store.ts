/**
 * 가격 기록 화면의 상태. 한 주를 놓고 드롭에 값을 매긴다.
 *
 * 히스토리 스토어(`drop-history-store`)와 형제이되 축과 성격이 다르다: 저쪽은 **전 기간 읽기
 * 전용**이고 여기는 **한 주 쓰기**다. 그래서 저장 경로(`savePrice`·`skipPrice`)가 함께 산다.
 *
 * **왜 원본 레코드를 들고 있나**. 저장이 `replaceBossDropRecords`(그룹 통째 교체)라, 한 건의
 * 가격만 고치려 해도 **같은 (ocid, boss, difficulty, periodKey) 의 나머지 드롭을 함께 넘겨야**
 * 한다. 넘기지 않으면 그 그룹의 다른 기록이 사라진다.
 */

import { withSqliteTimeout } from './sqlite-guards'
import { create } from 'zustand'
import { toRecordedDrop } from './rows'
import { useBossProfitStore } from './store'
import { getBossDropRecords, replaceBossDropRecords } from '../../storage/boss-drops'
import type { BossDropRecord } from '../../storage/boss-drops'
import { getBossProfitRecords } from '../../storage/boss-profit'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
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
  periodKey: string | null
  groups: DropPriceGroup[]
  load: (periodKey: string) => Promise<void>
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

export const useDropPriceStore = create<DropPriceState>((set, get) => ({
  status: 'idle',
  periodKey: null,
  groups: [],

  async load(periodKey) {
    set({ status: 'loading', periodKey })

    const ocids = await getTrackedCharacterOcids()
    if (ocids === null || ocids.length === 0) {
      set({ status: 'ready', groups: [] })
      return
    }

    try {
      // 드롭과 수익 기록을 함께 읽는다. 후자는 **분배 인원 기본값(파티원 수)** 에만 쓴다.
      const [dropRecords, profitRecords] = await Promise.all([
        withSqliteTimeout(getBossDropRecords(ocids, [periodKey])),
        withSqliteTimeout(getBossProfitRecords(ocids, [periodKey])),
      ])

      const partySizes = new Map(
        profitRecords.map((record) => [saveGroupKey(record), record.partySize] as const),
      )

      const characters = new Map<string, { characterName: string; imageUrl: string | null }>()
      for (const ocid of new Set(dropRecords.map((record) => record.ocid))) {
        const cached = await getCachedCharacterBasic(ocid)
        if (cached === null) continue
        characters.set(ocid, { characterName: cached.profile.name, imageUrl: cached.profile.imageUrl ?? null })
      }

      set({ status: 'ready', groups: buildGroups(dropRecords, characters, partySizes) })
    } catch {
      set({ status: 'failed', groups: [] })
    }
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

/**
 * 한 건의 가격을 고치고 그 **그룹 전체**를 다시 쓴다.
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
