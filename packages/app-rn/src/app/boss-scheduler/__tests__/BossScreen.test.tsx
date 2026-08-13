// 웹판 넷(`BossScreen.test.tsx` 1,695줄 · `.view-state` · `.cold-start` · `.dom-snapshot`)의
// **명세를 읽어 다시 쓴 것**이다.
//
// ── 갈린 것 여섯 ─────────────────────────────────────────────────────────────────────
//
// ① **라우터 프로브가 없다** — 이동은 `navigation.navigate('BossManage')` 가 불렸는가로 본다.
//    웹은 `/boss/manage` 에 프로브 요소를 두고 그것이 나타나는지 봤다.
// ② **당겨서 새로고침이 `RefreshControl` 이다**([[ADR-130]]). 웹의 제스처 시뮬레이션 넷(임계
//    넘김/미달 · 배너 위치 · 목록 transform)은 **옮길 계약이 아니다** — 그 값들을 이제 OS 가 갖는다.
//    남는 계약은 *"당김이 헤더 버튼과 같은 재조회를 부르는가"*([[ADR-072]] 결정 2)와 *"버튼이 그대로
//    남는가"*(결정 10) 둘이고, 컨텐츠 스케줄러와 **같은 방식으로** 본다(두 탭이 갈리면 회귀다).
// ③ **고정 헤더 실측·spacer 계약이 사라진다** — `fixed` 도 spacer 도 옮길 자리가 없고
//    ([[ADR-085]]·[[ADR-112]], `PageHeader` 파일 머리), [[ADR-131]] 뒤로는 헤더가 고정되지도
//    않는다. 대신 *"헤더가 셸의 `header` 로 들어가고 모달은 셸 바깥"* 을 본다.
// ④ `getByRole('combobox')`(웹 `<select>`) → **드롭다운 트리거의 캐릭터 이름**으로 기다린다.
// ⑤ **콜드 스타트 파일이 따로 없다** — 웹은 선하이드레이션 하네스를 세워 프레임 순서를 봤는데,
//    RN 에서 그 순서를 만드는 것은 `AppShell` 의 `prehydrateTabStores` 이고 그쪽 테스트가 이미
//    갖고 있다([[ADR-101]] 결정 2). 여기 남는 것은 **[[ADR-101]] 결정 1** — `null` 을 0명으로 읽지
//    않는가 — 이고 그것은 한 케이스다.
// ⑥ DOM 스냅샷 둘은 옮기지 않는다(전환 계획서 «잃는 안전망») — 대신 각 가지를 케이스로 적는다.
import { act, fireEvent, screen } from '@testing-library/react-native'
import { useState } from 'react'

import {
  useBossSchedulerStore,
  type BossCharacterView,
  type BossSchedulerStore,
} from '@core/features/boss-scheduler/store'
import { getCharacterPickerRoster } from '@core/features/schedule-sync/schedule-sync'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import type { MatchedBoss } from '@core/lib/boss-matching'
import { NexonAuthError, NexonRateLimitError } from '@core/nexon/errors'
import type { CharacterPickerEntry } from '@core/types'

import { renderOverlay, type AtomElement } from '../../../components/__tests__/render-atom'
import { useScreenNavigation } from '../../use-screen-navigation'
import { BossScreen } from '../BossScreen'

// 이름이 `mock` 으로 시작해야 한다 — babel-jest 가 `jest.mock` 팩토리 밖 변수 참조를 막는데
// 그 접두사만 예외로 통과시킨다.
const mockShowError = jest.fn()
const mockShowInfo = jest.fn()
const mockNoticeApiKeyIssue = jest.fn()
const mockGetRoster = jest.fn()
const navigate = jest.fn()
const setParams = jest.fn()

// [[ADR-063]]: 동기화 실패·파티원 수 저장 실패는 인라인 문단이 아니라 토스트다.
jest.mock('@core/features/toast/store', () => ({
  useToastStore: {
    getState: () => ({ showError: mockShowError, showSuccess: jest.fn(), showInfo: mockShowInfo }),
  },
}))

// [[ADR-115]] 결정 7 · [[ADR-116]] 결정 1: 401·429 는 토스트가 아니라 키 재입력 진입점으로 간다.
jest.mock('@core/features/onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyIssue: mockNoticeApiKeyIssue }) },
}))

