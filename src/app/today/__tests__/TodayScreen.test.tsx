// 첫 화면 `today`의 **배선**.
//
// 이 화면에는 판정이 한 줄도 없다. 조립은 `view-model.ts`(그 테스트), 그림은 위젯마다(각자의
// 테스트), 좌표는 `WidgetGrid`(그 테스트)가 이미 본다. 그래서 여기서 묻는 것은 넷뿐이다.
//
// ① **어느 문으로 조회하는가**. 진입은 포커스에 만료된 회차만 다시 받는 `useRefetchStaleOnFocus` 이고,
//    신선해도 받는 `refreshSchedules` 는 진입에서 부르지 않는다.
//    **신선도 자체는 여기서 못 본다**. 그것은 쿼리의 `staleTime` 계약이라 `schedule-query.spec.ts` 가 지킨다.
//    화면이 보장할 수 있는 것은 **어느 문을 쓰는가** 이고, 그 문이 바뀌면 TTL 이 통째로 사라진다.
// ② **당김과 헤더 버튼이 같은 재조회인가**.
// ③ **캐시가 비어도 서는가**. 콜드 스타트에 위젯이 전부 빈 상태로 선다.
// ④ **캐릭터 넷의 기본 배치**(스냅샷). 헤더 + 격자가 실제 값 위에서 함께 그려지는 것은 여기뿐이다.
import { act, fireEvent, screen, within } from '@testing-library/react-native'

import { useDropHistoryStore } from '../../../features/boss-profit/drop-history-store'
import { useSettlementStore } from '../../../features/settlement/store'
import { useBossProfitStore, type BossProfitRow } from '../../../features/boss-profit/store'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import { useBossSchedule, type BossSchedule } from '../../../features/boss-scheduler/use-boss-schedule'
import { useCharacterSelectionStore } from '../../../features/character-selection/store'
import { useContentSchedulerStore, type ContentCharacterView } from '../../../features/content-scheduler/store'
import { useContentSchedule, type ContentSchedule } from '../../../features/content-scheduler/use-content-schedule'
import { queryKeys } from '../../../features/query/keys'
import { useResetBoundaryTick } from '../../../features/query/reset-timer'
import { useDataFreshness } from '../../../features/refresh/freshness'
import { refreshSchedules } from '../../../features/schedule-sync/schedule-query'
import { useCharacterProfiles } from '../../../features/schedule-sync/use-schedule-queries'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { loadStatsDaysBetween } from '../../../features/stats/load'
import type { MatchedBoss } from '../../../lib/boss/boss-matching'
import type { DropHistoryPeriodGroup, DropHistoryRecord } from '../../../lib/drop/drop-history'
import {
  getLastSelectedCharacter,
  getRepresentativeCharacter,
  setRepresentativeCharacter,
} from '../../../storage/character-selection'
import type { CharacterBasicProfile, DailyContent, WeeklyContent } from '../../../types'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { useRefetchStaleOnFocus } from '../../../hooks/useRefetchStaleOnFocus'
import { useScreenNavigation } from '../../../hooks/useScreenNavigation'
import { TodayScreen } from '../TodayScreen'

// 스케줄과 프로필은 쿼리 캐시에서 온다. 이 하네스에는 쿼리 클라이언트가 없어 캐시를 보는 훅 셋과, 신선해도
// 받는 `refreshSchedules` 를 세운다. 포커스의 만료 재조회도 훅이라 무엇으로 불렸는가만 본다.
jest.mock('../../../features/content-scheduler/use-content-schedule', () => ({ useContentSchedule: jest.fn() }))
jest.mock('../../../features/boss-scheduler/use-boss-schedule', () => ({ useBossSchedule: jest.fn() }))
// `useScheduleQueries` 는 로딩 모달이 캐시가 비었는지 볼 때만 쓴다. 이 스위트는 모달을 띄우지 않으므로 찬 캐시로 둔다.
jest.mock('../../../features/schedule-sync/use-schedule-queries', () => ({
  useCharacterProfiles: jest.fn(),
  useScheduleQueries: () => ({
    status: 'loaded',
    error: null,
    trackedOcids: [],
    snapshot: { ocids: [], schedules: new Map(), basics: new Map(), round: undefined },
  }),
}))
jest.mock('../../../features/schedule-sync/schedule-query', () => ({ refreshSchedules: jest.fn() }))
jest.mock('../../../hooks/useRefetchStaleOnFocus', () => ({ useRefetchStaleOnFocus: jest.fn() }))
// **훅만 갈아끼우고 나머지는 실물을 남긴다.** 스토어 모듈은 훅 말고도 순수 헬퍼를 내보내는데
// (`dropRowKey`·`partySizeKey`) 그것을 이 화면이 아니라 **뷰모델이 부르는 계산기**가 쓴다.
// 통째로 목으로 덮으면 그 헬퍼가 `undefined` 가 되어 조립이 렌더 도중 죽는다(실제로 그렇게 갔다).
jest.mock('../../../features/content-scheduler/store', () => ({
  ...jest.requireActual('../../../features/content-scheduler/store'),
  useContentSchedulerStore: jest.fn() }))
