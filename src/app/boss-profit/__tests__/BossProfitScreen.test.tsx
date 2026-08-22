// 웹 `BossProfitScreen.test.tsx`(3,232줄) · `.count-up.test.tsx` · `.dom-snapshot.test.tsx` 셋의
// **명세를 읽어 다시 쓴 것**이다. 카드 안쪽 케이스는 `CharacterAccordion.test.tsx` 가 갖는다.
//
// ── 옮기지 않은 계약 여섯 ────────────────────────────────────────────────────────────
//
// ① **당김 제스처 시뮬레이션 다섯**([[ADR-072]]·[[ADR-073]]) — 임계 넘김/미달·목록 `transform`·
//    전환 켜고 끄기는 이제 OS 가 갖는다([[ADR-130]]). 남는 계약은 *"당김이 헤더 버튼과 같은
//    재조회를 부르는가"* 와 *"의미 없는 기간에서는 꺼지는가"* 둘이고 그것은 본다.
// ② **`fixed` 헤더 + 실측 spacer + `ADR-112` 한 커밋 반영** — 헤더가 스크롤 뷰의 형제라 spacer 도
//    실측도 없다. 대신 *"헤더가 셸의 `header` 로 들어간다"* 를 본다.
// ③ **중첩 sticky 오프셋**([[ADR-100]] 결정 3) — sticky 를 못 옮겼다(`contract.md`).
// ④ **DOM 스냅샷 두 파일** — 트리가 다르다. RN 트리 스냅샷을 **새 기준선**으로 남기고, 그것이
//    답하는 것은 *"앞으로 안 바뀌는가"* 뿐이다(«예전과 같은가» 는 사람이 두 앱을 나란히 놓고 답한다).
// ⑤ **히스토리 왕복에도 언마운트되지 않는가**([[ADR-077]]) — 루트 스택 push 라 구조가 지킨다.
//    화면 안에서 볼 자리가 없다.
// ⑥ **접기 전후 스크롤**([[ADR-102]]) — 접기에 스크롤 코드가 아예 없다(`CharacterAccordion`).
import { act, fireEvent, within } from '@testing-library/react-native'
import { render } from '@testing-library/react-native'
import { ScrollView } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import weeklyBossesData from '../../../data/weekly-bosses.json'
import valuableDropsData from '../../../data/valuable-drops.json'
import {
  useBossProfitStore,
  type BossProfitRow,
  type BossProfitStore,
  type BossProfitWeeklySubtotal } from '../../../features/boss-profit/store'
import { WEEKLY_CRYSTAL_SALE_LIMIT } from '../../../lib/boss-matching'
import { getCurrentBossProfitPeriod } from '../../../lib/boss-profit-period'
import { clearCountUpMemory } from '../../../lib/use-count-up'
import type { RecordedDrop } from '../../../types/drops'

import { 테스트_안전영역 } from '../../../components/__tests__/render-atom'
import { ThemeProvider } from '../../../theme/ThemeProvider'
import { useScreenNavigation } from '../../use-screen-navigation'
import { BossProfitScreen } from '../BossProfitScreen'

// 이름이 `mock` 으로 시작해야 한다 — babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데 그
// 접두사만 예외로 통과시킨다(step 5 와 같은 규칙).
const mockShowError = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()
const navigate = jest.fn()
// 층이 스택이 된 뒤로 «그룹 층으로 되돌리기» 는 액션이다([[ADR-167]]) — 화면이 이것도 부른다.
const dispatch = jest.fn()

// [[ADR-063]]: 동기화 실패·기간 로드 실패는 인라인 문단이 아니라 토스트다.
jest.mock('../../../features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: jest.fn() }) } }))

// [[ADR-115]] 결정 7: 401 은 토스트가 아니라 키 무효화 진입점으로 간다(이 화면에는 로스터 조회가
// 없어 동기화 경로 하나뿐이다).
jest.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) } }))

