/**
 * 항목 격자의 묶음을 **줄로 묶는다**.
 *
 * 한 묶음이 한 줄을 통째로 쓰면, 타일이 하나뿐인 묶음도 이름 줄과 타일 줄로 **두 줄**을 먹는다.
 * 이벤트·BM 은 그런 묶음이 둘(`VIP 사우나` · `기타`)이라 목록이 82% 상한에 닿았다.
 *
 * 그래서 잇달아 오는 **타일 하나짜리 묶음 둘**을 한 줄에 세운다. 이름이 아니라 **타일 개수**로
 * 판정하므로 묶음 이름이 바뀌어도 규칙이 그대로 성립한다.
 *
 * 셋이 잇달으면 **둘 + 하나**다. 한 줄에 셋을 세우면 타일이 1/3 폭으로 돌아가 다른 줄과 크기가
 * 갈린다.
 */
export function rowsOfGroups<T extends { choices: readonly unknown[] }>(
  groups: readonly T[],
): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < groups.length; i += 1) {
    const here = groups[i]!
    const next = groups[i + 1]
    if (here.choices.length === 1 && next !== undefined && next.choices.length === 1) {
      rows.push([here, next])
      i += 1
      continue
    }
    rows.push([here])
  }
  return rows
}
