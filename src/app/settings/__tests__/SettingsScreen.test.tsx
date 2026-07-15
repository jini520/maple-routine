// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsScreen } from '../SettingsScreen'
import { useSettingsStore } from '../../../features/settings/store'
import { useThemeStore } from '../../../features/theme/store'
import { useLiveUpdateStore } from '../../../features/live-update/store'

vi.mock('../../../features/settings/store', () => ({
  useSettingsStore: vi.fn(),
}))

vi.mock('../../../features/theme/store', () => ({
  useThemeStore: vi.fn(),
}))

vi.mock('../../../features/live-update/store', () => ({
  useLiveUpdateStore: vi.fn(),
}))

const mockedUseSettingsStore = vi.mocked(useSettingsStore)
const mockedUseThemeStore = vi.mocked(useThemeStore)
const mockedUseLiveUpdateStore = vi.mocked(useLiveUpdateStore)

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

function mockLiveUpdateStore(): void {
  mockedUseLiveUpdateStore.mockReturnValue({
    currentVersion: '1.0.0',
    status: 'idle',
    availableVersion: null,
    availableSize: null,
    minNativeVersion: null,
    downloadProgress: 0,
    channel: 'production',
    pending: null,
    downloadedBundleId: null,
    loadCurrentVersion: vi.fn(),
    check: vi.fn(),
    checkOnBoot: vi.fn(),
    startDownload: vi.fn(),
    confirmCellularDownload: vi.fn(),
    apply: vi.fn(),
    openStore: vi.fn(),
    dismiss: vi.fn(),
  })
}

beforeEach(() => {
  mockLiveUpdateStore()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsScreen', () => {
  it('API 키 재입력/계정 변경/테마/연결 해제 4개 행을 렌더링한다', () => {
    mockSettingsStore({})
    mockThemeStore({})

    render(<SettingsScreen />)

    expect(screen.getByRole('button', { name: /API 키 재입력/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /계정 변경/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /테마/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /연결 해제/ })).toBeInTheDocument()
  })

  it('테마 행에 현재 테마 이름이 표시된다', () => {
    mockSettingsStore({})
    mockThemeStore({ theme: '레테' })

    render(<SettingsScreen />)

    expect(within(screen.getByRole('button', { name: /테마/ })).getByText('레테')).toBeInTheDocument()
  })

  it('"API 키 재입력" 클릭 시 API 키 입력 모달이 열린다', async () => {
    const user = userEvent.setup()
    mockSettingsStore({})
    mockThemeStore({})

    render(<SettingsScreen />)
    await user.click(screen.getByRole('button', { name: /API 키 재입력/ }))

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('"계정 변경" 클릭 시 계정 모달이 열리고 refreshAccounts가 호출된다', async () => {
    const user = userEvent.setup()
    const refreshAccounts = vi.fn()
    mockSettingsStore({ refreshAccounts })
    mockThemeStore({})

    render(<SettingsScreen />)
    await user.click(screen.getByRole('button', { name: /계정 변경/ }))

    expect(refreshAccounts).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('account-modal-overlay')).toBeInTheDocument()
  })

  it('"테마" 클릭 시 테마 선택 모달이 열린다', async () => {
    const user = userEvent.setup()
    mockSettingsStore({})
    mockThemeStore({ theme: '렌' })

    render(<SettingsScreen />)
    await user.click(screen.getByRole('button', { name: /테마/ }))

    expect(screen.getByTestId('theme-modal-overlay')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '레테' })).toBeInTheDocument()
  })

  it('"연결 해제" 클릭 시 확인 모달이 열리고, 확인 클릭 시 disconnect가 호출된다', async () => {
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

  it('하단에 앱 버전·카피라이트·NEXON Open API 출처 문구를 표시한다', () => {
    mockSettingsStore({})
    mockThemeStore({})

    render(<SettingsScreen />)

    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeInTheDocument()
    expect(screen.getByText(/©\s*\d{4}\s*메이플 루틴/)).toBeInTheDocument()
    expect(screen.getByText('Data based on NEXON Open API')).toBeInTheDocument()
  })
})
