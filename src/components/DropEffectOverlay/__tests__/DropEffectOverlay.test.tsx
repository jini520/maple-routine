// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DropEffectOverlay } from '../DropEffectOverlay'

afterEach(cleanup)

describe('DropEffectOverlay', () => {
  // 시트(vaul/Radix)가 열려 있으면 dismissable-layer가 body에 pointer-events:none을 걸어(ADR-039),
  // 상속으로 이 오버레이의 탭이 먹지 않고 뒤 시트로 통과된다. 루트가 pointer-events-auto를 잃으면
  // 그 버그가 재발하므로 회귀 방지로 고정한다. (jsdom은 실제 hit-testing을 못 해 클래스로 가드.)
  it('오버레이 루트는 pointer-events-auto로 탭을 받는다', () => {
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    expect(screen.getByTestId('drop-effect-overlay')).toHaveClass('pointer-events-auto')
  })

  // 이 오버레이 위 pointerdown이 시트를 dismiss하지 않도록 BottomSheet의 onPointerDownOutside
  // 가드가 [data-sheet-keep-open] 마커로 인식한다(ADR-039). 마커가 빠지면 연출 탭이 시트를 닫는다.
  it('오버레이 루트에 data-sheet-keep-open 마커가 있다', () => {
    render(<DropEffectOverlay itemName="칠흑의 보스 반지" onClose={vi.fn()} />)
    expect(screen.getByTestId('drop-effect-overlay')).toHaveAttribute('data-sheet-keep-open')
  })
})