// 웹과 같은 범위로 좁혀 목한다 — `dropRowKey` 는 본문(`AccordionBody`)이 쓰는 순수 함수라 실물과
// 같은 문자열을 낸다.
jest.mock('../../../features/boss-profit/store', () => ({
  useBossProfitStore: jest.fn(),
  dropRowKey: (ocid: string, boss: string, difficulty: string, periodKey: string) =>
    `${ocid}|${boss}|${difficulty}|${periodKey}` }))

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

const mockedStore = jest.mocked(useBossProfitStore)
const mockedNavigation = jest.mocked(useScreenNavigation)

// 새로고침 버튼·다음 기간 버튼은 "현재 기간"에서만 노출/비활성되므로 실행 시점과 무관하게 항상
// 현재를 가리키도록 실제 계산값을 쓴다(웹 테스트와 같은 방식).
const CURRENT_WEEKLY = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
const CURRENT_MONTHLY = getCurrentBossProfitPeriod('monthly', new Date()).periodKey
const 주간보스 = weeklyBossesData.weekly[0].boss
const 고가아이템 = valuableDropsData.items[0]

function mockStore(overrides: Partial<BossProfitStore> = {}): void {
  mockedStore.mockReturnValue({
    status: 'idle',
    tab: 'weekly',
    periodKey: CURRENT_WEEKLY,
    loadedTab: 'weekly',
    loadedPeriodKey: CURRENT_WEEKLY,
    rows: [],
    dropsByRowKey: {},
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodState: 'confirmedEmpty',
    previousPeriodTotalMeso: 0,
    canGoPreviousPeriod: true,
    error: null,
    staleCharacterNames: [],
    characterIssues: {},
    trackedOcids: ['ocid-1'],
    lastSyncedAt: null,
    loadTrackedOcids: jest.fn(),
    // 실물은 `Promise<void>` 다 — 당김 훅이 회차의 «끝» 을 기다린다([[ADR-160]] 결정 1).
    refresh: jest.fn().mockResolvedValue(undefined),
    setTab: jest.fn(),
    goToPreviousPeriod: jest.fn(),
    goToNextPeriod: jest.fn(),
    retryPeriod: jest.fn(),
    setPartySize: jest.fn(),
    setBossDrops: jest.fn(),
    ...overrides } as unknown as BossProfitStore)
}

function 보스행(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    world: null,
    boss: 주간보스,
    difficulty: '하드',
    cycle: 'weekly',
    periodKey: CURRENT_WEEKLY,
    periodLabel: '이번 주',
    priceMeso: 10_000_000,
    maxPartySize: 6,
    partySize: 2,
    payoutMeso: 5_000_000,
    isComplete: true,
    ...overrides }
}

function 주차소계(overrides: Partial<BossProfitWeeklySubtotal> = {}): BossProfitWeeklySubtotal {
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    periodKey: CURRENT_WEEKLY,
    totalMeso: 5_000_000,
    drops: [],
    state: 'recorded',
    ...overrides }
}

function 드롭(overrides: Partial<RecordedDrop> = {}): RecordedDrop {
  return { itemName: '기타', slot: null, ...overrides } as RecordedDrop
}

function renderScreen(): ReturnType<typeof render> {
  return render(
    <SafeAreaProvider initialMetrics={테스트_안전영역}>
      <ThemeProvider>
        <BossProfitScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  // 카운트업의 '직전 표시값' 기억은 모듈 수준이라 언마운트를 건너 산다([[ADR-087]] 결정 8) —
  // 테스트 하나가 곧 세션 하나다.
  clearCountUpMemory()
  dispatch.mockClear()
  mockedNavigation.mockReturnValue({ navigate, dispatch } as unknown as ReturnType<
    typeof useScreenNavigation
  >)
  mockStore()
})

