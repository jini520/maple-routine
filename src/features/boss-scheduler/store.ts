import { create } from 'zustand'
import { getMaxPartySize } from '../../lib/boss-crystal-prices'
import { matchBossContent, type MatchedBoss } from '../../lib/boss-matching'
import { syncSchedules, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import {
  getLastSelectedCharacter,
  getTrackedCharacterOcids,
  setLastSelectedCharacter,
  setTrackedCharacterOcids,
} from '../../storage/character-selection'
import { getBossPartySettings, setBossPartySize } from '../../storage/boss-party-settings'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import type { BossDifficulty } from '../../types'
import { compareByName } from '../onboarding/representative-character'

export interface BossCharacterView {
  ocid: string
  characterName: string
  world?: string
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
  // key: `${ocid}:${boss}:${difficulty}` (ADR-019 결정 3) — 맵에 키가 없으면 "미설정"(솔로)을
  // 뜻한다. 이 store는 없는 키를 1로 채워 넣지 않는다 — 그 해석은 UI의 책임이다.
  partySizes: Record<string, number>
}

export interface BossSchedulerStore extends BossSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[], onProgress?: (completed: number, total: number) => void): Promise<void>
  refresh(ocids: string[], onProgress?: (completed: number, total: number) => void): Promise<void>
  selectCharacter(ocid: string): Promise<void>
  loadPartySizes(ocids: string[]): Promise<void>
  setPartySize(ocid: string, boss: string, difficulty: string, partySize: number): Promise<void>
}

const initialState: BossSchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
  selectedOcid: null,
  partySizes: {},
}

export function partySizeKey(ocid: string, boss: string, difficulty: string): string {
  return `${ocid}:${boss}:${difficulty}`
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

  async saveTrackedOcids(ocids, onProgress) {
    await setTrackedCharacterOcids('boss', ocids)
    set({ trackedOcids: ocids })
    await get().refresh(ocids, onProgress)
  },

  async refresh(ocids, onProgress) {
    if (ocids.length === 0) {
      set({ status: 'loaded', characters: [], error: null, partySizes: {} })
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
            world: cached.state.world,
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

    // ADR-019: 파티 설정은 완료 여부·주차와 무관한 상시 데이터라 스케줄 동기화(캐시 우선 표시 →
    // 재검증)와 독립적이다 — 벌크 조회 한 번으로 충분하다. 독립적이므로 조회가 실패해도(예: SQLite
    // 일시 오류) 스케줄 refresh 전체를 중단시키지 않는다 — 그러지 않으면 저장 진행률 모달이 안 닫힌다.
    try {
      await get().loadPartySizes(ocids)
    } catch {
      // 파티 설정 로드 실패는 조용히 넘긴다(스케줄 표시·저장 완료를 막지 않는다)
    }

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids, onProgress)
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
        world: result.world,
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

  async loadPartySizes(ocids) {
    if (ocids.length === 0) {
      set({ partySizes: {} })
      return
    }

    const settings = await getBossPartySettings(ocids)
    const partySizes: Record<string, number> = {}
    for (const setting of settings) {
      partySizes[partySizeKey(setting.ocid, setting.boss, setting.difficulty)] = setting.partySize
    }
    set({ partySizes })
  },

  async setPartySize(ocid, boss, difficulty, partySize) {
    const maxPartySize = getMaxPartySize(boss, difficulty as BossDifficulty)
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > maxPartySize) {
      throw new Error(`setPartySize: 파티원 수는 1 이상 ${maxPartySize} 이하의 정수여야 합니다`)
    }

    await setBossPartySize(ocid, boss, difficulty, partySize, new Date().toISOString())

    set({
      partySizes: { ...get().partySizes, [partySizeKey(ocid, boss, difficulty)]: partySize },
    })
  },
}))
