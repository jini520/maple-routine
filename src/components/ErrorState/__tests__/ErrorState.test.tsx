// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorState } from '../ErrorState'
import { StaleBanner } from '../StaleBanner'

afterEach(() => {
  cleanup()
})

describe('ErrorState', () => {
  it('제목과 설명을 렌더링한다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" description="네트워크 연결을 확인해주세요" />)

    expect(screen.getByText('캐릭터 목록을 불러오지 못했습니다')).toBeInTheDocument()
    expect(screen.getByText('네트워크 연결을 확인해주세요')).toBeInTheDocument()
  })

  it('설명이 없으면 제목만 렌더링한다', () => {
    render(<ErrorState title="요청이 너무 많습니다" />)

    expect(screen.getByText('요청이 너무 많습니다')).toBeInTheDocument()
    expect(screen.queryByTestId('error-state-description')).not.toBeInTheDocument()
  })

  it('액션이 없으면 버튼을 만들지 않는다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('액션을 누르면 onClick이 호출된다', async () => {
    const onClick = vi.fn()
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" action={{ label: '다시 시도', onClick }} />)

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // ADR-062 결정 1: 세 상태(조회 중 / 빈 상태 / 실패)가 구분 가능해야 한다. EmptyState는 아이콘을
  // 원형 배지로 감싸므로, ErrorState가 배지를 쓰지 않는 것이 그 구분의 시각적 근거다.
  it('아이콘을 배지로 감싸지 않는다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(screen.queryByTestId('empty-state-badge')).not.toBeInTheDocument()
  })

  it('스크린리더에 즉시 알리도록 role=alert 를 갖는다', () => {
    render(<ErrorState title="캐릭터 목록을 불러오지 못했습니다" />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})

describe('StaleBanner', () => {
  it('문구와 재시도 버튼을 렌더링한다', () => {
    render(<StaleBanner message="목록이 최신이 아닙니다" onRetry={() => {}} />)

    expect(screen.getByText('목록이 최신이 아닙니다')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument()
  })

  it('재시도를 누르면 onRetry가 호출된다', async () => {
    const onRetry = vi.fn()
    render(<StaleBanner message="목록이 최신이 아닙니다" onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('role=alert 를 갖는다', () => {
    render(<StaleBanner message="목록이 최신이 아닙니다" onRetry={() => {}} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
