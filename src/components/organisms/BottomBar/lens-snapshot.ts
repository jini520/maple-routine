/**
 * 렌즈가 휘는 그림(항목 줄 · 뒤 화면)을 언제 뜨고 언제 쓰는지의 판정. 뜨는 일 자체는 `BarLens.tsx` 가 한다.
 *
 * 그림은 미리 떠 두고 누를 때 쓴다. 누르는 순간 뜨면 그 프레임이 100ms 가까이 멈추기 때문이다.
 */

/** 항목 줄 그림이 비었을 때 다시 뜨기까지의 간격. */
export const ROW_RETRY_MS = 500
/** 항목 줄 그림을 다시 뜨는 최대 횟수. 이것으로도 안 되면 렌즈 없이 앱 뷰를 둔다. */
export const ROW_RETRY_LIMIT = 5
/** 페이지나 행이 바뀐 뒤 뒤 화면을 뜨기까지. 화면 전환 슬라이드가 끝난 자리를 뜬다. */
export const PAGE_CAPTURE_AFTER_CHANGE_MS = 700
/** 위 화면에서 돌아온 뒤(또는 백그라운드에서 돌아온 뒤) 다시 뜨기까지. */
export const PAGE_CAPTURE_AFTER_FOCUS_MS = 400

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

/**
 * 뒤 화면을 지금 떠도 되는가. 위 화면에 가려진 동안 뜨면 앱이 죽고, 뜨는 중에 또 뜨면 같은 일을 두 번 한다.
 */
export function canCapturePage(state: { covered: boolean; busy: boolean }): boolean {
  return !state.covered && !state.busy
}
