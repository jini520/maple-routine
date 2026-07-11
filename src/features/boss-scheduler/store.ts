import { create } from 'zustand'
import { matchBossContent, type MatchedBoss } from '../../lib/boss-matching'
import { syncSchedules, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'

export interface BossCharacterView {
  ocid: string
  characterName: string
  weeklyBosses: MatchedBoss[]
  monthlyBosses: MatchedBoss[]
  weeklyBossClearCount: number | null
  weeklyBossClearLimitCount: number | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type BossSchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface BossSchedulerState {
  status: BossSchedulerStatus
  characters: BossCharacterView[]
  error: ScheduleSyncError | null
  trackedOcids: string[] | null
}

export interface BossSchedulerStore extends BossSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[]): Promise<void>
  refresh(ocids: string[]): Promise<void>
}

const initialState: BossSchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
}

export const useBossSchedulerStore = create<BossSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadTrackedOcids() {
    const ocids = await getTrackedCharacterOcids('boss')
    set({ trackedOcids: ocids })
    if (ocids !== null) {
      await get().refresh(ocids)
    }
  },

  async saveTrackedOcids(ocids) {
    await setTrackedCharacterOcids('boss', ocids)
    set({ trackedOcids: ocids })
    await get().refresh(ocids)
  },

  async refresh(ocids) {
    if (ocids.length === 0) {
      set({ status: 'loaded', characters: [], error: null })
      return
    }

    set({ status: 'loading' })

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids)
    } catch {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패이므로 network로 취급한다.
      set({ status: 'error', error: { kind: 'network' } })
      return
    }

    const characters: BossCharacterView[] = results.map((result) => {
      const bosses = result.state?.bossContents.map(matchBossContent) ?? []
      return {
        ocid: result.ocid,
        characterName: result.characterName,
        weeklyBosses: bosses.filter((boss) => boss.cycle === 'weekly'),
        monthlyBosses: bosses.filter((boss) => boss.cycle === 'monthly'),
        weeklyBossClearCount: result.state?.weeklyBossClearCount ?? null,
        weeklyBossClearLimitCount: result.state?.weeklyBossClearLimitCount ?? null,
        isStale: result.isStale,
        syncedAt: result.syncedAt,
        error: result.error,
      }
    })

    set({ status: 'loaded', characters, error: null })
  },
}))
