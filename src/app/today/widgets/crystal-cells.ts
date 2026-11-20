/**
 * 넓힌 결정석 위젯의 칸. 메이플 ID 마다 칸 하나이고, 그 메이플 ID 의 한도 줄 수가 칸의 폭을 정한다.
 *
 * 한도 줄이 하나면 반 폭이고, 둘 이상이면 링을 옆으로 나란히 두는 넓은 칸이다.
 */
import type { CrystalMapleIdView } from '../view-model'

export type CrystalCellKind = 'half' | 'wide'

export interface CrystalCell {
  group: CrystalMapleIdView
  kind: CrystalCellKind
}

/** 한 줄. 넓은 칸 하나이거나 반 폭 칸 한두 개다. 짝 없이 남은 반 폭 칸은 반 폭 그대로 혼자 선다. */
export interface CrystalCellRow {
  wide: boolean
  cells: CrystalCell[]
}

function kindOf(group: CrystalMapleIdView): CrystalCellKind {
  return group.lines.length >= 2 ? 'wide' : 'half'
}

/**
 * 칸을 줄로 나눈다. 차례는 받은 차례(넥슨 계정 차례)이고, 넓은 칸이 있으면 넓은 칸을 앞으로 모은다.
 * 넓은 칸 앞뒤로 반 폭 칸이 갈려 혼자 서지 않는다(사용자 지정).
 */
export function crystalCellRows(groups: readonly CrystalMapleIdView[]): CrystalCellRow[] {
  const cells = groups.map((group) => ({ group, kind: kindOf(group) }))
  const ordered = [...cells.filter((cell) => cell.kind === 'wide'), ...cells.filter((cell) => cell.kind === 'half')]

  const rows: CrystalCellRow[] = []
  for (const cell of ordered) {
    const last = rows.at(-1)
    if (cell.kind === 'wide') rows.push({ wide: true, cells: [cell] })
    else if (last !== undefined && !last.wide && last.cells.length === 1) last.cells.push(cell)
    else rows.push({ wide: false, cells: [cell] })
  }
  return rows
}
