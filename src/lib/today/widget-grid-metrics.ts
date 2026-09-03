/**
 * today 위젯 격자의 치수. 창 폭 하나에서 나오는 계산.
 *
 * **행 높이는 폭에서 파생하지 않는다.** 정사각 셀로 두면 격자가 화면 폭에 비례해 길어져 폴더블
 * 펼침(~700dp)에서 4x2 타일 하나가 화면 절반을 넘는다. 위젯은 폭이 늘면 넓어지는 물건이지 같이
 * 길어지는 물건이 아니다. 그래서 열 폭만 유동이고 행 높이는 상수다.
 *
 * **재지 않고 계산한다.** `onLayout` 은 첫 프레임에 0 이라 타일이 한 프레임 접힌다. 창 폭을 인자로
 * 받으므로 이 파일은 순수 함수만 갖는다.
 *
 * `lib/` 인 것은 격자 컨테이너와 타일 렌더러가 함께 보고 배치 검증도 이 단위를 쓰기 때문이다.
 * 어느 한 컴포넌트에 두면 나머지가 그 컴포넌트를 import 하게 된다.
 */

/** 열 수. 고정 4. 1x1 이 아이콘 + 숫자 하나 로 성립하는 최소 단위가 되는 분할이다. */
export const GRID_COLUMNS = 4

/**
 * 격자의 좌우 여백. 앱의 모든 화면이 쓰는 16(`px-4`)이다.
 *
 * 하단바의 14에 맞추지 않는다: 바는 **떠 있는 물건**이라 콘텐츠 격자와 다른
 * 자를 써도 되고, 여기서 14 를 쓰면 today 만 다른 좌우 선을 갖는다.
 */
export const GRID_SIDE_PADDING = 16

/**
 * 타일 사이 간격. 12(제안값, 실기기에서 확정한다).
 *
 * 화면의 세로 리듬은 `gap-4`(16)이지만 그것은 **서로 다른 블록 사이** 값이다. 격자 안 타일들은
 * 한 판이라 더 붙는다.
 */
export const GRID_GAP = 12

/** 행 높이. 고정 76(제안값). 위 행 높이는 폭에서 파생하지 않는다 참조. */
export const GRID_ROW_HEIGHT = 82

export interface WidgetGridMetrics {
  /** 한 칸의 폭. 유동. 창 폭에서 여백과 간격을 뺀 나머지를 4로 나눈 값이다. */
  colWidthPx: number
  /** 한 행의 높이. 창 폭과 무관하게 `GRID_ROW_HEIGHT`. */
  rowHeightPx: number
  /** 타일 사이 간격(가로·세로 같다). */
  gapPx: number
  /** 격자의 좌우 여백. */
  padPx: number
}

/**
 * `useWindowDimensions().width` 하나로 정하는 격자의 치수 전부.
 *
 * **열 폭을 반올림하지 않는다.** 반올림하면 4칸 타일의 오른쪽이 화면 여백과 최대 3px 어긋난 채로
 * 조용히 살고, 그 어긋남은 칸이 4개 라는 사실 때문에 폭마다 다르게 나타나 재현이 어렵다.
 * 소수를 그대로 두면 `tileWidthPx(4)` 가 언제나 `창폭 − 여백×2` 다.
 */
export function resolveWidgetGridMetrics(windowWidthPx: number): WidgetGridMetrics {
  const contentWidthPx = windowWidthPx - GRID_SIDE_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)

  return {
    colWidthPx: contentWidthPx / GRID_COLUMNS,
    rowHeightPx: GRID_ROW_HEIGHT,
    gapPx: GRID_GAP,
    padPx: GRID_SIDE_PADDING,
  }
}

/** `w` 칸을 차지하는 타일의 폭. 칸 `w` 개와 그 사이 간격 `w-1` 개다. */
export function tileWidthPx(w: number, metrics: WidgetGridMetrics): number {
  return w * metrics.colWidthPx + (w - 1) * metrics.gapPx
}

/** `h` 행을 차지하는 타일의 높이. `'auto'` 는 최소 높이(nominal)를 넘겨 부른다. */
export function tileHeightPx(h: number, metrics: WidgetGridMetrics): number {
  return h * metrics.rowHeightPx + (h - 1) * metrics.gapPx
}
