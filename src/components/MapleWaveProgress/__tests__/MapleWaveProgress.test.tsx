// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MapleWaveProgress } from '../MapleWaveProgress'

afterEach(() => {
  cleanup()
})

describe('MapleWaveProgress', () => {
  it('progressbar 역할과 진행률을 aria 속성으로 노출한다', () => {
    render(<MapleWaveProgress percent={42} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('단풍잎 내부에 퍼센트 텍스트를 두 벌(빈 배경용/채움용) 렌더링한다', () => {
    render(<MapleWaveProgress percent={42} />)

    expect(screen.getAllByText('42%')).toHaveLength(2)
  })

  it('0%와 100%도 텍스트로 정확히 렌더링된다', () => {
    const { rerender } = render(<MapleWaveProgress percent={0} />)
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0)

    rerender(<MapleWaveProgress percent={100} />)
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0)
  })

  it('size prop으로 지정한 너비만큼 렌더링된다', () => {
    render(<MapleWaveProgress percent={10} size={96} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('width', '96')
  })
})