describe('빈 상태 ([[ADR-101]] 결정 1 · [[ADR-060]])', () => {
  it('마운트하면 추적 목록을 한 번 읽는다', async () => {
    const loadTrackedOcids = jest.fn()
    mockStore({ loadTrackedOcids })
    await renderScreen()

    expect(loadTrackedOcids).toHaveBeenCalledTimes(1)
  })

  it('`trackedOcids` 가 `null` 이면 빈 상태를 그리지 않는다 — "아직 안 읽었다" 는 "0명" 이 아니다', async () => {
    mockStore({ trackedOcids: null })
    const { queryByText, getByText } = await renderScreen()

    expect(queryByText('추적 중인 캐릭터가 없습니다')).toBeNull()
    expect(getByText('보스 수익')).toBeTruthy()
  })

  it('빈 배열이면 빈 상태만 보인다 — 진입점 둘은 두지 않는다', async () => {
    mockStore({ trackedOcids: [] })
    const { getByText, queryByText } = await renderScreen()

    expect(getByText('추적 중인 캐릭터가 없습니다')).toBeTruthy()
    expect(queryByText('히스토리')).toBeNull()
    expect(queryByText('아이템 가격')).toBeNull()
  })

  // [[ADR-068]] 결정 4의 «열어 둔 채로 보낸다» 는 그대로이고 **목적지만 바뀌었다** — 피커를 여는
  // 자리가 설정 하나가 됐다([[ADR-140]] 결정 1·2).
  it('빈 상태 CTA 는 피커를 열어 둔 채로 설정 탭에 보낸다([[ADR-068]] 결정 4 · [[ADR-140]])', async () => {
    mockStore({ trackedOcids: [] })
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText('캐릭터 선택하러 가기'))
    })

    // 층이 스택이 되면서 이동이 두 단 중첩이 됐다([[ADR-167]] 결정 2) — 설정은 **그룹 층**에
    // 살고, 파라미터는 가장 안쪽 화면에 붙는다.
    expect(navigate).toHaveBeenCalledWith('Main', {
      screen: 'Groups',
      params: { screen: 'Settings', params: { openPicker: true } },
    })
  })
})

describe('제목 줄 진입점 ([[ADR-071]] 결정 7 · [[ADR-124]] 결정 8)', () => {
  it('가격이 히스토리 **왼쪽**이다 — 값을 매기는 쪽이 주마다 들르는 자리다', async () => {
    const { getByTestId } = await renderScreen()

    // 둘은 같은 부모의 형제라 **렌더 순서가 곧 화면 순서**다(`flex-row`).
    const header = JSON.stringify(getByTestId('page-header').toJSON())
    expect(header.indexOf('아이템 가격')).toBeLessThan(header.indexOf('히스토리'))
  })

  it('히스토리·가격은 하위 페이지로 push 한다', async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText('히스토리'))
    })
    expect(navigate).toHaveBeenCalledWith('DropHistory')

    await act(async () => {
      fireEvent.press(getByText('아이템 가격'))
    })
    expect(navigate).toHaveBeenCalledWith('DropPrice')
  })
})

describe('탭과 기간 네비게이터 ([[ADR-023]] · [[ADR-037]])', () => {
  it('탭을 누르면 `setTab` 이 불린다', async () => {
    const setTab = jest.fn()
    mockStore({ setTab })
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText('월간'))
    })

    expect(setTab).toHaveBeenCalledWith('monthly')
  })

  it('‹ › 는 각각 이전·다음 기간을 부른다', async () => {
    const goToPreviousPeriod = jest.fn()
    const goToNextPeriod = jest.fn()
    mockStore({ goToPreviousPeriod, goToNextPeriod, periodKey: '2026-07-09' })
    const { getByLabelText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByLabelText('이전 기간'))
    })
    await act(async () => {
      fireEvent.press(getByLabelText('다음 기간'))
    })

    expect(goToPreviousPeriod).toHaveBeenCalled()
    expect(goToNextPeriod).toHaveBeenCalled()
  })

  it('최신 기간에서는 다음 기간 버튼이 잠긴다', async () => {
    const { getByLabelText } = await renderScreen()

    expect(getByLabelText('다음 기간')).toBeDisabled()
  })

  it('과거 기간에서는 다음 기간 버튼이 열린다', async () => {
    mockStore({ periodKey: '2026-07-09' })
    const { getByLabelText } = await renderScreen()

    expect(getByLabelText('다음 기간')).not.toBeDisabled()
  })

  it('이전 이동 가능 여부는 **스토어가 판단한다**(#29) — 화면이 다시 계산하지 않는다', async () => {
    mockStore({ canGoPreviousPeriod: false })
    const { getByLabelText } = await renderScreen()

    expect(getByLabelText('이전 기간')).toBeDisabled()
  })
})

