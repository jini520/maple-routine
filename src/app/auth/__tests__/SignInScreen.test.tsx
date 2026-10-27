// 이 화면이 지키는 것을 적는다. 넥슨 로그인 하나가 앞에 서고, API 키는 경고 모달을 거쳐 상단 시트에서 받는다.
//
// 화면이 라우트가 되면서 이 파일에서 단계 switch 가 사라졌다. 캐릭터 설정 화면이 어느 상태에서
// 서는지는 이제 `RootNavigator` 가 정하므로 그쪽 테스트가 본다.
//
// 스토어 목이 **셀렉터를 받는다**. 같은 훅을 셀렉터와 함께 부르는 자리가 있어 목 하나가 두
// 쓰임을 다 받아야 한다.
import { act, fireEvent } from '@testing-library/react-native'

import { useAuthStore } from '../../../features/auth/store'
import { keepWords } from '../../../lib/keep-words'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { openInAppBrowser } from '../../../native/browser'
import { SignInScreen } from '../SignInScreen'

jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))

jest.mock('../../../features/auth/store', () => ({
  useAuthStore: jest.fn(),
}))
jest.mock('../../../features/auth/saved-key', () => ({ loadSavedApiKey: jest.fn(async () => mockSavedKey) }))
jest.mock('../../../hooks/useScreenNavigation', () => ({
  useScreenNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
}))
// 온보딩 스택의 진입 단계. 셀렉터 훅과 `getState` 를 한 상태로 받는다.
jest.mock('../../../features/app-entry/store', () => {
  const hook = (selector: (state: unknown) => unknown) => selector(mockEntry)
  hook.getState = () => mockEntry
  return { useAppEntryStore: hook }
})

// 스토어 빌드는 꺼진 값으로 나간다. 켜진 화면과 꺼진 화면을 둘 다 잰다.
jest.mock('../../../features/auth/nexon-login-enabled', () => ({
  get NEXON_LOGIN_ENABLED() {
    return mockNexonLoginEnabled
  },
}))

var mockNexonLoginEnabled = true
var mockSavedKey: string | null = null
var mockNavigate: jest.Mock = jest.fn()
var mockEntry: { stage: string; resumeTo: string | null; consumeResume: jest.Mock } = {
  stage: 'signIn',
  resumeTo: null,
  consumeResume: jest.fn(),
}

beforeEach(() => {
  mockNexonLoginEnabled = true
  mockSavedKey = null
  mockNavigate = jest.fn()
  mockEntry = { stage: 'signIn', resumeTo: null, consumeResume: jest.fn() }
})

const mockedUseAuthStore = jest.mocked(useAuthStore)

type View = Awaited<ReturnType<typeof renderOverlay>>

/** 상단 시트의 스크림은 첫 렌더의 불투명도 0 이 jest 에 남아 숨은 요소로 잡힌다. */
const 숨김포함 = { includeHiddenElements: true }

/** 첫 화면의 `API 키로 시작하기` 를 눌러 경고 모달을 띄운다. */
async function openWarning(view: View): Promise<void> {
  await act(async () => {
    fireEvent.press(view.getByText('API 키로 시작하기'))
  })
}

/** 경고를 넘겨 키 입력 시트까지 연다. */
async function openKeySheet(view: View): Promise<void> {
  await openWarning(view)
  await act(async () => {
    fireEvent.press(view.getByText('그래도 API 키로 시작하기'))
  })
}

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
    signInWithNexonAccount: jest.fn(),
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

