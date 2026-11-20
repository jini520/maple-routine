/**
 * 떠 있는 하단바의 치수. 창 폭과 3버튼 내비게이션 바 여부에서 나오는 계산.
 *
 * **폭이 세로를 정한다.** 칸이 처음부터 바 폭의 함수라, 높이만 상수로 두면 알약의 종횡비가 기기마다
 * 달라진다(402pt 에서 92×66 이던 것이 320pt 에서 76×66). 어디서나 같은 비율이어야 하므로 세로를
 * 폭에 건다.
 *
 * **재지 않고 계산한다.** 측정은 첫 프레임에 0 이라 알약이 한 프레임 접혀 있었다. 전제는 하나,
 * 바의 부모가 창 전체를 덮는다는 것이다.
 *
 * 이 파일이 `lib/` 인 것은 값을 보는 자리가 여럿이라서다(바 자신 · 콘텐츠가 남기는 몫 · 안전영역
 * 페이드 · 토스트). 바 쪽에 두면 컴포넌트가 내비게이션을 import 하고 셸 쪽에 두면 바가 화면 셸의 내부를
 * 알게 된다. 어느 쪽도 아닌 순수 계산이라 여기 둔다.
 */
import type { ScreenLayout } from './screen-layout'

/**
 * 바가 창 가장자리에서 남기는 **최소** 여백. 3버튼 내비게이션 바 위에서 띄우는 높이도 이 값이라 세 방향 간격이 같다.
 *
 * 상한(`BAR_MAX_WIDTH`)에 걸리면 남는 폭이 좌우로 갈라져 이보다 커진다. 그때 이 값은 여백 이
 * 아니라 여백의 하한 이다.
 */
export const BAR_SIDE_MARGIN = 14

/**
 * 바 폭의 상한. 태블릿에서 캡슐이 계속 늘어나지 않게 한다.
 *
 * 가장 큰 휴대폰(440pt)의 바가 412 이므로 그 위 첫 자리다. 폴더블 내부 화면(674pt)과
 * 태블릿(834pt~)이 여기 걸리고 휴대폰은 하나도 안 걸린다. 상한이 큰 화면에만 작동한다는 뜻이다.
 */
export const BAR_MAX_WIDTH = 420

/**
 * 바 높이의 하한.
 *
 * 비례가 무너지는 자리가 아니라 **내용이 먼저 바닥나는** 자리다. 320pt 의 비례값은 56 인데
 * 그 안에 들어갈 글리프 블록(아이콘 25 + 간격 4 + 라벨 ~14)이 43 이라 위아래 여백이 3.5 밖에
 * 안 남는다. 360dp 안드로이드가 정확히 이 값에 앉는다.
 */
export const BAR_MIN_HEIGHT = 64

/**
 * 비례 상수를 역산한 기준. 고른 값이 아니라 이 앱이 이미 쓰고 있던 한 쌍이다(402pt 기기에서
 * 폭 374 · 높이 72). 그래서 그 기기에서는 계산이 한 픽셀도 안 바꾼다.
 */
const REFERENCE_WINDOW_WIDTH = 402
const REFERENCE_HEIGHT = 72
const HEIGHT_PER_WIDTH = REFERENCE_HEIGHT / (REFERENCE_WINDOW_WIDTH - BAR_SIDE_MARGIN * 2)

export interface BottomBarMetrics {
  /** 바의 폭. */
  widthPx: number
  /** 바 좌우에 남는 여백. 상한에 걸리면 `BAR_SIDE_MARGIN` 보다 커진다(가운데 정렬). */
  sideMarginPx: number
  /** 바의 높이. */
  heightPx: number
  /**
   * 안전영역 위로 바를 띄우는 높이. 3버튼 내비게이션 바 위에서만 `BAR_SIDE_MARGIN` 이고 그 밖에는 0 이다.
   * 3버튼 바는 버튼 줄 전체가 인셋이라 바로 위에 서면 바가 버튼 줄에 붙는다.
   */
  liftPx: number
  /** 콘텐츠가 아래에 남겨야 하는 세로 몫(높이 + 띄운 높이). `bottom-inset.ts` 와 안전영역 페이드가 본다. */
  spacePx: number
}

