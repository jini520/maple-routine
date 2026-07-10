import { create } from 'zustand'
import {
  getRegisteredCharacters,
  syncSchedules,
  type ScheduleSyncError,
} from '../schedule-sync/schedule-sync'
import type { DailyContent } from '../../types'

export interface DailyCharacterView {
  ocid: string
  characterName: string
  dailyContents: DailyContent[]
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type DailySchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface DailySchedulerState {
  status: DailySchedulerStatus
  characters: DailyCharacterView[]
  error: ScheduleSyncError | null
}

export interface DailySchedulerStore extends DailySchedulerState {
  refresh(): Promise<void>
}

const initialState: DailySchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
}

export const useDailySchedulerStore = create<DailySchedulerStore>()((set) => ({
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

    const characters: DailyCharacterView[] = results.map((result) => ({
      ocid: result.ocid,
      characterName: result.characterName,
      dailyContents: result.state?.dailyContents ?? [],
      isStale: result.isStale,
      syncedAt: result.syncedAt,
      error: result.error,
    }))

    set({ status: 'loaded', characters, error: null })
  },
}))
