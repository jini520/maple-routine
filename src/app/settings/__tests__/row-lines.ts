// 카드 안의 행 사이 선을 세는 보조 파일. 테스트 파일이 아니라 `*.test.tsx` 가 아니다.
//
// 행은 `card-inset` 칸으로 갈린다. `border-t` 가 돌아오면 칸 색과 선이 같은 경계를 두 번 긋는다.
import { findAllOfType, flattenStyle } from '../../../components/__tests__/render-atom'

/** 위쪽 테두리가 있는 `View` 의 수. 행 사이 선은 `border-t` 로만 그려 왔다. */
export function topLinesIn(tree: unknown): number {
  return findAllOfType(tree, 'View').filter((node) => Number(flattenStyle(node.props.style).borderTopWidth ?? 0) > 0)
    .length
}
