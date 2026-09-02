// 바 위 슬롯 —.
//
// 여기서 묻는 것은 셋이다: **어디에 그리나**(선 자리가 아니라 호스트) · **누가 뒤에 서나**(바보다
// 뒤여야 백드롭이 바를 덮는다) · **화면이 숨으면 어떻게 되나**(포털로 나간 그림은 저절로 안 숨는다).
import { act, render, screen } from '@testing-library/react-native'
import { View } from 'react-native'
import { PortalProvider } from '@gorhom/portal'
import { NavigationContext } from '@react-navigation/native'

import { BottomBarOverlay, BottomBarOverlayHost } from '../BottomBarOverlay'

/** `toJSON()` 트리를 훑어 testID 를 **그리는 순서대로** 낸다. 뒤에 있는 것이 위에 그려진다. */
function 그리는순서(): string[] {
  const order: string[] = []

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node === null || typeof node !== 'object') return

    const element = node as { props?: Record<string, unknown>; children?: unknown }
    const testID = element.props?.testID
    if (typeof testID === 'string') order.push(testID)
    walk(element.children)
  }

  walk(screen.toJSON())
  return order
}

/** 바 하나 + 화면 하나 를 세운 실제 트리의 축소판 — 호스트는 바 **뒤**다. */
async function 그리기(options: { 호스트?: boolean } = {}) {
  const { 호스트 = true } = options

  return render(
    <PortalProvider shouldAddRootHost={false}>
      <View testID="화면">
        <BottomBarOverlay>
          <View testID="떠있는것" />
        </BottomBarOverlay>
      </View>
      <View testID="바" />
      {호스트 ? <BottomBarOverlayHost /> : null}
    </PortalProvider>,
  )
}

it('선 자리가 아니라 호스트에 그린다 — 그래서 바보다 뒤에 선다', async () => {
  await 그리기()

  const order = 그리는순서()

  expect(order).toContain('떠있는것')
  expect(order.indexOf('떠있는것')).toBeGreaterThan(order.indexOf('바'))
})

// 호스트가 없으면 **조용히 선 자리에 그리지 않는다**. 그러면 **올라간 줄 알았는데 안 올라간**
// 상태가 되고, 그것이 바로 이 슬롯이 없애려던 결함이다.
it('호스트가 없으면 아무 데도 안 그린다', async () => {
  await 그리기({ 호스트: false })

  expect(screen.queryByTestId('떠있는것')).toBeNull()
})

describe('화면이 초점을 잃으면 안 그린다', () => {
  interface 가짜내비 {
    isFocused: () => boolean
    addListener: (type: string, callback: () => void) => () => void
  }

  function 초점가짜(초기값: boolean): {
    navigation: 가짜내비
    보내기: (type: string) => Promise<void>
  } {
    let focused = 초기값
    const listeners = new Map<string, Set<() => void>>()

    return {
      navigation: {
        isFocused: () => focused,
        addListener: (type, callback) => {
          const bucket = listeners.get(type) ?? new Set()
          bucket.add(callback)
          listeners.set(type, bucket)
          return () => bucket.delete(callback)
        },
      },
      보내기: async (type) => {
        focused = type === 'focus'
        await act(async () => {
          listeners.get(type)?.forEach((callback) => callback())
        })
      },
    }
  }

  async function 화면에그리기(초기값: boolean) {
    const 가짜 = 초점가짜(초기값)

    await render(
      <PortalProvider shouldAddRootHost={false}>
        <NavigationContext.Provider value={가짜.navigation as never}>
          <BottomBarOverlay>
            <View testID="떠있는것" />
          </BottomBarOverlay>
        </NavigationContext.Provider>
        <BottomBarOverlayHost />
      </PortalProvider>,
    )

    return 가짜
  }

  it('처음부터 초점이 없으면 안 그린다', async () => {
    await 화면에그리기(false)

    expect(screen.queryByTestId('떠있는것')).toBeNull()
  })

  it('초점을 잃으면 걷히고, 되찾으면 다시 선다', async () => {
    const 가짜 = await 화면에그리기(true)
    expect(screen.getByTestId('떠있는것')).toBeTruthy()

    await 가짜.보내기('blur')
    expect(screen.queryByTestId('떠있는것')).toBeNull()

    await 가짜.보내기('focus')
    expect(screen.getByTestId('떠있는것')).toBeTruthy()
  })
})
