// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDelayed } from '../use-delayed'

function Probe({ delayMs }: { delayMs: number }): React.JSX.Element {
  const elapsed = useDelayed(delayMs)
  return <span data-testid="probe">{elapsed ? '보인다' : '아직'}</span>
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useDelayed', () => {
  it('마운트 직후에는 거짓이다 — 그래야 짧은 대기가 한 프레임도 그려지지 않는다', () => {
    render(<Probe delayMs={200} />)

    expect(screen.getByTestId('probe')).toHaveTextContent('아직')
  })

  it('지연이 지나기 전까지는 계속 거짓이다', () => {
    render(<Probe delayMs={200} />)

    act(() => {
      vi.advanceTimersByTime(199)
    })

    expect(screen.getByTestId('probe')).toHaveTextContent('아직')
  })

  it('지연이 지나면 참이 된다 — 진짜 오래 걸리는 대기는 감추지 않는다', () => {
    render(<Probe delayMs={200} />)

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByTestId('probe')).toHaveTextContent('보인다')
  })

  it('지연 전에 언마운트되면 타이머를 건다', () => {
    // 프리페치가 끝난 청크는 한 프레임 만에 준비돼 폴백이 곧바로 언마운트된다.
    // 타이머가 남으면 사라진 컴포넌트에 setState 가 걸린다.
    const clearSpy = vi.spyOn(window, 'clearTimeout')
    const view = render(<Probe delayMs={200} />)
    view.unmount()

    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })
})
