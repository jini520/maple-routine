// 웹판(183줄)의 명세를 읽어 다시 쓴 것 — 이 파일이 보는 것은 **어느 `status` 에서 어떤 화면이
// 오는가** 하나다(각 단계의 내부는 그 단계의 테스트가 본다).
//
// 갈린 것 넷
// ① `container.firstElementChild` 의 `min-h-[calc(100dvh-…)]` 을 보던 자리가 **콘텐츠 컨테이너의
//    `flexGrow`** 로 바뀐다 — 웹이 그 min-height 로 만든 "남는 세로 공간"을 RN 스크롤에서는 그것이
//    만든다(그 공간이 있어야 프로브 대기의 `m-auto`·전체 대기의 `justify-center` 가 작동한다).
// ② `getByLabelText(/API 키/)` → `getByLabelText('Nexon Open API 키')`.
// ③ `getByRole('progressbar')` 로는 못 찾는다 — `AccountSelectionList` 테스트와 같은 이유로
//    `toJSON()` 트리에서 프롭으로 고른다.
// ④ 스토어 목이 **셀렉터를 받는다** — `useOnboardingStore()` 는 전체 상태를 돌려주지만 같은 훅을
//    `RootNavigator` 등이 셀렉터와 함께 부르므로, 목 하나가 두 쓰임을 다 받아야 한다.
import { useOnboardingStore } from '@core/features/onboarding/store'
import type { MapleAccount } from '@core/types'

import { renderOverlay, type TreeNode } from '../../../components/__tests__/render-atom'
import { OnboardingScreen } from '../OnboardingScreen'

jest.mock('@core/features/onboarding/store', () => ({
  useOnboardingStore: jest.fn(),
}))

// `ContentCharacterStep` 이 마운트 시 호출한다 — 후보 목록은 비워둔다(렌더 확인만).
jest.mock('@core/features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('@core/features/schedule-sync/errors')>(
    '@core/features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: jest.fn(async () => {}),
}))

// [[ADR-113]] 결정 3: `AccountSelectionList` 는 프로브가 settle 하기 전에는 목록 대신 진행률만
// 그린다. 이 파일이 보는 것은 "어느 status 에서 어떤 화면이 오는가"이므로 프로브는 끝난 것으로 둔다.
jest.mock('@core/features/onboarding/use-account-probes', () => ({
  useAccountProbes: jest.fn(() => ({
    probes: {},
    isSettled: true,
    progress: { completed: 1, total: 1 },
    retry: jest.fn(),
  })),
}))

jest.mock('@core/features/onboarding/use-api-key-notice', () => ({
  useApiKeyNotice: jest.fn(),
}))

const mockedUseOnboardingStore = jest.mocked(useOnboardingStore)

const account: MapleAccount = {
  accountId: 'account-1',
  characters: [{ ocid: 'ocid-1', name: '낟낟', world: '엘리시움', jobClass: '렌', level: 293 }],
}

type StoreState = ReturnType<typeof useOnboardingStore>