describe('SignInScreen: 첫 화면', () => {
  it('넥슨 로그인만 앞에 두고, 키 입력칸은 첫 화면에 없다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByLabelText('넥슨ID 로그인')).toBeTruthy()
    expect(view.getByText('API 키로 시작하기')).toBeTruthy()
    expect(view.queryByLabelText('Nexon Open API 키')).toBeNull()
  })

  // 첫 화면에 입력칸이 없어져 설명이 밀려날 자리가 없다. 이름이 제목이 되고 두 줄은 그 아래 보조 글이다.
  it('머리에 앱 이름과, 넥슨 로그인이 왜 필요한지를 적는다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByText('메이플 루틴')).toBeTruthy()
    expect(view.getByText('내 메이플 스토리 스케줄 정보 조회를 위해서')).toBeTruthy()
    expect(view.getByText('넥슨 로그인이 필요해요.')).toBeTruthy()
  })

  // 설명 다섯 문장을 앱이 싣지 않는다. 넥슨이 문구를 고치면 앱을 안 고쳐도 따라간다.
  it('소개 링크는 인앱 브라우저로 넥슨 페이지를 연다', async () => {
    mockStore({ status: 'signedOut' })
    const view = await renderOverlay(<SignInScreen />)

    await act(async () => {
      fireEvent.press(view.getByText('게임 데이터 활용 로그인이란?'))
    })

    expect(openInAppBrowser).toHaveBeenCalledWith('https://openapi.nexon.com/ko/data-util/introduction/')
  })

  it('부팅이 온보딩 중간을 찾으면 그 단계까지 스택을 다시 놓는다', async () => {
    mockEntry = { stage: 'mvpGrade', resumeTo: 'mvpGrade', consumeResume: jest.fn() }
    mockStore({ status: 'signedIn' })

    await renderOverlay(<SignInScreen />)

    expect(mockNavigate.mock.calls).toEqual([['CharacterSetup'], ['MvpGradePick']])
    expect(mockEntry.consumeResume).toHaveBeenCalled()
  })
})

describe('SignInScreen: 경고 모달', () => {
  // 키로 가려는 사용자에게 먼저 경고한다. 앞으로 일부 기능은 넥슨 로그인으로만 쓸 수 있다.
  it('API 키로 시작하기는 시트가 아니라 경고 모달을 먼저 연다', async () => {
    mockStore({ status: 'signedOut' })
    const view = await renderOverlay(<SignInScreen />)

    await openWarning(view)

    expect(view.getByText('API 키로 시작할까요?')).toBeTruthy()
    expect(view.getByText(keepWords('일부 기능은 넥슨 로그인으로만 쓸 수 있어요'))).toBeTruthy()
    expect(view.queryByLabelText('Nexon Open API 키')).toBeNull()
  })

  it('모달의 넥슨 로그인은 모달을 닫고 로그인을 시작한다', async () => {
    const signInWithNexonAccount = jest.fn()
    mockStore({ status: 'signedOut', signInWithNexonAccount })
    const view = await renderOverlay(<SignInScreen />)
    await openWarning(view)

    const buttons = view.getAllByLabelText('넥슨ID 로그인')
    await act(async () => {
      fireEvent.press(buttons[buttons.length - 1])
    })

    expect(signInWithNexonAccount).toHaveBeenCalledTimes(1)
    expect(view.queryByText('API 키로 시작할까요?')).toBeNull()
    expect(view.queryByLabelText('Nexon Open API 키')).toBeNull()
  })

  it('그래도 API 키로 시작하기는 모달을 닫고 키 입력 시트를 연다', async () => {
    mockStore({ status: 'signedOut' })
    const view = await renderOverlay(<SignInScreen />)

    await openKeySheet(view)

    expect(view.queryByText('API 키로 시작할까요?')).toBeNull()
    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
    expect(view.getByText('일부 기능 제한')).toBeTruthy()
  })
})

