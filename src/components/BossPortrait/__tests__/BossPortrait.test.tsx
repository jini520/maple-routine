// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BossPortrait } from '../BossPortrait'

afterEach(() => {
  cleanup()
})

describe('BossPortrait', () => {
  it('이미지가 있으면 원형(rounded-full) img를 렌더링하고 alt는 label과 같다', () => {
    render(<BossPortrait portraitSlug="lucid" difficulty="하드" label="루시드 (하드)" />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('alt', '루시드 (하드)')
    expect(img.className).toContain('rounded-full')
  })

  it('이미지가 없으면(portraitSlug null) label을 가진 플레이스홀더를 렌더링하고 img 역할은 없다', () => {
    render(<BossPortrait portraitSlug={null} difficulty="하드" label="자쿰" />)

    expect(screen.getByTitle('자쿰')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('slug는 있지만 해당 난이도 파일이 없으면 label을 가진 플레이스홀더를 렌더링한다', () => {
    render(<BossPortrait portraitSlug="lucid" difficulty="카오스" label="루시드 (카오스)" />)

    expect(screen.getByTitle('루시드 (카오스)')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
