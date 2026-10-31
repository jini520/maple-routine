// 백그라운드에서 포그라운드로 돌아오는 순간.
//
// 세는 것은 `background` 에서 `active` 로 바뀔 때 하나다. iOS 는 알림 센터를 내렸다 올리거나 시스템
// 팝업이 떴다 닫힐 때도 `inactive` 를 거쳐 `active` 로 오는데, 그때는 앱이 백그라운드로 간 적이 없다.
//
// 신호는 `app-focus.ts` 하나다. 그것을 세운 채 `AppState` 를 흉내 낸다. 세우지 않으면 신호가 끊겨도
// `안 부른다` 테스트가 그대로 통과한다.
import { focusManager } from '@tanstack/react-query'
import { act, render } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'

import { installAppStateFocus } from '../../features/query/app-focus'
import { useReturnToForeground } from '../useReturnToForeground'

const originalCurrentState = Object.getOwnPropertyDescriptor(AppState, 'currentState')
let stopFocus: (() => void) | null = null

/** 등록된 `change` 리스너를 잡아 상태를 바꿔 보기 위한 스파이. 복귀 신호까지 세운다. */
function startFocusSignal(initial: AppStateStatus): { change: (next: AppStateStatus) => void } {
  // 테스트 환경의 `AppState` 목은 `currentState` 가 함수라 `replaceProperty` 가 거부한다.
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

function Harness({ onReturn }: { onReturn: () => void }): null {
  useReturnToForeground(onReturn)
  return null
}

afterEach(() => {
  stopFocus?.()
  stopFocus = null
  // 포커스 값은 싱글턴에 남는다. 앞 테스트의 `true` 가 남으면 다음 `true` 가 변화로 안 잡혀 콜백이 안 불린다.
  focusManager.setFocused(undefined)
  jest.restoreAllMocks()
  if (originalCurrentState !== undefined) {
    Object.defineProperty(AppState, 'currentState', originalCurrentState)
  }
})

describe('useReturnToForeground', () => {
  it('쿼리와 같은 포커스 신호로 부른다', async () => {
    const onReturn = jest.fn()
    await render(<Harness onReturn={onReturn} />)

    focusManager.setFocused(false)
    expect(onReturn).not.toHaveBeenCalled()

    focusManager.setFocused(true)
    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('백그라운드에서 돌아오면 부른다', async () => {
    const appState = startFocusSignal('active')
    const onReturn = jest.fn()
    await render(<Harness onReturn={onReturn} />)

    appState.change('inactive')
    appState.change('background')
    appState.change('active')

    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('백그라운드를 거치지 않고 inactive 에서 돌아오면 안 부른다', async () => {
    const appState = startFocusSignal('active')
    const onReturn = jest.fn()
    await render(<Harness onReturn={onReturn} />)

    appState.change('inactive')
    appState.change('active')

    expect(onReturn).not.toHaveBeenCalled()
  })

  // 마운트 순간은 앱을 켠 때라 돌아온 것이 아니다. 앱을 켤 때의 일은 부르는 쪽이 따로 한다.
  it('마운트만으로는 안 부른다', async () => {
    startFocusSignal('active')
    const onReturn = jest.fn()

    await render(<Harness onReturn={onReturn} />)

    expect(onReturn).not.toHaveBeenCalled()
  })

  it('백그라운드 상태로 마운트된 뒤 돌아와도 부른다', async () => {
    const appState = startFocusSignal('background')
    const onReturn = jest.fn()
    await render(<Harness onReturn={onReturn} />)

    appState.change('active')

    expect(onReturn).toHaveBeenCalledTimes(1)
  })

  it('언마운트하면 더 안 부른다', async () => {
    const appState = startFocusSignal('active')
    const onReturn = jest.fn()
    const view = await render(<Harness onReturn={onReturn} />)

    await act(async () => view.unmount())
    appState.change('background')
    appState.change('active')

    expect(onReturn).not.toHaveBeenCalled()
  })
})
