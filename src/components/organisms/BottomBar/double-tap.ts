/**
 * 하단바 항목을 두 번 두드렸는가.
 *
 * 시간을 재는 코드를 컴포넌트에 두면 그것을 물으려면 렌더와 가짜 타이머가 함께 필요해진다.
 * 여기 있는 것은 판정뿐이고, 기록을 들고 지우는 일은 바가 한다.
 */

/** 마지막 누름. 항목이 다르면 짝이 될 수 없으므로 이름이 함께 붙는다. */
export interface TapRecord {
  readonly key: string
  readonly at: number
}

/**
 * 두 누름을 한 쌍으로 묶는 창. 두 플랫폼의 시스템 더블탭 창과 같은 값이다.
 *
 * 늘리면 한참 뒤의 별개 누름 둘이 한 쌍이 되어, 탭을 확인하려 두 번 누른 사용자가 영문 모르고
 * 맨 위로 튕긴다.
 */
export const DOUBLE_TAP_MS = 300

/**
 * 앞선 누름과 이어진 둘째 누름인가. 항목이 다르거나 창을 넘으면 새 첫 누름이다.
 *
 * @param previous 마지막 누름. 없으면 `null`
 * @param key 지금 누른 항목
 * @param at 지금 시각(ms)
 */
export function isSecondTap(previous: TapRecord | null, key: string, at: number): boolean {
  return previous !== null && previous.key === key && at - previous.at <= DOUBLE_TAP_MS
}