jest.mock('@core/features/boss-scheduler/store', () => ({
  useBossSchedulerStore: jest.fn(),
  partySizeKey: (ocid: string, boss: string, difficulty: string) => `${ocid}:${boss}:${difficulty}`,
}))

// [[ADR-062]]: 화면이 `toScheduleSyncError` 로 reject 를 원인으로 바꾸므로 그 매핑은 실물을 쓰고
// `getCharacterPickerRoster` 만 대체한다(부분 모킹). **웹의 `...importOriginal()` 을 그대로 옮기면
// 죽는다** — `schedule-sync` ↔ `character-roster` ↔ `character-eligibility` 가 순환 참조라 팩토리
// 안의 `requireActual` 이 아직 구성 중인 모듈을 `undefined` 로 만난다(step 2·4 와 같은 자리).
jest.mock('@core/features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('@core/features/schedule-sync/errors')>(
    '@core/features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: (...args: unknown[]) => mockGetRoster(...args),
}))

jest.mock('../../use-screen-navigation', () => ({ useScreenNavigation: jest.fn() }))

// 라우트 파라미터(`openPicker`)는 케이스마다 갈리므로 변수를 통해 준다. 이름이 `mock` 으로
// 시작해야 팩토리 밖 변수 참조가 허용된다(위 목들과 같은 규칙).
let mockRouteParams: { openPicker?: boolean } | undefined
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}))

const mockedStore = jest.mocked(useBossSchedulerStore)
const mockedRoster = mockGetRoster as unknown as jest.MockedFunction<typeof getCharacterPickerRoster>
const mockedNavigation = jest.mocked(useScreenNavigation)

// `ReturnType<typeof useBossSchedulerStore>` 은 **`unknown` 이 된다**(zustand 의 훅이 오버로드라
// tsc 가 셀렉터 시그니처를 집는다). 스토어가 그 타입을 이미 내보내므로 그것을 그대로 쓴다.
type Store = BossSchedulerStore

/**
 * 탭과 두 필터가 스토어 소유라([[ADR-096]] 결정 1) 정적 목으로는 전환이 렌더에 반영되지 않는다 —
 * 모킹된 훅도 렌더 중에 불리므로 여기서 `useState` 로 실물과 같은 "값 + 세터" 쌍을 흉내 낸다.
 */
function mockStore(overrides: Partial<Store> = {}): Store {
  const base = {
    status: 'idle',
    characters: [],
    error: null,
    trackedOcids: null,
    selectedOcid: null,
    partySizes: {},
    manualTrackedByOcid: {},
    loadTrackedOcids: jest.fn(),
    saveTrackedOcids: jest.fn(),
    refresh: jest.fn(),
    selectCharacter: jest.fn(),
    loadPartySizes: jest.fn(),
    setPartySize: jest.fn(),
    addManualBoss: jest.fn(),
    removeManualBoss: jest.fn(),
    setManualBossDifficulty: jest.fn(),
    activeTab: 'weekly' as const,
    setActiveTab: jest.fn(),
    weeklyFilter: 'all' as const,
    setWeeklyFilter: jest.fn(),
    monthlyFilter: 'all' as const,
    setMonthlyFilter: jest.fn(),
    ...overrides,
  } as Store

  mockedStore.mockImplementation(() => {
    const [activeTab, setActiveTab] = useState(base.activeTab)
    const [weeklyFilter, setWeeklyFilter] = useState(base.weeklyFilter)
    const [monthlyFilter, setMonthlyFilter] = useState(base.monthlyFilter)
    return { ...base, activeTab, setActiveTab, weeklyFilter, setWeeklyFilter, monthlyFilter, setMonthlyFilter }
  })
  return base
}

function character(overrides: Partial<BossCharacterView> = {}): BossCharacterView {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터1',
    weeklyBosses: [],
    monthlyBosses: [],
    weeklyBossClearCount: null,
    weeklyBossClearLimitCount: null,
    isStale: false,
    syncedAt: null,
    error: null,
    ...overrides,
  }
}

// 보스 이름·난이도는 **참조 데이터에 실재하는 것만** 쓴다([[ADR-006]] — 게임 수치를 지어내지 않는다).
function boss(overrides: Partial<MatchedBoss> = {}): MatchedBoss {
  return {
    apiName: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: false,
    ownComplete: false,
    matchedBossName: '자쿰',
    portraitSlug: 'zakum',
    isSeasonBoss: false,
    ...overrides,
  }
}

