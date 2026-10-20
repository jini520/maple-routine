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
  // RN 에는 `show` 가 덮을 대상 자체가 없고 `expo-splash-screen` 에도 다시 띄우는 API 가 없다
  // (`preventAutoHideAsync`·`setOptions`·`hide`·`hideAsync` 넷뿐). 특히 `preventAutoHideAsync`
  // 로 다시 띄우는 척 하면 안 된다. 이미 내려간 스플래시에는 아무 효과가 없어서 화면은 그대로
  // 인데 호출부만 덮였다고 믿는다.
  it('show() 는 스플래시 API 를 하나도 건드리지 않는다', async () => {
    await rnSplashScreenPort.show()

    expect(mocked.hideAsync).not.toHaveBeenCalled()
    expect(mocked.hide).not.toHaveBeenCalled()
    expect(mocked.preventAutoHideAsync).not.toHaveBeenCalled()
    expect(mocked.setOptions).not.toHaveBeenCalled()
  })
})
