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

// 포트 역전([[ADR-128]]) 후에도 검사 대상은 그대로다 — 플랫폼 가드와 DOM 커버(웹뷰 구현이다)가
// 어댑터로 옮겨갔으므로 실제 Capacitor 구현을 주입해 한 단위로 본다.
const { hideSplashScreen, showSplashScreen } = await import('@core/native/splash-screen')
const { setSplashScreenPort } = await import('@core/native/ports')
const { capacitorSplashScreenPort } = await import('../adapters/capacitor-splash-screen')
setSplashScreenPort(capacitorSplashScreenPort)

// 리로드 커버 오버레이(전체 화면·브랜드 주황, ADR-027 정정)를 DOM에서 찾는다.
function findReloadCover(): HTMLElement | null {
  return document.querySelector('[data-splash-cover]')
}

// 걷는 쪽은 "한 장"이 아니라 "전부"를 계약으로 삼는다(ADR-117 결정 4) — 개수를 센다.
function countReloadCovers(): number {
  return document.querySelectorAll('[data-splash-cover]').length
}

// showSplashScreen이 붙이는 리로드 커버를 원하는 장수만큼 재현한다.
function mountReloadCovers(count: number): void {
  for (let i = 0; i < count; i++) {
    const cover = document.createElement('div')
    cover.setAttribute('data-splash-cover', '')
    document.body.appendChild(cover)
  }
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

  // showSplashScreen이 붙이는 리로드 커버를 걷는 코드가 저장소에 아예 없었다 — "문서와 함께
  // 사라진다"는 전제가 리로드 성공에만 성립해, 적용이 실패하면 영구히 남았다(ADR-117 결정 4).
  it('리로드 커버([data-splash-cover])도 함께 제거한다', async () => {
    mountReloadCovers(1)

    await hideSplashScreen()

    expect(findReloadCover()).toBeNull()
  })

  it('리로드 커버가 여러 장 쌓여 있어도 전부 제거한다(중복 호출로 겹칠 수 있다)', async () => {
    mountReloadCovers(3)
    expect(countReloadCovers()).toBe(3)

    await hideSplashScreen()

    expect(countReloadCovers()).toBe(0)
  })

  it('웹 플랫폼에서도 두 커버를 모두 제거한다(네이티브 hide는 호출하지 않는다)', async () => {
    getPlatformMock.mockReturnValue('web')
    mountBootCover()
    mountReloadCovers(2)

    await hideSplashScreen()

    expect(document.getElementById('boot-cover')).toBeNull()
    expect(countReloadCovers()).toBe(0)
    expect(hideMock).not.toHaveBeenCalled()
  })

  // 네이티브 hide()가 매달려도 DOM 커버만큼은 이미 사라진 뒤여야 한다 — 그래야 화면이 돌아온다.
  it('네이티브 hide가 끝나지 않아도 DOM 커버는 먼저 제거된다', async () => {
    hideMock.mockReturnValue(new Promise(() => {}))
    mountBootCover()
    mountReloadCovers(1)

    void hideSplashScreen()
    await Promise.resolve()

    expect(document.getElementById('boot-cover')).toBeNull()
    expect(countReloadCovers()).toBe(0)
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
    // jsdom은 hex를 rgb로 정규화한다 — #F58B0F = rgb(245, 139, 15)
    expect(cover!.style.backgroundColor).toBe('rgb(245, 139, 15)')
  })

  it('웹 플랫폼에서는 아무것도 호출하지 않고 오버레이도 깔지 않는다', async () => {
    getPlatformMock.mockReturnValue('web')

    await showSplashScreen()

    expect(showMock).not.toHaveBeenCalled()
    expect(findReloadCover()).toBeNull()
  })
})