function pickerEntry(overrides: Partial<CharacterPickerEntry> = {}): CharacterPickerEntry {
  return { ocid: 'roster-ocid', name: '로스터캐릭터', level: 200, imageUrl: null, ...overrides }
}

async function renderScreen(): Promise<ReturnType<typeof renderOverlay>> {
  return renderOverlay(<BossScreen />)
}

async function press(element: AtomElement): Promise<void> {
  await act(async () => {
    fireEvent.press(element)
  })
}

/** 글자에서 위로 올라가 실제로 눌리는 조상을 찾는다(웹의 `getByRole('button', { name })`). */
function button(label: string, index = 0): AtomElement {
  let node: AtomElement | null = screen.getAllByText(label)[index]
  while (node !== null && node.props.role !== 'button') node = node.parent
  if (node === null) throw new Error(`버튼을 찾지 못했다: ${label}`)
  return node
}

/** 스크롤 셸에 붙은 당겨서 새로고침 컨트롤([[ADR-130]] 결정 1). */
function refreshControl(): { refreshing: boolean; onRefresh: () => void } {
  return screen.getByTestId('screen-scroll').props.refreshControl.props
}

beforeEach(() => {
  mockRouteParams = undefined
  mockShowError.mockClear()
  mockShowInfo.mockClear()
  mockNoticeApiKeyIssue.mockClear()
  navigate.mockClear()
  setParams.mockClear()
  mockGetRoster.mockClear()
  mockedNavigation.mockReturnValue({ navigate, goBack: jest.fn(), setParams } as never)
  mockedRoster.mockImplementation(async (onUpdate) => {
    onUpdate([])
  })
  useTrackingModeStore.setState({ mode: 'auto' })
})

describe('BossScreen — 빈 상태와 마운트', () => {
  it('마운트하면 loadTrackedOcids 를 부른다', async () => {
    const store = mockStore()

    await renderScreen()

    expect(store.loadTrackedOcids).toHaveBeenCalled()
  })

  it('추적 목록이 빈 배열이면 빈 상태 안내만 보인다', async () => {
    mockStore({ trackedOcids: [] })

    await renderScreen()

    expect(screen.getByText('표시할 캐릭터가 없습니다')).toBeTruthy()
    expect(screen.queryByTestId('screen-scroll')).toBeNull()
  })

  // [[ADR-101]] 결정 1 — `null` 은 "0명"이 아니라 "아직 안 읽었다"다. 콜드 스타트 첫 페인트가
  // 모르는 사실을 단정하면 안 된다(웹은 이 계약에 파일 하나를 썼다 — 파일 머리 ⑤).
  it('추적 목록이 null(미로드)이면 빈 상태가 아니라 로딩을 보여준다', async () => {
    mockStore({ trackedOcids: null, status: 'idle' })

    await renderScreen()

    expect(screen.queryByText('표시할 캐릭터가 없습니다')).toBeNull()
    expect(screen.getByText('불러오고 있어요')).toBeTruthy()
  })

  it('빈 상태 CTA 를 누르면 캐릭터 관리 피커가 열린다', async () => {
    mockStore({ trackedOcids: [] })
    await renderScreen()

    await press(button('캐릭터 선택하기'))

    expect(screen.getByTestId('character-tracking-picker-modal')).toBeTruthy()
  })

  // 웹의 `?openPicker=1` 자리(파일 머리 ②의 라우트 파라미터). 보내는 쪽은 step 7 이지만 받는 쪽은
  // 이 화면의 계약이다 — [[ADR-068]] 결정 4 가 "조회 불가 캐릭터"에서 여기로 보낸다.
  it('openPicker 파라미터로 진입하면 피커가 열린 채로 시작하고 파라미터를 지운다', async () => {
    mockRouteParams = { openPicker: true }
    mockStore({ trackedOcids: [] })

    await renderScreen()

    expect(screen.getByTestId('character-tracking-picker-modal')).toBeTruthy()
    // 안 지우면 탭을 떠났다 돌아올 때마다 피커가 다시 열린다.
    expect(setParams).toHaveBeenCalledWith({ openPicker: undefined })
  })

  it('파라미터가 없으면 피커도 닫혀 있고 지우지도 않는다', async () => {
    mockStore({ trackedOcids: [] })

    await renderScreen()

    expect(screen.queryByTestId('character-tracking-picker-modal')).toBeNull()
    expect(setParams).not.toHaveBeenCalled()
  })
})

