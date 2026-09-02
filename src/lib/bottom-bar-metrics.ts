/**
 * 떠 있는 하단바의 **치수** — 창 폭 하나에서 나온다.
 *
 * ## 왜 폭이 세로를 정하는가
 *
 * 칸은 처음부터 바 폭의 함수였다(`칸 = (바폭 − 패딩×2 − 오버행) ÷ 5`). 거기에 높이만 상수로 두면
 * **알약의 종횡비가 기기마다 달라진다** — 402pt 에서 92×66 이던 알약이 320pt 에서는 76×66(더
 * 정사각), 440pt 에서는 100×66(더 납작)이다. 사용자가 요구한 모든 기기에서 비슷한 경험은
 * 어디서나 72dp 가 아니라 ****어디서나 같은 비율**** 이므로, 세로를 상수로 고르는 대신 폭에 건다.
 *
 * ## 왜 이 파일이 `lib/` 에 있는가
 *
 * 이 값을 보는 자리가 **셋**이다 — 바 자신(`navigation/BottomBar`) · 콘텐츠가 남기는 몫
 * (`components/templates/ScreenScroll/bottom-inset`) · 그 파생인 안전영역 페이드.
 * 바 쪽에 두면 컴포넌트가 내비게이션을 import 하고(방향이 지금과 반대다 — 바가 아이콘을 가져다
 * 쓴다), 셸 쪽에 두면 바가 화면 셸의 내부를 알게 된다. 어느 쪽도 아닌 순수 계산이라 여기 둔다.
 *
 * ## 재지 않고 계산한다
 *
 * 예전에는 바 루트를 `onLayout` 으로 쟀다. 폭이 창 폭의 함수가 된 지금은 계산으로 나오고,
 * 계산이면 **첫 프레임부터 맞다**(측정은 첫 프레임에 0 이라 알약이 한 프레임 접혀 있었다).
 * 전제는 하나 — **바의 부모가 창 전체를 덮는다**(탭 내비게이터의 탭바 자리가 그렇다).
 */

/**
 * 바가 창 가장자리에서 남기는 **최소** 여백.
 *
 * 상한(`BAR_MAX_WIDTH`)에 걸리면 남는 폭이 좌우로 갈라져 이보다 커진다 — 그때 이 값은 여백 이
 * 아니라 여백의 하한 이다.
 */
export const BAR_SIDE_MARGIN = 14

/**
 * 바 폭의 상한 — 태블릿에서 캡슐이 계속 늘어나지 않게 한다(사용자 지시, 2026-08-15).
 *
 * 가장 큰 휴대폰(440pt)의 바가 412 이므로 그 위 첫 자리다. 폴더블 내부 화면(674pt)과 태블릿
 * (834pt~)이 여기 걸리고, **휴대폰은 하나도 안 걸린다** — 상한이 큰 화면 에만 작동한다는 뜻이다.
 */
export const BAR_MAX_WIDTH = 420

/**
 * 바 높이의 하한.
 *
 * 비례가 무너지는 자리가 아니라 **내용이 먼저 바닥나는** 자리다 — 320pt 의 비례값은 56 인데
 * 그 안에 들어갈 글리프 블록(아이콘 25 + 간격 4 + 라벨 ~14)이 43 이라 위아래 여백이 3.5 밖에
 * 안 남는다. 360dp 안드로이드가 정확히 이 값에 앉는다.
 */
export const BAR_MIN_HEIGHT = 64

/**
 * 안전영역 위로 바를 띄우는 높이 — **0**(사용자 지시, 2026-08-13). 바가 안전영역에 바로 붙는다.
 *
 * 없앤 12 는 **바 높이로 옮겼다**(60 → 72). 0 인데도 이름이 남아 있는 것은 콘텐츠가 남기는 몫이
 * 높이 + 이것 이라는 **관계**를 한 자리에 두기 위해서다 — 구성이 이미 한 번 바뀌었고, 그때
 * 합이 같아 인셋이 안 움직였다.
 */
export const BAR_LIFT = 0

/**
 * 비례 상수를 **역산한** 기준 — 고른 값이 아니라 이 앱이 이미 쓰고 있던 한 쌍이다
 * (402pt 기기에서 폭 374 · 높이 72). 그래서 그 기기에서는 정정 30 이 한 픽셀도 안 바꾼다.
 */
const REFERENCE_WINDOW_WIDTH = 402
const REFERENCE_HEIGHT = 72
const HEIGHT_PER_WIDTH = REFERENCE_HEIGHT / (REFERENCE_WINDOW_WIDTH - BAR_SIDE_MARGIN * 2)

export interface BottomBarMetrics {
  /** 바의 폭. */
  widthPx: number
  /** 바 좌우에 남는 여백 — 상한에 걸리면 `BAR_SIDE_MARGIN` 보다 커진다(가운데 정렬). */
  sideMarginPx: number
  /** 바의 높이. */
  heightPx: number
  /** 콘텐츠가 아래에 남겨야 하는 세로 몫 — `bottom-inset.ts` 와 안전영역 페이드가 본다. */
  spacePx: number
}

/**
 * `useWindowDimensions().width` 하나로 바의 치수를 전부 정한다.
 *
 * **폭의 상한이 높이의 상한을 겸한다** — 높이를 (이미 상한에 걸린) 폭에서 계산하기 때문이다.
 * 상한 값을 따로 적으면 폭은 멈췄는데 높이만 계속 자라는 조합이 만들어지고, 그것은 이 함수가
 * 지키려는 비율 자체를 깨는 상태다.
 */
export function resolveBottomBarMetrics(windowWidthPx: number): BottomBarMetrics {
  const widthPx = Math.min(windowWidthPx - BAR_SIDE_MARGIN * 2, BAR_MAX_WIDTH)
  const heightPx = Math.round(Math.max(BAR_MIN_HEIGHT, widthPx * HEIGHT_PER_WIDTH))

  return {
    widthPx,
    sideMarginPx: (windowWidthPx - widthPx) / 2,
    heightPx,
    spacePx: heightPx + BAR_LIFT,
  }
}