function mockStore(overrides: Partial<StoreState>): void {
  const state = {
    status: 'awaitingApiKey',
    accounts: [],
    selectedAccountId: null,
    error: null,
    prefetchProgress: null,
    apiKeyNotice: null,
    restoreFromStorage: jest.fn(),
    submitApiKey: jest.fn(),
    selectAccount: jest.fn(),
    selectTrackingMode: jest.fn(),
    submitContentCharacters: jest.fn(),
    restartAccountSelection: jest.fn(),
    noticeApiKeyIssue: jest.fn(),
    confirmApiKeyNotice: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as unknown as StoreState

  // 셀렉터 없는 호출(`useOnboardingStore()`)과 있는 호출을 한 목이 함께 받는다 — zustand 의 오버로드가
  // 타입으로는 갈려 있어 여기서만 넓혀 준다(런타임 계약은 하나다).
  const implementation = (selector?: (state: StoreState) => unknown): unknown =>
    selector === undefined ? state : selector(state)
  mockedUseOnboardingStore.mockImplementation(implementation as typeof useOnboardingStore)
}

afterEach(() => {
  jest.clearAllMocks()
})

type Rendered = Awaited<ReturnType<typeof renderOverlay>>

function findByProp(node: unknown, key: string, value: unknown): TreeNode[] {
  if (Array.isArray(node)) return node.flatMap((child) => findByProp(child, key, value))
  if (node === null || typeof node !== 'object') return []

  const current = node as TreeNode
  const hit = current.props?.[key] === value ? [current] : []
  return [...hit, ...findByProp(current.children, key, value)]
}

function progressBars(view: Rendered): TreeNode[] {
  return findByProp(view.toJSON(), 'accessibilityRole', 'progressbar')
}

describe('OnboardingScreen', () => {
  it('status가 awaitingApiKey이면 ApiKeyForm이 렌더링된다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
  })

  it('status가 verifyingApiKey이면 API 키 폼이 유지되고 제출 버튼이 로딩 상태가 된다', async () => {
    mockStore({ status: 'verifyingApiKey' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
    expect(view.getByText('확인 중')).toBeTruthy()
    expect(view.queryByText(/확인하고 있어요/)).toBeNull()
  })

  it('status가 prefetching이면 진행률 바와 문구가 렌더링된다', async () => {
    mockStore({ status: 'prefetching', prefetchProgress: { completed: 3, total: 10 } })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText(/캐릭터 정보를 준비하고 있어요/)).toBeTruthy()
    expect(view.getByText(/3\/10/)).toBeTruthy()
    expect(progressBars(view)[0].props.accessibilityValue).toMatchObject({ now: 30 })
  })

  it('status가 prefetching이고 진행률 정보가 아직 없으면 0%로 렌더링된다', async () => {
    mockStore({ status: 'prefetching', prefetchProgress: null })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(progressBars(view)[0].props.accessibilityValue).toMatchObject({ now: 0 })
  })

  it('status가 selectingAccount이면 AccountSelectionList가 렌더링된다', async () => {
    mockStore({ status: 'selectingAccount', accounts: [account] })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('사용할 메이플 ID를 선택해주세요.')).toBeTruthy()
    expect(view.getByText('엘리시움 · 낟낟 · Lv.293')).toBeTruthy()
  })

  // `AccountSelectionList` 의 프로브 대기는 `m-auto` 로 세로 중앙에 서는데, 자동 여백은 **부모가
  // 남는 세로 공간을 줄 때만** 작동한다(웹에서는 컨테이너의 `min-h-[calc(100dvh-…)]` 이 그 공간을
  // 만들었다 — 사용자 보고 2026-08-09). RN 에서 그 짝이 콘텐츠 컨테이너의 `flexGrow` 다.
  it('모든 단계의 스크롤 콘텐츠가 화면을 채워 자동 여백·중앙 정렬이 설 자리를 만든다', async () => {
    mockStore({ status: 'selectingAccount', accounts: [account] })

    const view = await renderOverlay(<OnboardingScreen />)

    const scroll = view.getByTestId('onboarding-scroll')
    expect(scroll.props.contentContainerStyle).toMatchObject({ flexGrow: 1 })
  })

  it('status가 selectingTrackingMode이면 TrackingModeStep이 렌더링된다', async () => {
    mockStore({ status: 'selectingTrackingMode' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('스케줄러를 어떻게 관리할까요?')).toBeTruthy()
    expect(view.getByText('자동')).toBeTruthy()
    expect(view.getByText('수동')).toBeTruthy()
  })

  it('status가 selectingContentCharacters이면 ContentCharacterStep이 렌더링된다', async () => {
    mockStore({ status: 'selectingContentCharacters' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('추적할 캐릭터를 선택해주세요')).toBeTruthy()
    expect(view.getByText('계속하기')).toBeTruthy()
  })

  it('status가 seedingTracking이면 시드 준비 스피너와 문구가 렌더링된다', async () => {
    mockStore({ status: 'seedingTracking' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('체크리스트를 준비하고 있어요')).toBeTruthy()
    // [[ADR-061]] 결정 1: 24px 이상 자리는 스윕 스피너.
    expect(view.getByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeTruthy()
  })

  it('status가 completed이면 완료 placeholder 텍스트가 렌더링된다', async () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText(/완료/)).toBeTruthy()
  })

  // 실패 피드백은 토스트(`features/onboarding/store` 의 showError)로 옮겨서, 여기서는 폼이
  // 그대로 남아 재입력할 수 있는지만 확인한다 — 인라인 에러 문구는 더 이상 없다.
  it('status가 error이고 accounts가 비어있으면 ApiKeyForm이 다시 렌더링된다', async () => {
    mockStore({ status: 'error', accounts: [], error: { kind: 'invalidApiKey' } })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
  })

  // [[ADR-083]] 결정 4: 실패는 토스트가 알린다(스토어가 띄운다) — 목록은 고를 수 있는 상태 그대로
  // 남아야 하므로 화면은 인라인 문구를 그리지 않는다.
  it('status가 error이고 accounts가 비어있지 않으면 인라인 문구 없이 AccountSelectionList만 렌더링된다', async () => {
    mockStore({ status: 'error', accounts: [account], error: { kind: 'storageWriteFailed' } })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('사용할 메이플 ID를 선택해주세요.')).toBeTruthy()
    expect(view.queryByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).toBeNull()
  })

  // 내비게이션 계약 — `RootNavigator` 의 온보딩 분기 테스트가 이 이름으로 화면을 지목한다
  // (자리표시자가 쓰던 `screen-<라우트 이름>` 규약을 그대로 잇는다).
  it('라우트 이름 testID 를 루트에 유지한다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByTestId('screen-Onboarding')).toBeTruthy()
  })
})
