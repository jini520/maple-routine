import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
}))

const { hideMock, showMock } = vi.hoisted(() => ({
  hideMock: vi.fn(),
  showMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}))

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: hideMock, show: showMock },
}))

const { hideSplashScreen, showSplashScreen } = await import('../splash-screen')

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('ios')
  hideMock.mockReset()
  showMock.mockReset()
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

describe('showSplashScreen', () => {
  it('네이티브 플랫폼에서는 autoHide 없이 스플래시를 띄운다(부팅 흐름이 직접 내릴 때까지 유지)', async () => {
    await showSplashScreen()

    expect(showMock).toHaveBeenCalledWith({ autoHide: false })
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await showSplashScreen()

    expect(showMock).not.toHaveBeenCalled()
  })
})
