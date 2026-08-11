// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { hideSplashScreenMock } = vi.hoisted(() => ({ hideSplashScreenMock: vi.fn() }))

vi.mock('@core/native/splash-screen', () => ({
  hideSplashScreen: hideSplashScreenMock,
}))

import { ErrorBoundary } from '../ErrorBoundary'

function Boom(): React.JSX.Element {
  throw new Error('render failed')
}

beforeEach(() => {
  // 바운더리가 잡은 예외를 React가 콘솔로도 한 번 더 뱉어 테스트 출력이 시끄러워진다.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  hideSplashScreenMock.mockReset()
  hideSplashScreenMock.mockResolvedValue(undefined)
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

  // ADR-117 결정 6 — 부팅 크래시에서 폴백이 무용지물이 되는 세 고리(커버가 안 걷힘 · 폴백이 커버
  // 밑 · 터치가 죽어 버튼이 안 눌림)를 이 호출 하나가 끊는다.
  it('폴백이 뜨면 스플래시를 내린다', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(hideSplashScreenMock).toHaveBeenCalledTimes(1)
  })

  it('예외가 없으면 스플래시를 내리지 않는다', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>,
    )

    expect(hideSplashScreenMock).not.toHaveBeenCalled()
  })

  // 이 순간 필요한 것은 화면이지 정확한 실패 처리가 아니다 — 스플래시 해제가 실패해도 폴백은
  // 그려져야 하고, 처리되지 않은 rejection 으로 남아서도 안 된다.
  //
  // 후자는 `unhandledRejection` 관측으로는 검사할 수 없다 — vitest 가 `settledResults` 를
  // 추적하려고 목의 반환 promise 에 **자기 핸들러를 붙여** 삼켜지지 않아도 이벤트가 안 뜬다(실제로
  // 확인). 그래서 "호출부가 rejection 핸들러를 붙였는가"를 직접 본다.
  it('스플래시 해제가 실패해도 폴백은 그대로 그리고 rejection 을 삼킨다', async () => {
    const rejected = Promise.reject(new Error('hide failed'))
    const catchSpy = vi.spyOn(rejected, 'catch')
    hideSplashScreenMock.mockReturnValue(rejected)

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 시작' })).toBeInTheDocument()
    expect(catchSpy).toHaveBeenCalledTimes(1)

    await rejected.catch(() => {})
  })
})
