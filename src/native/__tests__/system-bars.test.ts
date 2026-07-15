import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock, setStyleMock, refreshInsetsMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
  setStyleMock: vi.fn(),
  refreshInsetsMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
  registerPlugin: () => ({ setStyle: setStyleMock, refreshInsets: refreshInsetsMock }),
}))

const { setNavigationBarStyle, refreshSafeAreaInsets } = await import('../system-bars')

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('android')
  setStyleMock.mockReset()
  refreshInsetsMock.mockReset()
})

describe('setNavigationBarStyle', () => {
  it('다크 테마면 dark:true로 설정한다', async () => {
    await setNavigationBarStyle(true)

    expect(setStyleMock).toHaveBeenCalledWith({ dark: true })
  })

  it('라이트 테마면 dark:false로 설정한다', async () => {
    await setNavigationBarStyle(false)

    expect(setStyleMock).toHaveBeenCalledWith({ dark: false })
  })

  it('안드로이드가 아니면(iOS) 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('ios')

    await setNavigationBarStyle(true)

    expect(setStyleMock).not.toHaveBeenCalled()
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await setNavigationBarStyle(true)

    expect(setStyleMock).not.toHaveBeenCalled()
  })
})

describe('refreshSafeAreaInsets', () => {
  it('안드로이드면 네이티브에 인셋 재적용을 요청한다', async () => {
    await refreshSafeAreaInsets()

    expect(refreshInsetsMock).toHaveBeenCalled()
  })

  it('안드로이드가 아니면 호출하지 않는다 — iOS는 env()가 정상 동작한다', async () => {
    getPlatformMock.mockReturnValue('ios')

    await refreshSafeAreaInsets()

    expect(refreshInsetsMock).not.toHaveBeenCalled()
  })
})
