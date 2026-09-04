// 이 화면이 지키는 것을 적는다. **폼 하나와 그 위에 덮이는 모달**이다.
//
// 화면이 라우트가 되면서 이 파일에서 단계 switch 가 사라졌다. 캐릭터 설정 화면이 어느 상태에서
// 서는지는 이제 `RootNavigator` 가 정하므로 그쪽 테스트가 본다.
//
// 스토어 목이 **셀렉터를 받는다**. 같은 훅을 셀렉터와 함께 부르는 자리가 있어 목 하나가 두
// 쓰임을 다 받아야 한다.
import { useAuthStore } from '../../../features/auth/store'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { SignInScreen } from '../SignInScreen'

jest.mock('../../../features/auth/store', () => ({
  useAuthStore: jest.fn(),
}))

const mockedUseAuthStore = jest.mocked(useAuthStore)

type StoreState = ReturnType<typeof useAuthStore>

function mockStore(overrides: Partial<StoreState>): void {
  const state = {
    status: 'signedOut',
    accounts: [],
    error: null,
    apiKeyNotice: null,
    developmentStageBlocked: false,
    restoreFromStorage: jest.fn(),
    signIn: jest.fn(),
    acknowledgeDevelopmentStageKey: jest.fn(),
    noticeApiKeyIssue: jest.fn(),
    confirmApiKeyNotice: jest.fn(),
    signOut: jest.fn(),
    ...overrides,
  } as unknown as StoreState

  // 셀렉터 없는 호출과 있는 호출을 한 목이 함께 받는다. zustand 의 오버로드가 타입으로는 갈려
  // 있어 여기서만 넓혀 준다(런타임 계약은 하나다).
  const implementation = (selector?: (state: StoreState) => unknown): unknown =>
    selector === undefined ? state : selector(state)
  mockedUseAuthStore.mockImplementation(implementation as typeof useAuthStore)
}

afterEach(() => {
  jest.clearAllMocks()
})

describe('SignInScreen', () => {
  it('signedOut 이면 ApiKeyForm이 렌더링된다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
  })

  it('verifying 이면 API 키 폼이 유지되고 제출 버튼이 로딩 상태가 된다', async () => {
    mockStore({ status: 'verifying' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
    // 라벨은 가려질 뿐 트리에 남는다. 대기는 `aria-busy` 가 말한다.
    expect(view.getByText('확인')).toBeTruthy()
    expect(view.queryByText(/확인하고 있어요/)).toBeNull()
  })

  // 자동 여백·중앙 정렬은 부모가 남는 세로 공간을 줄 때만 작동한다. RN 에서 그 짝이 콘텐츠
  // 컨테이너의 `flexGrow` 다.
  it('스크롤 콘텐츠가 화면을 채워 자동 여백이 설 자리를 만든다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    const scroll = view.getByTestId('entry-scroll')
    expect(scroll.props.contentContainerStyle).toMatchObject({ flexGrow: 1 })
  })

  // 고정 바는 **CTA 를 넘긴 화면에만** 선다. 셸이 늘 그리면 여기에 빈 띠가 남는다.
  it('이 화면에는 고정 액션 바가 없다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.queryByTestId('entry-action-bar')).toBeNull()
  })

  // 막기만 하고 길을 안 주면 이슈 #176 의 하드 잠금이 된다. 모달 뒤에 폼이 그대로 남아 닫는
  // 것이 곧 다시 넣는 것이다.
  it('개발 단계 키로 막히면 모달이 덮이고 폼은 뒤에 남는다', async () => {
    mockStore({ status: 'signedOut', developmentStageBlocked: true })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByTestId('development-stage-key-title')).toBeTruthy()
    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
  })

  // 제목이 낱말을 안 쓰는 것이 이 모달의 요점이다. 넣은 키가 개발 단계라는 것은 그 아래 표가
  // 말하고, 제목은 **못 쓴다**만 말한다. 이 사람은 개발 단계가 무엇인지 모르고 그것을 골랐다.
  it('제목은 단계 낱말이 아니라 못 쓴다는 사실을 말한다', async () => {
    mockStore({ status: 'signedOut', developmentStageBlocked: true })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByTestId('development-stage-key-title')).toHaveTextContent(
      '이 키로는 연결할 수 없습니다',
    )
  })

  // 두 값이 함께 서야 그 자리에 다른 값이 있었다는 것이 읽힌다. 한쪽만 남으면 낱말을 모르는
  // 사람에게는 그냥 모르는 말 하나가 된다.
  it('넣은 단계와 필요한 단계를 함께 세운다', async () => {
    mockStore({ status: 'signedOut', developmentStageBlocked: true })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByText('개발 단계')).toBeTruthy()
    expect(view.getByText('서비스 단계')).toBeTruthy()
  })

  // 429 는 단계를 판정하지 못한 실패다. 그 자리에 단계를 단정하는 모달을 세우면 서비스 단계
  // 사용자가 개발 단계 키라는 말을 듣는다.
  it('다른 실패에는 그 모달이 서지 않는다', async () => {
    mockStore({ status: 'signedOut', error: { kind: 'rateLimited' } })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.queryByTestId('development-stage-key-title')).toBeNull()
    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
  })

  // 실패 피드백은 토스트(`features/auth/store` 의 showError)로 간다. 여기서는 폼이 그대로 남아
  // 재입력할 수 있는지만 확인한다. 인라인 에러 문구는 없다.
  // **`accounts` 로 갈리지 않는다**. 계정 목록 화면 자체가 없으므로 값이 남아 있어도 그릴 수
  // 있는 것은 폼 하나다.
  // 한 겹 더 감싼 것은 jest 규칙이다. `it.each` 의 행이 배열이면 그것을 **인자 목록**으로 편다.
  it.each([[[]], [[{ accountId: 'account-1', characters: [] }]]])(
    '검증에 실패해도 accounts 유무와 무관하게 ApiKeyForm 이 그대로 선다',
    async (accounts) => {
      mockStore({ status: 'signedOut', accounts, error: { kind: 'invalidApiKey' } })

      const view = await renderOverlay(<SignInScreen />)

      expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
      expect(view.queryByText('기기에 저장하지 못했습니다. 다시 시도해주세요')).toBeNull()
    },
  )

  // 내비게이션 계약. `RootNavigator` 의 분기 테스트가 이 이름으로 화면을 지목한다
  // (`screen-<라우트 이름>` 규약).
  it('라우트 이름 testID 를 루트에 유지한다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByTestId('screen-SignIn')).toBeTruthy()
  })
})