describe('동기화 상태 영역 ([[ADR-049]] 결정 1 · [[ADR-076]])', () => {
  it('현재 기간에서 새로고침을 누르면 추적 목록으로 재조회한다', async () => {
    const refresh = jest.fn()
    mockStore({ refresh, trackedOcids: ['ocid-1', 'ocid-2'] })
    const { getByLabelText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByLabelText('새로고침'))
    })

    expect(refresh).toHaveBeenCalledWith(['ocid-1', 'ocid-2'])
  })

  it('닫힌 과거 기간에서는 버튼도 동기화 시각도 없다(#30)', async () => {
    mockStore({ periodKey: '2026-07-09', lastSyncedAt: '2026-07-09T10:00:00+09:00' })
    const { queryByLabelText, queryByText } = await renderScreen()

    expect(queryByLabelText('새로고침')).toBeNull()
    expect(queryByText('동기화 기록 없음')).toBeNull()
  })

  it('과거 기간에서는 `status` 가 loading 이어도 "조회 중..." 을 쓰지 않는다', async () => {
    mockStore({ periodKey: '2026-07-09', status: 'loading' })
    const { queryByText } = await renderScreen()

    expect(queryByText('조회 중...')).toBeNull()
  })

  it('현재 기간에서 재조회 중이면 "조회 중..." 이다', async () => {
    mockStore({ status: 'loading' })
    const { getByText } = await renderScreen()

    expect(getByText('조회 중...')).toBeTruthy()
  })

  it('한 번도 동기화하지 않았으면 그렇게 말한다', async () => {
    const { getByText } = await renderScreen()

    expect(getByText('동기화 기록 없음')).toBeTruthy()
  })
})

