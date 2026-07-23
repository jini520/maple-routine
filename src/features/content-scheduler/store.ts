import { create } from 'zustand'
import { syncSchedules, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import {
  getLastSelectedCharacter,
  getTrackedCharacterOcids,
  setLastSelectedCharacter,
  setTrackedCharacterOcids,
} from '../../storage/character-selection'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import { compareByName } from '../onboarding/representative-character'
import { useToastStore } from '../toast/store'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import type { DailyContent, WeeklyContent } from '../../types'

export interface ContentCharacterView {
  ocid: string
  characterName: string
  world?: string
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
  selectedOcid: string | null
}

export interface ContentSchedulerStore extends ContentSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[], onProgress?: (completed: number, total: number) => void): Promise<void>
  refresh(ocids: string[], onProgress?: (completed: number, total: number) => void): Promise<void>
  selectCharacter(ocid: string): Promise<void>
}

const initialState: ContentSchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
  selectedOcid: null,
}

// ADR-017 결정 2: 캐시 단계(trackedOcids 저장 순서)와 동기화 단계(계정 전체 캐릭터
// 목록에서 필터링한 순서)가 서로 달라 생기던 불일치를 없애기 위해, character-basic-cache의
// level을 병합해 레벨 내림차순(동레벨이면 compareByName)으로 통일한다. 레벨 캐시가 없는
// 캐릭터는 맨 뒤로 보낸다.
async function sortByCachedLevel(views: ContentCharacterView[]): Promise<ContentCharacterView[]> {
  const withLevel = await Promise.all(
    views.map(async (view) => {
      const cached = await getCachedCharacterBasic(view.ocid)
      return { view, level: cached?.profile.level ?? null }
    }),
  )

  return withLevel
    .sort((a, b) => {
      if (a.level === null && b.level === null) {
        return compareByName(a.view.characterName, b.view.characterName)
      }
      if (a.level === null) return 1
      if (b.level === null) return -1
      if (b.level !== a.level) return b.level - a.level
      return compareByName(a.view.characterName, b.view.characterName)
    })
    .map((entry) => entry.view)
}

export const useContentSchedulerStore = create<ContentSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadTrackedOcids() {
    const [ocids, selectedOcid] = await Promise.all([
      getTrackedCharacterOcids('content'),
      getLastSelectedCharacter('content'),
    ])
    set({ trackedOcids: ocids, selectedOcid })
    if (ocids !== null) {
      await get().refresh(ocids)
    }
  },

  async saveTrackedOcids(ocids, onProgress) {
    const previousOcids = get().trackedOcids ?? []
    try {
      await setTrackedCharacterOcids('content', ocids)
    } catch {
      useToastStore.getState().showError('저장하지 못했어요')
      return
    }
    set({ trackedOcids: ocids })

    // ADR-035 결정 14(b): 수동 모드에서 새로 추적 목록에 추가된 캐릭터만 개별 시드한다.
    // refresh보다 먼저 실행 — 화면의 저장 진행률 모달이 saveTrackedOcids 전체를 기다리므로
    // 시드가 끝날 때까지 자연스럽게 로딩이 유지된다(결정 15).
    if (useTrackingModeStore.getState().mode === 'manual') {
      const newOcids = ocids.filter((ocid) => !previousOcids.includes(ocid))
      await Promise.all(newOcids.map((ocid) => seedManualTrackedContent(ocid)))
    }

    await get().refresh(ocids, onProgress)
    useToastStore.getState().showSuccess('캐릭터 정보를 모두 불러왔어요')
  },

  async refresh(ocids, onProgress) {
    if (ocids.length === 0) {
      set({ status: 'loaded', characters: [], error: null })
      return
    }

    // ADR-016: 캐시 우선 표시 — 재검증(fetch) 전에 마지막으로 성공한 캐시 값이 있으면
    // 그 값으로 먼저 채워 화면이 비지 않게 한다. 재검증 응답이 오면 그대로 덮어쓴다.
    const cachedCharacters = (
      await Promise.all(
        ocids.map(async (ocid): Promise<ContentCharacterView | null> => {
          const cached = await getCachedSchedulerState(ocid)
          if (cached === null) {
            return null
          }
          return {
            ocid,
            characterName: cached.state.characterName,
            world: cached.state.world,
            dailyContents: cached.state.dailyContents,
            weeklyContents: cached.state.weeklyContents,
            isStale: true,
            syncedAt: cached.syncedAt,
            error: null,
          }
        }),
      )
    ).filter((view): view is ContentCharacterView => view !== null)

    set({ status: 'loading', characters: await sortByCachedLevel(cachedCharacters) })

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids, onProgress)
    } catch {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패이므로 network로 취급한다.
      set({ status: 'error', error: { kind: 'network' } })
      return
    }

    const characters: ContentCharacterView[] = results.map((result) => ({
      ocid: result.ocid,
      characterName: result.characterName,
      world: result.world,
      dailyContents: result.state?.dailyContents ?? [],
      weeklyContents: result.state?.weeklyContents ?? [],
      isStale: result.isStale,
      syncedAt: result.syncedAt,
      error: result.error,
    }))

    set({ status: 'loaded', characters: await sortByCachedLevel(characters), error: null })
  },

  async selectCharacter(ocid) {
    set({ selectedOcid: ocid })
    await setLastSelectedCharacter('content', ocid)
  },
}))
