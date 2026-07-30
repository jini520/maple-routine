// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

function Boom(): React.JSX.Element {
  throw new Error('render failed')
}

beforeEach(() => {
  // 바운더리가 잡은 예외를 React가 콘솔로도 한 번 더 뱉어 테스트 출력이 시끄러워진다.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('예외가 없으면 children을 그대로 그린다', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>,
    )

    expect(screen.getByText('정상 화면')).toBeInTheDocument()
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument()
  })

  // ADR-065 결정 5: 전에는 아무 문구 없는 흰 화면이 남았다.
  it('렌더 중 예외가 나면 흰 화면 대신 폴백을 그린다', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(screen.getByText('화면을 표시하지 못했습니다')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('다시 시작을 누르면 리로드한다', async () => {
    const onRestart = vi.fn()
    render(
      <ErrorBoundary onRestart={onRestart}>
        <Boom />
      </ErrorBoundary>,
    )

    await userEvent.click(screen.getByRole('button', { name: '다시 시작' }))

    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  // 선택지를 하나로 줄인 것이 이 폴백의 결정이다 — 설정 열기·스택트레이스는 넣지 않는다.
  it('다시 시작 외의 버튼을 두지 않는다', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '설정 열기' })).not.toBeInTheDocument()
    expect(screen.queryByText(/자세한 내용/)).not.toBeInTheDocument()
  })
})
