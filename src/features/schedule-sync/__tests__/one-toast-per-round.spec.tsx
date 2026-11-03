/** @jest-environment jsdom */
import { cleanup, render } from '@testing-library/react'

import { useToastStore } from '../../toast/store'
import type { ScheduleSyncError } from '../schedule-sync'
import { useScheduleSyncErrorToast, useStaleCharactersToast } from '../use-sync-error-toast'

jest.mock('../../auth/store', () => ({
  useAuthStore: { getState: () => ({ noticeApiKeyIssue: jest.fn() }) },
}))

const networkError: ScheduleSyncError = { kind: 'network' }
const noop = (): void => {}

function ScheduleTab(): React.JSX.Element {
  useScheduleSyncErrorToast(networkError, { onRetry: noop })
  return <div />
}

function BossProfitTab(): React.JSX.Element {
  useStaleCharactersToast(['캐릭터A', '캐릭터B'], true, noop)
  return <div />
}

afterEach(() => {
  cleanup()
})

// 탭의 실행 순서는 어느 탭을 먼저 열었는지에 따라 달라진다. 순서에 기대면 인터넷이 끊겼을 때 두 장이 남는다.
describe('한 번의 회차 실패', () => {
  it.each([
    ['스케줄 탭이 먼저', <><ScheduleTab /><ScheduleTab /><BossProfitTab /></>],
    ['보스 수익 탭이 먼저', <><BossProfitTab /><ScheduleTab /><ScheduleTab /></>],
  ])('%s 돌아도 토스트가 한 장이다', (_, tabs) => {
    render(tabs)

    const { toasts, queue } = useToastStore.getState()
    expect(toasts.map((toast) => toast.message)).toEqual(['네트워크 오류가 발생했습니다'])
    expect(queue).toHaveLength(0)
  })
})
