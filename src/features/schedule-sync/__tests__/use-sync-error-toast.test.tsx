// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScheduleSyncError } from '../schedule-sync'

const { showErrorMock } = vi.hoisted(() => ({ showErrorMock: vi.fn() }))

vi.mock('../../toast/store', () => ({
  useToastStore: { getState: () => ({ showError: showErrorMock }) },
}))

import { useScheduleSyncErrorToast } from '../use-sync-error-toast'

function Harness(props: {
  error: ScheduleSyncError | null
  onRetry?: () => void
  onOpenSettings?: () => void
}): React.JSX.Element {
  useScheduleSyncErrorToast(props.error, {
    onRetry: props.onRetry ?? (() => {}),
    onOpenSettings: props.onOpenSettings ?? (() => {}),
  })
  return <div />
}

beforeEach(() => {
  showErrorMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('useScheduleSyncErrorToast', () => {
  it('error가 null이면 토스트를 띄우지 않는다', () => {
    render(<Harness error={null} />)

    expect(showErrorMock).not.toHaveBeenCalled()
  })

  it('network 실패는 문구 + 다시 시도 액션을 띄운다', () => {
    const onRetry = vi.fn()
    render(<Harness error={{ kind: 'network' }} onRetry={onRetry} />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('네트워크 오류가 발생했습니다')
    expect(action.label).toBe('다시 시도')

    action.onClick()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  // ADR-062 결정 3과 같은 판단 — 401은 재시도로 풀리지 않으므로 설정으로 보낸다.
  it('invalidApiKey는 재시도가 아니라 설정 열기를 준다', () => {
    const onRetry = vi.fn()
    const onOpenSettings = vi.fn()
    render(<Harness error={{ kind: 'invalidApiKey' }} onRetry={onRetry} onOpenSettings={onOpenSettings} />)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('API 키가 유효하지 않습니다')
    expect(action.label).toBe('설정 열기')

    action.onClick()
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    expect(onRetry).not.toHaveBeenCalled()
  })

  // 지금 누르면 또 429다 — 누를 수 있는 버튼을 주지 않는다.
  // 문구는 원인만 말한다. 처방("서비스 단계 키인지 확인해주세요")은 토스트 본문이 truncate라
  // 잘리므로 인라인 자리(배너·ErrorState·설정 계정 카드)가 준다([[ADR-114]] 결정 4).
  it('rateLimited는 액션 없이 문구만 띄운다', () => {
    render(<Harness error={{ kind: 'rateLimited' }} />)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('호출 한도를 초과했습니다')
    expect(action).toBeUndefined()
  })

  // ADR-083 결정 2: 캐릭터별 실패가 토스트를 타면서 이 종류가 처음 여기 도달한다.
  // 400 OPENAPI00003은 영구 실패라 "다시 시도"는 눌러도 같은 400이다(ADR-062 결정 3).
  it('characterUnavailable은 영구 실패라 액션 없이 문구만 띄운다', () => {
    render(<Harness error={{ kind: 'characterUnavailable' }} />)

    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('이 캐릭터는 조회할 수 없습니다')
    expect(action).toBeUndefined()
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
