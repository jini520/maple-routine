// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccountModal } from '../AccountModal'
import { useSettingsStore } from '../../../features/settings/store'

vi.mock('../../../features/settings/store', () => ({
  useSettingsStore: vi.fn(),
}))

const mockedUseSettingsStore = vi.mocked(useSettingsStore)

function mockStore(overrides: Partial<ReturnType<typeof useSettingsStore>>): void {
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

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountModal', () => {
  it('마운트되면 refreshAccounts를 정확히 1번 호출한다', () => {
    const refreshAccounts = vi.fn()
    mockStore({ refreshAccounts })

    render(<AccountModal onClose={vi.fn()} />)

    expect(refreshAccounts).toHaveBeenCalledTimes(1)
  })

  it('verifying 상태면 진행 상태를 보여준다', () => {
    mockStore({ status: 'verifying' })

    render(<AccountModal onClose={vi.fn()} />)

    expect(screen.getByText(/확인하고 있어요/)).toBeInTheDocument()
  })

  it('오버레이 클릭 시 onClose가 호출된다', async () => {
    mockStore({})
    const onClose = vi.fn()
    render(<AccountModal onClose={onClose} />)

    screen.getByTestId('account-modal-overlay').click()

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
