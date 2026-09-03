// 첫 화면 `today`의 **배선**.
//
// 이 화면에는 판정이 한 줄도 없다. 조립은 `view-model.ts`(그 테스트), 그림은 위젯 여덟(각자의
// 테스트), 좌표는 `WidgetGrid`(그 테스트)가 이미 본다. 그래서 여기서 묻는 것은 넷뿐이다.
//
// ① **어느 문으로 조회하는가**. 진입은 게이트가 있는 `loadTrackedOcids` 하나이고, 게이트를
//  우회하는 `refresh` 는 진입에서 부르지 않는다.
//    **게이트 자체는 여기서 못 본다**. 그것은 스토어 안의 계약이라 core 테스트가 지킨다. 화면이
//    보장할 수 있는 것은 **어느 문을 쓰는가** 이고, 그 문이 바뀌면 TTL 이 통째로 사라진다.
// ② **당김과 헤더 버튼이 같은 재조회인가**.
// ③ **스토어가 비어도 서는가**. 콜드 스타트에 위젯 여덟이 전부 빈 상태로 선다.
// ④ **캐릭터 넷의 기본 배치**(스냅샷). 헤더 + 격자가 실제 값 위에서 함께 그려지는 것은 여기뿐이다.
import { act, fireEvent, screen } from '@testing-library/react-native'

import { useDropHistoryStore } from '../../../features/boss-profit/drop-history-store'
import { useBossProfitStore, type BossProfitRow } from '../../../features/boss-profit/store'
import { useBossSchedulerStore, type BossCharacterView } from '../../../features/boss-scheduler/store'
import {
  useContentSchedulerStore,
  type ContentCharacterView } from '../../../features/content-scheduler/store'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'
import { formatMesoShort } from '../../../lib/boss/boss-profit-delta'
import type { MatchedBoss } from '../../../lib/boss/boss-matching'
import type { DropHistoryPeriodGroup, DropHistoryRecord } from '../../../lib/drop/drop-history'
import { getCachedCharacterBasic } from '../../../storage/character-basic-cache'
import { getRepresentativeCharacter } from '../../../storage/character-selection'
import type { DailyContent, WeeklyContent } from '../../../types'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { TodayScreen } from '../TodayScreen'

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
jest.mock('../../../storage/character-basic-cache', () => ({
  ...jest.requireActual('../../../storage/character-basic-cache'),
  getCachedCharacterBasic: jest.fn() }))
jest.mock('../../../storage/character-selection', () => ({
  ...jest.requireActual('../../../storage/character-selection'),
  getRepresentativeCharacter: jest.fn() }))
jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedContent = jest.mocked(useContentSchedulerStore)
const mockedBoss = jest.mocked(useBossSchedulerStore)
const mockedProfit = jest.mocked(useBossProfitStore)
const mockedDropHistory = jest.mocked(useDropHistoryStore)
const mockedGetCachedCharacterBasic = jest.mocked(getCachedCharacterBasic)
const mockedGetRepresentative = jest.mocked(getRepresentativeCharacter)
const mockedNavigation = jest.mocked(useScreenNavigation)

// 2026-08-17(월) 12:00 KST. `view-model.test.ts` 와 같은 시각이라 주간 기간 키가 2026-08-13 이다.
// 시각을 고정하지 않으면 초기화 카운트다운이 회차마다 달라 스냅샷이 못 선다.
const NOW = new Date('2026-08-17T03:00:00.000Z')
const WEEK_KEY = '2026-08-13'
const OCIDS = ['ocid-1', 'ocid-2', 'ocid-3', 'ocid-4']

// ── 스토어 목 ────────────────────────────────────────────────────────────────────────
//
// 넷 다 **상태 + 함수** 를 그대로 돌려주면 된다. 이 화면은 셀렉터를 쓰지 않고 상태를 통째로 읽는다.

interface TabStoreMock {
  loadTrackedOcids: jest.Mock
  refresh: jest.Mock
}
interface StoreMocks {
  content: TabStoreMock
  boss: TabStoreMock
  profit: TabStoreMock
  dropHistory: { load: jest.Mock }
}

let mocks: StoreMocks

