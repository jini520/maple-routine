// 아래에 3버튼 내비게이션 바가 있는가. 하단바 · 토스트 · 콘텐츠 몫이 이 값 하나로 함께 오르내린다.
//
// 값은 네이티브가 갖고 있고 이 훅은 그것을 읽어 그린다. 사용자가 내비게이션 방식을 바꾸거나 갤럭시의 버튼 숨기기로
// 버튼 줄을 내리면 네이티브가 알리고, 바가 그 자리에서 따라 움직여야 한다.
import { act, render } from '@testing-library/react-native'
import { Text } from 'react-native'

import { setSystemBarsPort } from '../../native/ports'
import { noopSystemBarsPort } from '../../native/__tests__/fake-native-ports'
import { useButtonNavigation } from '../useButtonNavigation'

/** 내비게이션 방식을 바꿔 볼 수 있는 가짜 기기. */
function 기기(처음: boolean): { change: (next: boolean) => void; listenerCount: () => number } {
  let value = 처음
  const listeners = new Set<() => void>()
  setSystemBarsPort({
    ...noopSystemBarsPort,
    isButtonNavigation: () => value,
    addButtonNavigationListener: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  })

  return {
    change: (next) => {
      value = next
      for (const listener of listeners) listener()
    },
    listenerCount: () => listeners.size,
  }
}

function Probe(): React.JSX.Element {
  return <Text testID="probe">{String(useButtonNavigation())}</Text>
}

afterEach(() => {
  setSystemBarsPort(noopSystemBarsPort)
})

describe('useButtonNavigation', () => {
  // 첫 그림부터 맞아야 한다. 거짓으로 그렸다가 고치면 3버튼 기기에서 앱을 열 때마다 바가 한 번 튄다.
  it('처음 그릴 때부터 네이티브가 아는 값을 쓴다', async () => {
    기기(true)
    const { getByTestId } = await render(<Probe />)

    expect(getByTestId('probe').props.children).toBe('true')
  })

  it('내비게이션 방식이 바뀌었다고 알리면 다시 그린다', async () => {
    const 폰 = 기기(false)
    const { getByTestId } = await render(<Probe />)

    await act(async () => {
      폰.change(true)
    })
    expect(getByTestId('probe').props.children).toBe('true')

    await act(async () => {
      폰.change(false)
    })
    expect(getByTestId('probe').props.children).toBe('false')
  })

  it('언마운트하면 구독을 뗀다', async () => {
    const 폰 = 기기(false)
    const view = await render(<Probe />)
    expect(폰.listenerCount()).toBe(1)

    await act(async () => {
      view.unmount()
    })

    expect(폰.listenerCount()).toBe(0)
  })
})
