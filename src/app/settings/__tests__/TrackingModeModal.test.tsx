// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackingModeModal } from '../TrackingModeModal'
import { useTrackingModeStore } from '../../../features/tracking-mode/store'

vi.mock('../../../features/tracking-mode/store', () => ({
  useTrackingModeStore: vi.fn(),
}))

const mockedUseTrackingModeStore = vi.mocked(useTrackingModeStore)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TrackingModeModal', () => {
  it('다른 모드를 선택하면 그 모드로 setMode를 호출하고 닫힌다', async () => {
    const user = userEvent.setup()
    const setMode = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /수동/ }))

    expect(setMode).toHaveBeenCalledWith('manual')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('setMode가 resolve되기 전까지 옵션이 비활성 상태를 유지하고 모달이 닫히지 않는다', async () => {
    const user = userEvent.setup()
    let resolveSet: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      resolveSet = resolve
    })
    const setMode = vi.fn().mockReturnValue(pending)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /수동/ }))

    // 시드(setMode)가 끝나기 전: 옵션 비활성 + 모달 유지
    expect(screen.getByRole('button', { name: /수동/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /자동/ })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()

    resolveSet()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('적용 중에는 오버레이 클릭으로 닫히지 않는다', async () => {
    const user = userEvent.setup()
    let resolveSet: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      resolveSet = resolve
    })
    const setMode = vi.fn().mockReturnValue(pending)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /수동/ }))
    await user.click(screen.getByTestId('tracking-mode-modal-overlay'))

    expect(onClose).not.toHaveBeenCalled()

    resolveSet()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('같은 모드를 다시 선택하면 setMode 없이 바로 닫힌다', async () => {
    const user = userEvent.setup()
    const setMode = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: /자동/ }))

    expect(setMode).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