describe('당겨서 새로고침 ([[ADR-072]] 결정 2·9 · [[ADR-076]] · [[ADR-130]])', () => {
  it('현재 기간에서는 당김이 헤더 버튼과 **같은 재조회**를 부른다', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined)
    mockStore({ refresh, trackedOcids: ['ocid-1'] })
    const { getByTestId } = await renderScreen()

    const control = getByTestId('screen-scroll').props.refreshControl
    await act(async () => {
      control.props.onRefresh()
    })

    expect(refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  it('새로고침이 의미 없는 기간에서는 컨트롤 자체를 달지 않는다 — 헤더 버튼과 같은 플래그다', async () => {
    mockStore({ periodKey: '2026-07-09' })
    const { getByTestId, queryByLabelText } = await renderScreen()

    expect(getByTestId('screen-scroll').props.refreshControl).toBeUndefined()
    expect(queryByLabelText('새로고침')).toBeNull()
  })

  // ★ 회귀 가드 — **«조회 중» 과 «당겼다» 는 다른 사실이다** ([[ADR-160]] 결정 1).
  //
  // 종전에는 `refreshing = status === 'loading'` 이라, 화면 마운트 하이드레이션만으로 인디케이터가
  // 프로그램적으로 열렸다. 사용자 보고(2026-08-22) *"페이지 이동 시 새로고침 인디케이터가 저절로
  // 돌고 상단이 빈 채로 멈춘다"* 가 그 증상이다. «조회 중...» 은 그대로 뜬다 — 그쪽이 조회를
  // 말하는 자리다.
  it('재조회 중이어도 컨트롤은 안 돈다 — 당김이 연 회차가 아니다', async () => {
    mockStore({ status: 'loading' })
    const { getByTestId } = await renderScreen()

    expect(getByTestId('screen-scroll').props.refreshControl.props.refreshing).toBe(false)
  })
})

describe('기간 상태별 표현 ([[ADR-060]] · [[ADR-068]] 결정 1 · [[ADR-083]] 결정 3)', () => {
  it('`confirmedEmpty` 는 확정된 빈 상태다 — 조회 불가와 디자인을 공유하지 않는다', async () => {
    mockStore({ status: 'loaded', periodState: 'confirmedEmpty' })
    const { getByText } = await renderScreen()

    expect(getByText('아직 처치한 보스가 없습니다')).toBeTruthy()
  })

  it('`notCollected` 는 "아직" 이라 말하고 재시도를 주지 않는다', async () => {
    mockStore({ status: 'loaded', periodState: 'notCollected' })
    const { getByText, queryByText } = await renderScreen()

    expect(getByText('아직 집계되지 않았습니다')).toBeTruthy()
    expect(queryByText('다시 시도')).toBeNull()
  })

  it('`outOfRange` 는 조회 불가 고지다', async () => {
    mockStore({ status: 'loaded', periodState: 'outOfRange' })
    const { getByText } = await renderScreen()

    expect(getByText('이 기간은 조회할 수 없습니다')).toBeTruthy()
  })

  it('카드가 없는 `failed` 는 실패 상태 + 재시도다', async () => {
    const retryPeriod = jest.fn()
    mockStore({ status: 'loaded', periodState: 'failed', retryPeriod })
    const { getByText } = await renderScreen()

    expect(getByText('이 기간을 불러오지 못했습니다')).toBeTruthy()
    await act(async () => {
      fireEvent.press(getByText('다시 시도'))
    })
    expect(retryPeriod).toHaveBeenCalled()
  })

  it('카드가 있는 `failed` 는 인라인이 아니라 토스트다 — 문구가 사라진 자리에 빈 칸이 남지 않는다', async () => {
    mockStore({ status: 'loaded', periodState: 'failed', rows: [보스행()] })
    const { queryByText } = await renderScreen()

    expect(queryByText('네트워크 상태를 확인해주세요')).toBeNull()
    expect(mockShowError).toHaveBeenCalledWith('이 기간을 불러오지 못했습니다', expect.anything())
  })

  it('기록이 있으면 아무 고지도 띄우지 않는다(결정 7)', async () => {
    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행()] })
    const { queryByText } = await renderScreen()

    expect(queryByText('아직 집계되지 않았습니다')).toBeNull()
    expect(queryByText('아직 처치한 보스가 없습니다')).toBeNull()
  })
})

describe('로딩 ([[ADR-061]] 결정 2)', () => {
  it('보여줄 데이터가 없을 때만 셸 승계 카드를 그린다', async () => {
    mockStore({ status: 'loading' })
    const { getByText } = await renderScreen()

    expect(getByText('불러오고 있어요')).toBeTruthy()
  })

  it('캐시된 행이 있으면 재조회 중에도 목록을 계속 보여준다([[ADR-017]])', async () => {
    mockStore({ status: 'loading', rows: [보스행()] })
    const { queryByText, getByText } = await renderScreen()

    expect(queryByText('불러오고 있어요')).toBeNull()
    expect(getByText('지내우시')).toBeTruthy()
  })

  it('기간 백필 중에는 그 기간 문구를 쓰고 카드는 그리지 않는다', async () => {
    mockStore({ isPeriodLoading: true, rows: [보스행()] })
    const { getByText, queryByText } = await renderScreen()

    expect(getByText(/기록을 불러오고 있어요$/)).toBeTruthy()
    expect(queryByText('지내우시')).toBeNull()
  })
})

