/**
 * 화면이 «저 탭으로 가고 싶다» 고 말하는 자리 —.
 *
 * ## 왜 화면이 직접 부르지 않는가
 *
 * 층이 스택이 되면서 탭으로 가는 이동이 **두 단 중첩**이 됐다 —
 * `navigate('Main', { screen: 층, params: { screen: 페이지 } })`. 이 모양을 화면마다 손으로 적으면
 * «어느 페이지가 어느 층에 사는가» 라는 표가 화면 수만큼 복제되고, 구조를 바꿀 때 전부 함께
 * 움직여야 한다. 예전에는 `navigate('Tabs', { screen: 페이지 })` 한 줄이라 그 표가 필요 없었다.
 *
 * 그래서 번역을 여기 하나로 모은다. 화면은 여전히 **페이지 이름만** 안다.
 *
 * 훅(`app/use-open-tab.ts`)이 아니라 순수 함수가 여기 있는 이유: 이 모듈은 층 표를 읽는
 * `navigation/` 것이고, 화면에 내비게이션 객체를 물리는 일은 `app/use-screen-navigation.ts` 가
 * 이미 «화면은 루트 스택을 여기로만 다룬다» 로 세워 둔 자리다. 둘을 합치면 `navigation/` 이
 * `app/` 을 되읽는다.
 */

import { layerOfPage } from './bar-model'
import type { LayerRouteName, TabRouteName } from './routes'

export interface TabNavigateParams {
  readonly screen: LayerRouteName
  readonly params: { readonly screen: TabRouteName; readonly params?: Record<string, unknown> }
}

/**
 * 탭 이름(+ 그 화면이 받을 파라미터)을 `navigate` 인자 한 벌로 옮긴다.
 *
 * 파라미터는 **가장 안쪽 화면**에 붙는다 — 한 단 위에 붙이면 층 화면이 그것을 받고 정작 목적지
 * 화면은 못 본다(웹의 `?openPicker=1` 자리,2).
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
 * 그 페이지로 가려면 **층을 먼저 되돌려야 하는가**.
 *
 * 그룹 층(`Groups`)은 층 스택의 **항상 바닥**이다 — 하위 층만 그 위로 쌓인다. 그래서 하위 층에
 * 서 있을 때 그룹 층 페이지를 «그냥 이동» 하면 바닥에 있는 것을 **한 번 더 쌓는다**(react-navigation
 * 7 의 `navigate` 는 되돌아가지 않는다). 그러면 바는 ← 를 안 그리는데 가장자리 스와이프는 뒤로
 * 가는 **어긋난 프레임**이 된다 — 바의 «층» 판정이 페이지에서 나오기 때문이다.
 *
 * 이미 그룹 층이면 되돌리기는 무동작이라, 갈래를 나누지 않고 늘 부르면 된다.
 */
export function needsPopToGroupLayer(page: TabRouteName): boolean {
  return layerOfPage(page) === 'Groups'
}
