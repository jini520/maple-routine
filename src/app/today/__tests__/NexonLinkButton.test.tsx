// today 머리의 `넥슨 ID 연동하기` 와 그것이 여는 연동 시트.
//
// 키로 이미 들어온 사용자는 로그인 화면을 다시 못 본다. 이 버튼이 앱 안에서 넥슨 로그인으로 가는 유일한 입구다.
import type { ReactNode } from 'react'
import { act, fireEvent, waitFor } from '@testing-library/react-native'

import { renderOverlay } from '../../../components/__tests__/render-atom'
import { hasNexonLogin } from '../../../features/auth/saved-key'
import { openInAppBrowser } from '../../../native/browser'
import { NexonLinkButton } from '../NexonLinkButton'

jest.mock('../../../features/auth/saved-key', () => ({ hasNexonLogin: jest.fn() }))
jest.mock('../../../native/browser', () => ({ openInAppBrowser: jest.fn() }))
var mockNexonLoginEnabled = true
jest.mock('../../../features/auth/nexon-login-enabled', () => ({
  get NEXON_LOGIN_ENABLED() {
    return mockNexonLoginEnabled
  },
}))
var mockSignIn = jest.fn()
jest.mock('../../../features/auth/store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ signInWithNexonAccount: mockSignIn }),
}))
// 포커스를 이펙트로 흉내 낸다. 마운트가 첫 포커스다.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void | (() => void)) => {
    const react = require('react') as typeof import('react')
    react.useEffect(callback, [callback])
  },
}))
// 시트 라이브러리를 맨 뷰로 바꾼다. 여기서 보는 것은 시트가 열리고 닫히는가와 그 안에 무엇이 서는가다.
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native')
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    BottomSheetBackdrop: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    BottomSheetModal: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref as never, () => ({ present: jest.fn(), dismiss: jest.fn() }))
      return React.createElement(ReactNative.View, props)
    }),
    BottomSheetScrollView: (props: Record<string, unknown>) => React.createElement(ReactNative.View, props),
    useBottomSheetTimingConfigs: (config: unknown) => config,
    useBottomSheetInternal: () =>
      jest.requireActual<typeof import('../../../components/__tests__/bottom-sheet-internal-fake')>(
        '../../../components/__tests__/bottom-sheet-internal-fake',
      ).fakeBottomSheetInternal(),
    BottomSheetModalProvider: (props: { children: ReactNode }) => props.children,
  }
})

const mockedHasNexonLogin = jest.mocked(hasNexonLogin)

const 머리버튼 = '넥슨 ID 연동하기'
const 넥슨버튼 = '넥슨ID 로그인'

beforeEach(() => {
  jest.clearAllMocks()
  mockNexonLoginEnabled = true
  mockedHasNexonLogin.mockResolvedValue(false)
  mockSignIn.mockResolvedValue(true)
})

async function 시트를연다() {
  const view = await renderOverlay(<NexonLinkButton />)
  const button = await waitFor(() => view.getByRole('button', { name: 머리버튼 }))
  await act(async () => {
    fireEvent.press(button)
  })
  return view
}

describe('머리 버튼이 서는 때', () => {
  it('넥슨 로그인이 없으면 선다', async () => {
    const view = await renderOverlay(<NexonLinkButton />)

    await waitFor(() => expect(view.getByRole('button', { name: 머리버튼 })).toBeTruthy())
  })

  it('넥슨 로그인이 이미 있으면 안 선다', async () => {
    mockedHasNexonLogin.mockResolvedValue(true)

    const view = await renderOverlay(<NexonLinkButton />)

    await waitFor(() => expect(mockedHasNexonLogin).toHaveBeenCalled())
    expect(view.queryByRole('button', { name: 머리버튼 })).toBeNull()
  })

  it('확인하기 전에는 안 선다', async () => {
    // 로그인한 사용자에게 보였다가 사라지면 버튼이 깜빡인다.
    mockedHasNexonLogin.mockReturnValue(new Promise(() => {}))

    const view = await renderOverlay(<NexonLinkButton />)

    expect(view.queryByRole('button', { name: 머리버튼 })).toBeNull()
  })

  it('넥슨 로그인 입구가 꺼져 있으면 로그인이 없어도 안 선다', async () => {
    mockNexonLoginEnabled = false

    const view = await renderOverlay(<NexonLinkButton />)

    await waitFor(() => expect(mockedHasNexonLogin).toHaveBeenCalled())
    expect(view.queryByRole('button', { name: 머리버튼 })).toBeNull()
  })
})

describe('연동 시트', () => {
  it('머리 버튼을 누르기 전에는 시트가 없다', async () => {
    const view = await renderOverlay(<NexonLinkButton />)

    await waitFor(() => expect(view.getByRole('button', { name: 머리버튼 })).toBeTruthy())
    expect(view.queryByLabelText(넥슨버튼)).toBeNull()
  })

  it('머리 버튼을 누르면 제목 · 설명 · 넥슨 버튼이 선 시트가 열린다', async () => {
    const view = await 시트를연다()

    expect(view.getByLabelText(넥슨버튼)).toBeTruthy()
    expect(view.getByText('일부 기능은 넥슨 로그인으로만 쓸 수 있어요.')).toBeTruthy()
    expect(view.getByText('앞으로 나오는 기능도 넥슨 로그인을 기준으로 만들어요.')).toBeTruthy()
  })

  it('넥슨 버튼은 시트를 먼저 닫고 로그인을 시작한다', async () => {
    // 시트는 토스트보다 위에 그려진다. 연 채로 로그인하면 실패 토스트가 시트에 가려진다.
    mockSignIn.mockReturnValue(new Promise(() => {}))
    const view = await 시트를연다()

    await act(async () => {
      fireEvent.press(view.getByLabelText(넥슨버튼))
    })

    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(view.queryByLabelText(넥슨버튼)).toBeNull()
  })

  it('로그인에 성공하면 머리 버튼이 사라진다', async () => {
    const view = await 시트를연다()

    await act(async () => {
      fireEvent.press(view.getByLabelText(넥슨버튼))
    })

    expect(view.queryByRole('button', { name: 머리버튼 })).toBeNull()
  })

  it('취소하거나 실패하면 머리 버튼이 남는다', async () => {
    // 다시 누를 수 있어야 한다. 실패 문구는 스토어가 띄운다.
    mockSignIn.mockResolvedValue(false)
    const view = await 시트를연다()

    await act(async () => {
      fireEvent.press(view.getByLabelText(넥슨버튼))
    })

    expect(view.getByRole('button', { name: 머리버튼 })).toBeTruthy()
  })

  it('소개 링크는 넥슨의 소개 페이지를 인앱 브라우저로 연다', async () => {
    const view = await 시트를연다()

    await act(async () => {
      fireEvent.press(view.getByText('게임 데이터 활용 로그인이란?'))
    })

    expect(openInAppBrowser).toHaveBeenCalledWith('https://openapi.nexon.com/ko/data-util/introduction/')
  })
})
