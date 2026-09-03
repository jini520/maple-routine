// 이 화면이 지키는 것을 적는다. 이 파일이 보는 것은 **어느 `status` 에서 어떤 화면이
// 오는가** 하나다(각 단계의 내부는 그 단계의 테스트가 본다).
//
// 갈린 것 넷
// ① `container.firstElementChild` 의 `min-h-[calc(100dvh-…)]` 을 보던 자리가 **콘텐츠 컨테이너의
//    `flexGrow`** 로 바뀐다. 남는 세로 공간을 RN 스크롤에서는 그것이
//    만든다(그 공간이 있어야 프로브 대기의 `m-auto`·전체 대기의 `justify-center` 가 작동한다).
// ② `getByLabelText(/API 키/)` → `getByLabelText('Nexon Open API 키')`.
// ③ 스토어 목이 **셀렉터를 받는다**. `useOnboardingStore` 는 전체 상태를 돌려주지만 같은 훅을
//    `RootNavigator` 등이 셀렉터와 함께 부르므로, 목 하나가 두 쓰임을 다 받아야 한다.
//
// 단계가 다섯에서 셋이 됐다
//
// `selectingAccount`·`prefetching` 은 이 앱에서 **도달할 수 없는 상태**이고(재개 파생이 그 행을
// 태우지 않는다), 그래서 그 둘을 보던 옛 케이스는 **어떤 화면이 오는가** 를 물을 대상이 아니다.
// 대신 **그 자리에 출구 없는 빈 화면이 서지 않는가** 를 묻는다.
import { useOnboardingStore } from '../../../features/onboarding/store'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { OnboardingScreen } from '../OnboardingScreen'

jest.mock('../../../features/onboarding/store', () => ({
  useOnboardingStore: jest.fn(),
}))

// `ContentCharacterStep` 의 본문(`useCharacterManage`)이 마운트 시 부르는 경계. 이 파일이 보는
// 것은 "어느 status 에서 어떤 화면이 오는가" 하나라 전부 빈 응답으로 둔다(본문의 계약은
// `ContentCharacterStep` 테스트가 본다).
jest.mock('../../../features/schedule-sync/schedule-sync', () => ({
  toScheduleSyncError: jest.requireActual<typeof import('../../../features/schedule-sync/errors')>(
    '../../../features/schedule-sync/errors',
  ).toScheduleSyncError,
  getCharacterPickerRoster: jest.fn(async () => {}),
}))
jest.mock('../../../nexon/character', () => ({ fetchCharacterList: jest.fn(async () => []) }))
jest.mock('../../../storage/api-key', () => ({
  getAuthConfig: jest.fn(async () => ({ apiKey: 'key', selectedAccountId: null })),
}))
jest.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: jest.fn(async () => null),
}))
jest.mock('../../../storage/character-selection', () => ({
  getRepresentativeCharacter: jest.fn(async () => null),
  setRepresentativeCharacter: jest.fn(async () => {}),
  clearRepresentativeCharacter: jest.fn(async () => {}),
}))
jest.mock('../../../storage/schedule-probe-ledger', () => ({
  getScheduleProbeLedger: jest.fn(async () => ({ unavailable: false, dates: {} })),
}))
jest.mock('../../../features/content-scheduler/store', () => ({
  useContentSchedulerStore: jest.fn(() => ({ trackedOcids: [], saveTrackedOcids: jest.fn() })),
}))

jest.mock('../../../features/onboarding/use-api-key-notice', () => ({
  useApiKeyNotice: jest.fn(),
}))

const mockedUseOnboardingStore = jest.mocked(useOnboardingStore)

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
    submitContentCharacters: jest.fn(),
    noticeApiKeyIssue: jest.fn(),
    confirmApiKeyNotice: jest.fn(),
    reset: jest.fn(),
    ...overrides,
  } as unknown as StoreState

  // 셀렉터 없는 호출(`useOnboardingStore`)과 있는 호출을 한 목이 함께 받는다. zustand 의 오버로드가
  // 타입으로는 갈려 있어 여기서만 넓혀 준다(런타임 계약은 하나다).
  const implementation = (selector?: (state: StoreState) => unknown): unknown =>
    selector === undefined ? state : selector(state)
  mockedUseOnboardingStore.mockImplementation(implementation as typeof useOnboardingStore)
}

