import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
}))

const { setStyleMock } = vi.hoisted(() => ({
  setStyleMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
}))

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: { setStyle: setStyleMock },
  Style: { Dark: 'DARK', Light: 'LIGHT' },
}))

const { setStatusBarStyle } = await import('../status-bar')

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('android')
  setStyleMock.mockReset()
})

describe('setStatusBarStyle', () => {
  it('다크 테마면 Style.Dark로 설정한다', async () => {
    await setStatusBarStyle(true)

    expect(setStyleMock).toHaveBeenCalledWith({ style: 'DARK' })
  })

  it('라이트 테마면 Style.Light로 설정한다', async () => {
    await setStatusBarStyle(false)

    expect(setStyleMock).toHaveBeenCalledWith({ style: 'LIGHT' })
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await setStatusBarStyle(true)

    expect(setStyleMock).not.toHaveBeenCalled()
  })
})
