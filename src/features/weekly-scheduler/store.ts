import { create } from 'zustand'
import { matchBossContent, type MatchedBoss } from '../../lib/boss-matching'
import {
  getRegisteredCharacters,
  syncSchedules,
  type ScheduleSyncError,
} from '../schedule-sync/schedule-sync'
import type { WeeklyContent } from '../../types'

export interface WeeklyCharacterView {
  ocid: string
  characterName: string
  weeklyContents: WeeklyContent[]
  bosses: MatchedBoss[]
  weeklyBossClearCount: number | null
  weeklyBossClearLimitCount: number | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type WeeklySchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface WeeklySchedulerState {
  status: WeeklySchedulerStatus
  characters: WeeklyCharacterView[]
  error: ScheduleSyncError | null
}

export interface WeeklySchedulerStore extends WeeklySchedulerState {
  refresh(): Promise<void>
}

const initialState: WeeklySchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
}

export const useWeeklySchedulerStore = create<WeeklySchedulerStore>()((set) => ({
  ...initialState,

  async refresh() {
    set({ status: 'loading' })

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      const characters = await getRegisteredCharacters()
      results = await syncSchedules(characters.map((character) => character.ocid))
    } catch {
      // getRegisteredCharacters/syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패이므로 network로 취급한다.
      set({ status: 'error', error: { kind: 'network' } })
      return
    }

    const characters: WeeklyCharacterView[] = results.map((result) => ({
      ocid: result.ocid,
      characterName: result.characterName,
      weeklyContents: result.state?.weeklyContents ?? [],
      bosses: result.state?.bossContents.map(matchBossContent) ?? [],
      weeklyBossClearCount: result.state?.weeklyBossClearCount ?? null,
      weeklyBossClearLimitCount: result.state?.weeklyBossClearLimitCount ?? null,
      isStale: result.isStale,
      syncedAt: result.syncedAt,
      error: result.error,
    }))

    set({ status: 'loaded', characters, error: null })
  },
}))