jest.mock('../../../features/boss-scheduler/store', () => ({
  ...jest.requireActual('../../../features/boss-scheduler/store'),
  useBossSchedulerStore: jest.fn() }))
jest.mock('../../../features/boss-profit/store', () => ({
  ...jest.requireActual('../../../features/boss-profit/store'),
  useBossProfitStore: jest.fn() }))
// `useFocusEffect` 는 내비게이션 컨텍스트를 요구한다. 이 하네스는 화면 하나만 띄우므로
// **포커스를 이펙트로 흉내 낸다**(마운트 = 첫 포커스, 실제 동작과 같은 순서다).
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const react = require('react') as typeof import('react')
    react.useEffect(callback, [callback])
  } }))
jest.mock('../../../features/boss-profit/drop-history-store', () => ({
  ...jest.requireActual('../../../features/boss-profit/drop-history-store'),
  useDropHistoryStore: jest.fn() }))
// 대표 표식은 선택 스토어가 든다. 스토어는 실물이고 그 밑의 저장소만 막는다. 포트가 주입되지 않은
// 이 하네스에서 실물 저장소를 부르면 던진다.
jest.mock('../../../storage/character-selection', () => ({
  ...jest.requireActual('../../../storage/character-selection'),
  getLastSelectedCharacter: jest.fn(),
  getRepresentativeCharacter: jest.fn(),
  setRepresentativeCharacter: jest.fn() }))
jest.mock('../../../hooks/useScreenNavigation', () => ({ useScreenNavigation: jest.fn() }))
// 이번 주 수익이 읽는 가계부 기록. 그 주만 읽는가를 이 화면에서 본다.
jest.mock('../../../features/stats/load', () => ({
  ...jest.requireActual('../../../features/stats/load'),
  loadStatsDaysBetween: jest.fn().mockResolvedValue({}),
}))
// 새로고침이 공지 배너의 서버 조회를 함께 탄다. 안 막으면 이 스위트가 실제 망으로 나간다.
// 배너 자체의 동작은 `NoticeBanner.test.tsx` 와 `banner-store.spec.ts` 가 본다.
jest.mock('../../../server/notices', () => ({
  __esModule: true,
  fetchNotices: jest.fn(async () => []),
  fetchNotice: jest.fn(async () => null) }))
// 결산 안내 줄도 같은 이유로 막는다. 줄 자체의 동작은 `SettlementBanner.test.tsx` 가 본다.
jest.mock('../../../server/settlement', () => ({
  __esModule: true,
  fetchSettlement: jest.fn(async () => null) }))

const mockedContent = jest.mocked(useContentSchedule)
const mockedBoss = jest.mocked(useBossSchedule)
const mockedProfiles = jest.mocked(useCharacterProfiles)
const mockedRefreshSchedules = jest.mocked(refreshSchedules)
const mockedRefetchStaleOnFocus = jest.mocked(useRefetchStaleOnFocus)
const mockedContentStore = jest.mocked(useContentSchedulerStore)
const mockedBossStore = jest.mocked(useBossSchedulerStore)
const mockedProfit = jest.mocked(useBossProfitStore)
const mockedDropHistory = jest.mocked(useDropHistoryStore)
const mockedGetRepresentative = jest.mocked(getRepresentativeCharacter)
const mockedGetLastSelected = jest.mocked(getLastSelectedCharacter)
const mockedSetRepresentative = jest.mocked(setRepresentativeCharacter)
const mockedNavigation = jest.mocked(useScreenNavigation)

