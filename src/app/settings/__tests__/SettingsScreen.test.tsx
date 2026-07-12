// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '../SettingsScreen'
import { useSettingsStore } from '../../../features/settings/store'
import { useThemeStore } from '../../../features/theme/store'
import type { MapleAccount } from '../../../types'

vi.mock('../../../features/settings/store', () => ({
  useSettingsStore: vi.fn(),
}))

vi.mock('../../../features/theme/store', () => ({
  useThemeStore: vi.fn(),
}))

const mockedUseSettingsStore = vi.mocked(useSettingsStore)
const mockedUseThemeStore = vi.mocked(useThemeStore)

function mockSettingsStore(overrides: Partial<ReturnType<typeof useSettingsStore>>): void {
  mockedUseSettingsStore.mockReturnValue({
    status: 'idle',
    accounts: [],
    error: null,
    prefetchProgress: null,
    changeApiKey: vi.fn(),
    refreshAccounts: vi.fn(),
    selectAccount: vi.fn(),
    disconnect: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  })
}

function mockThemeStore(overrides: Partial<ReturnType<typeof useThemeStore>>): void {
  mockedUseThemeStore.mockReturnValue({
    theme: '렌',
    restoreFromStorage: vi.fn(),
    selectTheme: vi.fn(),
    ...overrides,
  })
}

const ACCOUNTS: MapleAccount[] = [
  {
    accountId: 'account-1',
    characters: [{ ocid: 'ocid-1', name: '낟낟', world: '엘리시움', jobClass: '렌', level: 293 }],
  },
  {
    accountId: 'account-2',
    characters: [{ ocid: 'ocid-2', name: '내옆에최성일', world: '베라', jobClass: '아크메이지(썬,콜)', level: 211 }],
  },
]

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsScreen', () => {
  it('status가 selectingAccount이면 계정 선택 목록이 렌더링된다', () => {
    mockSettingsStore({ status: 'selectingAccount', accounts: ACCOUNTS })
    mockThemeStore({})

    render(<SettingsScreen />)

    expect(screen.getByText('사용할 메이플 ID를 선택해주세요.')).toBeInTheDocument()
  })

  it('status가 prefetching이면 진행률 바가 렌더링된다', () => {
    mockSettingsStore({ status: 'prefetching', prefetchProgress: { completed: 18, total: 45 } })
    mockThemeStore({})

    render(<SettingsScreen />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText(/18\/45/)).toBeInTheDocument()
  })

  it('status가 error이면 에러 메시지와 다시 시도 버튼이 렌더링되고, 클릭 시 reset이 호출된다', async () => {
    const reset = vi.fn()
    const user = userEvent.setup()
    mockSettingsStore({ status: 'error', error: { kind: 'invalidApiKey' }, reset })
    mockThemeStore({})

    render(<SettingsScreen />)

    expect(screen.getByText('API 키가 유효하지 않습니다')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('연결 해제 버튼 클릭 시 확인 모달이 열리고, 확인 클릭 시 disconnect가 호출된다', async () => {
    const disconnect = vi.fn()
    const user = userEvent.setup()
    mockSettingsStore({ disconnect })
    mockThemeStore({})

    render(<SettingsScreen />)

    expect(screen.queryByText('연결을 해제할까요?')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '연결 해제' }))

    expect(screen.getByText('연결을 해제할까요?')).toBeInTheDocument()

    const overlay = screen.getByTestId('disconnect-confirm-overlay')
    await user.click(within(overlay).getByRole('button', { name: '연결 해제' }))

    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('테마 버튼 클릭 시 selectTheme이 호출된다', async () => {
    const selectTheme = vi.fn()
    const user = userEvent.setup()
    mockSettingsStore({})
    mockThemeStore({ theme: '렌', selectTheme })

    render(<SettingsScreen />)

    await user.click(screen.getByRole('button', { name: '레테' }))

    expect(selectTheme).toHaveBeenCalledWith('레테')
  })
})
