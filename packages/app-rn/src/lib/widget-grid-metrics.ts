/**
 * today 위젯 격자의 **치수** — 창 폭 하나에서 나온다 ([[ADR-147]] 결정 1).
 *
 * ## 행 높이는 폭에서 파생하지 않는다
 *
 * 이 파일의 핵심이 그 한 줄이다. 정사각 셀(행 높이 = 열 폭)로 두면 격자가 화면 폭에 **비례해
 * 길어져** 폴더블 펼침(~700dp)에서 4x2 타일 하나가 화면 절반을 넘는다. 위젯은 *«폭이 늘면
 * 넓어지는»* 물건이지 *«같이 길어지는»* 물건이 아니다. 그래서 열 폭만 유동이고 행 높이는 상수다
 * (360dp 에서 열 폭 73 · 행 높이 76 이라 1x1 이 거의 정사각이고, 큰 화면에서는 옆으로만 넓어진다).
 *
 * ## 재지 않고 계산한다
 *
 * `onLayout` 실측을 쓰지 않는다 — 첫 프레임에 0 이라 타일이 한 프레임 접혀 있다. 하단바가 같은
 * 결론에 먼저 도달했다([[ADR-132]] 정정 30 · `bottom-bar-metrics.ts`). 창 폭은 인자로 받으므로
 * 이 파일은 순수 함수만 갖고, 값 조합만으로 테스트가 선다.
 *
 * ## 왜 이 파일이 `lib/` 에 있는가
 *
 * 격자 컨테이너와 타일 렌더러가 함께 보는 값이고 배치 검증(`widget-layout.ts`)도 이 단위를 쓴다.
 * 어느 한 컴포넌트에 두면 나머지가 그 컴포넌트를 import 하게 된다.
 */

/** 열 수 — 고정 4. 1x1 이 «아이콘 + 숫자 하나» 로 성립하는 최소 단위가 되는 분할이다. */
export const GRID_COLUMNS = 4

/**
 * 격자의 좌우 여백 — 앱의 모든 화면이 쓰는 16(`px-4`)이다.
 *
 * 하단바의 14([[ADR-132]] 결정 11)에 맞추지 않는다: 바는 **떠 있는 물건**이라 콘텐츠 격자와 다른
 * 자를 써도 되고, 여기서 14 를 쓰면 today 만 다른 좌우 선을 갖는다.
 */
export const GRID_SIDE_PADDING = 16

/**
 * 타일 사이 간격 — 12(제안값, 실기기에서 확정한다).
 *
 * 화면의 세로 리듬은 `gap-4`(16)이지만 그것은 **서로 다른 블록 사이** 값이다. 격자 안 타일들은
 * 한 판이라 더 붙는다.
 */
export const GRID_GAP = 12

/** 행 높이 — 고정 76(제안값). 위 「행 높이는 폭에서 파생하지 않는다」 참조. */
export const GRID_ROW_HEIGHT = 76

export interface WidgetGridMetrics {
  /** 한 칸의 폭 — 유동. 창 폭에서 여백과 간격을 뺀 나머지를 4로 나눈 값이다. */
  colWidthPx: number
  /** 한 행의 높이 — 창 폭과 무관하게 `GRID_ROW_HEIGHT`. */
  rowHeightPx: number
  /** 타일 사이 간격(가로·세로 같다). */
  gapPx: number
  /** 격자의 좌우 여백. */
  padPx: number
}

/**
 * `useWindowDimensions().width` 하나로 격자의 치수를 전부 정한다.
 *
 * **열 폭을 반올림하지 않는다.** 반올림하면 4칸 타일의 오른쪽이 화면 여백과 최대 3px 어긋난 채로
 * 조용히 살고, 그 어긋남은 «칸이 4개» 라는 사실 때문에 폭마다 다르게 나타나 재현이 어렵다.
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

/** `w` 칸을 차지하는 타일의 폭 — 칸 `w` 개와 그 사이 간격 `w-1` 개다. */
export function tileWidthPx(w: number, metrics: WidgetGridMetrics): number {
  return w * metrics.colWidthPx + (w - 1) * metrics.gapPx
}

/** `h` 행을 차지하는 타일의 높이. `'auto'` 는 최소 높이(nominal)를 넘겨 부른다. */
export function tileHeightPx(h: number, metrics: WidgetGridMetrics): number {
  return h * metrics.rowHeightPx + (h - 1) * metrics.gapPx
}
