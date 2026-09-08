// 최상단 이동을 화면에 잇는 훅 둘. 등록하는 쪽(`useScrollToTopTarget`)과 부르는 쪽
// (`useScrollToTop`)이 **같은 라우트 이름**을 봐야 화면 안의 버튼과 하단바가 한 과녁을 친다.
//
// 라우트를 `useRoute()` 로 안 읽는다. 그 훅은 내비게이터 밖에서 던지는데 이 저장소의 컴포넌트
// 테스트는 내비게이터 없이 렌더한다. 여기서 그 밖 을 직접 렌더해 확인한다.
import { renderHook } from '@testing-library/react-native'
import { NavigationRouteContext } from '@react-navigation/native'
import { useRef, type ReactNode } from 'react'

import { __resetScrollToTopForTest, scrollPageToTop } from '../../navigation/scroll-to-top'
import { useScrollToTop, useScrollToTopTarget } from '../useScrollToTop'

beforeEach(__resetScrollToTopForTest)

function 화면(name: string): (props: { children: ReactNode }) => React.JSX.Element {
  return function Screen({ children }) {
    return (
      <NavigationRouteContext.Provider value={{ key: `${name}-1`, name }}>
        {children}
      </NavigationRouteContext.Provider>
    )
  }
}

/** 셸이 넘기는 것과 같은 모양의 과녁. `scrollTo` 하나만 본다. */
function 과녁(): { scrollTo: jest.Mock } {
  return { scrollTo: jest.fn() }
}

describe('useScrollToTopTarget', () => {
  it('화면 이름으로 등록하고, 부르면 맨 위로 되돌린다', async () => {
    const target = 과녁()
    await renderHook(
      () => {
        useScrollToTopTarget(useRef(target))
      },
      { wrapper: 화면('Today') },
    )

    scrollPageToTop('Today')

    expect(target.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true })
  })

  it('언마운트하면 등록이 풀린다', async () => {
    const target = 과녁()
    const { unmount } = await renderHook(
      () => {
        useScrollToTopTarget(useRef(target))
      },
      { wrapper: 화면('Today') },
    )

    // 이 러너의 `unmount` 는 비동기다. 안 기다리면 정리가 돌기 전에 단언한다.
    await unmount()
    scrollPageToTop('Today')

    expect(target.scrollTo).not.toHaveBeenCalled()
  })

  // 셸을 내비게이터 없이 렌더하는 테스트가 이 저장소에 여럿이다. 거기서 던지면 그 스위트가
  // 통째로 빨개진다.
  it('내비게이터 밖이면 아무것도 등록하지 않는다', async () => {
    const target = 과녁()

    await expect(
      renderHook(() => {
        useScrollToTopTarget(useRef(target))
      }),
    ).resolves.toBeDefined()
  })
})

describe('useScrollToTop', () => {
  it('자기 화면의 과녁을 부른다', async () => {
    const target = 과녁()
    const { result } = await renderHook(
      () => {
        useScrollToTopTarget(useRef(target))
        return useScrollToTop()
      },
      { wrapper: 화면('Cashbook') },
    )

    result.current()

    expect(target.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true })
  })

  it('옆 화면의 과녁은 안 건드린다', async () => {
    const today = 과녁()
    await renderHook(
      () => {
        useScrollToTopTarget(useRef(today))
      },
      { wrapper: 화면('Today') },
    )
    const { result } = await renderHook(() => useScrollToTop(), { wrapper: 화면('Cashbook') })

    result.current()

    expect(today.scrollTo).not.toHaveBeenCalled()
  })

  it('내비게이터 밖에서 불러도 던지지 않는다', async () => {
    const { result } = await renderHook(() => useScrollToTop())

    expect(() => {
      result.current()
    }).not.toThrow()
  })
})