/**
 * 창 폭과 `useButtonNavigation()` 으로 정하는 가로 바의 치수 전부.
 *
 * **폭의 상한이 높이의 상한을 겸한다**. 높이를 (이미 상한에 걸린) 폭에서 계산하기 때문이다.
 * 상한 값을 따로 적으면 폭은 멈췄는데 높이만 계속 자라는 조합이 만들어지고, 그것은 이 함수가
 * 지키려는 비율 자체를 깨는 상태다.
 *
 * @param buttonNavigation 아래에 3버튼 내비게이션 바가 있는가
 */
export function resolveBottomBarMetrics(windowWidthPx: number, buttonNavigation: boolean): BottomBarMetrics {
  const widthPx = Math.min(windowWidthPx - BAR_SIDE_MARGIN * 2, BAR_MAX_WIDTH)
  const heightPx = barHeightOf(widthPx)
  const liftPx = buttonNavigation ? BAR_SIDE_MARGIN : 0

  return {
    widthPx,
    sideMarginPx: (windowWidthPx - widthPx) / 2,
    heightPx,
    liftPx,
    spacePx: heightPx + liftPx,
  }
}

/** 바 폭에서 나오는 높이. 설정의 하단 탭 순서 미리보기도 바보다 좁은 폭에서 이 값으로 같은 비율을 지킨다 */
export function barHeightOf(widthPx: number): number {
  return Math.round(Math.max(BAR_MIN_HEIGHT, widthPx * HEIGHT_PER_WIDTH))
}

/** 하단바가 화면 아래에서 차지하는 세로. 콘텐츠 끝 여백 · 페이드 · 토스트 · ＋ 가 그 위에 선다. */
export interface BottomBarSpace {
  heightPx: number
  liftPx: number
  spacePx: number
}

/**
 * 지금 구간에서 하단바가 화면 아래에서 차지하는 세로. 세로 막대는 옆에 서서 0 이다.
 *
 * @param buttonNavigation 아래에 3버튼 내비게이션 바가 있는가
 */
export function resolveBottomBarSpace(layout: ScreenLayout, buttonNavigation: boolean): BottomBarSpace {
  if (layout.kind === 'side-rail') return { heightPx: 0, liftPx: 0, spacePx: 0 }

  const { heightPx, liftPx, spacePx } = resolveBottomBarMetrics(layout.contentWidthPx, buttonNavigation)
  return { heightPx, liftPx, spacePx }
}

/** 세로 막대의 폭. 가장 긴 라벨 `파티 스케줄` 이 알약(폭 − 안쪽 여백 × 2) 안에 드는 폭. */
export const RAIL_BAR_WIDTH = 64

/** 세로 막대 한 칸의 높이. 아이콘 · 간격 · 라벨(44)에 위아래 6 씩. */
export const RAIL_BAR_ITEM_HEIGHT = 56

export interface RailBarMetrics {
  widthPx: number
  heightPx: number
  /** 창 왼쪽 끝에서 막대 왼쪽 끝까지. */
  leftPx: number
  /** 창 위 끝에서 막대 위 끝까지. */
  topPx: number
  itemHeightPx: number
}

/**
 * 오른쪽 레일 화면의 세로 막대 치수. 레일 폭은 OS 가 정해 창 크기를 따라 늘어나지 않으므로 고정값이다.
 *
 * 가로 가운데는 레일의 가운데다. OS 가 레일 위에 그리는 막대의 자리는 앱에 주어지지 않는다.
 */
export function resolveRailBarMetrics(options: {
  layout: ScreenLayout
  /** `useBottomSafeAreaPx()`. 막대 아래 끝이 여기 닿는다. */
  bottomSafeAreaPx: number
  itemCount: number
  /** 막대 안쪽 여백. 가로 바의 `BAR_PADDING` 과 같은 값. */
  paddingPx: number
}): RailBarMetrics {
  const { layout, bottomSafeAreaPx, itemCount, paddingPx } = options
  const heightPx = RAIL_BAR_ITEM_HEIGHT * itemCount + paddingPx * 2

  return {
    widthPx: RAIL_BAR_WIDTH,
    heightPx,
    leftPx: layout.contentWidthPx + (layout.railWidthPx - RAIL_BAR_WIDTH) / 2,
    topPx: layout.windowHeightPx - bottomSafeAreaPx - heightPx,
    itemHeightPx: RAIL_BAR_ITEM_HEIGHT,
  }
}