afterEach(() => {
  jest.clearAllMocks()
})

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
    // 라벨은 가려질 뿐 트리에 남는다. 대기는 `aria-busy` 가 말한다.
    expect(view.getByText('확인')).toBeTruthy()
    expect(view.queryByText(/확인하고 있어요/)).toBeNull()
  })

  // 이 앱에는 계정 선택도 예열도 없다. 리듀서를 안 고쳤으므로 두 상태는 타입상 남아 있고,
  // 그 자리에 빈 화면 대신 키 입력 폼이 선다. 출구 없는 흰 화면을 만들지 않는다.
  //
  // 자동 여백·중앙 정렬(`seedingTracking` 의 `justify-center`)은 부모가 남는 세로 공간을 줄
  // 때만 작동한다. RN 에서 그 짝이 콘텐츠 컨테이너의 `flexGrow` 다.
  it('모든 단계의 스크롤 콘텐츠가 화면을 채워 자동 여백·중앙 정렬이 설 자리를 만든다', async () => {
    mockStore({ status: 'seedingTracking' })

    const view = await renderOverlay(<OnboardingScreen />)

    const scroll = view.getByTestId('onboarding-scroll')
    expect(scroll.props.contentContainerStyle).toMatchObject({ flexGrow: 1 })
  })

  it('status가 selectingContentCharacters이면 ContentCharacterStep이 렌더링된다', async () => {
    mockStore({ status: 'selectingContentCharacters' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('관리할 캐릭터를 선택해주세요')).toBeTruthy()
    expect(view.getByText('계속하기')).toBeTruthy()
    // 설정 하위 페이지와 **같은 본문**이다. 사본이 아님을 여기서도 확인한다.
    expect(view.getByTestId('character-manage-body')).toBeTruthy()
    // CTA 는 고정 바 안이다. 그 계약은 단계 테스트가 자세히 본다.
    expect(view.getByTestId('onboarding-action-bar')).toBeTruthy()
  })

  // 고정 바는 **CTA 를 넘긴 단계에만** 선다. 셸이 늘 그리면 단계마다 빈 띠가 남는다.
  it('다른 단계에는 고정 액션 바가 없다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.queryByTestId('onboarding-action-bar')).toBeNull()
  })

  it('status가 seedingTracking이면 시드 준비 스피너와 문구가 렌더링된다', async () => {
    mockStore({ status: 'seedingTracking' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText('체크리스트를 준비하고 있어요')).toBeTruthy()
    // 24px 이상 자리는 스윕 스피너.
    expect(view.getByTestId('maple-sweep-spinner', { includeHiddenElements: true })).toBeTruthy()
  })

  it('status가 completed이면 완료 placeholder 텍스트가 렌더링된다', async () => {
    mockStore({ status: 'completed', selectedAccountId: 'account-1' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByText(/완료/)).toBeTruthy()
  })

  // 실패 피드백은 토스트(`features/onboarding/store` 의 showError)로 옮겨서, 여기서는 폼이
  // 그대로 남아 재입력할 수 있는지만 확인한다. 인라인 에러 문구는 더 이상 없다.
  // **`accounts` 로 갈리지 않는다**. 계정 목록 화면 자체가 없어졌으므로,
  // 값이 남아 있어도 이 앱이 그릴 수 있는 것은 폼 하나다.
  // 한 겹 더 감싼 것은 jest 규칙이다. `it.each` 의 행이 배열이면 그것을 **인자 목록**으로 편다.
  it.each([[[]], [[{ accountId: 'account-1', characters: [] }]]])(
    'status가 error이면 accounts 유무와 무관하게 ApiKeyForm 이 다시 렌더링된다',
    async (accounts) => {
      mockStore({ status: 'error', accounts, error: { kind: 'invalidApiKey' } })

      const view = await renderOverlay(<OnboardingScreen />)

      expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
      expect(view.queryByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).toBeNull()
    },
  )

  // 내비게이션 계약. `RootNavigator` 의 온보딩 분기 테스트가 이 이름으로 화면을 지목한다
  // (자리표시자가 쓰던 `screen-<라우트 이름>` 규약을 그대로 잇는다).
  it('라우트 이름 testID 를 루트에 유지한다', async () => {
    mockStore({ status: 'awaitingApiKey' })

    const view = await renderOverlay(<OnboardingScreen />)

    expect(view.getByTestId('screen-Onboarding')).toBeTruthy()
  })
})
