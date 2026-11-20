import { AppState, type AppStateStatus } from 'react-native'
import { focusManager } from '@tanstack/react-query'

import { backgroundedAt, installAppStateFocus } from '../app-focus'

const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, 'currentState')

function captureAppState(initial: AppStateStatus): { change: (next: AppStateStatus) => void } {
  Object.defineProperty(AppState, 'currentState', { value: initial, configurable: true, writable: true })
  let handler: ((next: AppStateStatus) => void) | undefined
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _event: string,
    callback: (next: AppStateStatus) => void,
  ) => {
    handler = callback
    return { remove: jest.fn() }
  }) as unknown as typeof AppState.addEventListener)
  return {
    change: (next) => {
      if (handler === undefined) throw new Error('change 리스너가 등록되지 않았다')
      handler(next)
    },
  }
}

afterEach(() => {
  jest.restoreAllMocks()
  if (originalCurrentState !== undefined) Object.defineProperty(AppState, 'currentState', originalCurrentState)
})

describe('installAppStateFocus', () => {
  it('배경에서 활성으로 돌아올 때만 포커스를 알린다', () => {
    const appState = captureAppState('active')
    const focused: boolean[] = []
    const stop = installAppStateFocus()
    const unsubscribe = focusManager.subscribe((isFocused) => focused.push(isFocused))

    // iOS 알림 센터를 내렸다 올린 것. 배경에 간 적이 없다.
    appState.change('inactive')
    appState.change('active')
    expect(focused).toEqual([])

    // 배경에 갈 때 꺼서 돌아올 때 켜지는 변화가 생긴다. 켜진 것만 다시 받기의 신호다.
    appState.change('background')
    appState.change('active')
    expect(focused).toEqual([false, true])

    unsubscribe()
    stop()
  })
})

describe('backgroundedAt', () => {
  const T0 = Date.parse('2026-11-13T02:00:00.000Z')

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // 바쁜 JS 가 타이머를 조금 늦게 불러도 멈춘 것으로 보지 않는다. 보면 체류가 그만큼 짧게 잘린다.
  it('신호를 제때 받으면 받은 시각이다', () => {
    const appState = captureAppState('active')
    const stop = installAppStateFocus()

    jest.advanceTimersByTime(10_000)
    jest.setSystemTime(T0 + 10_000 + 25_000)
    appState.change('background')

    expect(backgroundedAt()).toBe(T0 + 35_000)
    stop()
  })

  // iOS 가 신호를 처리하기 전에 앱을 멈추면 신호는 돌아온 뒤에 온다. 받은 시각을 쓰면 나가 있던 시간이 0 이 된다.
  it('JS 가 멈춰 있다가 신호를 받으면 마지막으로 살아 있던 시각이다', () => {
    const appState = captureAppState('active')
    const stop = installAppStateFocus()

    jest.advanceTimersByTime(10_000)
    jest.setSystemTime(T0 + 10_000 + 3_600_000)
    appState.change('background')

    expect(backgroundedAt()).toBe(T0 + 10_000)
    stop()
  })
})
