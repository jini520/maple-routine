/** 레벨 격자(`LevelRangeGrid`)의 계산. 탭이 고른 쪽(강화 전 · 강화 후)에 칸을 누른 값을 넣는다. */

export interface LevelRange {
  from: number
  to: number
}

/** 지금 고르는 쪽. 격자 위 탭 둘이다. */
export type RangeEnd = 'from' | 'to'

/**
 * 그 칸을 지금 고를 수 있나. 강화 전은 만렙을 못 고르고(올릴 단계가 없다), 강화 후는 강화 전보다 높아야 한다.
 * 못 고르는 칸은 흐리게 막는다. 강화 후를 고르는 중에 시작이 바뀌면 어느 쪽이 바뀌는지 헷갈리기 때문이다.
 */
export function canPick(range: LevelRange, editing: RangeEnd, level: number, max: number): boolean {
  return editing === 'from' ? level < max : level > range.from
}

/**
 * 칸을 누른 뒤의 범위와 다음에 고를 쪽. 강화 전을 고르면 강화 후 탭으로 넘어간다. 강화 후가 새 강화 전 이하가 되면
 * 그 한 칸 위로 민다.
 */
export function pickLevel(range: LevelRange, editing: RangeEnd, level: number): { range: LevelRange; editing: RangeEnd } {
  if (editing === 'from') return { range: { from: level, to: Math.max(range.to, level + 1) }, editing: 'to' }
  return { range: { from: range.from, to: level }, editing: 'to' }
}

/** 한 줄의 칸 수. 칸이 스물을 넘으면(헥사 0 ~ 30) 여덟, 아니면(심볼) 열이다. 칸 폭이 숫자 두 자리를 담게 한다. */
export function gridColumns(min: number, max: number): number {
  return max - min + 1 > 20 ? 8 : 10
}
