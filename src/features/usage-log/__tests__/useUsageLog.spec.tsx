/**
 * 사용 로그가 백그라운드로 간 시각을 포커스 신호에서 받는지. 신호를 처리한 시각을 쓰면 iOS 에서 백그라운드 시간이 체류에
 * 들어가고 돌아온 방문이 빠진다.
 */
import { focusManager } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'

import type { UsageEvent } from '../../../types/usage-event'
import { installAppStateFocus } from '../../query/app-focus'
import { usageTracker } from '../record'
import { useUsageLog } from '../useUsageLog'

jest.mock('../record', () => {
  const { createUsageTracker } = jest.requireActual('../tracker')
  const mockEvents: UsageEvent[] = []
  return {
    mockEvents,
    usageTracker: createUsageTracker(async (event: UsageEvent) => {
      mockEvents.push(event)
    }),
  }
})
jest.mock('../flush', () => ({ flushUsageEvents: jest.fn(async () => undefined) }))

const { mockEvents } = jest.requireMock('../record') as { mockEvents: UsageEvent[] }
const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, 'currentState')
const T0 = Date.parse('2026-11-13T02:00:00.000Z')
let stopFocus: (() => void) | null = null

/** 포커스 신호를 세우고 `AppState` 의 `change` 를 손으로 보낸다. */
function startFocusSignal(initial: AppStateStatus): { change: (next: AppStateStatus) => void } {
  Object.defineProperty(AppState, 'currentState', { value: initial, configurable: true, writable: true })
  let handler: ((next: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    callback: (next: AppStateStatus) => void,
  ) => {
    handler = callback
    return { remove: jest.fn() }
  }) as unknown as typeof AppState.addEventListener)
  stopFocus = installAppStateFocus()
  return {
    change: (next) => {
      if (handler === undefined) throw new Error('change 리스너가 등록되지 않았다')
      handler(next)
    },
  }
}

function Harness(): null {
  useUsageLog()
  return null
}

beforeEach(() => {
  mockEvents.length = 0
  jest.useFakeTimers({ now: T0 })
})

afterEach(() => {
  stopFocus?.()
  stopFocus = null
  focusManager.setFocused(undefined)
  jest.useRealTimers()
  jest.restoreAllMocks()
  if (originalCurrentState !== undefined) Object.defineProperty(AppState, 'currentState', originalCurrentState)
})

describe('useUsageLog', () => {
  it('JS 가 멈춰 있다가 배경 신호를 늦게 받아도 백그라운드 시간을 체류에 넣지 않고, 돌아오면 방문을 적는다', async () => {
    const appState = startFocusSignal('active')
    await render(<Harness />)
    await act(async () => {
      await usageTracker.screen('Today', new Date(T0))
    })

    jest.advanceTimersByTime(10_000)
    jest.setSystemTime(T0 + 10_000 + 3_600_000)
    await act(async () => {
      appState.change('background')
      appState.change('active')
    })

    expect(mockEvents.filter((event) => event.type === 'screen').map((event) => event.durationMs)).toEqual([10_000])
    expect(mockEvents.filter((event) => event.type === 'visit').map((event) => event.at)).toEqual([
      new Date(T0).toISOString(),
      new Date(T0 + 10_000 + 3_600_000).toISOString(),
    ])
  })
})
