// 화면이 **저 탭으로 가고 싶다** 고 말하는 자리.
//
// `use-screen-navigation.ts` 와 나란히 있는 이유는 같은 종류의 통로이기 때문이다. 그쪽이
// **하위 페이지를 민다** 를 맡고, 이쪽이 **저 탭을 연다** 를 맡는다. 층 이름과 중첩 파라미터의
// 모양은 `navigation/tab-navigate.ts` 가 알고, 화면은 **페이지 이름만** 안다.
//
// 층이 스택이 된 뒤로 하위를 가진 그룹으로 가는 것은 **한 단 내려가는 이동**이라, 이 함수를 탄
// 이동에도 전환과 가장자리 스와이프가 함께 붙는다(today 위젯 타일이 그 길로 간다).
import { useCallback } from 'react'

import { StackActions } from '@react-navigation/native'

import {
  needsPopToGroupLayer,
  tabNavigateArgs,
  type TabNavigateParams,
} from '../navigation/tab-navigate'
import type { TabRouteName } from '../navigation/routes'
import { useScreenNavigation } from './use-screen-navigation'

export function useOpenTab(): (page: TabRouteName, params?: Record<string, unknown>) => void {
  const navigation = useScreenNavigation()

  return useCallback(
    (page: TabRouteName, params?: Record<string, unknown>) => {
      // 그룹 층은 층 스택의 바닥이라 **되돌아가기** 가 곧 `popToTop` 이다(`needsPopToGroupLayer`).
      // 화면에서 부르므로 이 액션은 가장 가까운 내비게이터(탭)를 못 지나 **층 스택까지 올라간다** —
      // 액션이 부모로 전파되는 것은 `navigate('DropPrice')` 가 여기서 통하는 것과 같은 성질이다.
      if (needsPopToGroupLayer(page)) navigation.dispatch(StackActions.popToTop())

      const [name, nested] = tabNavigateArgs(page, params)
      // 층 이름이 유니온이라 `navigate` 의 파라미터가 하나로 안 좁혀진다(`Main.tsx` 와 같은 대가).
      ;(navigation.navigate as (route: string, params: TabNavigateParams) => void)(name, nested)
    },
    [navigation],
  )
}
