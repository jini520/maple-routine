// @vitest-environment jsdom
//
// 스토어는 core 에 있지만(`@core/features/theme/store`) **이 테스트는 app 쪽에 남는다** — 검사하는
// 것이 "문서에 실제로 반영되는가"라서 웹뷰 구현(`native/adapters/capacitor-theme-appearance`)을
// 함께 세워야 성립하고, DOM 단언이 들어간 파일은 core 에 둘 수 없다([[ADR-127]]).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTheme, setTheme } from '@core/storage/theme'
import { setColorSchemePort, setThemeAppearancePort } from '@core/native/ports'
import { setStatusBarStyle } from '@core/native/status-bar'
import { setNavigationBarStyle } from '@core/native/system-bars'
import { useThemeStore } from '@core/features/theme/store'
import { capacitorColorSchemePort } from '../../../native/adapters/capacitor-color-scheme'
import { capacitorThemeAppearancePort } from '../../../native/adapters/capacitor-theme-appearance'

vi.mock('@core/storage/theme', () => ({
  getTheme: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock('@core/native/status-bar', () => ({
  setStatusBarStyle: vi.fn(),
}))

vi.mock('@core/native/system-bars', () => ({
  setNavigationBarStyle: vi.fn(),
}))

function mockSystemColorScheme(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: prefersDark } as MediaQueryList),
  )
}

beforeEach(() => {
  // 전역 no-op 기본값(`vitest.setup.ts`)을 진짜 웹뷰 구현으로 덮는다 — 여기서 보려는 것이 그 구현이다.
  setColorSchemePort(capacitorColorSchemePort)
  setThemeAppearancePort(capacitorThemeAppearancePort)
  vi.mocked(getTheme).mockReset()
  vi.mocked(setTheme).mockReset()
  vi.mocked(setTheme).mockResolvedValue(undefined)
  vi.mocked(setStatusBarStyle).mockReset()
  vi.mocked(setNavigationBarStyle).mockReset()
  delete document.documentElement.dataset.theme
  delete document.documentElement.dataset.mode
  useThemeStore.setState({ theme: '머쉬맘' })
  mockSystemColorScheme(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('초기 상태', () => {
  it('theme은 머쉬맘이다', () => {
    expect(useThemeStore.getState().theme).toBe('머쉬맘')
  })
})

// ADR-099: 테마의 라이트/다크를 CSS 에도 알린다. 안 알리면 브라우저가 스크롤 인디케이터·폼 컨트롤
// 같은 UI 크롬 색을 자기 기본값으로 고르는데, 화면 스크롤 컨테이너에서 그 차이가 흰 인디케이터로
// 드러났다(실기기 관측 2026-08-06). 네이티브 상태바·내비바에 이미 같은 값을 넘기고 있었다.
describe('color-scheme (ADR-099)', () => {
  it('다크 테마면 문서에 color-scheme: dark 를 건다', async () => {
    vi.mocked(getTheme).mockResolvedValue('레테')

    await useThemeStore.getState().restoreFromStorage()

    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('라이트 테마면 color-scheme: light 다', async () => {
    vi.mocked(getTheme).mockResolvedValue('렌')

    await useThemeStore.getState().restoreFromStorage()

    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('테마를 바꾸면 함께 바뀐다', async () => {
    await useThemeStore.getState().selectTheme('레테')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    await useThemeStore.getState().selectTheme('렌')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  // ADR-122: CSS 선택자로 모드를 알려야 하는 규칙이 있다(스크림 위 패널 테두리처럼 같은 토큰이
  // 모드에 따라 반대 역할을 하는 자리). 테마 이름으로 분기하면 ADR-064 결정 8이 폐기한 수동
  // 다크 목록이 CSS 쪽에 되살아난다.
  it('테마 모드를 data-mode 로 노출한다', async () => {
    await useThemeStore.getState().selectTheme('레테')
    expect(document.documentElement.dataset.mode).toBe('dark')

    await useThemeStore.getState().selectTheme('렌')
    expect(document.documentElement.dataset.mode).toBe('light')
  })

  // color-scheme 만으로는 라이트 테마에서 인디케이터가 흰색으로 남았다(실기기) — 색을 직접 준다.
  it('인디케이터 색을 테마 모드에 맞춰 직접 지정한다', async () => {
    await useThemeStore.getState().selectTheme('렌')
    expect(document.documentElement.style.scrollbarColor).toBe('rgba(0, 0, 0, 0.35) transparent')

    await useThemeStore.getState().selectTheme('레테')
    expect(document.documentElement.style.scrollbarColor).toBe('rgba(255, 255, 255, 0.35) transparent')
  })
})

describe('restoreFromStorage', () => {
  it('저장된 값이 레테면 theme과 DOM을 레테로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('레테')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(true)
  })

  it('저장된 값이 렌이면 theme과 DOM을 렌으로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('렌')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('렌')
    expect(document.documentElement.dataset.theme).toBe('렌')
    expect(setStatusBarStyle).toHaveBeenCalledWith(false)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(false)
  })

  it('저장된 값이 혼테일이면 theme과 DOM을 혼테일로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('혼테일')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('혼테일')
    expect(document.documentElement.dataset.theme).toBe('혼테일')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
  })

  it('저장된 값이 없고 시스템이 라이트면 머쉬맘을 기본값으로 쓴다', async () => {
    vi.mocked(getTheme).mockResolvedValue(null)
    mockSystemColorScheme(false)

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('머쉬맘')
    expect(document.documentElement.dataset.theme).toBe('머쉬맘')
    expect(setStatusBarStyle).toHaveBeenCalledWith(false)
  })

  it('저장된 값이 없고 시스템이 다크면 혼테일을 기본값으로 쓴다', async () => {
    vi.mocked(getTheme).mockResolvedValue(null)
    mockSystemColorScheme(true)

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('혼테일')
    expect(document.documentElement.dataset.theme).toBe('혼테일')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
  })

  it('저장된 값이 없고 matchMedia를 지원하지 않으면 머쉬맘으로 안전하게 폴백한다', async () => {
    vi.mocked(getTheme).mockResolvedValue(null)
    vi.stubGlobal('matchMedia', undefined)

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('머쉬맘')
    expect(document.documentElement.dataset.theme).toBe('머쉬맘')
  })
})

describe('selectTheme', () => {
  it('레테를 선택하면 storage에 저장하고 DOM에 레테를 적용한다', async () => {
    await useThemeStore.getState().selectTheme('레테')

    expect(setTheme).toHaveBeenCalledWith('레테')
    expect(useThemeStore.getState().theme).toBe('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(true)
  })

  it('혼테일을 선택하면 storage에 저장하고 DOM에 혼테일을 적용한다', async () => {
    await useThemeStore.getState().selectTheme('혼테일')

    expect(setTheme).toHaveBeenCalledWith('혼테일')
    expect(useThemeStore.getState().theme).toBe('혼테일')
    expect(document.documentElement.dataset.theme).toBe('혼테일')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
  })

  it('레테 선택 후 머쉬맘을 선택하면 data-theme 속성이 제거된다', async () => {
    await useThemeStore.getState().selectTheme('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')

    await useThemeStore.getState().selectTheme('머쉬맘')

    expect(setTheme).toHaveBeenCalledWith('머쉬맘')
    expect(useThemeStore.getState().theme).toBe('머쉬맘')
    expect(document.documentElement.dataset.theme).toBe('머쉬맘')
    expect(setStatusBarStyle).toHaveBeenCalledWith(false)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(false)
  })
})
