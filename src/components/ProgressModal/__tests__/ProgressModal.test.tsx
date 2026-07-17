// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressModal } from '../ProgressModal'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('ProgressModal', () => {
  it('메시지와 진행률(N/M)을 함께 표시한다', () => {
    render(<ProgressModal message="캐릭터 정보를 저장하고 있어요" completed={2} total={5} />)

    expect(screen.getByText('캐릭터 정보를 저장하고 있어요 (2/5)')).toBeInTheDocument()
  })

  it('진행률 바의 aria-valuenow가 백분율(completed/total)로 설정된다', () => {
    render(<ProgressModal message="저장 중" completed={2} total={5} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  })

  it('total이 0이면 0%로 표시한다(0으로 나눔 방지)', () => {
    render(<ProgressModal message="저장 중" completed={0} total={0} />)

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })
})