function setStores(
  overrides: {
    content?: Record<string, unknown>
    boss?: Record<string, unknown>
    profit?: Record<string, unknown>
    dropHistory?: Record<string, unknown>
  } = {},
): void {
  mockedContent.mockReturnValue({
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    manualTrackedByOcid: {},
    activeTab: 'daily',
    loadTrackedOcids: mocks.content.loadTrackedOcids,
    refresh: mocks.content.refresh,
    ...overrides.content } as never)

  mockedBoss.mockReturnValue({
    status: 'loaded',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    partySizes: {},
    manualTrackedByOcid: {},
    activeTab: 'weekly',
    weeklyFilter: 'all',
    monthlyFilter: 'all',
    loadTrackedOcids: mocks.boss.loadTrackedOcids,
    refresh: mocks.boss.refresh,
    ...overrides.boss } as never)

  mockedProfit.mockReturnValue({
    status: 'loaded',
    tab: 'weekly',
    periodKey: WEEK_KEY,
    rows: [],
    // 이 화면이 읽는 것은 **지금 기간** 이다. `rows`(보고 있는 탭·기간)가 아니다.
    currentPeriodRows: [],
    loadedTab: 'weekly',
    loadedPeriodKey: WEEK_KEY,
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodState: 'ready',
    previousPeriodTotalMeso: 0,
    canGoPreviousPeriod: false,
    error: null,
    staleCharacterNames: [],
    characterIssues: {},
    trackedOcids: null,
    lastSyncedAt: null,
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

// ── 값 픽스처 ────────────────────────────────────────────────────────────────────────

function daily(overrides: Partial<DailyContent> = {}): DailyContent {
  return {
    name: '일일 퀘스트',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides }
}

function weekly(overrides: Partial<WeeklyContent> = {}): WeeklyContent {
  return {
    name: '[주간 퀘스트] 크리티아스',
    kind: 'quest',
    isRegistered: true,
    nowCount: 0,
    maxCount: 0,
    questState: 0,
    ...overrides }
}

function matchedBoss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    apiName: '스우',
    difficulty: '노멀',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    matchedBossName: '스우',
    portraitSlug: null,
    isSeasonBoss: false,
    ...overrides }
}

function contentView(ocid: string, index: number): ContentCharacterView {
  return {
    ocid,
    characterName: `캐릭터${index}`,
    // 캐릭터마다 남은 개수가 달라야 정렬(남은 개수 많은 순)이 스냅샷에 드러난다.
    dailyContents: [daily(), daily({ name: '몬스터파크', questState: index % 2 === 0 ? 2 : 0 })],
    weeklyContents: [weekly({ questState: index % 2 === 0 ? 2 : 0 })],
    isStale: false,
    syncedAt: NOW.toISOString(),
    error: null }
}

function bossView(ocid: string, index: number): BossCharacterView {
  return {
    ocid,
    characterName: `캐릭터${index}`,
    weeklyBosses: [matchedBoss({ isComplete: index % 2 === 0 }), matchedBoss({ apiName: '데미안' })],
    monthlyBosses: [matchedBoss({ apiName: '검은 마법사', cycle: 'monthly' })],
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
    boss: '스우',
    difficulty: '노멀',
    cycle: 'weekly',
    periodKey: WEEK_KEY,
    periodLabel: '이번 주',
    priceMeso: 1_000_000 * index,
    maxPartySize: 6,
    partySize: 1,
    payoutMeso: 1_000_000 * index,
    isComplete: true }
}

function dropRecord(overrides: Partial<DropHistoryRecord> = {}): DropHistoryRecord {
  return {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '노멀',
    periodKey: WEEK_KEY,
    category: 'equipment',
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
    // 주간 탭·현재 기간에서는 둘이 같은 내용이다(대가). 픽스처도 그 상태를 그대로 둔다.
    rows: OCIDS.map((ocid, index) => profitRow(ocid, index + 1)),
    currentPeriodRows: OCIDS.map((ocid, index) => profitRow(ocid, index + 1)),
    lastSyncedAt: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString() },
  dropHistory: {
    groups: [
      {
        periodKey: WEEK_KEY,
        cycle: 'weekly',
        records: [
          dropRecord({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 1 }),
          dropRecord({ itemName: '생명의 연마석', category: 'consumable' }),
        ] },
    ] satisfies DropHistoryPeriodGroup[],
    drought: {
      periodKey: WEEK_KEY,
      cycle: 'weekly' as const,
      weeksSince: 0,
      records: [dropRecord({ priceState: 'entered', priceMeso: 1_200_000_000 })] } } }

// ── 도우미 ───────────────────────────────────────────────────────────────────────────

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

async function renderScreen(): Promise<Rendered> {
  // **`await` 가 계약이다**. RNTL 14 의 `render` 는 비동기다. 안 기다리면 아래 `act` 가 마운트보다
  // 먼저 돌아 **아무것도 안 그려졌는데 초록** 인 테스트가 된다(실제로 그렇게 한 번 갔다).
  const view = await renderOverlay(<TodayScreen />)
  // 프로필·대표 표식은 비동기 효과가 채운다. 한 번 흘려보내야 대표 카드가 그려진다.
  await act(async () => {})
  return view
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 스크롤 셸에 붙은 당겨서 새로고침 컨트롤. 스케줄러 테스트와 같은 자리다. */
function refreshControl(): { refreshing: boolean; onRefresh: () => void } {
  return screen.getByTestId('screen-scroll').props.refreshControl.props
}

function buttonOf(node: AtomElement): AtomElement {
  let current: AtomElement | null = node
  while (current !== null && current.props.role !== 'button') current = current.parent
  if (current === null) throw new Error('버튼을 찾지 못했다')
  return current
}

/**
 * 지금까지 쌓인 재조회 호출을 그대로 떠서 돌려주고 목을 비운다.
 *
 * 두 경로(버튼·당김)가 **같은 재조회인가** 를 보려면 각각이 남긴 자국을 통째로 견줘야 한다
 * 어느 스토어를 어떤 인자로 몇 번 불렀는지가 전부 같아야 같은 이다.
 */
function 재조회_기록(): unknown {
  const 목 = [mocks.content.refresh, mocks.boss.refresh, mocks.profit.refresh, mocks.dropHistory.load]
  const 기록 = JSON.parse(JSON.stringify(목.map((fn) => fn.mock.calls))) as unknown
  for (const fn of 목) fn.mockClear()
  return 기록
}

beforeAll(() => {
  jest.useFakeTimers({ now: NOW })
})

afterAll(() => {
  jest.useRealTimers()
})

beforeEach(() => {
  mocks = {
    // 실물은 넷 다 `Promise` 다. 당김 훅이 `allSettled` 로 넷의 **끝** 을 기다린다.
    content: { loadTrackedOcids: jest.fn(), refresh: jest.fn().mockResolvedValue(undefined) },
    boss: { loadTrackedOcids: jest.fn(), refresh: jest.fn().mockResolvedValue(undefined) },
    profit: { loadTrackedOcids: jest.fn(), refresh: jest.fn().mockResolvedValue(undefined) },
    dropHistory: { load: jest.fn().mockResolvedValue(undefined) } }
  mockedGetRepresentative.mockResolvedValue(null)
  mockedGetCachedCharacterBasic.mockResolvedValue(null)
  mockedNavigation.mockReturnValue({ navigate: jest.fn(), goBack: jest.fn() } as never)
  useTrackingModeStore.setState({ mode: 'auto' })
  setStores()
})

describe('TodayScreen: 진입 조회', () => {
  //  **today 는 그 순차 밖의 **네 번째 트리거****. 예열이 셋을 돌고 이 화면이
  // 하나를 더 낸다. 스케줄러 화면 하나와 같은 횟수다.
  it('진입하면 동기화 트리거를 정확히 한 번 낸다', async () => {
    await renderScreen()

    expect(mocks.content.loadTrackedOcids).toHaveBeenCalledTimes(1)
    // 예열이 이미 같은 회차로 채운 스토어를 다시 부르지 않는다.
    expect(mocks.boss.loadTrackedOcids).not.toHaveBeenCalled()
    expect(mocks.profit.loadTrackedOcids).not.toHaveBeenCalled()
  })

  // 회귀 가드. 게이트는 `loadTrackedOcids` **안**에 있다. 진입이 `refresh` 를
  // 부르는 순간 10분 TTL 이 통째로 사라지고, 그 손실은 화면에서 아무 표시도 남기지 않는다.
  it('진입은 게이트를 우회하는 refresh 를 부르지 않는다', async () => {
    setStores(캐릭터_넷)

    await renderScreen()

    expect(mocks.content.refresh).not.toHaveBeenCalled()
    expect(mocks.boss.refresh).not.toHaveBeenCalled()
    expect(mocks.profit.refresh).not.toHaveBeenCalled()
  })

  // 드롭 히스토리는 예열 목록 밖이고 네트워크도 안 탄다. 동기화 트리거 수에 들지
  // 않으므로 위 케이스와 갈라 둔다.
  it('예열 밖인 드롭 히스토리는 이 화면이 읽는다', async () => {
    await renderScreen()

    expect(mocks.dropHistory.load).toHaveBeenCalledTimes(1)
  })

})

// 수동 멤버십은 저장소 키 하나인데 **스토어 둘이 각자 사본**을 든다. 사본을 갱신하는 것은 각자
// 자기 계열을 바꿀 때뿐이라(컨텐츠 추가는 컨텐츠 스토어만, 보스 추가는 보스 스토어만) 계열마다
// 주인이 정해져 있다. 이 화면은 **두 계열을 한 화면에서** 그리는 것은 여기뿐이라 둘을 다 읽어야
// 한다.
// 보스 수익 스토어의 `rows` 는 **사용자가 보고 있는 (탭, 기간)** 이고 이 화면이 그리는 것은 **이번
// 주** 다. 사용자 보고. 그 화면을 월간 탭으로 옮기기만 해도 위젯 3·5 가
// 함께 비었다. 이 화면은 그 네비게이션을 **모르는 채로** 서야 한다.
describe('TodayScreen: 수익 위젯이 읽는 값', () => {
  it('보스 수익 화면이 월간 탭을 보고 있어도 이번 주 수익을 그린다', async () => {
    setStores({
      ...캐릭터_넷,
      profit: {
        ...캐릭터_넷.profit,
        // 월간 탭을 보고 있는 상태. `rows` 에는 이번 주 행이 한 줄도 없다(`filterRowsForTab`).
        tab: 'monthly',
        rows: [],
        dropsByRowKey: {} } })

    await renderScreen()

    expect(screen.queryByText('아직 이번 주 기록이 없습니다')).toBeNull()
    // 1 + 2 + 3 + 4 백만. 화면의 접기 규칙은 `formatMesoShort` 하나가 판다(총액과 결정석 분해가
    // 같은 값이라 자리는 여럿이다).
    expect(screen.getAllByText(formatMesoShort(10_000_000)).length).toBeGreaterThan(0)
  })
})

describe('TodayScreen: 수동 멤버십을 어느 스토어에서 읽는가', () => {
  it('컨텐츠 멤버십은 컨텐츠 스토어에서 읽는다. 보스 스토어의 사본이 아니다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    setStores({
      content: {
        trackedOcids: ['ocid-1'],
        characters: [contentView('ocid-1', 1)],
        // character 범위 항목이어야 `남은 스케줄`에 남는다. 공유 컨텐츠는 별도 위젯으로 뗐다
        //
        manualTrackedByOcid: {
          'ocid-1': [{ contentName: '[일일 퀘스트] 소멸의 여로 조사', kind: 'daily' }] } },
      boss: { trackedOcids: ['ocid-1'], characters: [bossView('ocid-1', 1)] } })

    await renderScreen()

    // 일일 퀘스트라 기본 탭(일간)에서 바로 수치가 선다.
    expect(screen.queryAllByTestId('schedule-stats').length).toBeGreaterThan(0)
  })

  it('보스 멤버십은 보스 스토어에서 읽는다. 컨텐츠 스토어의 사본이 아니다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    setStores({
      content: { trackedOcids: ['ocid-1'], characters: [contentView('ocid-1', 1)] },
      boss: {
        trackedOcids: ['ocid-1'],
        characters: [bossView('ocid-1', 1)],
        manualTrackedByOcid: { 'ocid-1': [{ contentName: '스우', difficulty: '노멀', kind: 'boss' }] } } })

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
  // 당김과 헤더 버튼은 **같은 재조회**다.
  it('당김이 헤더 버튼과 같은 재조회를 부른다', async () => {
    setStores(캐릭터_넷)
    await renderScreen()

    재조회_기록() // 마운트가 남긴 것(드롭 히스토리 1회)을 걷어내고 시작한다.

    await press(buttonOf(screen.getByLabelText('새로고침')))
    const 버튼 = 재조회_기록()
    // 둘 다 **아무것도 안 불렀다** 여도 같으므로, 견주기 전에 자국이 남았는지부터 본다.
    expect(버튼).not.toEqual([[], [], [], []])

    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(재조회_기록()).toEqual(버튼)
  })

  // 명시적 재조회는 TTL 을 무시하고 **이 화면이 그리는 스토어 셋을 모두** 읽는다
  // 하나만 읽으면 당겨도 보스·수익 위젯이 안 바뀐다. 셋이 동시에 나가도 `syncSchedules` 의 단일
  // 비행이 한 회차로 합친다.
  it('재조회는 화면이 그리는 스토어 셋을 모두 읽는다', async () => {
    setStores(캐릭터_넷)
    await renderScreen()

    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(mocks.content.refresh).toHaveBeenCalledWith(OCIDS)
    expect(mocks.boss.refresh).toHaveBeenCalledWith(OCIDS)
    expect(mocks.profit.refresh).toHaveBeenCalledWith(OCIDS)
    expect(mocks.dropHistory.load).toHaveBeenCalledTimes(2)
  })

  it('제스처가 붙어도 헤더 버튼은 남는다', async () => {
    await renderScreen()

    expect(screen.getByLabelText('새로고침')).toBeTruthy()
    expect(refreshControl()).toBeDefined()
  })

  // ★ 회귀 가드. **조회 중 과 당겼다 는 다른 사실이다**.
  //
  // 종전에는 `refreshing = status === 'loading'` 이라, 화면 마운트 하이드레이션만으로 인디케이터가
  // 프로그램적으로 열렸다. 사용자 보고 *"페이지 이동 시 새로고침 인디케이터가 저절로
  // 돌고 상단이 빈 채로 멈춘다"* 가 그 증상이다. **조회 중...** 은 그대로 뜬다. 그쪽이 조회를
  // 말하는 자리다.
  it('조회 중이어도 인디케이터는 안 돈다. "조회 중..." 만 보여준다', async () => {
    setStores({ ...캐릭터_넷, boss: { ...캐릭터_넷.boss, status: 'loading' } })

    await renderScreen()

    expect(screen.getByText('조회 중...')).toBeTruthy()
    expect(refreshControl().refreshing).toBe(false)
  })

  // 이 화면에는 **선택된 캐릭터** 가 없어 스케줄러 두 화면의 출처(선택된 캐릭터의 `syncedAt`)를 쓸 수
  // 없다. 페이지 전체 기준 값인 보스 수익 스토어의 `lastSyncedAt` 이 그 자리다.
  it('동기화 시각은 페이지 전체 기준 값에서 온다', async () => {
    setStores(캐릭터_넷)

    await renderScreen()

    expect(screen.getByText('5분 전')).toBeTruthy()
  })
})

describe('TodayScreen: 격자', () => {
  // 데이터가 없다고 타일을 빼지 않는다. 콜드 스타트(스토어 전부 빈 값)에서도
  // 여덟이 서고, 각자 자기 타일 안에서 빈 상태를 말한다.
  it('스토어가 비어 있어도 위젯 여덟이 전부 선다', async () => {
    await renderScreen()

    expect(screen.getByTestId('widget-grid')).toBeTruthy()
    for (const id of [
      'representative-character',
      'reset-countdown',
      'crystal-limit',
      'remaining-schedule',
      'weekly-boss-profit',
      'top-valuable-item',
      'unpriced-drops',
      'valuable-drought',
    ]) {
      expect(screen.getByTestId(`widget-tile-${id}`)).toBeTruthy()
    }
  })

})