// 2026-08-17(월) 12:00 KST. `view-model.test.ts` 와 같은 시각이라 주간 기간 키가 2026-08-13 이다.
// 시각을 고정하지 않으면 초기화 카운트다운이 회차마다 달라 스냅샷이 못 선다.
const NOW = new Date('2026-08-17T03:00:00.000Z')
const WEEK_KEY = '2026-08-13'
const OCIDS = ['ocid-1', 'ocid-2', 'ocid-3', 'ocid-4']

// 훅 · 스토어 목
//
// 스케줄 훅 둘은 캐시의 캐릭터 뷰를, 스토어 둘은 기기 값(수동 추적 · 직접 완료)을 낸다. 전부 **상태 + 함수** 를
// 그대로 돌려주면 된다. 이 화면은 셀렉터를 쓰지 않고 상태를 통째로 읽는다.

interface StoreMocks {
  bossStore: { reloadManualCompleted: jest.Mock }
  profit: { loadTrackedOcids: jest.Mock; refresh: jest.Mock }
  dropHistory: { load: jest.Mock }
}

let mocks: StoreMocks

function setStores(
  overrides: {
    content?: Partial<ContentSchedule>
    boss?: Partial<BossSchedule>
    contentStore?: Record<string, unknown>
    bossStore?: Record<string, unknown>
    profit?: Record<string, unknown>
    dropHistory?: Record<string, unknown>
  } = {},
): void {
  mockedContent.mockReturnValue({
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: null,
    refresh: jest.fn(),
    ...overrides.content })

  mockedBoss.mockReturnValue({
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: null,
    refresh: jest.fn(),
    ...overrides.boss })

  mockedContentStore.mockReturnValue({
    manualTrackedByOcid: {},
    activeTab: 'daily',
    ...overrides.contentStore } as never)

  mockedBossStore.mockReturnValue({
    partySizes: {},
    partyShares: {},
    manualTrackedByOcid: {},
    manualCompletedByOcid: {},
    manualCompletedStamp: null,
    partyFilter: 'all',
    reloadManualCompleted: mocks.bossStore.reloadManualCompleted,
    ...overrides.bossStore } as never)

  mockedProfit.mockReturnValue({
    status: 'loaded',
    tab: 'weekly',
    periodKey: WEEK_KEY,
    rows: [],
    // 이 화면이 읽는 것은 **이번 주** 다. `rows`(보고 있는 탭·기간)가 아니다.
    currentWeekRows: [],
    loadedTab: 'weekly',
    loadedPeriodKey: WEEK_KEY,
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodState: 'ready',
    canGoPreviousPeriod: false,
    error: null,
    staleCharacterNames: [],
    characterIssues: {},
    trackedOcids: null,
    loadTrackedOcids: mocks.profit.loadTrackedOcids,
    refresh: mocks.profit.refresh,
    ...overrides.profit } as never)

  mockedDropHistory.mockReturnValue({
    status: 'ready',
    groups: [],
    drought: null,
    charactersByOcid: {},
    load: mocks.dropHistory.load,
    ...overrides.dropHistory } as never)
}

// 값 픽스처

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    contentKey: 'daily_quest_lacheln',
    apiName: '[일일 퀘스트] 레헬른의 평온한 밤',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides }
}

function weekly(overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return {
    contentKey: 'weekly_quest_critias',
    apiName: '[주간 퀘스트] 크리티아스 주간 임무',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides }
}

function matchedBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    bossKey: 'lotus',
    apiName: '스우',
    difficulty: 'normal',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    portraitSlug: null,
    isSeasonBoss: false,
    ...overrides }
}

function contentView(ocid: string, index: number): ContentCharacterView {
  return {
    ocid,
    characterName: `캐릭터${index}`,
    // 캐릭터마다 남은 개수가 달라야 정렬(남은 개수 많은 순)이 스냅샷에 드러난다.
    dailyContents: [daily(), daily({ contentKey: 'monster_park', apiName: '몬스터파크', questState: index % 2 === 0 ? 2 : 0 })],
    weeklyContents: [weekly({ questState: index % 2 === 0 ? 2 : 0 })],
    isStale: false,
    syncedAt: NOW.toISOString(),
    error: null }
}

