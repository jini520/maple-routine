/**
 * 화면이 `저 탭으로 가고 싶다` 고 말하는 자리. 페이지 이름을 두 단 중첩 이동으로 옮기는 번역기.
 *
 * 층이 스택이라 탭 이동이 `navigate('Main', { screen: 층, params: { screen: 페이지 } })` 다. 이
 * 모양을 화면마다 손으로 적으면 **어느 페이지가 어느 층에 사는가** 라는 표가 화면 수만큼 복제된다.
 * 그래서 번역을 여기 하나로 모으고 화면은 페이지 이름만 안다.
 *
 * 훅이 아니라 순수 함수인 것은 이 모듈이 층 표를 읽는 `navigation/` 것이기 때문이다. 화면에
 * 내비게이션 객체를 물리는 일은 `app/use-screen-navigation.ts` 가 한다. 둘을 합치면 `navigation/`
 * 이 `app/` 을 되읽는다.
 */

import { layerOfPage } from './bar-model'
import type { LayerRouteName, TabRouteName } from './routes'

export interface TabNavigateParams {
  readonly screen: LayerRouteName
  readonly params: { readonly screen: TabRouteName; readonly params?: Record<string, unknown> }
}

/**
 * 탭 이름(+ 그 화면이 받을 파라미터)을 `navigate` 인자 한 벌로 옮긴 것.
 *
 * 파라미터는 **가장 안쪽 화면**에 붙는다. 한 단 위에 붙이면 층 화면이 그것을 받고 정작 목적지
 * 화면은 못 본다.
 */
export function tabNavigateArgs(
  page: TabRouteName,
  params?: Record<string, unknown>,
): readonly ['Main', TabNavigateParams] {
  return [
    'Main',
    {
      screen: layerOfPage(page),
      params: params === undefined ? { screen: page } : { screen: page, params },
    },
  ]
}

/**
 * 그 페이지로 가려면 층을 먼저 되돌려야 하는가.
 *
 * 그룹 층(`Groups`)은 층 스택의 항상 바닥이고 하위 층만 그 위로 쌓인다. 그래서 하위 층에
 * 서 있을 때 그룹 층 페이지를 그냥 이동하면 바닥에 있는 것을 한 번 더 쌓는다. 그러면 바는
 * ← 를 안 그리는데 가장자리 스와이프는 뒤로 가는 어긋난 프레임이 된다.
 *
 * 이미 그룹 층이면 되돌리기가 무동작이라 갈래를 나누지 않고 늘 부르면 된다.
 */
export function needsPopToGroupLayer(page: TabRouteName): boolean {
  return layerOfPage(page) === 'Groups'
}