// [[ADR-143]] 결정 3: 카드가 서는 차례는 행의 순서(= 스토어의 레벨 내림차순, [[ADR-017]] 결정 2)가
// 아니라 사용자가 캐릭터 관리에서 정한 저장 배열 순서다.
describe('캐릭터 카드 순서 ([[ADR-143]] 결정 3)', () => {
  /** 카드 헤더에 그려진 캐릭터 이름을 카드 순서대로. */
  async function 카드이름들(store: Partial<BossProfitStore>): Promise<string[]> {
    mockStore({ status: 'loaded', periodState: 'recorded', ...store })
    const { getAllByTestId } = await renderScreen()

    return getAllByTestId('character-accordion').map((card) =>
      within(card).getAllByText(/^(지내우시|두번째)$/)[0].props.children as string,
    )
  }

  it('저장 배열 순서가 카드 순서다 — 행 순서가 아니다', async () => {
    expect(
      await 카드이름들({
        trackedOcids: ['ocid-2', 'ocid-1'],
        rows: [보스행(), 보스행({ ocid: 'ocid-2', characterName: '두번째' })] }),
    ).toEqual(['두번째', '지내우시'])
  })

  // 순서를 정하는 함수가 목록의 크기를 바꾸면 안 된다 — 저장 목록과 행이 한순간 어긋날 때
  // 캐릭터 카드가 통째로 사라지는 것이 가장 나쁜 실패다.
  it('저장 목록에 없는 캐릭터의 카드도 사라지지 않는다', async () => {
    expect(
      await 카드이름들({
        trackedOcids: ['ocid-2'],
        rows: [보스행(), 보스행({ ocid: 'ocid-2', characterName: '두번째' })] }),
    ).toEqual(['두번째', '지내우시'])
  })
})

describe('총 수익 헤드라인 ([[ADR-046]] · [[ADR-054]] · [[ADR-124]] 결정 7)', () => {
  it('여러 캐릭터의 합계가 하나의 숫자로 선다', async () => {
    mockStore({
      status: 'loaded',
      periodState: 'recorded',
      rows: [보스행(), 보스행({ ocid: 'ocid-2', characterName: '두번째', payoutMeso: 3_000_000 })] })
    const { getByText } = await renderScreen()

    // 헤드라인과 카드가 같은 어휘(`N 메소`)를 쓰므로 합계 숫자로 가른다 — 카드는 5·3백만이다.
    expect(getByText(/^8,000,000 /)).toBeTruthy()
  })

  it('단위 앞에 **실제 공백 문자**를 남긴다 — 스크린리더가 붙여 읽지 않게', async () => {
    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행()] })
    const { getByText } = await renderScreen()

    expect(getByText('메소').parent?.props.children).toEqual(
      expect.arrayContaining([' ']),
    )
  })

  it('아이템 판매가가 결정석 위에 얹힌다', async () => {
    mockStore({
      status: 'loaded',
      periodState: 'recorded',
      rows: [보스행()],
      dropsByRowKey: {
        [`ocid-1|${주간보스}|하드|${CURRENT_WEEKLY}`]: [
          드롭({ priceState: 'entered', priceMeso: 2_000_000, priceShare: 1 }),
        ] } })
    const { getAllByText } = await renderScreen()

    // 헤드라인과 그 캐릭터 카드가 같은 값을 말한다 — 둘 다 움직여야 합산이 한 곳에서만 일어난다.
    expect(getAllByText(/^7,000,000 /)).toHaveLength(2)
  })

  it('미입력 드롭은 총액을 한 푼도 움직이지 않는다 — 0원이 아니라 "아직 안 적었다" 다', async () => {
    mockStore({
      status: 'loaded',
      periodState: 'recorded',
      rows: [보스행()],
      dropsByRowKey: {
        [`ocid-1|${주간보스}|하드|${CURRENT_WEEKLY}`]: [드롭({ priceMeso: 9_000_000 })] } })
    const { getAllByText } = await renderScreen()

    expect(getAllByText(/^5,000,000 /)).toHaveLength(2)
  })

  it('자세히 보기를 누르면 결정석·아이템·합계가 갈려 나온다', async () => {
    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행()] })
    const { getByLabelText, getByTestId, getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByLabelText('총 수익 자세히 보기'))
    })

    expect(getByTestId('item-revenue-popover')).toBeTruthy()
    expect(getByText('결정석')).toBeTruthy()
    expect(getByText('아이템')).toBeTruthy()
    expect(getByText('합계')).toBeTruthy()
  })

  it('월드를 아는 캐릭터가 있으면 결정석 판매 현황 칩이 선다', async () => {
    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행({ world: '스카니아' })] })
    const { getByLabelText } = await renderScreen()

    expect(getByLabelText(`주간 결정석 판매 1 / ${WEEKLY_CRYSTAL_SALE_LIMIT}`)).toBeTruthy()
  })

  it('기간 전체 고가 드롭이 있으면 헤드라인에도 뱃지가 붙는다([[ADR-046]])', async () => {
    mockStore({
      status: 'loaded',
      periodState: 'recorded',
      rows: [보스행()],
      dropsByRowKey: {
        [`ocid-1|${주간보스}|하드|${CURRENT_WEEKLY}`]: [드롭({ itemName: 고가아이템 })] } })
    const { getByLabelText } = await renderScreen()

    expect(getByLabelText('이 기간 고가 드롭')).toBeTruthy()
  })

  it('고가 드롭이 없으면 헤드라인 뱃지를 렌더하지 않는다', async () => {
    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행()] })
    const { queryByLabelText } = await renderScreen()

    expect(queryByLabelText('이 기간 고가 드롭')).toBeNull()
  })
})