describe('BossScreen — 목록 ([[ADR-031]])', () => {
  const withBosses = (): Store =>
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss(),
            boss({ apiName: '매그너스', matchedBossName: '매그너스', difficulty: '하드', isRegistered: false }),
          ],
          monthlyBosses: [
            boss({
              apiName: '검은 마법사',
              matchedBossName: '검은마법사',
              difficulty: '하드',
              cycle: 'monthly',
              portraitSlug: 'blackMage',
              isComplete: true,
              ownComplete: true,
            }),
          ],
          weeklyBossClearCount: 3,
          weeklyBossClearLimitCount: 12,
        }),
      ],
    })

  it('기본 탭은 주간이고, 등록된 보스만 보이며 n/12 배지를 그린다', async () => {
    withBosses()

    await renderScreen()

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.getByText('카오스')).toBeTruthy()
    expect(screen.queryByText('매그너스')).toBeNull()
    expect(screen.queryByText('검은마법사')).toBeNull()
    expect(screen.getByText('3/12')).toBeTruthy()
  })

  it('월간 탭으로 바꾸면 월간 보스만 보이고 n/12 배지는 사라진다 — 12는 주간 한도다', async () => {
    withBosses()
    await renderScreen()

    await press(button('월간'))

    expect(screen.getByText('검은마법사')).toBeTruthy()
    expect(screen.queryByText('자쿰')).toBeNull()
    expect(screen.queryByText('3/12')).toBeNull()
  })

  it('완료된 보스에만 완료 배지가 붙는다', async () => {
    withBosses()
    await renderScreen()

    expect(screen.queryByText('완료')).toBeNull()

    await press(button('월간'))

    expect(screen.getByText('완료')).toBeTruthy()
  })

  // [[ADR-031]] 결정 5 — 미등록이어도 완료된 보스는 목록에 남는다(게임에서 지웠어도 잡은 것은 사실).
  it('미등록이어도 완료된 보스는 카드로 표시된다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss({ apiName: '자쿰', matchedBossName: '자쿰', isRegistered: false, isComplete: true }),
            boss({ apiName: '매그너스', matchedBossName: '매그너스', difficulty: '하드', isRegistered: false }),
          ],
        }),
      ],
    })

    await renderScreen()

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('매그너스')).toBeNull()
  })

  // [[ADR-016]] — 캐시가 있으면 재검증 중에도 계속 보여준다(셸 승계 카드는 보여줄 게 없을 때만).
  it('status 가 loading 이어도 캐시된 목록이 있으면 로딩 대신 목록을 보여준다', async () => {
    mockStore({ status: 'loading', trackedOcids: ['ocid-1'], characters: [character({ weeklyBosses: [boss()] })] })

    await renderScreen()

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('불러오고 있어요')).toBeNull()
  })

  it('헤더와 목록이 공용 스크롤 셸 안에 있고, 모달은 그 바깥이다', async () => {
    withBosses()
    await renderScreen()

    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screen.getByTestId('screen-scroll')).toBeTruthy()

    await press(button('캐릭터 관리'))
    let node: AtomElement | null = screen.getByTestId('character-tracking-picker-modal')
    let insideShell = false
    while (node !== null) {
      if (node.props.testID === 'screen-scroll') insideShell = true
      node = node.parent
    }
    expect(insideShell).toBe(false)
  })
})

// [[ADR-031]] 결정 3 · [[ADR-056]] 결정 2 — 판정은 화면이 아니라 `isChallengersWorld` 가 한다.
describe('BossScreen — 챌린저스 시즌 보스 배지 ([[ADR-031]])', () => {
  const seasonBoss = (overrides: Partial<MatchedBoss> = {}): MatchedBoss =>
    boss({
      apiName: '시즌 보스 메이린',
      matchedBossName: '시즌 보스 메이린',
      difficulty: '하드',
      portraitSlug: 'maerin',
      isSeasonBoss: true,
      isRegistered: false,
      ...overrides,
    })

  const withWorld = (world: string | undefined, bosses: MatchedBoss[]): void => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ world, weeklyBosses: bosses })],
    })
  }

  it('챌린저스 월드면 등록 여부와 무관하게 season 배지를 보여준다', async () => {
    withWorld('챌린저스2', [seasonBoss()])

    await renderScreen()

    expect(screen.getByText('season 미완료')).toBeTruthy()
  })

  it('시즌 보스가 완료됐으면 배지가 완료를 말한다', async () => {
    withWorld('챌린저스', [seasonBoss({ isComplete: true })])

    await renderScreen()

    expect(screen.getByText('season 완료')).toBeTruthy()
  })

  it('일반 월드면 시즌 보스 항목이 있어도 배지가 없다', async () => {
    withWorld('스카니아', [seasonBoss()])

    await renderScreen()

    expect(screen.queryByText(/season/)).toBeNull()
  })

  // 월드를 모르는 구버전 캐시는 비-챌린저스로 취급한다 — 관리 페이지의 목록 판정과 같아야 한다.
  it('월드를 모르면 배지가 없다', async () => {
    withWorld(undefined, [seasonBoss()])

    await renderScreen()

    expect(screen.queryByText(/season/)).toBeNull()
  })

  it('챌린저스 월드여도 시즌 보스 항목이 없으면 배지가 없다', async () => {
    withWorld('챌린저스', [boss()])

    await renderScreen()

    expect(screen.queryByText(/season/)).toBeNull()
  })
})

