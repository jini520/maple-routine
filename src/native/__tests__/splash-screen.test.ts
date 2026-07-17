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
})

// index.html의 정적 부팅 커버(전체 화면·브랜드색)를 재현한다.
function mountBootCover(): void {
  const cover = document.createElement('div')
  cover.id = 'boot-cover'
  document.body.appendChild(cover)
}

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

  it('index.html의 정적 부팅 커버(#boot-cover)를 제거한다(테마 적용 전 라이트 플래시까지 가리는 커버)', async () => {
    mountBootCover()

    await hideSplashScreen()

    expect(document.getElementById('boot-cover')).toBeNull()
  })

  it('웹 플랫폼에서도 부팅 커버는 제거한다', async () => {
    getPlatformMock.mockReturnValue('web')
    mountBootCover()

    await hideSplashScreen()

    expect(document.getElementById('boot-cover')).toBeNull()
  })

  it('부팅 커버가 이미 없어도 오류 없이 동작한다', async () => {
    await expect(hideSplashScreen()).resolves.toBeUndefined()
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
