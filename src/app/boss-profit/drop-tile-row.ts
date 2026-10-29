/**
 * 드롭 타일 줄의 카드 바탕이 스크롤을 따라 늘고 주는 셈과 고른 타일의 바탕색.
 *
 * UI 스레드의 스크롤 콜백에서 부르므로 셈은 worklet 이다.
 */
import { withAlpha } from '../../lib/color'
import type { ThemeDefinition } from '../../types/theme'

/** 카드 바탕이 늘어나는 최대 폭. 시트 좌우 여백과 같아서, 다 늘면 시트 끝에 닿는다. */
export const CARD_EDGE_STRETCH = 16

/**
 * 카드 바탕이 양쪽으로 늘어난 폭. 가려진 타일이 남은 쪽만 늘고, 그쪽 끝 16 안에서 넘긴 만큼 제자리로 돌아온다.
 *
 * @param offset 지금 스크롤 자리. 바운스로 범위 밖에 있을 수 있다
 * @param contentWidth 타일 줄 전체 폭
 * @param viewportWidth 스크롤 영역의 보이는 폭
 */
export function cardEdgeStretch(
  offset: number,
  contentWidth: number,
  viewportWidth: number,
): { left: number; right: number } {
  'worklet'
  const end = contentWidth - viewportWidth
  if (end <= 0) return { left: 0, right: 0 }
  const clamp = (value: number): number => Math.min(CARD_EDGE_STRETCH, Math.max(0, value))
  return { left: clamp(offset), right: clamp(end - offset) }
}

/** 고른 타일의 바탕. 카드 색 위에 강조색을 얹는다. 다크는 카드가 어두워 더 진하게 얹어야 같은 만큼 도드라진다. */
export function pickedTileColor(definition: ThemeDefinition): string {
  return withAlpha(definition.primary, definition.mode === 'dark' ? 0.3 : 0.22)
}