describe('BossScreen — 재조회 ([[ADR-072]] · [[ADR-130]])', () => {
  const loaded = (status: Store['status'] = 'loaded'): Store =>
    mockStore({ status, trackedOcids: ['ocid-1'], characters: [character({ weeklyBosses: [boss()] })] })

  it('헤더 새로고침 버튼을 누르면 refresh 를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await press(screen.getByLabelText('새로고침'))

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // [[ADR-130]] 결정 1 — 당김과 버튼이 **같은 재조회**를 부른다([[ADR-072]] 결정 2). 컨텐츠
  // 스케줄러와 같은 배선이어야 한다.
  it('당겨서 새로고침은 헤더 버튼과 같은 재조회를 부른다', async () => {
    const store = loaded()
    await renderScreen()

    await act(async () => {
      refreshControl().onRefresh()
    })

    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // [[ADR-072]] 결정 10 — 제스처를 붙여도 버튼은 그대로 남는다(추가 수단이지 대체가 아니다).
  it('제스처가 붙어도 헤더 버튼은 남는다', async () => {
    loaded()
    await renderScreen()

    expect(screen.getByLabelText('새로고침')).toBeTruthy()
    expect(refreshControl()).toBeDefined()
  })

  it('조회 중이면 인디케이터가 돌고 "조회 중..." 을 보여준다', async () => {
    loaded('loading')
    await renderScreen()

    expect(screen.getByText('조회 중...')).toBeTruthy()
    expect(refreshControl().refreshing).toBe(true)
  })
})

describe('BossScreen — 실패의 목적지', () => {
  const failWith = (error: Store['error']): Store =>
    mockStore({ status: 'error', error, trackedOcids: ['ocid-1'], characters: [character()] })

  it('401 은 토스트가 아니라 키 무효화 경로로 간다', async () => {
    failWith({ kind: 'invalidApiKey' })

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('429 도 같은 진입점을 탄다 — 토스트는 아예 없다', async () => {
    failWith({ kind: 'rateLimited' })

    await renderScreen()

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('rateLimited')
    expect(mockShowError).not.toHaveBeenCalled()
  })

  it('네트워크 실패는 다시 시도 액션이 붙은 토스트다', async () => {
    const store = failWith({ kind: 'network' })
    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
    const action = mockShowError.mock.calls[0][1] as { label: string; onClick: () => void }
    expect(action.label).toBe('다시 시도')
    action.onClick()
    expect(store.refresh).toHaveBeenCalledWith(['ocid-1'])
  })

  // [[ADR-083]] 결정 1 — 실패의 대부분은 전역이 아니라 **캐릭터별**로 온다.
  it('캐릭터별 실패도 토스트다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ error: { kind: 'network' } })],
    })

    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
  })

  // [[ADR-083]] 결정 2 — 영구 실패라 "다시 시도"는 눌러도 같은 400 이다.
  it('characterUnavailable 토스트에는 액션이 없다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ error: { kind: 'characterUnavailable' } })],
    })

    await renderScreen()

    expect(mockShowError).toHaveBeenCalledTimes(1)
    expect(mockShowError.mock.calls[0][1]).toBeUndefined()
  })

  it('isStale 이지만 error 가 없으면(캐시 우선 표시) 아무것도 알리지 않는다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ isStale: true, error: null })],
    })

    await renderScreen()

    expect(mockShowError).not.toHaveBeenCalled()
    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })
})

