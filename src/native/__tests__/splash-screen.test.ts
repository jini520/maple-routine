// @vitest-environment jsdom
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

// 리로드 커버 오버레이(전체 화면·브랜드 주황, ADR-027 정정)를 DOM에서 찾는다.
function findReloadCover(): HTMLElement | null {
  return document.querySelector('[data-splash-cover]')
}

beforeEach(() => {
  getPlatformMock.mockReset().mockReturnValue('ios')
  hideMock.mockReset()
  showMock.mockReset()
  document.body.innerHTML = ''
  document.documentElement.style.removeProperty('background-color')
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

  it('index.html이 깔아둔 <html> 인라인 브랜드 배경을 제거한다(오버스크롤에 주황이 비치지 않게)', async () => {
    document.documentElement.style.backgroundColor = '#FB8101'

    await hideSplashScreen()

    expect(document.documentElement.style.backgroundColor).toBe('')
  })

  it('웹 플랫폼에서도 <html> 인라인 브랜드 배경은 제거한다', async () => {
    getPlatformMock.mockReturnValue('web')
    document.documentElement.style.backgroundColor = '#FB8101'

    await hideSplashScreen()

    expect(document.documentElement.style.backgroundColor).toBe('')
  })
})

describe('showSplashScreen', () => {
  it('네이티브 플랫폼에서는 autoHide 없이 스플래시를 띄운다(부팅 흐름이 직접 내릴 때까지 유지)', async () => {
    await showSplashScreen()

    expect(showMock).toHaveBeenCalledWith({ autoHide: false })
  })

  it('플러그인 창이 못 덮는 하단 바 인셋 띠를 가리는 전체 화면 브랜드색 오버레이를 문서에 깐다', async () => {
    await showSplashScreen()

    const cover = findReloadCover()
    expect(cover).not.toBeNull()
    expect(cover!.style.position).toBe('fixed')
    expect(cover!.style.inset).toBe('0px')
    // jsdom은 hex를 rgb로 정규화한다 — #FB8101 = rgb(251, 129, 1)
    expect(cover!.style.backgroundColor).toBe('rgb(251, 129, 1)')
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않고 오버레이도 깔지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await showSplashScreen()

    expect(showMock).not.toHaveBeenCalled()
    expect(findReloadCover()).toBeNull()
  })
})
