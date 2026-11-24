/**
 * 보스 스케줄러의 화면 상태. 넥슨에서 받은 값은 여기 없다. 그것은 쿼리 캐시가 들고 `useBossSchedule` 이 뷰로 만든다.
 * 여기 남는 것은 기기에만 있는 값(파티 인원 · 수동 추적 · 직접 완료)과 화면이 고른 것(필터)뿐이다.
 */
import { create } from 'zustand'

import { countManualWeeklyBosses, WEEKLY_BOSS_CLEAR_LIMIT } from '../../lib/boss/boss-matching'
import { getMaxPartySize } from '../../lib/boss/bosses'
import {
  getBossPartySettings,
  setBossPartySetting,
  type BossPartyShareColumns,
} from '../../storage/boss-party-settings'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../../storage/manual-tracked-content'
import { batchRecordWrites } from '../../storage/record-revision-batch'
import type { BossDifficulty } from '../../types'
import { readTrackedOcidsSync } from '../schedule-sync/read-schedule'
import { useToastStore } from '../toast/store'
import { useTrackingModeStore } from '../tracking-mode/store'
import { applyBossTrackingDraft, type BossManageDraft } from './manage-draft'

export type { BossCharacterView } from './views'

/**
 * 보스 관리 저장의 결과. 실패마다 화면이 띄우는 문구가 다르다.
 *
 * `partyFailed` 는 추적 목록과 그 앞의 파티 설정을 이미 쓴 뒤다. 쓴 파티 설정의 키가 `savedPartyKeys` 다.
 */
export type BossManageSaveResult =
  | { status: 'saved' }
  | { status: 'limitReached' }
  | { status: 'trackingFailed' }
  | { status: 'partyFailed'; savedPartyKeys: string[] }

// 솔로/파티 서브 필터. 목록이 하나라 필터도 하나다.
export type PartyFilter = 'all' | 'solo' | 'party'

export interface BossSchedulerState {
  // key: `${ocid}:${bossKey}:${difficulty}`. 맵에 키가 없으면 미설정(솔로)을 뜻한다. 이 스토어는
  // 없는 키를 1 로 채워 넣지 않는다. 그 해석은 UI 의 책임이다.
  partySizes: Record<string, number>
  // 같은 키의 분배 비율. `partySizes` 와 나란히 사는 것은 인원을 읽는 곳(배지 · 필터 · 드롭
  // 기본값)이 비율을 안 쓰기 때문이다. 둘은 언제나 함께 쓰이고 따로 안 바뀐다.
  partyShares: Record<string, BossPartyShareColumns>
  // 수동 모드에서 캐릭터별 추적 항목(멤버십). 값 필드는 여기 두지 않고 표시 시점에 캐시의
  // 동기화 값 또는 참조 테이블에서 조회한다.
  manualTrackedByOcid: Record<string, ManualTrackedItem[]>
  // 화면 로컬 state 가 아니라 스토어가 소유한다. 화면이 언마운트돼도 살아남는다. 영속화하지 않는다.
  //
  // `activeTab` 은 여기 없다. 주간/월간 탭이 두 화면에서 함께 걷혔다. 되살리지 말 것. 공유할
  // 상대가 없는 공유 상태가 된다. 필터도 하나다. 두 축이 서로 독립 은 탭이 있을 때만 뜻이
  // 있는 문장이었다.
  partyFilter: PartyFilter
}

export interface BossSchedulerStore extends BossSchedulerState {
  /** 추적 캐릭터의 기기 값 둘(파티 인원 · 수동 추적)을 읽는다. 넥슨은 안 부른다. 직접 적은 완료는 쿼리(`manual-completed-query.ts`)다. */
  loadLocal(ocids: readonly string[]): Promise<void>
  /** 캐시의 추적 목록으로 `loadLocal`. 설정이 모드를 바꾼 뒤 부른다. */
  reloadLocal(): Promise<void>
  loadPartySizes(ocids: readonly string[]): Promise<void>
  /** 파티 인원과 분배 비율을 한 번에 저장한다. 균등으로 되돌리는 것도 `shares` 를 비우는 이 길이다. */
  setPartySetting(
    ocid: string,
    bossKey: string,
    difficulty: BossDifficulty,
    input: { partySize: number; shares: BossPartyShareColumns },
  ): Promise<void>
  /**
   * 보스 관리의 초안을 한 번에 저장하는 함수. 추적 목록을 먼저 쓰고 파티 설정을 나중에 쓴다. 쓰기 알림은 끝날 때 한 번이다.
   *
   * 초안을 얹은 주간 보스가 12개를 넘으면 아무것도 쓰지 않는다. 추적 목록을 쓰지 못하면 파티 설정을 쓰지 않는다.
   */
  saveBossManageDraft(ocid: string, draft: BossManageDraft): Promise<BossManageSaveResult>
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
  partyFilter: 'all',
}