function bossView(ocid: string, index: number): BossCharacterView {
  return {
    ocid,
    characterName: `캐릭터${index}`,
    weeklyBosses: [matchedBoss({ isComplete: index % 2 === 0 }), matchedBoss({ bossKey: 'damien', apiName: '데미안' })],
    monthlyBosses: [matchedBoss({ bossKey: 'black_mage', apiName: '검은 마법사', cycle: 'monthly' })],
    weeklyBossClearCount: index,
    weeklyBossClearLimitCount: 12,
    isStale: false,
    syncedAt: NOW.toISOString(),
    error: null }
}

function profitRow(ocid: string, index: number): BossProfitRow {
  return {
    ocid,
    characterName: `캐릭터${index}`,
    imageUrl: null,
    world: '스카니아',
    worldKey: 'scania',
    bossKey: 'lotus',
    bossName: '스우',
    difficulty: 'normal',
    cycle: 'weekly',
    periodKey: WEEK_KEY,
    periodLabel: '이번 주',
    priceMeso: 1_000_000 * index,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 1_000_000 * index,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true, defeatedOn: null, source: 'auto' }
}

function dropRecord(overrides: Partial<DropHistoryRecord> = {}): DropHistoryRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'normal',
    periodKey: WEEK_KEY,
    dropRecordId: null,
    category: 'equipment',
    itemKey: null,
    itemName: '가디언 엔젤링',
    quantity: 1,
    ...overrides }
}

const 캐릭터_넷 = {
  content: {
    trackedOcids: OCIDS,
    characters: OCIDS.map((ocid, index) => contentView(ocid, index + 1)) },
  boss: {
    trackedOcids: OCIDS,
    characters: OCIDS.map((ocid, index) => bossView(ocid, index + 1)) },
  profit: {
    trackedOcids: OCIDS,
    // 주간 탭·현재 기간에서는 둘이 **같은 배열**이다(스토어가 한 번 자른다).
    rows: OCIDS.map((ocid, index) => profitRow(ocid, index + 1)),
    currentWeekRows: OCIDS.map((ocid, index) => profitRow(ocid, index + 1)) },
  dropHistory: {
    groups: [
      {
        periodKey: WEEK_KEY,
        cycle: 'weekly',
        records: [
          dropRecord({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 1 }),
          dropRecord({ itemKey: 'life_whetstone', itemName: '생명의 연마석', dropRecordId: null,
          category: 'consumable' }),
        ] },
    ] satisfies DropHistoryPeriodGroup[],
    drought: {
      periodKey: WEEK_KEY,
      cycle: 'weekly' as const,
      weeksSince: 0,
      records: [dropRecord({ priceState: 'entered', priceMeso: 1_200_000_000 })] } } }

/** 캐릭터마다 이름과 얼굴이 다른 프로필. 대표 카드와 머리 버튼이 누구를 그리는지 가를 수 있다. */
function profileOf(ocid: string): CharacterBasicProfile {
  const index = OCIDS.indexOf(ocid) + 1
  return {
    name: `캐릭터${index}`,
    level: 280 + index,
    imageUrl: `https://example.com/${index}.png`,
    accessFlag: true,
    world: '스카니아',
    expRate: 10 }
}

/** 추적 캐릭터 넷의 프로필. `useCharacterProfiles` 가 캐시에서 내는 모양 그대로다. */
const 프로필_넷: Record<string, CharacterBasicProfile> = Object.fromEntries(OCIDS.map((ocid) => [ocid, profileOf(ocid)]))

// 도우미

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function renderScreen(): Promise<Rendered> {
  // **`await` 가 계약이다**. RNTL 14 의 `render` 는 비동기다. 안 기다리면 아래 `act` 가 마운트보다
  // 먼저 돌아 **아무것도 안 그려졌는데 초록** 인 테스트가 된다(실제로 그렇게 한 번 갔다).
  const view = await renderOverlay(<TodayScreen />)
  // 드롭 기록 · 가계부 기록은 비동기 효과가 채운다. 한 번 흘려보내야 위젯이 값 위에 선다.
  await act(async () => {})
  return view
}

/** 스크롤 셸에 붙은 당겨서 새로고침 컨트롤. 스케줄러 테스트와 같은 자리다. */
function refreshControl(): { refreshing: boolean; onRefresh: () => void } {
  return screen.getByTestId('screen-scroll').props.refreshControl.props
}

beforeAll(() => {
  jest.useFakeTimers({ now: NOW })
})

afterAll(() => {
  jest.useRealTimers()
})

