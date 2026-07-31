// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// 이슈 #78 D: `onRetry={reset}` 이라 "다시 시도"가 재조회가 아니라 **모달을 닫았다** —
// reset이 status를 'idle'로 되돌리면 닫힘 판정(idle 복귀 + 한 번은 idle을 벗어남)이 걸린다.
describe('실패 상태의 "다시 시도" (이슈 #78 D)', () => {
  it('재조회를 호출하고 reset은 부르지 않는다', async () => {
    const user = userEvent.setup()
    const refreshAccounts = vi.fn()
    const reset = vi.fn()
    mockStore({ status: 'error', error: { kind: 'network' }, refreshAccounts, reset })

    render(<AccountModal onClose={vi.fn()} />)
    refreshAccounts.mockClear() // 마운트 시 1회 호출을 제외한다

    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(refreshAccounts).toHaveBeenCalledTimes(1)
    expect(reset).not.toHaveBeenCalled()
  })

  it('누른 뒤 모달이 닫히지 않는다', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mockStore({ status: 'error', error: { kind: 'network' }, refreshAccounts: vi.fn() })

    render(<AccountModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onClose).not.toHaveBeenCalled()
  })
})
