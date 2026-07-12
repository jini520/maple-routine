// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiKeyModal } from '../ApiKeyModal'
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

describe('ApiKeyModal', () => {
  it('idle이면 API 키 입력 폼을 보여준다', () => {
    mockStore({})

    render(<ApiKeyModal onClose={vi.fn()} />)

    expect(screen.getByLabelText(/API 키/)).toBeInTheDocument()
  })

  it('폼을 제출하면 changeApiKey가 호출된다', async () => {
    const user = userEvent.setup()
    const changeApiKey = vi.fn()
    mockStore({ changeApiKey })

    render(<ApiKeyModal onClose={vi.fn()} />)
    await user.type(screen.getByLabelText(/API 키/), 'new-key-123')
    await user.click(screen.getByRole('button', { name: /확인|제출|시작/ }))

    expect(changeApiKey).toHaveBeenCalledWith('new-key-123')
  })

  it('verifying 상태면 폼 대신 진행 상태를 보여준다', () => {
    mockStore({ status: 'verifying' })

    render(<ApiKeyModal onClose={vi.fn()} />)

    expect(screen.queryByLabelText(/API 키/)).not.toBeInTheDocument()
    expect(screen.getByText(/확인하고 있어요/)).toBeInTheDocument()
  })

  it('오버레이 클릭 시 onClose가 호출된다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mockStore({})

    render(<ApiKeyModal onClose={onClose} />)
    await user.click(screen.getByTestId('api-key-modal-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
