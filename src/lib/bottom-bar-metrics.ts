/**
 * 떠 있는 하단바의 치수. 창 폭과 3버튼 내비게이션 바 여부에서 나오는 계산.
 *
 * **재지 않고 계산한다.** 측정은 첫 프레임에 0 이라 알약이 한 프레임 접혀 있었다. 전제는 하나,
 * 바의 부모가 창 전체를 덮는다는 것이다.
 *
 * 이 파일이 `lib/` 인 것은 값을 보는 자리가 여럿이라서다(바 자신 · 콘텐츠가 남기는 몫 · 안전영역
 * 페이드 · 토스트 · 설정의 미리보기). 어느 컴포넌트에도 속하지 않는 순수 계산이라 여기 둔다.
 */
import type { ScreenLayout } from './screen-layout'

/** 바가 창 좌우 가장자리에서 남기는 **최소** 여백. 3버튼 내비게이션 바 위에서 띄우는 높이도 이 값이라 세 방향 간격이 같다. */
export const BAR_SIDE_MARGIN = 21

/** 바 폭의 상한. 태블릿에서 캡슐이 계속 늘어나지 않게 한다. 휴대폰은 하나도 안 걸린다. */
export const BAR_MAX_WIDTH = 420

/** 가로 바의 높이. iOS 시스템 탭 바가 기기 폭과 관계없이 62 라 같이 둔다. */
export const BAR_HEIGHT = 62

/** 바 안쪽 여백. 끝 칸의 알약이 바 위아래 · 끝에서 떨어지는 거리. */
export const BAR_PADDING = 4

/** 쉬는 알약의 높이(바 높이 − 여백 × 2). */
export const PILL_HEIGHT = BAR_HEIGHT - BAR_PADDING * 2

/** 알약이 그룹 행 칸보다 넓은 정도. */
export const PILL_OVERHANG = 9

/** 하위 행의 ← 원 지름. 알약 높이와 같다. */
export const BACK_CIRCLE = PILL_HEIGHT

/** ← 원과 바 사이 간격. */
export const BACK_GAP = 8

/** 하위 행의 칸 수. 하위가 셋인 그룹도 네 칸으로 나눠, 행을 오갈 때 알약 폭이 바뀌지 않는다. */
export const SUB_ROW_SLOTS = 4

export interface BottomBarMetrics {
  /** 그룹 행 바의 폭. 하위 행은 이 폭에서 ← 원 자리를 뺀다. */
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
 * @param buttonNavigation 아래에 3버튼 내비게이션 바가 있는가
 */
export function resolveBottomBarMetrics(windowWidthPx: number, buttonNavigation: boolean): BottomBarMetrics {
  const widthPx = Math.min(windowWidthPx - BAR_SIDE_MARGIN * 2, BAR_MAX_WIDTH)
  const liftPx = buttonNavigation ? BAR_SIDE_MARGIN : 0

  return {
    widthPx,
    sideMarginPx: (windowWidthPx - widthPx) / 2,
    heightPx: BAR_HEIGHT,
    liftPx,
    spacePx: BAR_HEIGHT + liftPx,
  }
}

/** 바 한 행에서 칸이 늘어선 방향(가로 바는 가로, 세로 막대는 세로)의 배치. */
export interface BarRowLayout {
  /** 그룹 행 바의 시작에서 이 행 바의 시작까지. 하위 행은 ← 원과 간격만큼 밀린다. */
  offsetPx: number
  /** 이 행 바의 길이. */
  lengthPx: number
  /** 알약의 길이. 그룹 행 칸 + `PILL_OVERHANG` 이고 하위 행도 같다. */
  pillLengthPx: number
  /** 바 시작에서 첫 칸 가운데까지. 끝 칸의 알약이 바 끝에서 `paddingPx` 만큼 떨어진다. */
  firstCenterPx: number
  /** 칸 가운데 사이 거리. */
  spacingPx: number
}

/**
 * 한 행의 칸 배치. 그룹 행은 `groupSlots` 칸, 하위 행은 ← 원 자리를 뺀 남은 길이를 `SUB_ROW_SLOTS` 칸으로 나눈다.
 *
 * 알약 길이를 하위 행에서도 그룹 행 값으로 두는 것은 행이 바뀔 때 알약 크기가 튀지 않게 하려는 것이다.
 */
export function resolveBarRowLayout(options: {
  /** 그룹 행 바의 길이(가로 바는 `widthPx`, 세로 막대는 막대 높이). */
  fullLengthPx: number
  groupSlots: number
  /** 하위 행인가(← 원이 바 앞에 따로 선다) */
  sub: boolean
  paddingPx: number
}): BarRowLayout {
  const { fullLengthPx, groupSlots, sub, paddingPx } = options
  const pillLengthPx = (fullLengthPx - paddingPx * 2 - PILL_OVERHANG) / groupSlots + PILL_OVERHANG
  const offsetPx = sub ? BACK_CIRCLE + BACK_GAP : 0
  const lengthPx = fullLengthPx - offsetPx
  const slots = sub ? SUB_ROW_SLOTS : groupSlots

  return {
    offsetPx,
    lengthPx,
    pillLengthPx,
    firstCenterPx: paddingPx + pillLengthPx / 2,
    spacingPx: (lengthPx - paddingPx * 2 - pillLengthPx) / (slots - 1),
  }
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

/** 세로 막대 한 칸의 높이. 아이콘 · 간격 · 라벨(44)에 위아래 6 씩. 막대 길이를 이 값으로 정한다. */
export const RAIL_BAR_ITEM_HEIGHT = 56

export interface RailBarMetrics {
  widthPx: number
  heightPx: number
  /** 창 왼쪽 끝에서 막대 왼쪽 끝까지. */
  leftPx: number
  /** 창 위 끝에서 그룹 행 막대 위 끝까지. 하위 행은 이 자리에 ← 원이 서고 막대가 그만큼 아래에서 시작한다. */
  topPx: number
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
}): RailBarMetrics {
  const { layout, bottomSafeAreaPx, itemCount } = options
  const heightPx = RAIL_BAR_ITEM_HEIGHT * itemCount + BAR_PADDING * 2

  return {
    widthPx: RAIL_BAR_WIDTH,
    heightPx,
    leftPx: layout.contentWidthPx + (layout.railWidthPx - RAIL_BAR_WIDTH) / 2,
    topPx: layout.windowHeightPx - bottomSafeAreaPx - heightPx,
  }
}
