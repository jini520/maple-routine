import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
}))

const { hideMock } = vi.hoisted(() => ({
  hideMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}))

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: hideMock },
}))

const { hideSplashScreen } = await import('../splash-screen')

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('ios')
  hideMock.mockReset()
})

describe('hideSplashScreen', () => {
  it('네이티브 플랫폼에서는 스플래시를 숨긴다', async () => {
    await hideSplashScreen()

    expect(hideMock).toHaveBeenCalledWith()
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await hideSplashScreen()

    expect(hideMock).not.toHaveBeenCalled()
  })
})
