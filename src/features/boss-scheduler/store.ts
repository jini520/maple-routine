/**
 * 보스 스케줄러의 화면 상태. 넥슨에서 받은 값은 여기 없다. 그것은 쿼리 캐시가 들고 `useBossSchedule` 이 뷰로 만든다.
 * 여기 남는 것은 기기에만 있는 값(파티 인원 · 수동 추적 · 직접 완료)과 화면이 고른 것(필터)뿐이다.
 */
import { create } from 'zustand'

import { countManualWeeklyBosses, WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'
import { bossCycleOf, getMaxPartySize, isSeasonBoss } from '../../lib/boss/bosses'
import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { manualCompletionKey } from '../../lib/boss/manual-completion'
import {
  getBossPartySettings,
  setBossPartySetting,
  type BossPartyShareColumns,
} from '../../storage/boss-party-settings'
import { getBossProfitRecordsRevision, getManualBossProfitRecordKeys } from '../../storage/boss-profit'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../../storage/manual-tracked-content'
import type { BossDifficulty } from '../../types'
import { readTrackedOcidsSync } from '../schedule-sync/read-schedule'
import { useToastStore } from '../toast/store'
import { useTrackingModeStore } from '../tracking-mode/store'

export type { BossCharacterView } from './views'

// 추가 시도의 결과. 'duplicate'는 이미 같은 (보스, 난이도)를 추적 중이라
// 아무 일도 일어나지 않은 경우이고, 'limitReached'는 주간 12개 한도가 막은 경우다.
export type ManualBossAddResult = 'added' | 'duplicate' | 'limitReached'

// 솔로/파티 서브 필터. 목록이 하나라 필터도 하나다.
export type PartyFilter = 'all' | 'solo' | 'party'

export interface BossSchedulerState {
  // key: `${ocid}:${bossKey}:${difficulty}`. 맵에 키가 없으면 미설정(솔로)을 뜻한다. 이 스토어는
  // 없는 키를 1 로 채워 넣지 않는다. 그 해석은 UI 의 책임이다.
  partySizes: Record<string, number>
  // 같은 키의 분배 비율. `partySizes` 와 나란히 사는 것은 인원을 읽는 곳(배지 · 필터 · 드롭
  // 기본값)이 비율을 안 쓰기 때문이다. 둘은 아래 두 함수에서만 함께 쓰이고 따로 안 바뀐다.
  partyShares: Record<string, BossPartyShareColumns>
  // 수동 모드에서 캐릭터별 추적 항목(멤버십). 값 필드는 여기 두지 않고 표시 시점에 캐시의
  // 동기화 값 또는 참조 테이블에서 조회한다.
  manualTrackedByOcid: Record<string, ManualTrackedItem[]>
  /**
   * 사용자가 직접 적은 완료(`bossKey|difficulty`)를 캐릭터별로. **이번 주·이번 달 것만** 든다.
   *
   * 스케줄 캐시에 안 쓰고 여기 따로 드는 이유는 다음 동기화가 캐시를 덮기 때문이다. 표시 판정
   * (`displayedBosses`)이 이 값을 받아 카드 · 주간 한도 · today 남은 스케줄에 함께 얹는다.
   */
  manualCompletedByOcid: Record<string, string[]>
  /**
   * 위 값이 비추는 **기록 판**(`getBossProfitRecordsRevision`)과 기간. 포커스가 이것과 지금을 견줘
   * 바뀌었을 때만 다시 읽는다. `null` 은 아직 한 번도 안 읽었다는 뜻이다. 기간을 함께 드는 것은
   * 목요일을 넘기면 기록이 그대로여도 지난주 완료가 이번 주 것이 아니기 때문이다.
   */
  manualCompletedStamp: string | null
  // 화면 로컬 state 가 아니라 스토어가 소유한다. 화면이 언마운트돼도 살아남는다. 영속화하지 않는다.
  //
  // `activeTab` 은 여기 없다. 주간/월간 탭이 두 화면에서 함께 걷혔다. 되살리지 말 것. 공유할
  // 상대가 없는 공유 상태가 된다. 필터도 하나다. 두 축이 서로 독립 은 탭이 있을 때만 뜻이
  // 있는 문장이었다.
  partyFilter: PartyFilter
}

export interface BossSchedulerStore extends BossSchedulerState {
  /** 추적 캐릭터의 기기 값 셋(파티 인원 · 수동 추적 · 직접 완료)을 읽는다. 넥슨은 안 부른다. */
  loadLocal(ocids: readonly string[]): Promise<void>
  /** 캐시의 추적 목록으로 `loadLocal`. 설정이 모드를 바꾼 뒤 부른다. */
  reloadLocal(): Promise<void>
  /**
   * 직접 완료만 다시 읽는다. **기록 판이나 기간이 바뀌었을 때만** 읽고 넥슨은 안 부른다.
   *
   * 화면이 포커스마다 부른다. 이 스토어를 쓰는 두 화면(스케줄러 · today)은 탭이라 계속 살아
   * 있어서, 그 사이 보스 수익에서 적은 완료를 이것이 들여온다.
   */
  reloadManualCompleted(): Promise<void>
  loadPartySizes(ocids: readonly string[]): Promise<void>
  /** 파티 인원과 분배 비율을 한 번에 저장한다. 균등으로 되돌리는 것도 `shares` 를 비우는 이 길이다. */
  setPartySetting(
    ocid: string,
    bossKey: string,
    difficulty: BossDifficulty,
    input: { partySize: number; shares: BossPartyShareColumns },
  ): Promise<void>
  addManualBoss(ocid: string, bossKey: string, difficulty: BossDifficulty): Promise<ManualBossAddResult>
  removeManualBoss(ocid: string, bossKey: string, difficulty: BossDifficulty): Promise<void>
  /**
   * 추적 중인 보스의 난이도를 `to` 로 바꾸는 명령.
   *
   * `from` 을 받지 않는 것이 의도다. 호출부는 렌더 시점의 난이도를 넘기게 되는데, 칩을 연달아
   * 누르면 낡은 값이 넘어와 매칭 실패로 변경이 **무음 유실**된다. "이 보스의 난이도를 to 로
   * 만든다"는 명령형이면 그 실패 모드가 없다.
   *
   * 개수가 변하지 않으므로 주간 12개 한도에 걸리지 않는다. 반환값이 없는 이유다.
   */
  setManualBossDifficulty(ocid: string, bossKey: string, to: BossDifficulty): Promise<void>
  // 필터 전환에 네트워크가 없어 동기 세터다(보스 수익 setTab과 다른 점).
  setPartyFilter(filter: PartyFilter): void
}

const initialState: BossSchedulerState = {
  partySizes: {},
  partyShares: {},
  manualTrackedByOcid: {},
  manualCompletedByOcid: {},
  manualCompletedStamp: null,
  partyFilter: 'all',
}

export function partySizeKey(ocid: string, bossKey: string, difficulty: string): string {
  return `${ocid}:${bossKey}:${difficulty}`
}

/** 직접 완료가 비추는 판. 기록 판과 이번 주 · 이번 달 기간을 한 글자로 잇는다. */
function manualCompletedStampOf(now: Date): string {
  return [
    getBossProfitRecordsRevision(),
    getCurrentBossProfitPeriod('weekly', now).periodKey,
    getCurrentBossProfitPeriod('monthly', now).periodKey,
  ].join('|')
}

/**
 * 직접 적은 완료를 캐릭터별로 읽는다. 이번 주와 이번 달 기록만 본다.
 *
 * 실패하면 빈 표다. 그 회차의 카드가 넥슨이 준 그대로 서고, 다음 회차가 다시 읽는다. 여기서
 * 던지면 스케줄러 화면 전체가 못 선다.
 */
async function readManualCompleted(
  ocids: readonly string[],
  now: Date,
): Promise<Record<string, string[]>> {
  if (ocids.length === 0) return {}

  const periodKeys = [
    getCurrentBossProfitPeriod('weekly', now).periodKey,
    getCurrentBossProfitPeriod('monthly', now).periodKey,
  ]
  const byOcid: Record<string, string[]> = {}
  try {
    for (const record of await getManualBossProfitRecordKeys([...ocids], periodKeys)) {
      const keys = byOcid[record.ocid] ?? []
      keys.push(manualCompletionKey(record.bossKey, record.difficulty))
      byOcid[record.ocid] = keys
    }
  } catch {
    return {}
  }
  return byOcid
}

export const useBossSchedulerStore = create<BossSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadLocal(ocids) {
    // 직접 적은 완료. 모드와 무관하게 읽는다 - 카드의 완료 배지와 주간 한도가 이 값을 함께 본다.
    // 판은 **읽기 전에 찍는다.** 읽는 중에 들어온 쓰기를 본 것으로 적으면 그 쓰기를 영영 놓친다.
    const now = new Date()
    const manualCompletedStamp = manualCompletedStampOf(now)
    const manualCompletedByOcid = await readManualCompleted(ocids, now)

    // 수동 모드에서만 캐릭터별 추적 항목(멤버십)을 읽어둔다. 표시 목록이 이 멤버십으로
    // 결정되기 때문. auto 모드는 등록 여부로 목록을 결정하므로 불필요한 읽기를 건너뛴다.
    const manualTrackedByOcid: Record<string, ManualTrackedItem[]> =
      useTrackingModeStore.getState().mode === 'manual'
        ? Object.fromEntries(
            await Promise.all(ocids.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const)),
          )
        : {}

    set({ manualCompletedByOcid, manualCompletedStamp, manualTrackedByOcid })

    // 파티 설정은 스케줄과 독립인 기기 값이라 실패해도 나머지를 막지 않는다.
    try {
      await get().loadPartySizes(ocids)
    } catch {
      // 파티 설정 로드 실패는 조용히 넘긴다(스케줄 표시·저장 완료를 막지 않는다)
    }
  },

  reloadLocal() {
    return get().loadLocal(readTrackedOcidsSync() ?? [])
  },

  async reloadManualCompleted() {
    const now = new Date()
    const stamp = manualCompletedStampOf(now)
    if (stamp === get().manualCompletedStamp) return
    const ocids = readTrackedOcidsSync()
    // 추적 목록을 아직 안 읽었으면 진입 조회가 곧 읽는다. 여기서 빈 표를 적으면 그 회차보다
    // 앞서 판을 소모해 버린다.
    if (ocids === null) return
    const manualCompletedByOcid = await readManualCompleted(ocids, now)
    set({ manualCompletedByOcid, manualCompletedStamp: stamp })
  },

  setPartyFilter(filter) {
    set({ partyFilter: filter })
  },

  async loadPartySizes(ocids) {
    if (ocids.length === 0) {
      set({ partySizes: {}, partyShares: {} })
      return
    }

    const settings = await getBossPartySettings([...ocids])
    const partySizes: Record<string, number> = {}
    const partyShares: Record<string, BossPartyShareColumns> = {}
    for (const setting of settings) {
      const key = partySizeKey(setting.ocid, setting.bossKey, setting.difficulty)
      partySizes[key] = setting.partySize
      partyShares[key] = {
        crystalMyShare: setting.crystalMyShare,
        crystalSharesTotal: setting.crystalSharesTotal,
        splitFeePercent: setting.splitFeePercent,
        splitFeeAuto: setting.splitFeeAuto,
      }
    }
    set({ partySizes, partyShares })
  },

  async setPartySetting(ocid, bossKey, difficulty, { partySize, shares }) {
    const maxPartySize = getMaxPartySize(bossKey, difficulty)
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > maxPartySize) {
      throw new Error(`setPartySetting: 파티원 수는 1 이상 ${maxPartySize} 이하의 정수여야 합니다`)
    }

    await setBossPartySetting({
      ocid,
      bossKey,
      difficulty,
      partySize,
      ...shares,
      updatedAt: new Date().toISOString(),
    })

    const key = partySizeKey(ocid, bossKey, difficulty)
    set({
      partySizes: { ...get().partySizes, [key]: partySize },
      partyShares: { ...get().partyShares, [key]: shares },
    })
    useToastStore.getState().showSuccess('파티원 수를 저장했어요')
  },

  // 저장소(단일 진실 공급원)에서 현재 배열을 읽어 (보스, 난이도) 멤버십만 추가·삭제하고 다시
  // 저장한 뒤 화면 상태를 갱신한다. 보스는 maxCount 개념이 없어 값 필드를 안 채운다. 한도 초과는
  // 여기서 막고 결과 코드로 알린다. UI 사전 차단만으로는 난이도 교체(remove → add)·시드 같은
  // 다른 호출 경로가 새어 나간다.
  async addManualBoss(ocid, bossKey, difficulty) {
    const current = await getManualTrackedContent(ocid)
    if (
      current.some((item) => item.kind === 'boss' && item.bossKey === bossKey && item.difficulty === difficulty)
    ) {
      return 'duplicate'
    }

    // 한도는 주간 보스에만 걸린다. 시즌 보스·월간 보스는 카운트에도 이 검사에도 안 들어간다.
    const countsTowardWeeklyLimit = bossCycleOf(bossKey) === 'weekly' && !isSeasonBoss(bossKey)
    if (countsTowardWeeklyLimit && countManualWeeklyBosses(current) >= WEEKLY_BOSS_CLEAR_LIMIT) {
      return 'limitReached'
    }

    const next: ManualTrackedItem[] = [...current, { kind: 'boss', bossKey, difficulty }]
    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
    return 'added'
  },

  // 읽기 → 배열 계산 → 쓰기 1회. 화면이 removeManualBoss → addManualBoss 를 이어 부르면 두
  // 액션이 각자 커밋해 첫 커밋 직후 그 보스가 목록에 없는 상태가 저장소에 실재한다. 거기서
  // 두 번째가 실패하거나 앱이 죽으면 보스가 통째로 사라진다. Preferences 는 키 하나에 배열
  // 전체를 덮어쓰므로 set 한 번이 이미 원자적이다. 필요한 것은 트랜잭션이 아니라 커밋을 1회로
  // 줄이는 것이다.
  //
  // 쓰기 앞은 순수 계산뿐이고 메모리 갱신은 쓰기 뒤라, 던지면 저장소도 스토어도 원래대로다.
  async setManualBossDifficulty(ocid, bossKey, to) {
    const current = await getManualTrackedContent(ocid)

    // 같은 보스가 두 난이도로 저장돼 있었다면(스토어가 금지하지는 않는다) 하나로 수렴시킨다.
    let replaced = false
    const next = current.flatMap((item): ManualTrackedItem[] => {
      if (item.kind !== 'boss' || item.bossKey !== bossKey) return [item]
      if (replaced) return []
      replaced = true
      return [{ ...item, difficulty: to }]
    })

    // 추적 중이 아니면 쓸 것이 없다. 빈 쓰기로 저장소를 건드리지 않는다.
    if (!replaced) return

    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
  },

  async removeManualBoss(ocid, bossKey, difficulty) {
    const current = await getManualTrackedContent(ocid)
    const next = current.filter(
      (item) => !(item.kind === 'boss' && item.bossKey === bossKey && item.difficulty === difficulty),
    )
    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
  },
}))
