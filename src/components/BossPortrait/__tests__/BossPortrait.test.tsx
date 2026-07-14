// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { BossPortrait } from '../BossPortrait'

afterEach(() => {
  cleanup()
})

describe('BossPortrait', () => {
  it('이미지가 있으면 원형(rounded-full) 배경 이미지를 렌더링하고 aria-label은 label과 같다', () => {
    render(<BossPortrait portraitSlug="lucid" label="루시드" />)

    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', '루시드')
    expect(img.className).toContain('rounded-full')
  })

  it('crop prop을 주면 background-size/position에 그대로 반영된다', () => {
    render(<BossPortrait portraitSlug="lucid" label="루시드" crop={{ size: '150% auto', position: '20% 80%' }} />)

    const img = screen.getByRole('img')
    // jsdom은 "150% auto"에서 기본값인 auto를 생략해 "150%"로 정규화한다(브라우저와 동일하게
    // 실질적으로 같은 값) — 문자열 그대로가 아니라 정규화된 값으로 검증한다.
    expect(img.getAttribute('style')).toContain('background-size: 150%')
    expect(img.getAttribute('style')).toContain('background-position: 20% 80%')
  })

  it('이미지가 없으면(portraitSlug null) label을 가진 플레이스홀더를 렌더링하고 img 역할은 없다', () => {
    render(<BossPortrait portraitSlug={null} label="벨로나" />)

    expect(screen.getByTitle('벨로나')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('존재하지 않는 slug면 label을 가진 플레이스홀더를 렌더링한다', () => {
    render(<BossPortrait portraitSlug="존재하지않는슬러그" label="알 수 없는 보스" />)

    expect(screen.getByTitle('알 수 없는 보스')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
