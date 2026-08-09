// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DifficultySegment } from '../DifficultySegment'

afterEach(cleanup)

describe('DifficultySegment', () => {
  it('난이도를 받은 순서대로 버튼으로 그린다', () => {
    render(<DifficultySegment difficulties={['노멀', '하드', '익스트림']} selected="하드" onSelect={vi.fn()} />)

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '노멀',
      '하드',
      '익스트림',
    ])
  })

  it('선택된 난이도만 aria-pressed 다', () => {
    render(<DifficultySegment difficulties={['노멀', '하드']} selected="하드" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '노멀' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '하드' })).toHaveAttribute('aria-pressed', 'true')
  })

  // ADR-121 결정 4: 미선택도 풀컬러 뱃지 그대로 두고 흐림만 건다 — 색이 안 죽는다.
  // 고스트 칩(색 없는 아웃라인)으로 대체했던 2026-07-24 결정을 되돌린 것이다.
  it('미선택 난이도는 같은 뱃지에 opacity-40 만 걸어 그린다', () => {
    render(<DifficultySegment difficulties={['노멀', '하드']} selected="하드" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: '노멀' })).toHaveClass('opacity-40')
    expect(screen.getByRole('button', { name: '하드' })).not.toHaveClass('opacity-40')
  })

  it('미선택 뱃지도 선택 뱃지와 같은 배경을 갖는다 (색을 잃지 않는다)', () => {
    const { rerender } = render(
      <DifficultySegment difficulties={['카오스']} selected="카오스" onSelect={vi.fn()} />,
    )
    const selectedBackground = screen.getByText('카오스').style.background

    rerender(<DifficultySegment difficulties={['카오스']} selected={null} onSelect={vi.fn()} />)

    expect(screen.getByText('카오스').style.background).toBe(selectedBackground)
    expect(selectedBackground).not.toBe('')
  })

  it('탭하면 그 난이도로 onSelect 를 부른다', async () => {
    const onSelect = vi.fn()
    render(<DifficultySegment difficulties={['노멀', '하드']} selected="노멀" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: '하드' }))

    expect(onSelect).toHaveBeenCalledWith('하드')
  })

  it('이미 선택된 난이도를 다시 눌러도 onSelect 를 부르지 않는다', async () => {
    const onSelect = vi.fn()
    render(<DifficultySegment difficulties={['노멀', '하드']} selected="하드" onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: '하드' }))

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disabled 면 버튼을 눌러도 onSelect 를 부르지 않는다', async () => {
    const onSelect = vi.fn()
    render(<DifficultySegment difficulties={['노멀', '하드']} selected="노멀" onSelect={onSelect} disabled />)

    await userEvent.click(screen.getByRole('button', { name: '하드' }))

    expect(onSelect).not.toHaveBeenCalled()
  })
})
