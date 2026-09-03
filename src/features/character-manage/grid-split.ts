/**
 * 캐릭터 관리의 두 층이 격자 하나를 나눠 쓰는 규칙.
 *
 * 격자는 자리만 알려 주므로 **어느 칸이 어느 층인가**는 여기서 정한다.
 */

/** 두 층을 가르는 고정 항목의 키. 실제 ocid 와 겹칠 수 없는 모양이어야 한다. */
export const SEPARATOR_KEY = '__layer-separator__'

/**
 * 격자가 준 순서에서 선택된 ocid 만 낸다.
 *
 * 순서 변경 · 후보에서 선택으로 · 선택에서 후보로 셋이 전부 이 계산 하나를 지난다. 격자에게는
 * 그 셋이 같은 재배열이기 때문이다.
 *
 * @returns 구분자가 없으면 `null`. 그때는 **아무것도 바꾸지 않는다**. 전부를 선택으로 읽으면
 *   후보 전원이 한 번에 추적 목록에 들어간다.
 */
export function selectedFromOrder(order: readonly string[]): string[] | null {
  const at = order.indexOf(SEPARATOR_KEY)
  if (at === -1) return null
  return [...order.slice(0, at)]
}
