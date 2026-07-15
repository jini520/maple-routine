// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTheme, setTheme } from '../../../storage/theme'
import { setStatusBarStyle } from '../../../native/status-bar'
import { setNavigationBarStyle } from '../../../native/navigation-bar'
import { useThemeStore } from '../store'

vi.mock('../../../storage/theme', () => ({
  getTheme: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock('../../../native/status-bar', () => ({
  setStatusBarStyle: vi.fn(),
}))

vi.mock('../../../native/navigation-bar', () => ({
  setNavigationBarStyle: vi.fn(),
}))

function mockSystemColorScheme(prefersDark: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: prefersDark } as MediaQueryList),
  )
}

beforeEach(() => {
  vi.mocked(getTheme).mockReset()
  vi.mocked(setTheme).mockReset()
  vi.mocked(setTheme).mockResolvedValue(undefined)
  vi.mocked(setStatusBarStyle).mockReset()
  vi.mocked(setNavigationBarStyle).mockReset()
  delete document.documentElement.dataset.theme
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

describe('restoreFromStorage', () => {
  it('저장된 값이 레테면 theme과 DOM을 레테로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('레테')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(true, expect.any(String))
  })

  it('저장된 값이 렌이면 theme과 DOM을 렌으로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('렌')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('렌')
    expect(document.documentElement.dataset.theme).toBe('렌')
    expect(setStatusBarStyle).toHaveBeenCalledWith(false)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(false, expect.any(String))
  })

  it('저장된 값이 혼테일이면 theme과 DOM을 혼테일로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('혼테일')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('혼테일')
    expect(document.documentElement.dataset.theme).toBe('혼테일')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
  })

  it('저장된 값이 없고 시스템이 라이트면 머쉬맘을 기본값으로 쓰고 data-theme은 설정되지 않는다', async () => {
    vi.mocked(getTheme).mockResolvedValue(null)
    mockSystemColorScheme(false)

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('머쉬맘')
    expect(document.documentElement.dataset.theme).toBeUndefined()
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
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})

describe('selectTheme', () => {
  it('레테를 선택하면 storage에 저장하고 DOM에 레테를 적용한다', async () => {
    await useThemeStore.getState().selectTheme('레테')

    expect(setTheme).toHaveBeenCalledWith('레테')
    expect(useThemeStore.getState().theme).toBe('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')
    expect(setStatusBarStyle).toHaveBeenCalledWith(true)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(true, expect.any(String))
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
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(setStatusBarStyle).toHaveBeenCalledWith(false)
    expect(setNavigationBarStyle).toHaveBeenCalledWith(false, expect.any(String))
  })
})
