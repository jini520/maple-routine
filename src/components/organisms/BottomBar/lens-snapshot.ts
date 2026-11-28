/**
 * 렌즈가 휘는 그림(항목 줄 · 렌즈 뒤 그림)을 언제 만들고 언제 쓰는지의 판정. 만드는 일 자체는 `lens-images.tsx` 가 한다.
 *
 * 그림은 미리 만들어 두고 누를 때 쓴다. 누르는 순간 만들면 그 프레임이 멈추기 때문이다.
 */

/** 항목 줄 그림이 비었을 때 다시 뜨기까지의 간격. */
export const ROW_RETRY_MS = 500
/** 항목 줄 그림을 다시 뜨는 최대 횟수. 이것으로도 안 되면 렌즈 없이 앱 뷰를 둔다. */
export const ROW_RETRY_LIMIT = 5
/** 위 화면에서 돌아온 뒤(또는 백그라운드에서 돌아온 뒤) 항목 줄을 다시 뜨기까지. */
export const ROW_REFRESH_AFTER_FOCUS_MS = 400

/** 뜬 그림과 뜬 순간의 테마. */
export interface Snapshot<T> {
  key: string
  value: T
}

/**
 * 지금 테마에서 쓸 수 있는 그림. 뜬 테마가 다르면 쓰지 않는다. 옛 테마 색이 렌즈에 비치기 때문이다.
 *
 * @param key 지금 테마(와 그림 모양을 정하는 값)를 이은 글자
 */
export function usableSnapshot<T>(shot: Snapshot<T> | null, key: string): T | null {
  return shot !== null && shot.key === key ? shot.value : null
}

/**
 * 항목 줄을 다시 뜰 때까지 기다릴 시간. 다시 뜨지 않으면 null.
 *
 * @param attempt 방금 뜬 것이 몇 번째 다시 뜨기인가(처음은 0)
 * @param complete 모든 줄에 아이콘이 찍혔는가
 */
export function rowRetryDelay(attempt: number, complete: boolean): number | null {
  if (complete || attempt >= ROW_RETRY_LIMIT) return null
  return ROW_RETRY_MS
}

/**
 * 찍은 픽셀(RGBA 순)에 불투명한 점이 하나라도 있는가. 첫 칸 가운데 둘레를 읽어 아이콘이 찍혔는지 본다.
 * 빈 그림을 쓰면 누르는 동안 아이콘과 라벨이 통째로 사라진다.
 */
export function hasInk(rgba: ArrayLike<number>): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 0) return true
  return false
}

/** 창 좌표의 사각형. */
export interface StripRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 렌즈 뒤 그림으로 그릴 바 자리 띠. 칸이 늘어선 방향은 창 끝에서 끝까지, 가로지르는 방향은 렌즈 캔버스와 같은 줄이다.
 *
 * 칸 방향을 창 전체로 두는 것은 바가 칸 수에 따라 자리와 폭을 바꾸고, 렌즈가 바 양 끝 밖으로 부풀기 때문이다.
 */
export function lensBackdropStrip(options: {
  vertical: boolean
  windowWidthPx: number
  windowHeightPx: number
  /** 렌즈 캔버스가 가로지르는 방향에서 시작하는 창 좌표(가로 바는 y, 세로 막대는 x). */
  crossStartPx: number
  /** 렌즈 캔버스의 두께. */
  crossLengthPx: number
}): StripRect {
  const { vertical, windowWidthPx, windowHeightPx, crossStartPx, crossLengthPx } = options
  return vertical
    ? { x: crossStartPx, y: 0, width: crossLengthPx, height: windowHeightPx }
    : { x: 0, y: crossStartPx, width: windowWidthPx, height: crossLengthPx }
}

/**
 * 렌즈 뒤 그림의 열쇠. 이것이 바뀔 때만 다시 그린다. 페이지 · 스크롤은 넣지 않는다. 그림은 그 위 콘텐츠를 담지 않기 때문이다.
 *
 * @param themeKey 바탕색 · 배경 그림 · 바 색을 이은 글자
 */
export function backdropKey(options: { themeKey: string; strip: StripRect }): string {
  const { themeKey, strip } = options
  return [themeKey, strip.x, strip.y, strip.width, strip.height].join('|')
}