describe('BossScreen — 솔로/파티 필터 ([[ADR-019]] · [[ADR-096]])', () => {
  const 스우 = boss({ apiName: '스우', matchedBossName: '스우', difficulty: '하드', portraitSlug: 'lucid' })

  const withFilterFixture = (): Store =>
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      // 자쿰만 4인 파티 — 나머지는 설정이 없어 솔로로 친다([[ADR-019]] 결정 3).
      partySizes: { 'ocid-1:자쿰:카오스': 4 },
      characters: [character({ weeklyBosses: [boss(), 스우] })],
    })

  it('파티원 2인 이상 설정된 카드에만 "n인" 배지가 붙는다', async () => {
    withFilterFixture()

    await renderScreen()

    expect(screen.getByText('4인')).toBeTruthy()
    expect(screen.queryByText('1인')).toBeNull()
  })

  it('필터를 "파티"로 고르면 2인 이상만 남는다', async () => {
    withFilterFixture()
    await renderScreen()

    await press(button('파티'))

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('스우')).toBeNull()
  })

  it('필터를 "솔로"로 고르면 미설정·1인만 남는다', async () => {
    withFilterFixture()
    await renderScreen()

    await press(button('솔로'))

    expect(screen.getByText('스우')).toBeTruthy()
    expect(screen.queryByText('자쿰')).toBeNull()
  })

  // [[ADR-096]] 결정 1 — 두 탭의 필터는 독립이다(한 탭을 바꿔도 다른 탭은 전체).
  it('주간 필터를 바꿔도 월간 탭은 전체다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      partySizes: { 'ocid-1:자쿰:카오스': 4 },
      characters: [
        character({
          weeklyBosses: [boss(), 스우],
          monthlyBosses: [
            boss({
              apiName: '검은 마법사',
              matchedBossName: '검은마법사',
              difficulty: '하드',
              cycle: 'monthly',
              portraitSlug: 'blackMage',
            }),
          ],
        }),
      ],
    })
    await renderScreen()

    await press(button('파티'))
    await press(button('월간'))

    // 월간 보스는 파티 설정이 없어 "파티" 필터였다면 사라졌을 것이다.
    expect(screen.getByText('검은마법사')).toBeTruthy()
  })

  // 보스가 0건인 빈 상태와 **다른 문구·다른 CTA** 다([[ADR-060]] 결정 3).
  it('필터 결과가 0개면 필터 빈 상태를 보여주고 CTA 가 필터를 되돌린다', async () => {
    // 파티 설정이 하나도 없으므로 "파티" 필터의 결과가 0이다 — 보스 자체는 있다.
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ weeklyBosses: [boss(), 스우] })],
    })
    await renderScreen()

    await press(button('파티'))

    expect(screen.getByText('이 조건에 해당하는 보스가 없습니다')).toBeTruthy()
    // 보스가 0건인 빈 상태의 문구가 아니다.
    expect(screen.queryByText('등록된 주간 보스가 없습니다')).toBeNull()

    await press(button('필터 초기화'))

    expect(screen.getByText('자쿰')).toBeTruthy()
    expect(screen.queryByText('이 조건에 해당하는 보스가 없습니다')).toBeNull()
  })
})

describe('BossScreen — 빈 상태 문구 ([[ADR-060]])', () => {
  it('자동 모드는 게임 등록을 안내하고 CTA 가 없다 — 목적지가 앱 밖이다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })

    await renderScreen()

    expect(screen.getByText('등록된 주간 보스가 없습니다')).toBeTruthy()
    // "보스 관리"는 **헤더 버튼 하나뿐**이다 — 빈 상태에 CTA 가 붙었다면 둘이 된다.
    expect(screen.getAllByText('보스 관리')).toHaveLength(1)
  })

  it('수동 모드는 "보스 관리" CTA 를 주고, 누르면 관리 페이지로 간다', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character()] })
    await renderScreen()

    expect(screen.getByText('추적할 주간 보스가 없습니다')).toBeTruthy()
    // 헤더 버튼과 CTA 가 같은 라벨이라 둘째 것을 누른다(CTA).
    await press(button('보스 관리', 1))

    expect(navigate).toHaveBeenCalledWith('BossManage')
  })

  // 캐시 우선 표시 중(`isStale`)에는 자동 모드에서 "없다"고 단정하지 않는다.
  it('자동 모드에서 isStale 이면 빈 상태 문구를 그리지 않는다', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character({ isStale: true })] })

    await renderScreen()

    expect(screen.queryByText('등록된 주간 보스가 없습니다')).toBeNull()
  })

  it('헤더 "보스 관리" 버튼을 누르면 관리 페이지로 간다 ([[ADR-035]] 결정 18)', async () => {
    mockStore({ status: 'loaded', trackedOcids: ['ocid-1'], characters: [character({ weeklyBosses: [boss()] })] })
    await renderScreen()

    await press(button('보스 관리'))

    expect(navigate).toHaveBeenCalledWith('BossManage')
  })
})

