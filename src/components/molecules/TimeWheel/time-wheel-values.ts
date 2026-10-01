/** 시 휠에 서는 값 */
export const HOUR_VALUES: readonly number[] = Array.from({ length: 24 }, (_, hour) => hour)

/** 분 휠에 서는 값. `step` 은 60 을 나누는 분 단위 */
export function minuteValues(step: number): number[] {
  return Array.from({ length: 60 / step }, (_, index) => index * step)
}

/**
 * 단위에 안 맞는 분을 가장 가까운 칸으로. 60 으로 올라가 시가 바뀌는 일은 없게 그 시의 마지막 칸에서 멈춘다.
 *
 * @example snapMinute(23, 5) // 25
 */
export function snapMinute(minute: number, step: number): number {
  const values = minuteValues(step)
  return values.reduce((best, value) => (Math.abs(value - minute) < Math.abs(best - minute) ? value : best))
}