beforeEach(() => {
  mocks = {
    // 실물은 셋 다 `Promise` 다. 당김 훅이 `allSettled` 로 넷의 **끝** 을 기다린다.
    bossStore: { reloadManualCompleted: jest.fn().mockResolvedValue(undefined) },
    profit: { loadTrackedOcids: jest.fn(), refresh: jest.fn().mockResolvedValue(undefined) },
    dropHistory: { load: jest.fn().mockResolvedValue(undefined) } }
  // 모듈 목은 테스트 사이에 호출 기록이 남는다. 세는 둘만 비운다.
  mockedRefreshSchedules.mockClear().mockResolvedValue(undefined)
  mockedRefetchStaleOnFocus.mockClear()
  mockedProfiles.mockReturnValue({})
  mockedGetRepresentative.mockResolvedValue(null)
  mockedGetLastSelected.mockResolvedValue(null)
  mockedSetRepresentative.mockResolvedValue(undefined)
  // 스토어는 모듈 수명이라 앞 테스트가 쓴 대표가 남는다.
  useCharacterSelectionStore.setState({
    selectedOcid: null,
    representativeOcid: null,
    isRepresentativeHydrated: false })
  mockedNavigation.mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() } as never)
  useTrackingModeStore.setState({ mode: 'auto' })
  useDataFreshness.setState({ fetchedAt: null })
  setStores()
})

describe('TodayScreen: 진입 조회', () => {
  // 이 화면은 탭이라 계속 살아 있고 마운트의 자동 조회는 한 번뿐이다. 돌아올 때는 만료된 회차만 다시 받는다.
  // 그 회차 하나를 컨텐츠 · 보스 · 프로필이 함께 본다.
  it('진입은 포커스에 만료된 스케줄 회차만 다시 받는다', async () => {
    await renderScreen()

    expect(mockedRefetchStaleOnFocus).toHaveBeenCalledWith(queryKeys.scheduleRound())
    expect(mockedRefetchStaleOnFocus).toHaveBeenCalledWith(['schedule-round'])
  })

  // 회귀 가드. 신선도는 쿼리의 `staleTime` 안에 있다. 진입이 `refreshSchedules` 를 부르는 순간
  // 10분 TTL 이 통째로 사라지고, 그 손실은 화면에서 아무 표시도 남기지 않는다.
  it('진입은 신선해도 받는 refreshSchedules 를 부르지 않는다', async () => {
    setStores(캐릭터_넷)

    await renderScreen()

    expect(mockedRefreshSchedules).not.toHaveBeenCalled()
    expect(mocks.profit.refresh).not.toHaveBeenCalled()
    // 보스 수익은 아직 자기 스토어가 받는다. 예열이 이미 같은 회차로 채운 스토어를 다시 부르지 않는다.
    expect(mocks.profit.loadTrackedOcids).not.toHaveBeenCalled()
  })

  // 드롭 히스토리는 예열 목록 밖이고 네트워크도 안 탄다. 동기화 트리거 수에 들지
  // 않으므로 위 케이스와 갈라 둔다.
  it('예열 밖인 드롭 히스토리는 이 화면이 읽는다', async () => {
    await renderScreen()

    expect(mocks.dropHistory.load).toHaveBeenCalledTimes(1)
  })

  // 남은 스케줄이 보스 스케줄러 스토어의 직접 완료를 본다. 탭은 계속 살아 있어서, 보스 수익에서
  // 적고 돌아와도 포커스가 안 물으면 옛 값이 선다(사용자 보고). 넥슨을 안 타는 로컬 재조회다.
  it('포커스마다 직접 완료를 다시 묻는다', async () => {
    await renderScreen()

    expect(mocks.bossStore.reloadManualCompleted).toHaveBeenCalledTimes(1)
    // 신선해도 받는 동기화가 아니다.
    expect(mockedRefreshSchedules).not.toHaveBeenCalled()
  })

})

// 이번 주 수익은 통계와 같은 가계부 기록을 읽는다. 전 기간이 아니라 이번 주만 읽는다.
describe('TodayScreen: 이번 주 수익이 읽는 기록', () => {
  it('이번 주 범위만 읽는다', async () => {
    await renderScreen()

    // 2026-08-17(월) KST. 이번 주는 목요일 2026-08-13 부터 수요일 2026-08-19 까지다.
    expect(jest.mocked(loadStatsDaysBetween)).toHaveBeenCalledWith({ from: '2026-08-13', to: '2026-08-19' })
  })
})