describe('BossScreen — 카드 탭 → 파티 인원 모달 ([[ADR-121]])', () => {
  const opened = async (overrides: Partial<Store> = {}): Promise<Store> => {
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ weeklyBosses: [boss()] })],
      ...overrides,
    })
    await renderScreen()
    await press(screen.getByLabelText('자쿰 파티 설정'))
    return store
  }

  it('보스 카드를 탭하면 파티 인원 모달이 열린다', async () => {
    await opened()

    expect(screen.getByTestId('party-size-modal')).toBeTruthy()
    expect(screen.getByText('주간 보스')).toBeTruthy()
  })

  // 파티 인원은 완료 여부와 무관한 상시 데이터다([[ADR-019]]).
  it('완료된 보스도 탭할 수 있다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [character({ weeklyBosses: [boss({ isComplete: true })] })],
    })
    await renderScreen()

    await press(screen.getByLabelText('자쿰 파티 설정'))

    expect(screen.getByTestId('party-size-modal')).toBeTruthy()
  })

  it('스테퍼를 누르면 그 (보스, 난이도)로 setPartySize 를 부른다', async () => {
    const store = await opened()

    await press(screen.getByLabelText('자쿰 파티원 수 증가'))

    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스', 2)
  })

  it('저장이 실패하면 관리 페이지와 같은 문구로 토스트를 띄운다', async () => {
    await opened({ setPartySize: jest.fn(async () => Promise.reject(new Error('boom'))) as Store['setPartySize'] })

    await press(screen.getByLabelText('자쿰 파티원 수 증가'))

    expect(mockShowError).toHaveBeenCalledWith('파티원 수를 저장하지 못했습니다')
  })

  it('닫기를 누르면 모달이 사라진다', async () => {
    await opened()

    await press(screen.getByLabelText('닫기'))

    expect(screen.queryByTestId('party-size-modal')).toBeNull()
  })

  // [[ADR-121]] 결정 3 — 자동 모드의 난이도 전환은 멤버십이 아니라 "편집 대상" 전환이다.
  // 자쿰은 참조표에 카오스 하나뿐이라 세그먼트에 고를 것이 없다 — 셋을 가진 스우로 연다.
  it('자동 모드에서 난이도를 바꿔도 멤버십 API 를 부르지 않고 그 난이도의 인원을 편집한다', async () => {
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      characters: [
        character({
          weeklyBosses: [
            boss({ apiName: '스우', matchedBossName: '스우', difficulty: '하드', portraitSlug: 'lucid' }),
          ],
        }),
      ],
    })
    await renderScreen()
    await press(screen.getByLabelText('스우 파티 설정'))

    await press(button('익스트림'))

    expect(store.setManualBossDifficulty).not.toHaveBeenCalled()

    // 편집 대상이 옮겨졌다는 증거 — 이제 스테퍼가 그 난이도로 저장한다.
    await press(screen.getByLabelText('스우 파티원 수 증가'))
    expect(store.setPartySize).toHaveBeenCalledWith('ocid-1', '스우', '익스트림', 2)
  })

  it('수동 모드에서 난이도를 바꾸면 단일 액션으로 멤버십을 교체한다 ([[ADR-121]] 결정 6)', async () => {
    useTrackingModeStore.setState({ mode: 'manual' })
    const store = mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: {
        'ocid-1': [{ kind: 'boss', contentName: '스우', difficulty: '하드' }],
      },
      characters: [character()],
    })
    await renderScreen()

    await press(screen.getByLabelText('스우 파티 설정'))
    await press(button('노멀'))

    expect(store.setManualBossDifficulty).toHaveBeenCalledWith('ocid-1', '스우', '노멀')
  })
})

