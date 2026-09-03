/** @jest-environment jsdom */
import { cleanup, render } from '@testing-library/react'
import type { ScheduleSyncError } from '../schedule-sync'

jest.mock('../../toast/store', () => {
  const showError = jest.fn()
  return { useToastStore: { getState: () => ({ showError }) } }
})
const showErrorMock = jest.requireMock('../../toast/store').useToastStore.getState().showError as jest.Mock

// 401과 429는 이 훅이 토스트로 알리는 대신 온보딩 스토어의
// 키 재입력 진입점에 위임한다.
jest.mock('../../onboarding/store', () => {
  const noticeApiKeyIssue = jest.fn()
  return { useOnboardingStore: { getState: () => ({ noticeApiKeyIssue }) } }
})
const noticeApiKeyIssueMock = jest.requireMock('../../onboarding/store').useOnboardingStore.getState().noticeApiKeyIssue as jest.Mock

import { useScheduleSyncErrorToast } from '../use-sync-error-toast'

function Harness(props: { error: ScheduleSyncError | null; onRetry?: () => void }): React.JSX.Element {
  useScheduleSyncErrorToast(props.error, { onRetry: props.onRetry ?? (() => {}) })
  return <div />
}

beforeEach(() => {
  showErrorMock.mockClear()
  noticeApiKeyIssueMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('useScheduleSyncErrorToast', () => {
  it('error가 null이면 토스트를 띄우지 않는다', async () => {
    render(<Harness error={null} />)

    expect(showErrorMock).not.toHaveBeenCalled()
  })

  // 회귀 가드: 이 phase가 바꾸는 것은 401뿐이라 무효화 경로를 타면 안 된다(범위).
  it('network 실패는 문구 + 다시 시도 액션을 띄운다', async () => {
    const onRetry = jest.fn()
    render(<Harness error={{ kind: 'network' }} onRetry={onRetry} />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('네트워크 오류가 발생했습니다')
    expect(action.label).toBe('다시 시도')

    action.onClick()
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
  })

  // 401은 이 훅이 아무 토스트도 띄우지 않는다. 문구는 noticeApiKeyIssue가
  // 띄우고, 액션은 없다(이동이 이미 일어나 누를 것이 없다). 여기서는 위임만 확인한다.
  it('invalidApiKey는 토스트를 띄우지 않고 키 무효화 경로로 넘긴다', async () => {
    const onRetry = jest.fn()
    render(<Harness error={{ kind: 'invalidApiKey' }} onRetry={onRetry} />)

    expect(noticeApiKeyIssueMock).toHaveBeenCalledTimes(1)
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(onRetry).not.toHaveBeenCalled()
  })

  // 멱등은 noticeApiKeyIssue 안의 status 가드가 맡지만, 같은 값으로 재렌더될
  // 때마다 부르면 그 가드가 없는 것처럼 호출이 쌓인다. dep이 값 자체인 것이 여기서 담보된다.
  it('같은 invalidApiKey 객체로 다시 렌더되면 무효화를 다시 부르지 않는다', async () => {
    const error: ScheduleSyncError = { kind: 'invalidApiKey' }
    const { rerender } = render(<Harness error={error} />)
    rerender(<Harness error={error} />)
    rerender(<Harness error={error} />)

    expect(noticeApiKeyIssueMock).toHaveBeenCalledTimes(1)
  })

  // 429도 401과 같은 사슬을 탄다. 처방("키를 다시 입력한다")이 같기 때문이다.
  // 그래서 이 훅은 429에도 토스트를 띄우지 않는다. 전에는 액션 없는 문구만 띄웠는데, 이제 같은
  // 사실을 모달이 말하므로 토스트로 한 번 더 말하지 않는다(문구·처방은 ApiKeyNoticeModal).
  it('rateLimited는 토스트를 띄우지 않고 키 재입력 경로로 넘긴다', async () => {
    const onRetry = jest.fn()
    render(<Harness error={{ kind: 'rateLimited' }} onRetry={onRetry} />)

    expect(noticeApiKeyIssueMock).toHaveBeenCalledExactlyOnceWith('rateLimited')
    expect(showErrorMock).not.toHaveBeenCalled()
    expect(onRetry).not.toHaveBeenCalled()
  })

  // 캐릭터별 실패가 토스트를 타면서 이 종류가 처음 여기 도달한다.
  // 400 OPENAPI00003은 영구 실패라 "다시 시도"는 눌러도 같은 400이다.
  it('characterUnavailable은 영구 실패라 액션 없이 문구만 띄운다', async () => {
    render(<Harness error={{ kind: 'characterUnavailable' }} />)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('이 캐릭터는 조회할 수 없습니다')
    expect(action).toBeUndefined()
    expect(noticeApiKeyIssueMock).not.toHaveBeenCalled()
  })

  it('같은 error 객체로 다시 렌더되면 중복으로 띄우지 않는다', async () => {
    const error: ScheduleSyncError = { kind: 'network' }
    const { rerender } = render(<Harness error={error} />)
    rerender(<Harness error={error} />)
    rerender(<Harness error={error} />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
  })

  // 스토어는 실패마다 새 객체를 set하므로, 같은 종류가 연달아 실패해도 매번 알려야 한다
  // (사용자가 '다시 시도'를 눌렀는데 아무 반응이 없으면 안 된다).
  it('같은 종류라도 새 error 객체면 다시 띄운다', async () => {
    const { rerender } = render(<Harness error={{ kind: 'network' }} />)
    rerender(<Harness error={{ kind: 'network' }} />)

    expect(showErrorMock).toHaveBeenCalledTimes(2)
  })

  it('실패 후 성공(null)했다가 다시 실패하면 또 띄운다', async () => {
    const { rerender } = render(<Harness error={{ kind: 'network' }} />)
    rerender(<Harness error={null} />)
    rerender(<Harness error={{ kind: 'network' }} />)

    expect(showErrorMock).toHaveBeenCalledTimes(2)
  })
})