describe('월간 탭', () => {
  it('주차별 합계만 있는 캐릭터도 그룹이 생긴다', async () => {
    mockStore({
      status: 'loaded',
      periodState: 'recorded',
      tab: 'monthly',
      loadedTab: 'monthly',
      periodKey: CURRENT_MONTHLY,
      loadedPeriodKey: CURRENT_MONTHLY,
      rows: [],
      weeklySubtotals: [주차소계()] })
    const { getByText } = await renderScreen()

    expect(getByText('지내우시')).toBeTruthy()
  })
})

describe('구조 계약', () => {
  it('페이지 헤더에는 경계 페이드를 두지 않는다([[ADR-047]] 결정 6 — 회귀 가드)', async () => {
    const { queryByTestId, getByTestId } = await renderScreen()

    expect(getByTestId('page-header')).toBeTruthy()
    expect(queryByTestId('page-header-fade')).toBeNull()
  })

  it('기간이 바뀌면 스크롤을 최상단으로 옮긴다([[ADR-080]]) — 목적지가 0 인 것이 계약이다', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    const { rerender } = await renderScreen()
    scrollTo.mockClear()

    mockStore({ periodKey: '2026-07-09' })
    await act(async () => {
      rerender(
        <SafeAreaProvider initialMetrics={테스트_안전영역}>
          <ThemeProvider>
            <BossProfitScreen />
          </ThemeProvider>
        </SafeAreaProvider>,
      )
    })

    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false })
    scrollTo.mockRestore()
  })

  it('탭·기간이 그대로면 스크롤을 건드리지 않는다 — 히스토리 왕복의 위치 유지([[ADR-077]])가 깨진다', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo')
    const { rerender } = await renderScreen()
    scrollTo.mockClear()

    await act(async () => {
      rerender(
        <SafeAreaProvider initialMetrics={테스트_안전영역}>
          <ThemeProvider>
            <BossProfitScreen />
          </ThemeProvider>
        </SafeAreaProvider>,
      )
    })

    expect(scrollTo).not.toHaveBeenCalled()
    scrollTo.mockRestore()
  })

  it('탭·기간이 아코디언 key 에 들어가 이동하면 펼침이 리셋된다(#27)', async () => {
    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행()] })
    const { getByText, queryByText, rerender } = await renderScreen()

    // 헤더 전체가 버튼이라 이름을 눌러도 같은 곳이 받는다(`aria-expanded` 는 자세히 보기 칩도
    // 갖고 있어 역할 질의로는 갈리지 않는다).
    await act(async () => {
      fireEvent.press(getByText('지내우시'))
    })
    expect(queryByText(주간보스)).toBeTruthy()

    mockStore({ status: 'loaded', periodState: 'recorded', rows: [보스행()], periodKey: '2026-07-09' })
    await act(async () => {
      rerender(
        <SafeAreaProvider initialMetrics={테스트_안전영역}>
          <ThemeProvider>
            <BossProfitScreen />
          </ThemeProvider>
        </SafeAreaProvider>,
      )
    })

    expect(queryByText(주간보스)).toBeNull()
  })
})

