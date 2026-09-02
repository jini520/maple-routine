import { create } from 'zustand'
import { getMaxPartySize } from '../../lib/boss/boss-crystal-prices'
import {
  countClearedWeeklyBosses,
  countManualWeeklyBosses,
  getBossCycleByName,
  isSeasonBossName,
  matchBossContent,
  WEEKLY_BOSS_CLEAR_LIMIT,
  type MatchedBoss,
} from '../../lib/boss/boss-matching'
import { syncSchedules, toScheduleSyncError, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { hasSyncAttemptedThisRun } from '../schedule-sync/sync-run-state'
import { isSyncFresh } from '../../lib/scheduler/sync-freshness'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'
import { useCharacterSelectionStore } from '../character-selection/store'
import { getBossPartySettings, setBossPartySize } from '../../storage/boss-party-settings'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import type { BossDifficulty } from '../../types'
import { compareByName } from '../onboarding/representative-character'
import { useToastStore } from '../toast/store'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../../storage/manual-tracked-content'

// ADR-055 결정 1·2: 추가 시도의 결과. 'duplicate'는 이미 같은 (보스, 난이도)를 추적 중이라
// 아무 일도 일어나지 않은 경우이고, 'limitReached'는 주간 12개 한도가 막은 경우다.
export type ManualBossAddResult = 'added' | 'duplicate' | 'limitReached'

export interface BossCharacterView {
  ocid: string
  characterName: string
  world?: string
  // [[ADR-142]] 결정 6: 초상화 레일이 쓰는 둘 — 컨텐츠 스케줄러 뷰와 같은 자리·같은 규약이다
  // (`null` = 캐시가 아직 모름). 정렬이 이미 읽는 캐시에서 함께 꺼내므로 조회가 안 는다.
  level?: number | null
  imageUrl?: string | null
  weeklyBosses: MatchedBoss[]
  monthlyBosses: MatchedBoss[]
  weeklyBossClearCount: number | null
  weeklyBossClearLimitCount: number | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type BossSchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

// ADR-097 결정 4: "강제"가 기본값이고 게이트가 예외다. force 인자를 두면 강제해야 할 호출부를
// 하나라도 빠뜨리는 순간 그 자리가 조용히 게이트에 걸리므로, 자동 진입 경로인 loadTrackedOcids()만
// auto: true 를 넘긴다. 화면(헤더 버튼·당겨서 새로고침·재시도)은 인자를 안 넘겨 자동으로 강제 경로다.
// 컨텐츠 스케줄러 스토어와 같은 이름·같은 모양이다 — 같은 정책이 두 모양으로 존재하면 값을 바꿀 때
// 한쪽만 고치게 된다.
export interface RefreshOptions {
  auto?: boolean
}

// ADR-019 솔로/파티 서브 필터. **목록이 하나라 필터도 하나다**([[ADR-164]] 결정 5).
export type PartyFilter = 'all' | 'solo' | 'party'

export interface BossSchedulerState {
  status: BossSchedulerStatus
  characters: BossCharacterView[]
  error: ScheduleSyncError | null
  trackedOcids: string[] | null
  // key: `${ocid}:${boss}:${difficulty}` (ADR-019 결정 3) — 맵에 키가 없으면 "미설정"(솔로)을
  // 뜻한다. 이 store는 없는 키를 1로 채워 넣지 않는다 — 그 해석은 UI의 책임이다.
  partySizes: Record<string, number>
  // ADR-035: 수동 모드에서 캐릭터별 추적 항목(멤버십). 값 필드는 여기 두지 않고 표시 시점에
  // characters의 동기화 값 또는 참조 테이블에서 조회한다(단일 진실 공급원, 결정 6).
  manualTrackedByOcid: Record<string, ManualTrackedItem[]>
  // 화면 로컬 state가 아니라 스토어가 소유한다 — 화면이 언마운트돼도 살아남는다(탭 이동 후 복귀).
  // 영속화하지 않는다.
  //
  // **`activeTab` 은 여기 없다**([[ADR-164]] 결정 4) — 주간/월간 탭이 두 화면에서 함께 걷혔다.
  // [[ADR-096]] 결정 1·2 와 [[ADR-145]] 결정 2(«승계가 아니라 공유»)가 이 축에서 폐기된 자리다.
  // 되살리지 말 것: 공유할 상대가 없는 공유 상태가 된다. 선택 캐릭터 쪽 공유는 [[ADR-159]] 가
  // 따로 갖고 있어 그대로다.
  //
  // 필터도 하나다([[ADR-164]] 결정 5 — [[ADR-019]] 결정 6 정정). «두 축이 서로 독립» 은 탭이
  // 있을 때만 뜻이 있는 문장이었다.
  partyFilter: PartyFilter
}

export interface BossSchedulerStore extends BossSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[], onProgress?: (completed: number, total: number) => void): Promise<void>
  refresh(
    ocids: string[],
    onProgress?: (completed: number, total: number) => void,
    options?: RefreshOptions,
  ): Promise<void>
  loadPartySizes(ocids: string[]): Promise<void>
  setPartySize(ocid: string, boss: string, difficulty: string, partySize: number): Promise<void>
  addManualBoss(ocid: string, contentName: string, difficulty: string): Promise<ManualBossAddResult>
  removeManualBoss(ocid: string, contentName: string, difficulty: string): Promise<void>
  /**
   * 추적 중인 보스의 난이도를 `to` 로 바꾼다 ([[ADR-121]] 결정 6).
   *
   * `from` 을 받지 않는 것이 의도다 — 호출부는 렌더 시점의 난이도를 넘기게 되는데, 칩을 연달아
   * 누르면 낡은 값이 넘어와 매칭 실패로 변경이 **무음 유실**된다. "이 보스의 난이도를 to 로
   * 만든다"는 명령형이면 그 실패 모드가 없다.
   *
   * 개수가 변하지 않으므로 주간 12개 한도(ADR-055)에 걸리지 않는다 — 반환값이 없는 이유다.
   */
  setManualBossDifficulty(ocid: string, contentName: string, to: string): Promise<void>
  // 필터 전환에 네트워크가 없어 동기 세터다(보스 수익 setTab과 다른 점).
  setPartyFilter(filter: PartyFilter): void
}

