import { create } from 'zustand'
import { syncSchedules, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'
import type { DailyContent, WeeklyContent } from '../../types'

export interface ContentCharacterView {
  ocid: string
  characterName: string
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type ContentSchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface ContentSchedulerState {
  status: ContentSchedulerStatus
  characters: ContentCharacterView[]
  error: ScheduleSyncError | null
  trackedOcids: string[] | null
}

export interface ContentSchedulerStore extends ContentSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[]): Promise<void>
  refresh(ocids: string[]): Promise<void>
}

const initialState: ContentSchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
}

export const useContentSchedulerStore = create<ContentSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadTrackedOcids() {
    const ocids = await getTrackedCharacterOcids('content')
    set({ trackedOcids: ocids })
    if (ocids !== null) {
      await get().refresh(ocids)
    }
  },

  async saveTrackedOcids(ocids) {
    await setTrackedCharacterOcids('content', ocids)
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

    const characters: ContentCharacterView[] = results.map((result) => ({
      ocid: result.ocid,
      characterName: result.characterName,
      dailyContents: result.state?.dailyContents ?? [],
      weeklyContents: result.state?.weeklyContents ?? [],
      isStale: result.isStale,
      syncedAt: result.syncedAt,
      error: result.error,
    }))

    set({ status: 'loaded', characters, error: null })
  },
}))
