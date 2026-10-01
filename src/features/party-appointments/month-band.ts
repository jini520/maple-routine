/**
 * 보드 날짜 머리 위 달 띠의 달 이름 자리. 이름은 그 달이 보이는 동안 화면 왼쪽 끝에 붙고 다음 달에 밀려 나간다.
 */

export interface MonthSegment {
  month: number
  /** 그 달의 첫 칸 · 마지막 칸 차례 */
  first: number
  last: number
}

/** 칸 날짜(`YYYY-MM-DD`)를 이어진 같은 달끼리 묶은 조각 */
export function monthSegments(dateKeys: readonly string[]): MonthSegment[] {
  const segments: MonthSegment[] = []
  dateKeys.forEach((dateKey, index) => {
    const month = Number(dateKey.slice(5, 7))
    const current = segments[segments.length - 1]
    if (current !== undefined && current.month === month) current.last = index
    else segments.push({ month, first: index, last: index })
  })
  return segments
}

/**
 * 달 이름의 화면 x. 조각이 `[start, end)` 를 차지하는 띠가 `offset` 만큼 넘어가 있을 때다.
 *
 * @param labelWidth 이름 폭. 조각 끝에서 이만큼 앞이 이름이 머물 수 있는 가장 오른쪽이다
 */
export function stickyLabelLeft(offset: number, start: number, end: number, labelWidth: number): number {
  'worklet'
  return Math.min(Math.max(offset, start), end - labelWidth) - offset
}
