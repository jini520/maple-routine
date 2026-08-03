// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TrackingModeStep } from '../TrackingModeStep'
import { TRACKING_MODE_OPTIONS } from '../../../features/tracking-mode/copy'

afterEach(() => {
  cleanup()
})

// 수동 옵션의 주의 문구가 "…앱에는 **자동**으로 추가되지 않아요"라 /자동/ 은 두 버튼 모두에
// 걸린다(ADR-035 결정 22). 접근 가능한 이름은 제목으로 시작하므로 앵커로 좁힌다.
const AUTO_OPTION = { name: /^자동/ } as const
const MANUAL_OPTION = { name: /^수동/ } as const

describe('TrackingModeStep', () => {
  it('초기에는 어느 옵션도 선택돼 있지 않다 (ADR-035 결정 17)', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    expect(screen.getByRole('button', AUTO_OPTION)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', MANUAL_OPTION)).toHaveAttribute('aria-pressed', 'false')
  })

  // ADR-035 결정 22: 고르기 **전에** 둘을 비교하는 화면이라 설명·주의를 선택 시에만 펼치지 않는다.
  it('설명과 주의 문구가 선택 전에도 두 옵션 모두 보인다 (ADR-035 결정 22)', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    for (const option of TRACKING_MODE_OPTIONS) {
      expect(screen.getByText(option.description)).toBeVisible()
      expect(screen.getByText(option.caution)).toBeVisible()
    }
  })

  it('한 옵션을 골라도 다른 옵션의 설명·주의가 그대로 남는다 (ADR-035 결정 22)', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', AUTO_OPTION))

    for (const option of TRACKING_MODE_OPTIONS) {
      expect(screen.getByText(option.description)).toBeVisible()
      expect(screen.getByText(option.caution)).toBeVisible()
    }
  })

  it('옵션을 고르기 전에는 계속하기가 비활성화된다', () => {
    const onSubmit = vi.fn()
    render(<TrackingModeStep onSubmit={onSubmit} />)

    const cta = screen.getByRole('button', { name: '계속하기' })
    expect(cta).toBeDisabled()

    fireEvent.click(cta)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('추천 배지는 표시되지 않는다 (ADR-035 결정 17)', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    expect(screen.queryByText('추천')).not.toBeInTheDocument()
  })

  it('수동 옵션을 클릭하면 aria-pressed가 바뀐다', () => {
    render(<TrackingModeStep onSubmit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', MANUAL_OPTION))

    expect(screen.getByRole('button', MANUAL_OPTION)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', AUTO_OPTION)).toHaveAttribute('aria-pressed', 'false')
  })

  it('자동을 선택하고 계속하기를 누르면 auto로 onSubmit이 호출된다', () => {
    const onSubmit = vi.fn()
    render(<TrackingModeStep onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', AUTO_OPTION))
    fireEvent.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSubmit).toHaveBeenCalledWith('auto')
  })

  it('수동을 선택하고 계속하기를 누르면 manual로 onSubmit이 호출된다', () => {
    const onSubmit = vi.fn()
    render(<TrackingModeStep onSubmit={onSubmit} />)

    fireEvent.click(screen.getByRole('button', MANUAL_OPTION))
    fireEvent.click(screen.getByRole('button', { name: '계속하기' }))

    expect(onSubmit).toHaveBeenCalledWith('manual')
  })
})
