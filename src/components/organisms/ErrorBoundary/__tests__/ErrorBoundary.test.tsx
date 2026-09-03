// 에러 바운더리. 갈린 것 둘.
//
// *"다시 시작을 누르면 리로드한다"* → **주입한 `onRestart` 를 부른다**. RN 에는
//   `window.location.reload` 짝이 없어 기본값이 없어졌다(`ErrorBoundary.tsx`).
//   테스트 전용이던 프롭이 여기서는 계약이라, 이 케이스가 그 계약을 지킨다.
// *"폴백이 뜨면 스플래시를 내린다"* 는 그대로 남지만 **이유가 하나로 줄어든다**(
//   결정 6 의 셋 중 ⑵만 RN 에 성립한다. 나머지 둘은 웹뷰/Capacitor 플러그인 사정이었다).
// `jest.mock` 팩토리는 호이스팅돼 스코프 밖 변수를 못 읽는다. **`mock` 접두 이름만** 예외다.
const mockHideSplashScreen = jest.fn()

jest.mock('../../../../native/splash-screen', () => ({
  hideSplashScreen: (): Promise<void> => mockHideSplashScreen() as Promise<void>,
}))

import { fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'

import { renderAtom } from '../../../__tests__/render-atom'
import { ErrorBoundary } from '../ErrorBoundary'

function Boom(): React.JSX.Element {
  throw new Error('render failed')
}

const noop = (): void => {}

beforeEach(() => {
  // 바운더리가 잡은 예외를 React 가 콘솔로도 한 번 더 뱉어 테스트 출력이 시끄러워진다.
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockHideSplashScreen.mockReset()
  mockHideSplashScreen.mockResolvedValue(undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('예외가 없으면 children 을 그대로 그린다', async () => {
    const { getByText, queryByTestId } = await renderAtom(
      <ErrorBoundary onRestart={noop}>
        <Text>정상 화면</Text>
      </ErrorBoundary>,
    )

    expect(getByText('정상 화면')).toBeTruthy()
    expect(queryByTestId('error-boundary-fallback')).toBeNull()
  })

  it('렌더 중 예외가 나면 빈 화면 대신 폴백을 그린다', async () => {
    const { getByTestId, getByText } = await renderAtom(
      <ErrorBoundary onRestart={noop}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(getByTestId('error-boundary-fallback')).toBeTruthy()
    expect(getByText('화면을 표시하지 못했습니다')).toBeTruthy()
    expect(getByText('앱을 다시 시작하면 대부분 해결됩니다.')).toBeTruthy()
  })

  it('다시 시작을 누르면 주입된 재시작 수단을 부른다', async () => {
    const onRestart = jest.fn()
    const { getByText } = await renderAtom(
      <ErrorBoundary onRestart={onRestart}>
        <Boom />
      </ErrorBoundary>,
    )

    await fireEvent.press(getByText('다시 시작'))

    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  // 폴백의 목적은 복구 도구를 주는 게 아니라 빈 화면을 없애는 것이다.
  // 선택지를 하나로 줄이면 그 하나가 분명해진다.
  it('다시 시작 외의 버튼을 두지 않는다', async () => {
    const { getAllByRole } = await renderAtom(
      <ErrorBoundary onRestart={noop}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(getAllByRole('button')).toHaveLength(1)
  })

  // (⑵): 네이티브 스플래시는 JS 트리 위에 뜨는 뷰라, 부팅 중 렌더가 던지면
  // 폴백이 그 아래 가려진다.
  it('폴백이 뜨면 스플래시를 내린다', async () => {
    await renderAtom(
      <ErrorBoundary onRestart={noop}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(mockHideSplashScreen).toHaveBeenCalledTimes(1)
  })

  it('예외가 없으면 스플래시를 내리지 않는다', async () => {
    await renderAtom(
      <ErrorBoundary onRestart={noop}>
        <Text>정상 화면</Text>
      </ErrorBoundary>,
    )

    expect(mockHideSplashScreen).not.toHaveBeenCalled()
  })

  // 이 순간 사용자에게 필요한 것은 화면이지 정확한 실패 처리가 아니다.
  it('스플래시 해제가 실패해도 폴백은 그대로 그리고 rejection 을 삼킨다', async () => {
    mockHideSplashScreen.mockRejectedValue(new Error('splash failed'))

    const { getByTestId } = await renderAtom(
      <ErrorBoundary onRestart={noop}>
        <Boom />
      </ErrorBoundary>,
    )

    expect(getByTestId('error-boundary-fallback')).toBeTruthy()
  })

})
