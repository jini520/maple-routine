/**
 * 층 스택의 상태에서 지금 페이지를 뽑는 조회.
 *
 * 바는 층 스택의 `layout` 이 그려서 그 내비게이터의 상태를 인자로 받는다. 그 상태의 각 단은
 * 다시 탭 내비게이터라 지금 페이지는 두 단 아래에 있다.
 *
 * 사본을 들지 않고 읽기만 한다. 페이지의 진실 공급원은 react-navigation 하나다.
 */

import { BAR_GROUPS } from './bar-groups'
import { INITIAL_TAB_ROUTE, TAB_ROUTE_NAMES, type LayerRouteName, type TabRouteName } from './routes'

/** react-navigation 이 주는 라우트/상태의 **읽는 데 필요한 만큼**. 라이브러리 타입을 좁혀 받는다. */
export interface NavRouteLike {
  readonly name: string
  readonly params?: Record<string, unknown>
  readonly state?: NavStateLike
}

export interface NavStateLike {
  readonly index?: number
  readonly routes: readonly NavRouteLike[]
}

function isTabRoute(name: unknown): name is TabRouteName {
  return typeof name === 'string' && (TAB_ROUTE_NAMES as readonly string[]).includes(name)
}

/** 그 층 화면의 첫 페이지. 상태도 파라미터도 없을 때의 마지막 안전망. 표에서 나온다. */
function firstPageOfLayer(layer: string): TabRouteName | undefined {
  const group = BAR_GROUPS.find((candidate) => candidate.layer === layer)
  if (group !== undefined) return group.subs[0].page
  // 그룹 층. 하위가 없는 그룹들의 페이지 중 첫째다.
  if (layer === ('Groups' satisfies LayerRouteName)) {
    return BAR_GROUPS.find((candidate) => candidate.page !== null)?.page ?? undefined
  }
  return undefined
}

function topRoute(state: NavStateLike | undefined): NavRouteLike | undefined {
  if (state === undefined || state.routes.length === 0) return undefined
  return state.routes[state.index ?? state.routes.length - 1]
}

/**
 * 층 스택의 상태에서 읽는 지금 페이지.
 *
 * 순서는 가장 안쪽 상태 → 이동에 실어 보낸 `screen` 파라미터 → 그 층의 첫 화면이다. 둘째 단이
 * 있는 것은 중첩 내비게이터가 첫 프레임에 아직 상태를 안 갖기 때문이고, 이동할 때 언제나
 * `params: { screen }` 을 명시하므로 그 자리에 답이 있다.
 *
 * 알 수 없는 이름이면 첫 화면으로 떨어진다. 바가 던지면 앱이 통째로 죽는다.
 */
export function pageFromLayerState(state: NavStateLike | undefined): TabRouteName {
  const layer = topRoute(state)
  if (layer === undefined) return INITIAL_TAB_ROUTE

  const inner = topRoute(layer.state)
  if (isTabRoute(inner?.name)) return inner.name

  const pending = layer.params?.screen
  if (isTabRoute(pending)) return pending

  return firstPageOfLayer(layer.name) ?? INITIAL_TAB_ROUTE
}
