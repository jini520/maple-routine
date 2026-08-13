// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackingModeModal } from '../TrackingModeModal'
import { useTrackingModeStore } from '@core/features/tracking-mode/store'
import { TRACKING_MODE_OPTIONS } from '@core/features/tracking-mode/copy'

vi.mock('@core/features/tracking-mode/store', () => ({
  useTrackingModeStore: vi.fn(),
}))

const mockedUseTrackingModeStore = vi.mocked(useTrackingModeStore)

// 수동 옵션의 주의 문구가 "…앱에는 **자동**으로 추가되지 않아요"라 /자동/ 은 두 버튼 모두에
// 걸린다(ADR-035 결정 22). 접근 가능한 이름은 제목으로 시작하므로 앵커로 좁힌다.
const AUTO_OPTION = { name: /^자동/ } as const
const MANUAL_OPTION = { name: /^수동/ } as const
// 적용 중에는 라벨이 '적용 중'으로 바뀌므로 '적용'만 정확히 가리킨다.
const APPLY = { name: '적용' } as const

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TrackingModeModal', () => {
  // ADR-035 결정 22: 온보딩과 같은 카피(주의 문구 포함)를 설정 모달도 그대로 보여준다.
  it('두 옵션의 설명과 주의 문구를 모두 보여준다 (ADR-035 결정 22)', () => {
    mockedUseTrackingModeStore.mockReturnValue({
      mode: 'auto',
      restoreFromStorage: vi.fn(),
      setMode: vi.fn(),
    })

    render(<TrackingModeModal onClose={vi.fn()} />)

    for (const option of TRACKING_MODE_OPTIONS) {
      expect(screen.getByText(option.description)).toBeVisible()
      expect(screen.getByText(option.caution)).toBeVisible()
    }
  })

  // ADR-035 결정 23: 탭은 고르는 것일 뿐이고, 적용은 버튼이 한다.
  it('옵션을 탭해도 setMode를 부르지 않고 모달도 닫히지 않는다 (ADR-035 결정 23)', async () => {
    const user = userEvent.setup()
    const setMode = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', MANUAL_OPTION))

    expect(setMode).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', MANUAL_OPTION)).toHaveAttribute('aria-pressed', 'true')
  })

  it('현재 모드가 그대로면 적용 버튼이 비활성이다 (ADR-035 결정 23)', async () => {
    const user = userEvent.setup()
    const setMode = vi.fn().mockResolvedValue(undefined)
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={vi.fn()} />)

    expect(screen.getByRole('button', APPLY)).toBeDisabled()

    // 다른 모드로 옮기면 활성, 원래 모드로 되돌리면 다시 비활성이다.
    await user.click(screen.getByRole('button', MANUAL_OPTION))
    expect(screen.getByRole('button', APPLY)).toBeEnabled()

    await user.click(screen.getByRole('button', AUTO_OPTION))
    expect(screen.getByRole('button', APPLY)).toBeDisabled()
  })

  it('다른 모드를 고르고 적용을 누르면 그 모드로 setMode를 호출하고 닫힌다', async () => {
    const user = userEvent.setup()
    const setMode = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', MANUAL_OPTION))
    await user.click(screen.getByRole('button', APPLY))

    expect(setMode).toHaveBeenCalledWith('manual')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('취소를 누르면 setMode 없이 닫힌다', async () => {
    const user = userEvent.setup()
    const setMode = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', MANUAL_OPTION))
    await user.click(screen.getByRole('button', { name: '취소' }))

    expect(setMode).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('setMode가 resolve되기 전까지 옵션·취소·적용이 모두 비활성이고 모달이 닫히지 않는다', async () => {
    const user = userEvent.setup()
    let resolveSet: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      resolveSet = resolve
    })
    const setMode = vi.fn().mockReturnValue(pending)
    const onClose = vi.fn()
    mockedUseTrackingModeStore.mockReturnValue({ mode: 'auto', restoreFromStorage: vi.fn(), setMode })

    render(<TrackingModeModal onClose={onClose} />)
    await user.click(screen.getByRole('button', MANUAL_OPTION))
    await user.click(screen.getByRole('button', APPLY))

    // 시드(setMode)가 끝나기 전: 누를 수 있는 것이 하나도 없고 모달도 유지된다
    expect(screen.getByRole('button', MANUAL_OPTION)).toBeDisabled()
    expect(screen.getByRole('button', AUTO_OPTION)).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
    expect(onClose).not.toHaveBeenCalled()

    // 적용 버튼은 라벨이 '적용 중'으로 바뀌고 aria-busy 를 단다 (ADR-061 결정 9)
    const applying = screen.getByRole('button', { name: '적용 중' })
    expect(applying).toBeDisabled()
    expect(applying).toHaveAttribute('aria-busy', 'true')

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
    await user.click(screen.getByRole('button', MANUAL_OPTION))
    await user.click(screen.getByRole('button', APPLY))
    await user.click(screen.getByTestId('tracking-mode-modal-overlay'))

    expect(onClose).not.toHaveBeenCalled()

    resolveSet()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