describe('TodayScreen: 수동 멤버십을 어느 스토어에서 읽는가', () => {
  it('컨텐츠 멤버십은 컨텐츠 스토어에서 읽는다. 보스 스토어의 사본이 아니다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    setStores({
      content: { trackedOcids: ['ocid-1'], characters: [contentView('ocid-1', 1)] },
      // character 범위 항목이어야 `남은 스케줄`에 남는다. 공유 컨텐츠는 별도 위젯으로 뗐다
      contentStore: {
        manualTrackedByOcid: {
          'ocid-1': [{ contentKey: 'daily_quest_road_of_vanishing', kind: 'daily' }] } },
      boss: { trackedOcids: ['ocid-1'], characters: [bossView('ocid-1', 1)] } })

    await renderScreen()

    // 일일 퀘스트라 기본 탭(일간)에서 바로 수치가 선다.
    expect(screen.queryAllByTestId('schedule-stats').length).toBeGreaterThan(0)
  })

  it('보스 멤버십은 보스 스토어에서 읽는다. 컨텐츠 스토어의 사본이 아니다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    setStores({
      content: { trackedOcids: ['ocid-1'], characters: [contentView('ocid-1', 1)] },
      boss: { trackedOcids: ['ocid-1'], characters: [bossView('ocid-1', 1)] },
      bossStore: {
        manualTrackedByOcid: { 'ocid-1': [{ bossKey: 'lotus', difficulty: 'normal', kind: 'boss' }] } } })

    await renderScreen()

    // 주간 보스라 **주간 탭**에서 선다. 위젯이 탭마다 다른 배열을 보므로
    // 기본 탭(일간)에는 이 캐릭터에 남은 것이 없다.
    expect(screen.queryAllByTestId('schedule-stats')).toHaveLength(0)

    await act(async () => {
      fireEvent.press(screen.getByLabelText('주간'))
    })

    expect(screen.queryAllByTestId('schedule-stats').length).toBeGreaterThan(0)
  })
})

describe('TodayScreen: 명시적 재조회', () => {
  // 명시적 재조회는 신선해도 받는다. 스케줄 회차는 **하나**다. 컨텐츠 · 보스 · 프로필이 같은 캐시를 보므로
  // 둘을 따로 부르면 같은 응답을 두 번 받는다. 보스 수익과 드롭 기록은 아직 자기 스토어라 함께 읽는다.
  it('재조회는 스케줄 회차 하나와 보스 수익 · 드롭 기록을 함께 읽는다', async () => {
    setStores(캐릭터_넷)
    await renderScreen()

    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(mockedRefreshSchedules).toHaveBeenCalledTimes(1)
    expect(mocks.profit.refresh).toHaveBeenCalledWith(OCIDS)
    expect(mocks.dropHistory.load).toHaveBeenCalledTimes(2)
  })

  // 회귀 가드. 조회 중 과 당겼다 는 다른 사실이다.
  //
  // `refreshing = status === 'loading'` 으로 두면 화면 마운트 하이드레이션만으로 인디케이터가
  // 프로그램적으로 열린다.
  it('조회 중이어도 인디케이터는 안 돈다', async () => {
    setStores({ ...캐릭터_넷, boss: { ...캐릭터_넷.boss, status: 'loading' } })

    await renderScreen()

    expect(refreshControl().refreshing).toBe(false)
  })
})

