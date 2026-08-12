/**
 * 스냅샷을 찍기 전에 **실행마다 달라지는 값**을 지운다.
 *
 * `react-native-screens` 의 `RNSScreen` 은 `screenId` 로 nanoid 를 달아(`Tabs-li8hgy1X8G8eOXrt6sInC`)
 * 같은 트리를 두 번 찍어도 diff 가 난다. 그대로 두면 스냅샷이 **매번 빨개져 아무도 안 읽게 되고**,
 * 그러면 이 기준선이 답하기로 한 질문(*"앞으로 안 바뀌는가"*)에 답할 수 없다.
 *
 * 전역 스냅샷 시리얼라이저로 두지 않은 이유는 그것이 트리의 **모든 문자열**을 훑기 때문이다 —
 * nanoid 를 알아보는 정규식은 반드시 멀쩡한 문자열도 잡고, 그때는 회귀가 조용히 지워진다.
 * 여기서는 **키 이름**으로 정확히 그 프롭만 고른다.
 *
 * 트리 타입을 `react-test-renderer` 에서 가져오지 않고 여기 적는 이유는 그 패키지에 타입 선언이
 * 없어서다(`@types/react-test-renderer` 를 이것 하나 때문에 들이지 않는다). 쓰는 것은 세 필드뿐이다.
 */
const UNSTABLE_PROPS = ['screenId'] as const

export interface RenderedNode {
  type: string
  props: Record<string, unknown>
  children: (RenderedNode | string)[] | null
}

export type NavigationTree = RenderedNode | string | null

export function normalizeNavigationTree(node: NavigationTree): NavigationTree {
  if (node === null || typeof node === 'string') return node

  const props: Record<string, unknown> = { ...node.props }
  for (const key of UNSTABLE_PROPS) {
    if (key in props) props[key] = `<${key}>`
  }

  return {
    ...node,
    props,
    children: node.children?.map((child) => normalizeNavigationTree(child) as RenderedNode | string) ?? null,
  }
}