describe('SignInScreen: 키 입력 시트', () => {
  it('verifying 이면 시트가 그대로 서고 제출 버튼만 대기 상태가 된다', async () => {
    mockStore({ status: 'verifying' })
    const view = await renderOverlay(<SignInScreen />)
    await openKeySheet(view)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
    expect(view.getByText('확인')).toBeTruthy()
  })

  // 막기만 하고 길을 안 주면 하드 잠금이 된다. 모달 뒤에 시트가 그대로 남아 닫는 것이 곧 다시 넣는 것이다.
  it('개발 단계 키로 막히면 모달이 시트 위에 덮이고 시트는 뒤에 남는다', async () => {
    mockStore({ status: 'signedOut', developmentStageBlocked: true })
    const view = await renderOverlay(<SignInScreen />)
    await openKeySheet(view)

    expect(view.getByTestId('development-stage-key-title')).toBeTruthy()
    expect(view.getByLabelText('Nexon Open API 키', 숨김포함)).toBeTruthy()
  })

  // 429 는 단계를 판정하지 못한 실패다. 그 자리에 단계를 단정하는 모달을 세우면 서비스 단계 사용자가
  // 개발 단계 키라는 말을 듣는다.
  it('다른 실패에는 그 모달이 서지 않고 시트가 남는다', async () => {
    mockStore({ status: 'signedOut', error: { kind: 'rateLimited' } })
    const view = await renderOverlay(<SignInScreen />)
    await openKeySheet(view)

    expect(view.queryByTestId('development-stage-key-title')).toBeNull()
    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
  })

  // 온보딩은 뒤로 갈 수 있는 한 스택이다. 앞으로 가는 것은 이 화면이 민다.
  it('로그인이 성공하면 다음 온보딩 화면을 민다', async () => {
    const signIn = jest.fn(async () => {
      mockEntry.stage = 'characterSetup'
      return true
    })
    mockStore({ status: 'signedOut', signIn })
    const view = await renderOverlay(<SignInScreen />)
    await openKeySheet(view)

    await act(async () => {
      fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), 'key-1')
    })
    await act(async () => {
      fireEvent.press(view.getByText('확인'))
    })

    expect(signIn).toHaveBeenCalledWith('key-1')
    expect(mockNavigate).toHaveBeenCalledWith('CharacterSetup')
  })

  it('로그인이 실패하면 안 밀고 시트를 그대로 둔다', async () => {
    mockStore({ status: 'signedOut', signIn: jest.fn(async () => false) })
    const view = await renderOverlay(<SignInScreen />)
    await openKeySheet(view)

    await act(async () => {
      fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), 'bad')
    })
    await act(async () => {
      fireEvent.press(view.getByText('확인'))
    })

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(view.getByLabelText('Nexon Open API 키')).toHaveDisplayValue('bad')
  })

  it('저장된 키가 있으면 시트 입력칸에 채워 둔다', async () => {
    mockSavedKey = 'saved-key'
    mockStore({ status: 'signedOut' })
    const view = await renderOverlay(<SignInScreen />)
    await act(async () => {})

    await openKeySheet(view)

    expect(view.getByLabelText('Nexon Open API 키')).toHaveDisplayValue('saved-key')
  })

  // 시트를 닫는 것은 키 경로를 그만두는 것이다. 다시 열었을 때 반쯤 친 키가 남아 있으면 이어서 제출하기 쉽다.
  it('시트를 닫으면 친 키를 버린다', async () => {
    jest.useFakeTimers()
    mockStore({ status: 'signedOut' })
    const view = await renderOverlay(<SignInScreen />)
    await openKeySheet(view)
    await act(async () => {
      fireEvent.changeText(view.getByLabelText('Nexon Open API 키'), 'half-typed')
    })

    await act(async () => {
      fireEvent.press(view.getByTestId('api-key-sheet-scrim', 숨김포함))
    })
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(view.queryByLabelText('Nexon Open API 키')).toBeNull()

    await openKeySheet(view)
    expect(view.getByLabelText('Nexon Open API 키')).toHaveDisplayValue('')
    jest.useRealTimers()
  })
})

// 프로덕션 승인 전에는 테스트 사용자만 로그인된다. 그때 빌드는 진입점을 끈 채로 나가고 승인이 나면 상수만 켜는 OTA 로 연다.
describe('SignInScreen: 넥슨 로그인이 꺼져 있을 때', () => {
  beforeEach(() => {
    mockNexonLoginEnabled = false
  })

  it('넥슨 버튼 · 소개 링크 · 맨 아래 글자 버튼을 세우지 않는다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.queryByLabelText('넥슨ID 로그인')).toBeNull()
    expect(view.queryByText('게임 데이터 활용 로그인이란?')).toBeNull()
    expect(view.queryByText('API 키로 시작하기')).toBeNull()
  })

  // 로그인을 말하면 없는 수단을 찾게 된다.
  it('머리 둘째 줄은 키만 말한다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByText('API 키 입력이 필요해요.')).toBeTruthy()
    expect(view.queryByText('넥슨 로그인이 필요해요.')).toBeNull()
  })

  // 경고와 시트는 넥슨 로그인이 있을 때 키 경로를 낮추려고 둔 것이다. 키가 유일한 방법이면 낮출 이유가 없다.
  it('키 입력은 경고와 시트 없이 첫 화면에 펼쳐 둔다', async () => {
    mockStore({ status: 'signedOut' })

    const view = await renderOverlay(<SignInScreen />)

    expect(view.getByLabelText('Nexon Open API 키')).toBeTruthy()
    expect(view.queryByText('일부 기능 제한')).toBeNull()
  })
})
