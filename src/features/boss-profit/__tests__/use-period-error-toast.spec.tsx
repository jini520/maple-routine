/** @jest-environment jsdom */
import { cleanup, render } from '@testing-library/react'

jest.mock('../../toast/store', () => {
  const showError = jest.fn()
  return { useToastStore: { getState: () => ({ showError }) } }
})
const showErrorMock = jest.requireMock('../../toast/store').useToastStore.getState().showError as jest.Mock

import { usePeriodLoadErrorToast } from '../use-period-error-toast'

function Harness(props: {
  isFailed: boolean
  isLoading: boolean
  periodKey: string
  onRetry?: () => void
}): React.JSX.Element {
  usePeriodLoadErrorToast({
    isFailed: props.isFailed,
    isLoading: props.isLoading,
    periodKey: props.periodKey,
    onRetry: props.onRetry ?? (() => {}),
  })
  return <div />
}

beforeEach(() => {
  showErrorMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('usePeriodLoadErrorToast (ADR-083 결정 3)', () => {
  it('실패가 아니면 띄우지 않는다', async () => {
    render(<Harness isFailed={false} isLoading={false} periodKey="2026-W31" />)

    expect(showErrorMock).not.toHaveBeenCalled()
  })

  it('로딩 중에는 아직 띄우지 않는다 — 결과가 나온 뒤에 말한다', async () => {
    render(<Harness isFailed={true} isLoading={true} periodKey="2026-W31" />)

    expect(showErrorMock).not.toHaveBeenCalled()
  })

  // 문구는 카드가 없을 때의 ErrorState 제목과 같다 — 같은 실패의 두 얼굴이 다른 말을 하면 안 된다.
  // "— 다시 시도해주세요"는 액션 버튼이 대신하므로 뗀다.
  it('실패하면 문구 + 다시 시도 액션을 띄운다', async () => {
    const onRetry = jest.fn()
    render(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" onRetry={onRetry} />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
    const [message, action] = showErrorMock.mock.calls[0]
    expect(message).toBe('이 기간을 불러오지 못했습니다')
    expect(action.label).toBe('다시 시도')

    action.onClick()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('같은 기간으로 재렌더돼도 중복으로 띄우지 않는다', async () => {
    const { rerender } = render(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)
    rerender(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)
    rerender(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
  })

  it('다른 기간으로 이동해 실패하면 다시 띄운다', async () => {
    const { rerender } = render(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)
    rerender(<Harness isFailed={true} isLoading={false} periodKey="2026-W30" />)

    expect(showErrorMock).toHaveBeenCalledTimes(2)
  })

  // 이 가드가 없으면 "다시 시도"를 눌러 같은 기간이 또 실패했을 때 아무 반응이 없다.
  it('같은 기간이라도 로딩을 거쳐 다시 실패하면 또 띄운다', async () => {
    const { rerender } = render(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)
    rerender(<Harness isFailed={false} isLoading={true} periodKey="2026-W31" />)
    rerender(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)

    expect(showErrorMock).toHaveBeenCalledTimes(2)
  })

  it('실패했다가 성공하면 그 뒤 재렌더에는 아무것도 띄우지 않는다', async () => {
    const { rerender } = render(<Harness isFailed={true} isLoading={false} periodKey="2026-W31" />)
    rerender(<Harness isFailed={false} isLoading={false} periodKey="2026-W31" />)
    rerender(<Harness isFailed={false} isLoading={false} periodKey="2026-W31" />)

    expect(showErrorMock).toHaveBeenCalledTimes(1)
  })
})