// 대표 표식은 선택 스토어가 든다. 화면 상태로 들던 때는 다시 읽는 계기가 추적 목록 변경과 당김
// 둘뿐이라, 캐릭터 관리에서 대표만 옮기고 돌아오면 당기기 전까지 옛 캐릭터가 남았다(#395). today 는
// 탭이라 캐릭터 관리를 다녀와도 다시 마운트되지 않는다.
describe('TodayScreen: 대표 표식', () => {
  it('다시 마운트하거나 당기지 않아도 대표를 바꾸면 대표 카드와 머리 첫 얼굴이 새 캐릭터다', async () => {
    setStores(캐릭터_넷)
    mockedProfiles.mockReturnValue(프로필_넷)

    await renderScreen()
    expect(screen.getByTestId('representative-name')).toHaveTextContent('캐릭터1')
    expect(screen.getByTestId('character-manage-face-0').props.source).toEqual({
      uri: 'https://example.com/1.png' })

    // 캐릭터 관리의 저장이 부르는 것과 같은 문이다.
    await act(async () => {
      await useCharacterSelectionStore.getState().setRepresentative(OCIDS[2])
    })

    expect(screen.getByTestId('representative-name')).toHaveTextContent('캐릭터3')
    expect(screen.getByTestId('character-manage-face-0').props.source).toEqual({
      uri: 'https://example.com/3.png' })
    expect(mockedRefreshSchedules).not.toHaveBeenCalled()
  })

  // 표식을 저장소에서 다시 읽으면 스토어와 두 벌이 되고, 늦게 온 읽기가 방금 바꾼 대표를 되돌린다.
  it('마운트도 당김도 표식을 저장소에서 읽지 않는다', async () => {
    setStores(캐릭터_넷)
    mockedProfiles.mockReturnValue(프로필_넷)
    mockedGetRepresentative.mockClear()

    await renderScreen()
    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(mockedGetRepresentative).not.toHaveBeenCalled()
  })
})

describe('TodayScreen: 갱신 시각', () => {
  // 제목에 딸린 작은 글씨다. 제목 **줄 안**에 있으면 폭을 다투고, 그때 줄어드는 것은 제목이다.
  it('제목 줄이 아니라 그 아래에 선다', async () => {
    useDataFreshness.setState({ fetchedAt: '2026-09-08T05:03:22.000Z' })
    setStores(캐릭터_넷)

    await renderScreen()

    const line = screen.getByTestId('data-freshness')
    expect(within(screen.getByTestId('page-header-title-row')).queryByTestId('data-freshness')).toBeNull()
    expect(within(screen.getByTestId('page-header')).getByTestId('data-freshness')).toBe(line)
  })

  // **자리는 지킨다.** 값이 들어오는 순간 줄이 생기면 헤더가 16 만큼 내려앉고 그 아래 화면
  // 전체가 한 번 밀린다. 콜드 스타트 첫 진입에서 실제로 일어난다.
  it('받은 적이 없으면 글자만 빈다', async () => {
    useDataFreshness.setState({ fetchedAt: null })

    await renderScreen()

    expect(screen.getByTestId('data-freshness')).toHaveTextContent('')
  })
})

// 머리의 캐릭터 관리 버튼. **화면이 하는 일은 배선뿐**이라 여기서 보는 것은 그 버튼이 머리에
// 섰는가와 누르면 어디로 가는가 둘이다. 도는 얼굴의 목록은 뷰모델이 내고(`view-model.test.ts`),
// 움직임은 `header-portrait-motion.test.ts` 가 붙든다.
describe('TodayScreen: 머리의 캐릭터 관리 버튼', () => {
  it('제목 줄 오른쪽에 선다', async () => {
    setStores(캐릭터_넷)
    mockedProfiles.mockReturnValue(프로필_넷)

    await renderScreen()

    const trailing = screen.getByTestId('page-header-title-trailing')
    expect(within(trailing).getByLabelText('캐릭터 관리')).toBeTruthy()
  })

  // 설정 안쪽으로 들어가야 닿던 화면이다. 루트 스택 push 라 뒤로가기로 today 에 돌아온다.
  it('누르면 캐릭터 관리로 push 한다', async () => {
    const navigate = jest.fn()
    mockedNavigation.mockReturnValue({ navigate, goBack: jest.fn() } as never)
    setStores(캐릭터_넷)
    mockedProfiles.mockReturnValue(프로필_넷)

    await renderScreen()
    await act(async () => {
      fireEvent.press(screen.getByLabelText('캐릭터 관리'))
    })

    expect(navigate).toHaveBeenCalledWith('SettingsCharacters')
  })

  // 추적이 하나도 없는 첫 실행에서도 문은 열려 있어야 한다. 그때가 캐릭터를 고르러 갈 이유가
  // 가장 큰 순간이다. 얼굴이 없으면 사람 아이콘이 그 자리를 채운다.
  it('관리 대상이 없어도 버튼은 선다', async () => {
    await renderScreen()

    expect(screen.getByLabelText('캐릭터 관리')).toBeTruthy()
    expect(screen.getByTestId('character-manage-fallback')).toBeTruthy()
  })
})

