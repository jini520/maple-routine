import { create } from 'zustand'
import { syncSchedules, toScheduleSyncError, type ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { hasSyncAttemptedThisRun } from '../schedule-sync/sync-run-state'
import { isSyncFresh } from '../../lib/scheduler/sync-freshness'
import { getTrackedCharacterOcids, setTrackedCharacterOcids } from '../../storage/character-selection'
import { useCharacterSelectionStore } from '../character-selection/store'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import { compareByName } from '../onboarding/representative-character'
import { useToastStore } from '../toast/store'
import { seedManualTrackedContent } from '../tracking-mode/seed'
import { useTrackingModeStore } from '../tracking-mode/store'
import {
  getManualTrackedContent,
  setManualTrackedContent,
  type ManualTrackedItem,
} from '../../storage/manual-tracked-content'
import { isGuildContent } from '../../lib/scheduler/content-category'
import type { SchedulerContentTemplateEntry } from '../../lib/scheduler/manual-content-merge'
import schedulerContentTemplate from '../../data/scheduler-content-template.json'
import type { DailyContent, WeeklyContent } from '../../types'

const contentTemplate = schedulerContentTemplate as {
  daily: SchedulerContentTemplateEntry[]
  weekly: SchedulerContentTemplateEntry[]
}

// 수동 추적 항목에 저장할 max_count는 템플릿 파일의 확정값을 그대로 복사한다
// (사용자가 숫자를 입력하는 UI는 없다). 템플릿에 없는 항목이면 undefined(카운트 표기 없음).
function templateMaxCount(contentName: string): number | undefined {
  const entry = [...contentTemplate.daily, ...contentTemplate.weekly].find(
    (candidate) => candidate.content_name === contentName,
  )
  return entry?.max_count
}

// 추가 시도의 결과. 컨텐츠에는 개수 한도가 없어 보스와 달리 limitReached 가 없고, 대신 길드
// 콘텐츠 전용 사유 guildRequired 가 있다.
export type ManualContentAddResult = 'added' | 'duplicate' | 'guildRequired'

export interface ContentCharacterView {
  ocid: string
  characterName: string
  world?: string
  // 같은 캐시에서 함께 꺼내는 길드명. null = 미가입(길드 콘텐츠 잠금 근거),
  // undefined = 모름(잠그지 않음).
  guildName?: string | null
  // 초상화 레일이 쓰는 둘. 같은 캐시에서 정렬과 함께 꺼내므로 조회가 안 는다. `null` 은 캐시가
  // 아직 그 캐릭터를 모른다는 뜻이다. 레일은 그때 레벨 호를 비운다.
  level?: number | null
  imageUrl?: string | null
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type ContentSchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

// 강제가 기본값이고 게이트가 예외다. force 인자를 두면 강제해야 할 호출부를 하나라도 빠뜨리는
// 순간 그 자리가 조용히 게이트에 걸리므로, 자동 진입 경로인 loadTrackedOcids() 만 auto: true 를
// 넘긴다. 화면은 인자를 안 넘겨 자동으로 강제 경로다.
export interface RefreshOptions {
  auto?: boolean
}

// 스케줄러 화면과 관리 페이지가 함께 쓰는 탭 식별자. 두 화면이 각자 선언하면 그 복제가 각자
// 판단해도 된다 처럼 보인다.
export type ContentTab = 'daily' | 'weekly'

export interface ContentSchedulerState {
  status: ContentSchedulerStatus
  characters: ContentCharacterView[]
  error: ScheduleSyncError | null
  trackedOcids: string[] | null
  // 수동 모드에서 캐릭터별 추적 항목(멤버십). 값 필드는 여기 두지 않고 표시 시점에 characters 의
  // 동기화 값 또는 템플릿에서 조회한다.
  manualTrackedByOcid: Record<string, ManualTrackedItem[]>
  // 화면 로컬 state 가 아니라 스토어가 소유한다. 화면이 언마운트돼도 살아남고, 관리 페이지가
  // 같은 값을 읽어 보던 탭 그대로 열린다. 영속화하지 않는다. 앱을 다시 켜면 기본값으로 돌아온다.
  activeTab: ContentTab
}

export interface ContentSchedulerStore extends ContentSchedulerState {
  loadTrackedOcids(): Promise<void>
  saveTrackedOcids(ocids: string[], onProgress?: (completed: number, total: number) => void): Promise<void>
  refresh(
    ocids: string[],
    onProgress?: (completed: number, total: number) => void,
    options?: RefreshOptions,
  ): Promise<void>
  addManualContent(ocid: string, contentName: string, kind: 'daily' | 'weekly'): Promise<ManualContentAddResult>
  removeManualContent(ocid: string, contentName: string, kind: 'daily' | 'weekly'): Promise<void>
  // 보스 수익의 setTab 과 달리 동기다. 그쪽은 탭이 바뀌면 기간을 다시 불러와야 하지만 여기 탭은
  // 이미 받아 둔 데이터를 갈라 보여줄 뿐이라 네트워크가 없다.
  setActiveTab(tab: ContentTab): void
}

const initialState: ContentSchedulerState = {
  status: 'idle',
  characters: [],
  error: null,
  trackedOcids: null,
  manualTrackedByOcid: {},
  activeTab: 'daily',
}

// 캐시 단계(trackedOcids 저장 순서)와 동기화 단계(계정 전체 캐릭터 목록에서 필터링한 순서)가
// 서로 달라 생기던 불일치를 없애기 위해, character-basic-cache 의 level 을 병합해 레벨
// 내림차순(동레벨이면 compareByName)으로 통일한다. 레벨 캐시가 없는 캐릭터는 맨 뒤로 보낸다.
//
// 길드명·`level`·`imageUrl` 도 여기서 함께 꺼내 뷰에 실어 보낸다. 정렬을 위해 이미 읽는 캐시
// 객체 안에 있어 추가 조회가 0 이고, 화면이 character-basic-cache 를 다시 읽을 이유가 없다.
async function sortByCachedLevel(views: ContentCharacterView[]): Promise<ContentCharacterView[]> {
  const withLevel = await Promise.all(
    views.map(async (view) => {
      const cached = await getCachedCharacterBasic(view.ocid)
      return {
        view,
        level: cached?.profile.level ?? null,
        guildName: cached?.profile.guildName,
        imageUrl: cached?.profile.imageUrl ?? null,
      }
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
    .map((entry) => ({
      ...entry.view,
      guildName: entry.guildName,
      level: entry.level,
      imageUrl: entry.imageUrl,
    }))
}

// 저장 시점에 유지되는 캐릭터의 뷰가 메모리에 없을 때만 쓰는 폴백.
// 네트워크(syncSchedules)는 새로 추가된 캐릭터에만 쓰고, 그 외에는 마지막 캐시를 읽는다.
async function readCachedView(ocid: string): Promise<ContentCharacterView | null> {
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
}

// 부팅 선하이드레이션과 화면 마운트가 같은 회차를 부르므로, 진행 중인 회차가 있으면 그 Promise 를
// 그대로 돌려준다. 평생 한 번이 아니라 동시에 하나만이다. 끝나면 잊는다. 영구 메모로 만들면
// 진입 재조회의 10분 TTL 이 죽는다.
let hydration: Promise<void> | null = null

export const useContentSchedulerStore = create<ContentSchedulerStore>()((set, get) => ({
  ...initialState,

  loadTrackedOcids() {
    // 동시 호출은 한 회차로 합친다(위 `hydration` 주석).
    hydration ??= (async () => {
      // 저장된 선택은 선택 스토어가 읽는다. 이 스토어가 읽어 자기 상태에 넣으면 출처가 두 벌이
      // 된다. 둘을 나란히 태우는 것은 그대로다(왕복 한 번).
      const [ocids] = await Promise.all([
        getTrackedCharacterOcids(),
        useCharacterSelectionStore.getState().hydrate(),
      ])
      set({ trackedOcids: ocids })
      if (ocids !== null) {
        // 자동 진입 경로는 여기 하나뿐이라 게이트를 놓칠 자리가 생기지 않는다.
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

    // 저장 시점에는 새로 추가된 캐릭터만 조회한다. 유지되는 캐릭터는
    // 이미 가진 뷰를 그대로 재사용하고, 제거만 했거나 아무것도 안 바뀌었으면 조회 자체를 하지 않는다.
    const added = ocids.filter((ocid) => !previousOcids.includes(ocid))

    // 수동 모드에서 새로 추적 목록에 추가된 캐릭터만 개별 시드하고 그 멤버십을 화면 상태에도
    // 반영한다. 동기화보다 먼저 실행한다. 화면의 저장 진행률 모달이 saveTrackedOcids 전체를
    // 기다리므로 시드가 끝날 때까지 자연스럽게 로딩이 유지된다.
    if (added.length > 0 && useTrackingModeStore.getState().mode === 'manual') {
      await seedManualTrackedContent(added)
      const seeded = Object.fromEntries(
        await Promise.all(added.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const)),
      )
      set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, ...seeded } }))
    }

    if (added.length === 0) {
      // 네트워크 0회. 이미 가진 뷰에서 빠진 캐릭터만 걷어내면 화면이 정확해진다.
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
      ).filter((view): view is ContentCharacterView => view != null)

      // .catch(() => null)로 원인을 버리지 않는다. 아래에서 종류를 살려야 한다.
      const outcome = await syncSchedules(added, onProgress).then(
        (results) => ({ results, error: null as unknown }),
        (error: unknown) => ({ results: null, error }),
      )
      const results = outcome.results
      if (results === null) {
        // syncSchedules 자체가 던지는 에러(온보딩 미완료 등)는 캐릭터별 에러가 아니라 전체 조회
        // 자체의 실패다. 원인은 버리지 않고 toScheduleSyncError 로 살린다.
        set({ status: 'error', error: toScheduleSyncError(outcome.error), characters: await sortByCachedLevel(keptViews) })
      } else {
        const addedViews: ContentCharacterView[] = results.map((result) => ({
          ocid: result.ocid,
          characterName: result.characterName,
          world: result.world,
          dailyContents: result.state?.dailyContents ?? [],
          weeklyContents: result.state?.weeklyContents ?? [],
          isStale: result.isStale,
          syncedAt: result.syncedAt,
          error: result.error,
        }))
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
      set({ status: 'loaded', characters: [], error: null })
      return
    }

    // 수동 모드에서만 캐릭터별 추적 항목(멤버십)을 읽어둔다. 표시 목록이 이 멤버십으로
    // 결정되기 때문. auto 모드는 등록 여부로 목록을 결정하므로 불필요한 읽기를 건너뛴다.
    const manualMode = useTrackingModeStore.getState().mode === 'manual'
    const manualTrackedByOcid: Record<string, ManualTrackedItem[]> = manualMode
      ? Object.fromEntries(
          await Promise.all(
            ocids.map(async (ocid) => [ocid, await getManualTrackedContent(ocid)] as const),
          ),
        )
      : {}

    // 캐시 우선 표시. 재검증(fetch) 전에 마지막으로 성공한 캐시 값이 있으면
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

    // 화면 진입 자동 재조회는 데이터가 신선하면 건너뛴다. 판정 근거는 바로 위 캐시 우선 표시
    // 단계가 이미 읽은 syncedAt 이라 저장소를 다시 읽지 않는다.
    if (
      options?.auto === true &&
      hasSyncAttemptedThisRun() &&
      isSyncFresh(
        cachedCharacters.map((view) => view.syncedAt),
        ocids.length,
        new Date(),
      )
    ) {
      // set 을 두 번 하지 않는다. loading 을 거치면 건너뛰는 진입에서 로딩이 한 프레임 번쩍인다.
      // isStale 은 false 다. 재검증이 오지 않기로 결정된 값이라 오래된 데이터가 아니고, 그 표식을
      // 남기면 탭을 옮길 때마다 스탈 토스트가 뜬다. syncedAt 은 캐시 값 그대로 둔다.
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
      // 원인은 toScheduleSyncError로 살린다.
      set({ status: 'error', error: toScheduleSyncError(error) })
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

    set({ status: 'loaded', characters: await sortByCachedLevel(characters), error: null, manualTrackedByOcid })
  },

  setActiveTab(tab) {
    set({ activeTab: tab })
  },

  // 저장소(단일 진실 공급원)에서 현재 배열을 읽어 멤버십만 추가·삭제하고 다시 저장한 뒤 화면
  // 상태를 갱신한다. 값 필드는 저장하지 않는다. kind 는 호출부가 확정해 넘긴다. 선택 불가
  // 항목은 여기서 막는다. UI 사전 차단만으로는 다른 호출 경로가 샌다.
  async addManualContent(ocid, contentName, kind) {
    const view = get().characters.find((character) => character.ocid === ocid)

    // 길드 콘텐츠는 길드에 가입한 캐릭터만 진행할 수 있다. guildName이 null일 때만
    // 막는다. undefined는 "미가입"이 아니라 "모름"이라 잠그면 안 된다(같은 이유로 뷰가 없어도 통과).
    if (view?.guildName === null && isGuildContent(contentName)) {
      return 'guildRequired'
    }

    const current = await getManualTrackedContent(ocid)
    if (current.some((item) => item.kind === kind && item.contentName === contentName)) {
      return 'duplicate'
    }
    const next: ManualTrackedItem[] = [
      ...current,
      { contentName, kind, maxCount: templateMaxCount(contentName) },
    ]
    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
    return 'added'
  },

  async removeManualContent(ocid, contentName, kind) {
    const current = await getManualTrackedContent(ocid)
    const next = current.filter((item) => !(item.kind === kind && item.contentName === contentName))
    await setManualTrackedContent(ocid, next)
    set((state) => ({ manualTrackedByOcid: { ...state.manualTrackedByOcid, [ocid]: next } }))
  },
}))
