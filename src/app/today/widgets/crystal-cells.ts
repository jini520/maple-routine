/**
 * 넓힌 결정석 위젯의 칸. 메이플 ID 마다 칸 하나이고, 그 메이플 ID 의 월드 수가 칸의 모양과 폭을 정한다.
 *
 * 월드 1 은 링 칸, 2 는 막대 칸이고 둘 다 반 폭이다. 3 이상은 한 줄을 다 쓰는 막대 칸이다.
 */
import type { CrystalMapleIdView } from '../view-model'

export type CrystalCellKind = 'ring' | 'bars' | 'wide'

export interface CrystalCell {
  group: CrystalMapleIdView
  kind: CrystalCellKind
}

/** 한 줄. 넓은 칸 하나이거나 반 폭 칸 한두 개다. 짝 없이 남은 반 폭 칸은 반 폭 그대로 혼자 선다. */
export interface CrystalCellRow {
  wide: boolean
  cells: CrystalCell[]
}

/** 월드가 이 수 이상이면 칸이 한 줄을 다 쓴다. */
const WIDE_WORLD_COUNT = 3

function kindOf(group: CrystalMapleIdView): CrystalCellKind {
  if (group.worlds.length >= WIDE_WORLD_COUNT) return 'wide'
  return group.worlds.length === 1 ? 'ring' : 'bars'
}

/**
 * 칸을 줄로 나눈다. 차례는 받은 차례(넥슨 계정 차례)이고, 월드가 3개 이상인 메이플 ID 가 있으면 월드가 많은 차례로 다시 놓는다.
 * 넓은 칸이 앞으로 모여서, 넓은 칸 앞뒤로 반 폭 칸이 갈려 혼자 서지 않는다(사용자 지정).
 */
export function crystalCellRows(groups: readonly CrystalMapleIdView[]): CrystalCellRow[] {
  const hasWide = groups.some((group) => group.worlds.length >= WIDE_WORLD_COUNT)
  // `sort` 는 안정 정렬이라 월드 수가 같으면 기본 차례가 남는다.
  const ordered = hasWide ? [...groups].sort((left, right) => right.worlds.length - left.worlds.length) : groups

  const rows: CrystalCellRow[] = []
  for (const group of ordered) {
    const cell = { group, kind: kindOf(group) }
    const last = rows.at(-1)
    if (cell.kind === 'wide') rows.push({ wide: true, cells: [cell] })
    else if (last !== undefined && !last.wide && last.cells.length === 1) last.cells.push(cell)
    else rows.push({ wide: false, cells: [cell] })
  }
  return rows
}
