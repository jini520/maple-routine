import { AppState, type AppStateStatus } from 'react-native'
import { focusManager } from '@tanstack/react-query'

import { installAppStateFocus } from '../app-focus'

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
