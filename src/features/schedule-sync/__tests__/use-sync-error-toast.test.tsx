// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleSyncError } from '../schedule-sync'

const { showErrorMock, noticeApiKeyInvalidMock } = vi.hoisted(() => ({
  showErrorMock: vi.fn(),
  noticeApiKeyInvalidMock: vi.fn(),
}))

vi.mock('../../toast/store', () => ({
  useToastStore: { getState: () => ({ showError: showErrorMock }) },
}))

// ADR-115 결정 7: 401은 이 훅이 토스트로 알리는 대신 온보딩 스토어의 무효화 진입점에 위임한다.
vi.mock('../../onboarding/store', () => ({
  useOnboardingStore: { getState: () => ({ noticeApiKeyInvalid: noticeApiKeyInvalidMock }) },
}))

import { useScheduleSyncErrorToast } from '../use-sync-error-toast'

function Harness(props: { error: ScheduleSyncError | null; onRetry?: () => void }): React.JSX.Element {
  useScheduleSyncErrorToast(props.error, { onRetry: props.onRetry ?? (() => {}) })
  return <div />
}

beforeEach(() => {
  showErrorMock.mockClear()
  noticeApiKeyInvalidMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('useScheduleSyncErrorToast', () => {
  it('error가 null이면 토스트를 띄우지 않는다', () => {
    render(<Harness error={null} />)

    expect(showErrorMock).not.toHaveBeenCalled()
  })

  // 회귀 가드: 이 phase가 바꾸는 것은 401뿐이라 무효화 경로를 타면 안 된다(ADR-115 범위).
  it('network 실패는 문구 + 다시 시도 액션을 띄운다', () => {
    const onRetry = vi.fn()
    render(<Harness error={{ kind: 'network' }} onRetry={onRetry} />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('네트워크 오류가 발생했습니다')
    expect(action.label).toBe('다시 시도')

    action.onClick()
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
  })

  // ADR-115 결정 1·7: 401은 이 훅이 아무 토스트도 띄우지 않는다 — 문구는 noticeApiKeyInvalid()가
  // 띄우고, 액션은 없다(이동이 이미 일어나 누를 것이 없다). 여기서는 위임만 확인한다.
  it('invalidApiKey는 토스트를 띄우지 않고 키 무효화 경로로 넘긴다', () => {
    const onRetry = vi.fn()
    render(<Harness error={{ kind: 'invalidApiKey' }} onRetry={onRetry} />)

    expect(noticeApiKeyInvalidMock).toHaveBeenCalledTimes(1)
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(onRetry).not.toHaveBeenCalled()
  })

  // 멱등은 noticeApiKeyInvalid() 안의 status 가드가 맡지만(ADR-115 결정 6), 같은 값으로 재렌더될
  // 때마다 부르면 그 가드가 없는 것처럼 호출이 쌓인다 — dep이 값 자체인 것이 여기서 담보된다.
  it('같은 invalidApiKey 객체로 다시 렌더되면 무효화를 다시 부르지 않는다', () => {
    const error: ScheduleSyncError = { kind: 'invalidApiKey' }
    const { rerender } = render(<Harness error={error} />)
    rerender(<Harness error={error} />)
    rerender(<Harness error={error} />)

    expect(noticeApiKeyInvalidMock).toHaveBeenCalledTimes(1)
  })

  // 지금 누르면 또 429다 — 누를 수 있는 버튼을 주지 않는다.
  // 문구는 원인만 말한다. 처방("서비스 단계 키인지 확인해주세요")은 토스트 본문이 truncate라
  // 잘리므로 인라인 자리(배너·ErrorState·설정 계정 카드)가 준다([[ADR-114]] 결정 4).
  // 회귀 가드: 이 phase가 바꾸는 것은 401뿐이라 무효화 경로를 타면 안 된다(ADR-115 범위).
  it('rateLimited는 액션 없이 문구만 띄운다', () => {
    render(<Harness error={{ kind: 'rateLimited' }} />)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('호출 한도를 초과했습니다')
    expect(action).toBeUndefined()
    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
  })

  // ADR-083 결정 2: 캐릭터별 실패가 토스트를 타면서 이 종류가 처음 여기 도달한다.
  // 400 OPENAPI00003은 영구 실패라 "다시 시도"는 눌러도 같은 400이다(ADR-062 결정 3).
  it('characterUnavailable은 영구 실패라 액션 없이 문구만 띄운다', () => {
    render(<Harness error={{ kind: 'characterUnavailable' }} />)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('이 캐릭터는 조회할 수 없습니다')
    expect(action).toBeUndefined()
    expect(noticeApiKeyInvalidMock).not.toHaveBeenCalled()
  })

  it('같은 error 객체로 다시 렌더되면 중복으로 띄우지 않는다', () => {
    const error: ScheduleSyncError = { kind: 'network' }
    const { rerender } = render(<Harness error={error} />)
    rerender(<Harness error={error} />)
    rerender(<Harness error={error} />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
  })

  // 스토어는 실패마다 새 객체를 set하므로, 같은 종류가 연달아 실패해도 매번 알려야 한다
  // (사용자가 '다시 시도'를 눌렀는데 아무 반응이 없으면 안 된다).
  it('같은 종류라도 새 error 객체면 다시 띄운다', () => {
    const { rerender } = render(<Harness error={{ kind: 'network' }} />)
    rerender(<Harness error={{ kind: 'network' }} />)

    expect(showErrorMock).toHaveBeenCalledTimes(2)
  })

  it('실패 후 성공(null)했다가 다시 실패하면 또 띄운다', () => {
    const { rerender } = render(<Harness error={{ kind: 'network' }} />)
    rerender(<Harness error={null} />)
    rerender(<Harness error={{ kind: 'network' }} />)

    expect(showErrorMock).toHaveBeenCalledTimes(2)
  })
})
