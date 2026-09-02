import * as SplashScreen from 'expo-splash-screen'

import { rnSplashScreenPort } from '../rn-splash-screen'

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => {}),
  hide: jest.fn(),
  preventAutoHideAsync: jest.fn(async () => true),
  setOptions: jest.fn(),
}))

const mocked = SplashScreen as jest.Mocked<typeof SplashScreen>

afterEach(() => {
  jest.clearAllMocks()
})

describe('rnSplashScreenPort', () => {
  it('hide() 는 네이티브 스플래시를 내린다', async () => {
    await rnSplashScreenPort.hide()

    expect(mocked.hideAsync).toHaveBeenCalledTimes(1)
  })

  // 스플래시를 내리는 주체가 여럿이라(정상 부팅 · 실패 catch · ErrorBoundary 폴백)
  // 중복 호출이 정상 경로다. 두 번째 호출이 던지면 그 자리의 나머지 정리가 통째로 멈춘다.
  it('hide() 를 두 번 불러도 던지지 않는다', async () => {
    await rnSplashScreenPort.hide()
    await expect(rnSplashScreenPort.hide()).resolves.toBeUndefined()
  })

  // RN 에는 웹뷰 리로드가 없어 `show()` 가 덮을 대상 자체가 없고, `expo-splash-screen` 에도 다시
  // 띄우는 API 가 없다(`preventAutoHideAsync`·`setOptions`·`hide`·`hideAsync` 넷뿐). 특히
  // `preventAutoHideAsync()` 로 "다시 띄우는 척" 하면 안 된다. 이미 내려간 스플래시에는 아무
  // 효과가 없어서 화면은 그대로인데 호출부만 덮였다고 믿는다.
  it('show() 는 스플래시 API 를 하나도 건드리지 않는다', async () => {
    await rnSplashScreenPort.show()

    expect(mocked.hideAsync).not.toHaveBeenCalled()
    expect(mocked.hide).not.toHaveBeenCalled()
    expect(mocked.preventAutoHideAsync).not.toHaveBeenCalled()
    expect(mocked.setOptions).not.toHaveBeenCalled()
  })

  it('show() 는 던지지 않고 조용히 끝난다', async () => {
    await expect(rnSplashScreenPort.show()).resolves.toBeUndefined()
  })

  // DOM 커버(`#boot-cover`·`[data-splash-cover]`)는 정의상 웹뷰 구현이다.
  // RN 에는 문서가 없으므로 흉내 낼 것도, 걷을 것도 없다.
  it('DOM 커버 개념을 흉내 내지 않는다. document 없이도 돈다', async () => {
    const document = (globalThis as { document?: unknown }).document
    delete (globalThis as { document?: unknown }).document
    try {
      await expect(rnSplashScreenPort.hide()).resolves.toBeUndefined()
      await expect(rnSplashScreenPort.show()).resolves.toBeUndefined()
    } finally {
      if (document !== undefined) {
        ;(globalThis as { document?: unknown }).document = document
      }
    }
  })
})
