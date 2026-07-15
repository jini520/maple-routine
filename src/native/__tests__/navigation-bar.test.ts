import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getPlatformMock, setStyleMock } = vi.hoisted(() => ({
  getPlatformMock: vi.fn(),
  setStyleMock: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: getPlatformMock },
  registerPlugin: () => ({ setStyle: setStyleMock }),
}))

const { setNavigationBarStyle } = await import('../navigation-bar')

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('android')
  setStyleMock.mockReset()
})

describe('setNavigationBarStyle', () => {
  it('다크 테마면 dark:true와 표면색을 전달한다', async () => {
    await setNavigationBarStyle(true, '#1a1720')

    expect(setStyleMock).toHaveBeenCalledWith({ dark: true, color: '#1a1720' })
  })

  it('라이트 테마면 dark:false와 표면색을 전달한다', async () => {
    await setNavigationBarStyle(false, '#fdfcf6')

    expect(setStyleMock).toHaveBeenCalledWith({ dark: false, color: '#fdfcf6' })
  })

  it('3자리 단축 hex(#fff)는 안드로이드가 읽는 6자리로 펴서 전달한다', async () => {
    // Vite CSS 미니파이어가 #ffffff(렌 테마)를 #fff로 줄이는데 Android Color.parseColor는 못 읽는다.
    await setNavigationBarStyle(false, '#fff')

    expect(setStyleMock).toHaveBeenCalledWith({ dark: false, color: '#ffffff' })
  })

  it('안드로이드가 아니면(iOS) 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('ios')

    await setNavigationBarStyle(true, '#fdfcf6')

    expect(setStyleMock).not.toHaveBeenCalled()
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await setNavigationBarStyle(true, '#fdfcf6')

    expect(setStyleMock).not.toHaveBeenCalled()
  })
})