const initialState: BossSchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
  partySizes: {},
  manualTrackedByOcid: {},
  partyFilter: 'all',
}

export function partySizeKey(ocid: string, boss: string, difficulty: string): string {
  return `${ocid}:${boss}:${difficulty}`
}

// ADR-101 결정 4: 부팅 선하이드레이션(`features/prehydrate`)과 화면 마운트가 같은 회차를 부르므로,
// 진행 중인 회차가 있으면 그 Promise 를 그대로 돌려준다. **"평생 한 번"이 아니라 "동시에 하나만"**
// 이다 — 끝나면 잊는다. 영구 메모로 만들면 진입 재조회의 10분 TTL([[ADR-097]])이 죽는다.
// `storage/character-selection` 의 `migrationLock` 과 같은 모양·같은 이유(락 없이 겹쳐 돌면 같은
// 응답을 두 번 받는다).
let hydration: Promise<void> | null = null

// ADR-017 결정 2: 캐시 단계(trackedOcids 저장 순서)와 동기화 단계(계정 전체 캐릭터
// 목록에서 필터링한 순서)가 서로 달라 생기던 불일치를 없애기 위해, character-basic-cache의
// level을 병합해 레벨 내림차순(동레벨이면 compareByName)으로 통일한다. 레벨 캐시가 없는
// 캐릭터는 맨 뒤로 보낸다.
// [[ADR-142]] 결정 6: 정렬에 쓰는 level 을 버리지 않고 `imageUrl` 과 함께 뷰에 남긴다 — 초상화
// 레일이 쓴다. 컨텐츠 스케줄러 스토어의 같은 이름 함수와 **같은 모양이어야 한다**(같은 정책이 두
// 모양으로 있으면 값을 바꿀 때 한쪽만 바뀐다).
async function sortByCachedLevel(views: BossCharacterView[]): Promise<BossCharacterView[]> {
  const withLevel = await Promise.all(
    views.map(async (view) => {
      const cached = await getCachedCharacterBasic(view.ocid)
      return { view, level: cached?.profile.level ?? null, imageUrl: cached?.profile.imageUrl ?? null }
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
    .map((entry) => ({ ...entry.view, level: entry.level, imageUrl: entry.imageUrl }))
}

// ADR-043 결정 3: 저장 시점에 유지되는 캐릭터의 뷰가 메모리에 없을 때만 쓰는 폴백 —
// 네트워크(syncSchedules)는 새로 추가된 캐릭터에만 쓰고, 그 외에는 마지막 캐시를 읽는다.
async function readCachedView(ocid: string): Promise<BossCharacterView | null> {
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
    weeklyBossClearCount: countClearedWeeklyBosses(bosses),
    weeklyBossClearLimitCount: WEEKLY_BOSS_CLEAR_LIMIT,
    isStale: true,
    syncedAt: cached.syncedAt,
    error: null,
  }
}

export const useBossSchedulerStore = create<BossSchedulerStore>()((set, get) => ({
  ...initialState,

  loadTrackedOcids() {
    // ADR-101 결정 4: 동시 호출은 한 회차로 합친다(위 `hydration` 주석).
    hydration ??= (async () => {
      // 저장된 선택은 **선택 스토어가 읽는다**([[ADR-159]] 결정 2) — 이 스토어가 읽어 자기
      // 상태에 넣던 것이 «두 벌» 의 출처였다. 둘을 나란히 태우는 것은 그대로다(왕복 한 번).
      const [ocids] = await Promise.all([
        getTrackedCharacterOcids(),
        useCharacterSelectionStore.getState().hydrate(),
      ])
      set({ trackedOcids: ocids })
      if (ocids !== null) {
        // ADR-097 결정 4: 자동 진입 경로는 여기 하나뿐이라 게이트를 놓칠 자리가 생기지 않는다.
        await get().refresh(ocids, undefined, { auto: true })
      }
    })().finally(() => {
      hydration = null
    })
    return hydration
  },

  async saveTrackedOcids(ocids, onProgress) {
    const previousOcids = get().trackedOcids ?? []
    try {
      await setTrackedCharacterOcids(ocids)
    } catch {
      useToastStore.getState().showError('저장하지 못했습니다')
      return
    }
    set({ trackedOcids: ocids })

    // ADR-043 결정 2·3: 저장 시점에는 새로 추가된 캐릭터만 조회한다 — 유지되는 캐릭터는
    // 이미 가진 뷰를 그대로 재사용하고, 제거만 했거나 아무것도 안 바뀌었으면 조회 자체를 하지 않는다.
    const added = ocids.filter((ocid) => !previousOcids.includes(ocid))

    // ADR-035 결정 14(b): 수동 모드에서 새로 추적 목록에 추가된 캐릭터만 개별 시드하고, 그
    // 멤버십을 화면 상태에도 반영한다(동기화가 added만 훑으므로 refresh처럼 전체를 다시 읽지 않는다).
    // 동기화보다 먼저 실행 — 화면의 저장 진행률 모달이 saveTrackedOcids 전체를 기다리므로
    // 시드가 끝날 때까지 자연스럽게 로딩이 유지된다(결정 15).
    if (added.length > 0 && useTrackingModeStore.getState().mode === 'manual') {
      await seedManualTrackedContent(added)
      const seeded = Object.fromEntries(
        await Promise.all(added.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const)),
      )
      set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, ...seeded } }))
    }

    // ADR-019: 파티 설정은 스케줄 동기화와 독립적인 로컬 조회라 위 diff와 무관하게 항상 새 집합
    // 기준으로 다시 채운다 — 그래야 추가된 캐릭터의 설정이 들어오고 제거된 캐릭터의 항목이 빠진다.
    // refresh와 동일하게 실패는 조용히 넘긴다(저장 진행률 모달이 안 닫히는 걸 막는다).
    try {
      await get().loadPartySizes(ocids)
    } catch {
      // 파티 설정 로드 실패는 조용히 넘긴다(스케줄 표시·저장 완료를 막지 않는다)
    }

    if (added.length === 0) {
      // 네트워크 0회 — 이미 가진 뷰에서 빠진 캐릭터만 걷어내면 화면이 정확해진다.
      set({
        status: 'loaded',
        error: null,
        characters: get().characters.filter((character) => ocids.includes(character.ocid)),
      })
    } else {
      set({ status: 'loading' })

      const existingByOcid = new Map(get().characters.map((character) => [character.ocid, character]))
      const keptViews = (
        await Promise.all(
          ocids
            .filter((ocid) => !added.includes(ocid))
            .map(async (ocid) => existingByOcid.get(ocid) ?? (await readCachedView(ocid))),
        )
      ).filter((view): view is BossCharacterView => view != null)

      // .catch(() => null)로 원인을 버리지 않는다 — 아래에서 종류를 살려야 한다([[ADR-063]]).
      const outcome = await syncSchedules(added, onProgress).then(
        (results) => ({ results, error: null as unknown }),
        (error: unknown) => ({ results: null, error }),
      )
      const results = outcome.results
      if (results === null) {
        // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는 캐릭터별 에러가 아니라
        // 전체 조회 자체의 실패다. 원인은 버리지 않고
        // toScheduleSyncError로 살린다([[ADR-063]]) — 전에는 network로 하드코딩해 401/429가 화면에 도달하지 못했다.
        set({ status: 'error', error: toScheduleSyncError(outcome.error), characters: await sortByCachedLevel(keptViews) })
      } else {
        const addedViews: BossCharacterView[] = results.map((result) => {
          const bosses = result.state?.bossContents.map(matchBossContent) ?? []
          return {
            ocid: result.ocid,
            characterName: result.characterName,
            world: result.world,
            weeklyBosses: bosses.filter((boss) => boss.cycle === 'weekly'),
            monthlyBosses: bosses.filter((boss) => boss.cycle === 'monthly'),
            weeklyBossClearCount: result.state === null ? null : countClearedWeeklyBosses(bosses),
            weeklyBossClearLimitCount: result.state === null ? null : WEEKLY_BOSS_CLEAR_LIMIT,
            isStale: result.isStale,
            syncedAt: result.syncedAt,
            error: result.error,
          }
        })
        set({
          status: 'loaded',
          error: null,
          characters: await sortByCachedLevel([...keptViews, ...addedViews]),
        })
      }
    }

    useToastStore.getState().showSuccess('캐릭터 정보를 모두 불러왔어요')
  },

  async refresh(ocids, onProgress, options) {
    if (ocids.length === 0) {
      set({ status: 'loaded', characters: [], error: null, partySizes: {} })
      return
    }

    // ADR-035: 수동 모드에서만 캐릭터별 추적 항목(멤버십)을 읽어둔다 — 표시 목록이 이 멤버십으로
    // 결정되기 때문. auto 모드는 등록 여부로 목록을 결정하므로 불필요한 읽기를 건너뛴다.
    const manualMode = useTrackingModeStore.getState().mode === 'manual'
    const manualTrackedByOcid: Record<string, ManualTrackedItem[]> = manualMode
      ? Object.fromEntries(
          await Promise.all(
            ocids.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const),
          ),
        )
      : {}

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
            weeklyBossClearCount: countClearedWeeklyBosses(bosses),
            weeklyBossClearLimitCount: WEEKLY_BOSS_CLEAR_LIMIT,
            isStale: true,
            syncedAt: cached.syncedAt,
            error: null,
          }
        }),
      )
    ).filter((view): view is BossCharacterView => view !== null)

    // ADR-019: 파티 설정은 완료 여부·주차와 무관한 상시 데이터라 스케줄 동기화(캐시 우선 표시 →
    // 재검증)와 독립적이다 — 벌크 조회 한 번으로 충분하다. 독립적이므로 조회가 실패해도(예: SQLite
    // 일시 오류) 스케줄 refresh 전체를 중단시키지 않는다 — 그러지 않으면 저장 진행률 모달이 안 닫힌다.
    // ADR-097: 아래 TTL 게이트보다 **앞이다** — 로컬 SQLite 조회라 네트워크 TTL 의 대상이 아니고,
    // 함께 건너뛰면 추적 목록이 바뀐 진입에서 파티원 수 배지·솔로/파티 필터가 옛 값으로 남는다.
    try {
      await get().loadPartySizes(ocids)
    } catch {
      // 파티 설정 로드 실패는 조용히 넘긴다(스케줄 표시·저장 완료를 막지 않는다)
    }

    // ADR-097 결정 1~3: 화면 진입 자동 재조회는 데이터가 신선하면 건너뛴다. 판정 근거는 위
    // 캐시 우선 표시 단계가 이미 읽은 syncedAt 이라 저장소를 다시 읽지 않는다(결정 4).
    if (
      options?.auto === true &&
      hasSyncAttemptedThisRun() &&
      isSyncFresh(
        cachedCharacters.map((view) => view.syncedAt),
        ocids.length,
        new Date(),
      )
    ) {
      // set 을 두 번 하지 않는다 — loading 을 거치면 건너뛰는 진입에서 로딩이 한 프레임 번쩍인다.
      // isStale 은 false 다(결정 5): 재검증이 오지 않기로 결정된 값이라 "오래된 데이터"가 아니고,
      // 그 표식을 남기면 탭을 옮길 때마다 스탈 토스트가 뜬다. syncedAt 은 캐시 값 그대로 둔다.
      set({
        status: 'loaded',
        characters: await sortByCachedLevel(
          cachedCharacters.map((view) => ({ ...view, isStale: false })),
        ),
        error: null,
        manualTrackedByOcid,
      })
      return
    }

    set({ status: 'loading', characters: await sortByCachedLevel(cachedCharacters), manualTrackedByOcid })

    let results: Awaited<ReturnType<typeof syncSchedules>>
    try {
      results = await syncSchedules(ocids, onProgress)
    } catch (error) {
      // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는
      // 캐릭터별 에러가 아니라 전체 조회 자체의 실패다.
      // 원인은 toScheduleSyncError로 살린다([[ADR-063]]).
      set({ status: 'error', error: toScheduleSyncError(error) })
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
        weeklyBossClearCount: result.state === null ? null : countClearedWeeklyBosses(bosses),
        weeklyBossClearLimitCount: result.state === null ? null : WEEKLY_BOSS_CLEAR_LIMIT,
        isStale: result.isStale,
        syncedAt: result.syncedAt,
        error: result.error,
      }
    })

    set({ status: 'loaded', characters: await sortByCachedLevel(characters), error: null, manualTrackedByOcid })
  },

  setPartyFilter(filter) {
    set({ partyFilter: filter })
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
    useToastStore.getState().showSuccess('파티원 수를 저장했어요')
  },

  // ADR-035 결정 3·6: 저장소(단일 진실 공급원)에서 현재 배열을 읽어 (보스, 난이도) 멤버십만
  // 추가/삭제하고 다시 저장한 뒤 화면 상태를 갱신한다. 보스는 maxCount 개념이 없어 값 필드를
  // 채우지 않는다(완료 여부는 표시 시점에 동기화 결과에서 조회).
  // ADR-055 결정 2: 한도 초과는 여기서 막고 결과 코드로 알린다 — UI 사전 차단만으로는
  // 난이도 교체(remove → add)·시드 같은 다른 호출 경로가 새어나간다.
  async addManualBoss(ocid, contentName, difficulty) {
    const current = await getManualTrackedContent(ocid)
    if (
      current.some(
        (item) => item.kind === 'boss' && item.contentName === contentName && item.difficulty === difficulty,
      )
    ) {
      return 'duplicate'
    }

    // 결정 3: 한도는 주간 보스에만 걸린다 — 시즌 보스·월간 보스는 카운트에도, 이 검사에도 들어가지 않는다.
    const countsTowardWeeklyLimit =
      getBossCycleByName(contentName) === 'weekly' && !isSeasonBossName(contentName)
    if (countsTowardWeeklyLimit && countManualWeeklyBosses(current) >= WEEKLY_BOSS_CLEAR_LIMIT) {
      return 'limitReached'
    }

    const next: ManualTrackedItem[] = [...current, { contentName, kind: 'boss', difficulty }]
    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
    return 'added'
  },

  // ADR-121 결정 6: 읽기 → 배열 계산 → **쓰기 1회**. 전에는 화면이 removeManualBoss →
  // addManualBoss 를 이어 불렀는데, 두 액션이 각자 커밋해 **첫 커밋 직후 "그 보스가 목록에 없는"
  // 상태가 저장소에 실재**했다. 거기서 두 번째가 실패하거나 앱이 죽으면 보스가 통째로 사라진다.
  // Preferences 는 키 하나에 배열 전체를 덮어쓰므로 set 한 번이 이미 원자적이다 — 필요한 것은
  // 트랜잭션이 아니라 커밋을 1회로 줄이는 것이다.
  //
  // 쓰기 앞은 순수 계산뿐이고 메모리 갱신은 쓰기 뒤라, 던지면 저장소도 스토어도 원래대로다
  // (호출부에 롤백 코드가 필요 없다).
  async setManualBossDifficulty(ocid, contentName, to) {
    const current = await getManualTrackedContent(ocid)

    // 같은 보스가 두 난이도로 저장돼 있었다면(스토어가 금지하지는 않는다) 하나로 수렴시킨다.
    let replaced = false
    const next = current.flatMap((item): ManualTrackedItem[] => {
      if (item.kind !== 'boss' || item.contentName !== contentName) return [item]
      if (replaced) return []
      replaced = true
      return [{ ...item, difficulty: to }]
    })

    // 추적 중이 아니면 쓸 것이 없다 — 빈 쓰기로 저장소를 건드리지 않는다.
    if (!replaced) return

    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
  },

  async removeManualBoss(ocid, contentName, difficulty) {
    const current = await getManualTrackedContent(ocid)
    const next = current.filter(
      (item) =>
        !(item.kind === 'boss' && item.contentName === contentName && item.difficulty === difficulty),
    )
    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
  },
}))
