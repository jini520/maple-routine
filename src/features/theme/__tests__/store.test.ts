// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTheme, setTheme } from '../../../storage/theme'
import { useThemeStore } from '../store'

vi.mock('../../../storage/theme', () => ({
  getTheme: vi.fn(),
  setTheme: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(getTheme).mockReset()
  vi.mocked(setTheme).mockReset()
  vi.mocked(setTheme).mockResolvedValue(undefined)
  delete document.documentElement.dataset.theme
  useThemeStore.setState({ theme: '렌' })
})

describe('초기 상태', () => {
  it('theme은 렌이다', () => {
    expect(useThemeStore.getState().theme).toBe('렌')
  })
})

describe('restoreFromStorage', () => {
  it('저장된 값이 레테면 theme과 DOM을 레테로 갱신한다', async () => {
    vi.mocked(getTheme).mockResolvedValue('레테')

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')
  })

  it('저장된 값이 없으면(null) theme은 렌을 유지하고 data-theme은 설정되지 않는다', async () => {
    vi.mocked(getTheme).mockResolvedValue(null)

    await useThemeStore.getState().restoreFromStorage()

    expect(useThemeStore.getState().theme).toBe('렌')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})

describe('selectTheme', () => {
  it('레테를 선택하면 storage에 저장하고 DOM에 레테를 적용한다', async () => {
    await useThemeStore.getState().selectTheme('레테')

    expect(setTheme).toHaveBeenCalledWith('레테')
    expect(useThemeStore.getState().theme).toBe('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')
  })

  it('레테 선택 후 렌을 선택하면 data-theme 속성이 제거된다', async () => {
    await useThemeStore.getState().selectTheme('레테')
    expect(document.documentElement.dataset.theme).toBe('레테')

    await useThemeStore.getState().selectTheme('렌')

    expect(setTheme).toHaveBeenCalledWith('렌')
    expect(useThemeStore.getState().theme).toBe('렌')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})
