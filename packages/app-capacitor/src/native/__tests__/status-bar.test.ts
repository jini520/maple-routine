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

// 포트 역전([[ADR-128]]) 후에도 검사 대상은 그대로다 — 플랫폼 가드가 어댑터로 옮겨갔으므로
// 실제 Capacitor 구현을 주입해 「어댑터 함수 → 어댑터 → 플러그인」을 한 단위로 본다.
const { setStatusBarStyle } = await import('@core/native/status-bar')
const { setStatusBarPort } = await import('@core/native/ports')
const { capacitorStatusBarPort } = await import('../adapters/capacitor-status-bar')
setStatusBarPort(capacitorStatusBarPort)

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