describe('BossScreen — 수동 모드 ([[ADR-035]])', () => {
  beforeEach(() => {
    useTrackingModeStore.setState({ mode: 'manual' })
  })

  it('게임 등록·완료와 무관하게 추적 중인 보스를 표시한다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: { 'ocid-1': [{ kind: 'boss', contentName: '스우', difficulty: '하드' }] },
      // 게임에는 자쿰이 등록돼 있지만 추적 목록에는 없다.
      characters: [character({ weeklyBosses: [boss()] })],
    })

    await renderScreen()

    expect(screen.getByText('스우')).toBeTruthy()
    expect(screen.queryByText('자쿰')).toBeNull()
  })

  it('한 번도 동기화된 적 없는 보스도 참조 테이블 cycle 로 표시한다', async () => {
    mockStore({
      status: 'loaded',
      trackedOcids: ['ocid-1'],
      manualTrackedByOcid: { 'ocid-1': [{ kind: 'boss', contentName: '검은마법사', difficulty: '하드' }] },
      characters: [character()],
    })
    await renderScreen()

    // 월간 참조표의 보스라 주간 탭에는 없고 월간 탭에 있다.
    expect(screen.queryByText('검은마법사')).toBeNull()
    await press(button('월간'))
    expect(screen.getByText('검은마법사')).toBeTruthy()
  })
})

describe('BossScreen — 캐릭터 관리 피커 ([[ADR-053]])', () => {
  function deferredRoster(): {
    emit: (entries: CharacterPickerEntry[]) => void
    fail: (error: unknown) => void
  } {
    let emit: (entries: CharacterPickerEntry[]) => void = () => {}
    let fail: (error: unknown) => void = () => {}
    mockedRoster.mockImplementation(
      (onUpdate) =>
        new Promise<void>((_resolve, reject) => {
          emit = (entries) => onUpdate(entries)
          fail = (error) => reject(error)
        }),
    )
    // **콜백을 그대로 돌려주면 안 된다** — 위 대입은 `mockImplementation` 이 실제로 불릴 때
    // (= 화면이 피커를 열 때) 일어나므로, 지금 값을 캡처하면 영원히 빈 함수를 쥔다.
    return { emit: (entries) => emit(entries), fail: (error) => fail(error) }
  }

  async function openPicker(): Promise<void> {
    mockStore({ trackedOcids: [] })
    await renderScreen()
    await press(button('캐릭터 선택하기'))
  }

  it('조회 중이고 보여줄 항목이 없으면 스피너를 보여준다', async () => {
    deferredRoster()
    await openPicker()

    expect(screen.getByTestId('character-tracking-picker-body')).toBeTruthy()
    expect(screen.queryByText('표시할 캐릭터가 없어요')).toBeNull()
  })

  // [[ADR-016]] 웜 캐시 — 항목이 도착하면 조회가 안 끝났어도 목록을 그린다.
  it('조회가 끝나기 전에 항목이 도착하면 바로 목록을 보여준다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.emit([pickerEntry({ name: '내옆에최성일' })])
    })

    expect(screen.getByText('내옆에최성일')).toBeTruthy()
  })

  it('401 로 reject 되면 키 무효화 경로로 간다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.fail(new NexonAuthError('401'))
    })

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('invalid')
  })

  // [[ADR-116]] 결정 1 — 빈 상태에서 연 피커가 429 면 EmptyState 루프가 아니라 키 재입력이다.
  it('429 로 reject 되면 키 재입력 경로로 간다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.fail(new NexonRateLimitError('429'))
    })

    expect(mockNoticeApiKeyIssue).toHaveBeenCalledWith('rateLimited')
  })

  it('401·429 가 아닌 실패는 키 재입력 경로를 타지 않는다', async () => {
    const roster = deferredRoster()
    await openPicker()

    await act(async () => {
      roster.fail(new Error('boom'))
    })

    expect(mockNoticeApiKeyIssue).not.toHaveBeenCalled()
  })

  it('저장하면 saveTrackedOcids 를 부른다', async () => {
    const store = mockStore({ trackedOcids: [] })
    mockedRoster.mockImplementation(async (onUpdate) => {
      onUpdate([pickerEntry({ ocid: 'ocid-2', name: '내옆에최성일' })])
    })
    await renderScreen()
    await press(button('캐릭터 선택하기'))

    await press(screen.getByText('내옆에최성일'))
    await press(button('저장'))

    expect(store.saveTrackedOcids).toHaveBeenCalled()
  })
})
