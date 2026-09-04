// 트리 밖에서 스플래시를 다루는 것 셋을 본다. 붙들기 · 퇴장 길이 · 실패 안전 타이머.
//
// 셋 다 진입점이 부르는 함수 하나(`holdSplashUntilAppReady`) 안에 있고, 순서가 계약이다.
// jest 가 `jest.mock` 을 파일 맨 위로 끌어올리므로 팩토리가 참조하는 이름은 `mock` 으로
// 시작해야 한다. 그것만이 초기화 전 접근을 허용받는다.
const mockPreventAutoHideAsync = jest.fn(async () => true)
const mockSetOptions = jest.fn()
const mockHideSplashScreen = jest.fn(async () => {})

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: () => mockPreventAutoHideAsync(),
  setOptions: (options: unknown) => mockSetOptions(options),
}))

jest.mock('../native/splash-screen', () => ({
  hideSplashScreen: () => mockHideSplashScreen(),
}))

import { holdSplashUntilAppReady, SPLASH_FAILSAFE_MS } from '../boot-splash'

beforeEach(() => {
  jest.useFakeTimers()
  mockPreventAutoHideAsync.mockClear()
  mockSetOptions.mockClear()
  mockHideSplashScreen.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('holdSplashUntilAppReady', () => {
  it('스플래시를 붙든다', () => {
    holdSplashUntilAppReady()

    expect(mockPreventAutoHideAsync).toHaveBeenCalledTimes(1)
  })

  // 안드로이드는 퇴장에 alpha 페이드를 **항상** 건다(`SplashScreenManager.kt` 의
  // `setOnExitAnimationListener`). 기본값 400ms 는 1겹이 화면에 더 남아 있는 시간이고, 그동안
  // 2겹은 이미 그려진 채 가려져 있다. 0 으로 끄면 그만큼이 1겹 노출에서 빠진다.
  //
  // iOS 는 `fade` 가 꺼져 있어 이 값이 안 쓰인다. 켜질 때를 대비해 같은 값을 준다.
  it('퇴장 페이드를 끈다', () => {
    holdSplashUntilAppReady()

    expect(mockSetOptions).toHaveBeenCalledWith({ duration: 0, fade: false })
  })

  // 붙들기보다 **뒤**여야 한다. 붙들지 않은 스플래시는 이미 사라진 뒤라 설정할 대상이 없다.
  it('붙든 뒤에 설정한다', () => {
    holdSplashUntilAppReady()

    expect(mockPreventAutoHideAsync.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetOptions.mock.invocationCallOrder[0],
    )
  })

  // 부팅 렌더가 끝내 오지 않으면 2겹도 안 그려지고, 그러면 내릴 주체가 없다.
  it('부팅 렌더가 끝내 안 오면 실패 안전 타이머가 내린다', () => {
    holdSplashUntilAppReady()
    expect(mockHideSplashScreen).not.toHaveBeenCalled()

    jest.advanceTimersByTime(SPLASH_FAILSAFE_MS)

    expect(mockHideSplashScreen).toHaveBeenCalledTimes(1)
  })
})
