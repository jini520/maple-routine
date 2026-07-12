import { create } from 'zustand'
import { matchBossContent, type MatchedBoss } from '../../lib/boss-matching'
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
  selectedOcid: string | null
}

export interface BossSchedulerStore extends BossSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[]): Promise<void>
  refresh(ocids: string[]): Promise<void>
  selectCharacter(ocid: string): Promise<void>
}

const initialState: BossSchedulerState = {
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
async function sortByCachedLevel(views: BossCharacterView[]): Promise<BossCharacterView[]> {
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

export const useBossSchedulerStore = create<BossSchedulerStore>()((set, get) => ({
  ...initialState,

  async loadTrackedOcids() {
    const [ocids, selectedOcid] = await Promise.all([
      getTrackedCharacterOcids('boss'),
      getLastSelectedCharacter('boss'),
    ])
    set({ trackedOcids: ocids, selectedOcid })
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

    // ADR-016: 캐시 우선 표시 — 재검증(fetch) 전에 마지막으로 성공한 캐시 값이 있으면
    // 그 값으로 먼저 채워 화면이 비지 않게 한다. 재검증 응답이 오면 그대로 덮어쓴다.
    const cachedCharacters = (
      await Promise.all(
        ocids.map(async (ocid): Promise<BossCharacterView | null> => {
          const cached = await getCachedSchedulerState(ocid)
          if (cached === null) {
            return null
          }
          const bosses = cached.state.bossContents.map(matchBossContent)
          return {
            ocid,
            characterName: cached.state.characterName,
            weeklyBosses: bosses.filter((boss) => boss.cycle === 'weekly'),
            monthlyBosses: bosses.filter((boss) => boss.cycle === 'monthly'),
            weeklyBossClearCount: cached.state.weeklyBossClearCount,
            weeklyBossClearLimitCount: cached.state.weeklyBossClearLimitCount,
            isStale: true,
            syncedAt: cached.syncedAt,
            error: null,
          }
        }),
      )
    ).filter((view): view is BossCharacterView => view !== null)

    set({ status: 'loading', characters: await sortByCachedLevel(cachedCharacters) })

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

    set({ status: 'loaded', characters: await sortByCachedLevel(characters), error: null })
  },

  async selectCharacter(ocid) {
    set({ selectedOcid: ocid })
    await setLastSelectedCharacter('boss', ocid)
  },
}))