export function partySizeKey(ocid: string, bossKey: string, difficulty: string): string {
  return `${ocid}:${bossKey}:${difficulty}`
}

export const useBossSchedulerStore = create<BossSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadLocal(ocids) {
    // 수동 모드에서만 캐릭터별 추적 항목(멤버십)을 읽어둔다. 표시 목록이 이 멤버십으로
    // 결정되기 때문. auto 모드는 등록 여부로 목록을 결정하므로 불필요한 읽기를 건너뛴다.
    const manualTrackedByOcid: Record<string, ManualTrackedItem[]> =
      useTrackingModeStore.getState().mode === 'manual'
        ? Object.fromEntries(
            await Promise.all(ocids.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const)),
          )
        : {}

    set({ manualTrackedByOcid })

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
        crystalExcluded: setting.crystalExcluded,
      }
    }
    set({ partySizes, partyShares })
  },

  async setPartySetting(ocid, bossKey, difficulty, input) {
    await writePartySetting(ocid, bossKey, difficulty, input)
    set(withPartySetting(get(), partySizeKey(ocid, bossKey, difficulty), input))
    useToastStore.getState().showSuccess('파티원 수를 저장했어요')
  },

  // 읽기 → 초안 얹기 → 쓰기 1회. 받기가 넣은 항목을 덮지 않고, 쓰는 사이에 보스가 빠진 상태가 저장되지 않는다. 한도는 화면이 아니라
  // 여기서 막는다. 화면을 연 동안 받은 항목으로 목록이 늘어날 수 있다.
  saveBossManageDraft(ocid, draft) {
    return batchRecordWrites(async (): Promise<BossManageSaveResult> => {
      if (Object.keys(draft.tracking).length > 0) {
        let next: ManualTrackedItem[]
        try {
          const current = await getManualTrackedContent(ocid)
          next = applyBossTrackingDraft(current, draft.tracking)
          // 한도 안에서 바꾸거나 빼는 것은 막지 않는다. 늘어서 한도를 넘을 때만 막는다.
          const weeklyCount = countManualWeeklyBosses(next)
          if (weeklyCount > WEEKLY_BOSS_CLEAR_LIMIT && weeklyCount > countManualWeeklyBosses(current)) {
            return { status: 'limitReached' }
          }
          await setManualTrackedContent(ocid, next)
        } catch {
          return { status: 'trackingFailed' }
        }
        set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
      }

      const savedPartyKeys: string[] = []
      for (const [key, setting] of Object.entries(draft.party)) {
        if (setting === undefined) continue
        try {
          await writePartySetting(ocid, setting.bossKey, setting.difficulty, setting)
        } catch {
          return { status: 'partyFailed', savedPartyKeys }
        }
        savedPartyKeys.push(key)
        set(withPartySetting(get(), key, setting))
      }
      return { status: 'saved' }
    })
  },

  // 읽기 → 배열 계산 → 쓰기 1회. 지우기와 추가를 따로 저장하면 두 쓰기가 각자 커밋해 첫 커밋 직후 그 보스가 목록에 없는
  // 상태가 저장소에 실재한다. 거기서
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
}))

/** 파티 설정 한 줄을 쓰는 함수. 인원이 1 미만이거나 그 난이도의 상한을 넘으면 쓰지 않고 던진다. */
async function writePartySetting(
  ocid: string,
  bossKey: string,
  difficulty: BossDifficulty,
  { partySize, shares }: { partySize: number; shares: BossPartyShareColumns },
): Promise<void> {
  const maxPartySize = getMaxPartySize(bossKey, difficulty)
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > maxPartySize) {
    throw new Error(`파티원 수는 1 이상 ${maxPartySize} 이하의 정수여야 합니다`)
  }

  await setBossPartySetting({
    ocid,
    bossKey,
    difficulty,
    partySize,
    ...shares,
    updatedAt: new Date().toISOString(),
  })
}

/** 쓴 파티 설정을 얹은 인원 · 비율 맵. */
function withPartySetting(
  state: BossSchedulerState,
  key: string,
  { partySize, shares }: { partySize: number; shares: BossPartyShareColumns },
): Pick<BossSchedulerState, 'partySizes' | 'partyShares'> {
  return {
    partySizes: { ...state.partySizes, [key]: partySize },
    partyShares: { ...state.partyShares, [key]: shares },
  }
}
