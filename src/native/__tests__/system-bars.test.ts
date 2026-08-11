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

// 포트 역전([[ADR-127]]) 후에도 검사 대상은 그대로다 — 플랫폼 가드가 어댑터로 옮겨갔으므로
// 실제 Capacitor 구현을 주입해 「어댑터 함수 → 어댑터 → 플러그인」을 한 단위로 본다.
const { setNavigationBarStyle, refreshSafeAreaInsets } = await import('../system-bars')
const { setSystemBarsPort } = await import('../ports')
const { capacitorSystemBarsPort } = await import('../adapters/capacitor-system-bars')
setSystemBarsPort(capacitorSystemBarsPort)

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
