// 테마 배경 벽지의 기하. CSS `background-size: cover` + `background-position` 을 RN 배치로 옮긴다
//
//
// ## 왜 순수 함수로 떼어내나
//
// **백드롭(전면)과 헤더 조각이 같은 값을 써야 이음매가 안 생긴다**. 웹은
// 둘 다 `100vw × 100dvh` 상자에 같은 `background-*` 를 걸어 그 정합을 CSS 가 보장했다. RN 에는
// 배경 속성이 없어 우리가 좌표를 계산하므로, **계산이 한 곳이어야** 두 자리가 갈라지지 않는다.
//
// 값을 두 벌로 두면 한쪽만 고쳐도 아무 데서도 안 드러난다. 이 저장소가 테마 토큰·라우트 표에서
// 반복해 거부해 온 형태다.
//
// ## `cover` 의 뜻
//
// 상자를 **덮는 최소 배율**이다: `max(상자폭/그림폭, 상자높이/그림높이)`. 그래서 한 축은 딱 맞고
// 다른 축은 넘치며, 넘치는 만큼을 `background-position` 이 어디로 밀지 정한다.

/** `background-position` 의 한 축. 퍼센트 또는 키워드. */
const KEYWORDS: Record<string, number> = {
  left: 0,
  top: 0,
  center: 0.5,
  right: 1,
  bottom: 1,
}

export interface BackdropBitmapSize {
  width: number
  height: number
}

export interface BackdropPlacement {
  left: number
  top: number
  width: number
  height: number
}

/**
 * `"45% bottom"` · `"center"` · `"25% 80%"` 을 0~1 두 축으로 읽는다.
 *
 * 한 값만 오면 CSS 와 같이 **가로에 쓰고 세로는 center** 다. 못 읽는 값은 `0.5`(center)로.
 * 그림이 안 보이는 것보다 가운데라도 보이는 편이 낫고, 웹의 기본값도 `0% 0%` 가 아니라 `center` 다.
 */
export function parseBackgroundPosition(position: string): { x: number; y: number } {
  const axis = (token: string | undefined, fallback: number): number => {
    if (token === undefined) return fallback
    if (token in KEYWORDS) return KEYWORDS[token]
    const percent = /^(-?\d+(?:\.\d+)?)%$/.exec(token)
    return percent === null ? fallback : Number(percent[1]) / 100
  }

  const tokens = position.trim().toLowerCase().split(/\s+/)
  return { x: axis(tokens[0], 0.5), y: axis(tokens[1], 0.5) }
}

/**
 * 뷰포트를 덮도록 그림을 배치한다.
 *
 * 크기를 모르면 `null`. 그때는 그리지 않는다. 크기 없이 그리면 배율이 정해지지 않아 그림이
 * 상자에 늘어붙고, 그건 벽지가 아니라 왜곡이다(같은 판단이 `frame-layout.ts` 에도 있다).
 */
export function resolveThemeBackdropLayout(
  viewport: { width: number; height: number },
  bitmap: BackdropBitmapSize | null,
  position: string,
): BackdropPlacement | null {
  if (bitmap === null) return null
  if (!Number.isFinite(bitmap.width) || bitmap.width <= 0) return null
  if (!Number.isFinite(bitmap.height) || bitmap.height <= 0) return null
  if (viewport.width <= 0 || viewport.height <= 0) return null

  const scale = Math.max(viewport.width / bitmap.width, viewport.height / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  const { x, y } = parseBackgroundPosition(position)

  return {
    // 넘치는 만큼(음수)을 position 비율로 나눈다. CSS 와 같은 식이다.
    left: (viewport.width - width) * x,
    top: (viewport.height - height) * y,
    width,
    height,
  }
}