describe('TodayScreen: 격자', () => {
  // 데이터가 없다고 타일을 빼지 않는다. 콜드 스타트(캐시 · 스토어 전부 빈 값)에서도
  // 전부 서고, 각자 자기 타일 안에서 빈 상태를 말한다. 다음 파티 스케줄은 회차가 없으면 맨 아래 줄의 등록 칸이다.
  it('캐시가 비어 있어도 위젯이 전부 선다', async () => {
    await renderScreen()

    expect(screen.getByTestId('widget-grid')).toBeTruthy()
    for (const id of [
      'representative-character',
      'reset-countdown',
      'crystal-limit',
      'shared-contents',
      'remaining-schedule',
      'weekly-income',
      'top-valuable-item',
      'unpriced-drops',
      'next-party-schedule',
    ]) {
      expect(screen.getByTestId(`widget-tile-${id}`)).toBeTruthy()
    }
  })

})

// 뷰모델은 렌더 때의 `now` 로 초기화 시각과 기간을 정한다. 경계가 지나도 화면이 다시 렌더되지
// 않으면 카운트다운이 `0초` 에 멈추고 기간 값이 지난 기간을 말한다(이슈 #459).
//
// 다시 그리는 신호는 공용 타이머가 올리는 `useResetBoundaryTick` 이다. 타이머가 자정에 틱을 올리는 것은
// `reset-timer.spec.ts` 가 보고, 여기서는 그 틱에 이 화면이 다시 그리는가를 본다.
describe('TodayScreen: 초기화 경계', () => {
  afterEach(() => {
    jest.setSystemTime(NOW)
  })

  function 일일_값(): unknown {
    return screen.getByTestId('reset-value-daily').props.children
  }

  /** 시계를 `ms` 만큼 옮기고 공용 타이머가 자정에 하는 일(틱 올리기)을 한다. */
  async function 자정넘기기(ms: number): Promise<void> {
    await act(async () => {
      jest.advanceTimersByTime(ms)
      useResetBoundaryTick.setState((state) => ({ tick: state.tick + 1 }))
    })
  }

  it('일일 초기화가 지나면 다음 24시간부터 다시 센다', async () => {
    // 2026-08-17(월) 23:59:57 KST
    jest.setSystemTime(new Date('2026-08-17T14:59:57.000Z'))
    await renderScreen()
    expect(일일_값()).toBe('3초')

    await 자정넘기기(5 * 1000)

    expect(일일_값()).toBe('23시간 59분 58초')
  })

  // 월간은 기본 배치(2x1)가 안 그린다. 월간 경계에서의 값은 `view-model.test.ts` 가 본다.
  it('주간 초기화(목 00:00)가 지나면 다음 주기로 넘어간다', async () => {
    // 2026-08-19(수) 23:59:30 KST
    jest.setSystemTime(new Date('2026-08-19T14:59:30.000Z'))
    await renderScreen()

    await 자정넘기기(60 * 1000)

    expect(screen.getByTestId('reset-value-weekly').props.children).toBe('6일 23시간')
  })

  it('주간 초기화가 지나면 이번 주 수익이 새 주를 다시 읽는다', async () => {
    // 2026-08-19(수) 23:59:58 KST. 이번 주 키는 2026-08-13, 다음 주 키는 2026-08-20
    jest.setSystemTime(new Date('2026-08-19T14:59:58.000Z'))
    await renderScreen()

    await 자정넘기기(5 * 1000)

    expect(jest.mocked(loadStatsDaysBetween)).toHaveBeenLastCalledWith({ from: '2026-08-20', to: '2026-08-26' })
  })
})

// 결산 줄이 공지 배너 **위**다. 공지는 읽을거리이고 결산 줄은 지금 화면의 값이 왜 안 맞는지를
// 말하므로, 그 줄이 값보다 먼저 와야 한다.
describe('TodayScreen: 결산 안내 줄', () => {
  // 실물 스토어라 값이 케이스 사이로 샌다.
  beforeEach(() => {
    useSettlementStore.setState({ settling: false, startedAt: null, dismissedAt: null, visible: false })
  })

  it('결산 중이면 격자 위에 선다', async () => {
    useSettlementStore.setState({
      settling: true,
      startedAt: '2026-08-16T14:00:00.000Z',
      dismissedAt: null,
      visible: true,
    })

    await renderScreen()

    expect(screen.getByTestId('today-settlement-banner')).toBeTruthy()
  })
})
