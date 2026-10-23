/**
 * today 위젯의 **좌표 배치**. 검증과 줄 묶기.
 *
 * ## 왜 흐름이 아니라 좌표인가
 *
 * 자동 패킹(순서 배열을 주면 알고리즘이 빈칸을 채운다)을 기각한 이유가 이 파일의 존재 이유다.
 * **검증할 것이 없어지기 때문**이다. 알고리즘은 늘 어딘가에 넣으므로 배치 실수가 실수로 드러나지
 * 않는다. 좌표를 손으로 적는 대신 그 실수를 여기서 잡는다.
 *
 * 높이는 적지 않는다. 위젯 높이는 내용이 정하고, 같은 줄의 위젯끼리는 격자가 가장 높은 것에 맞춘다.
 * 그래서 `row` 는 몇 번째 줄인가 만 뜻한다.
 *
 * **배치 배열은 코드 상수다.** 나중에 편집이 오면 배열만 저장소로 옮기고 이 검증 함수를
 * 그대로 재사용한다.
 */

export interface WidgetPlacement {
  id: string
  /** 0..3 */
  col: number
  /** 몇 번째 줄인가. 0 부터 빈 줄 없이 이어진다 */
  row: number
  /** 1..4 */
  w: number
}

export interface LayoutViolation {
  id: string
  reason: string
}

const GRID_COLUMNS = 4

/**
 * 배치의 실수를 잡는 검사. **반환값이 빈 배열이면 유효한 배치다.**
 *
 * 검증 넷. ① 같은 줄에서 겹치는 타일 없음 ② `col + w ≤ 4` ③ 통째로 빈 줄 없음 ④ `w` 가 그 위젯이
 * 선언한 폭.
 *
 * @param widthById 위젯이 그리는 폭. 레지스트리에서 만든다
 */
export function validateWidgetLayout(
  layout: readonly WidgetPlacement[],
  widthById: Readonly<Record<string, number>>,
): LayoutViolation[] {
  const violations: LayoutViolation[] = []

  for (const placement of layout) {
    const { id, col, w } = placement

    if (col + w > GRID_COLUMNS) {
      violations.push({ id, reason: `가로가 격자를 넘는다. col ${col} + w ${w} > ${GRID_COLUMNS}` })
    }

    if (widthById[id] !== w) {
      violations.push({ id, reason: `위젯이 선언하지 않은 폭이다. w ${w}` })
    }
  }

  violations.push(...findOverlaps(layout))
  violations.push(...findEmptyRows(layout))

  return violations
}

/** 이미 놓인 타일과 칸이 겹치면 **나중 타일**의 위반으로 적는다(먼저 적은 좌표를 기준으로 읽힌다). */
function findOverlaps(layout: readonly WidgetPlacement[]): LayoutViolation[] {
  const violations: LayoutViolation[] = []
  const ownerByCell = new Map<string, string>()

  for (const placement of layout) {
    let collidedWith: string | null = null

    for (let col = placement.col; col < placement.col + placement.w; col += 1) {
      const cell = `${col},${placement.row}`
      const owner = ownerByCell.get(cell)

      if (owner === undefined) ownerByCell.set(cell, placement.id)
      else collidedWith ??= owner
    }

    if (collidedWith !== null) {
      violations.push({ id: placement.id, reason: `다른 타일과 겹친다. ${collidedWith}` })
    }
  }

  return violations
}

/**
 * 통째로 빈 줄.
 *
 * 위반은 **그 아래 첫 타일**의 것으로 적는다. 빈 줄 자체는 주인이 없고, 실수는 언제나 그 아래
 * 타일의 `row` 를 밀어 놓고 위를 안 채운 것 이기 때문이다.
 */
function findEmptyRows(layout: readonly WidgetPlacement[]): LayoutViolation[] {
  if (layout.length === 0) return []

  const occupied = new Set(layout.map((placement) => placement.row))
  const lastRow = Math.max(...occupied)
  const violations: LayoutViolation[] = []

  for (let row = 0; row <= lastRow; row += 1) {
    if (occupied.has(row)) continue

    // 빈 줄 아래에는 반드시 타일이 있다(`lastRow` 까지만 훑으므로).
    const below = layout
      .filter((placement) => placement.row > row)
      .reduce<WidgetPlacement | null>(
        (nearest, placement) => (nearest === null || placement.row < nearest.row ? placement : nearest),
        null,
      )

    if (below !== null) violations.push({ id: below.id, reason: `위에 통째로 빈 줄이 있다. ${row} 줄` })
  }

  return violations
}

/** 줄 단위 묶음. 줄은 `row` 순서, 줄 안은 `col` 순서다. 격자가 줄마다 높이를 맞추려고 쓴다. */
export function groupWidgetRows<T extends WidgetPlacement>(layout: readonly T[]): T[][] {
  const rows = new Map<number, T[]>()
  for (const placement of layout) {
    const row = rows.get(placement.row)
    if (row === undefined) rows.set(placement.row, [placement])
    else row.push(placement)
  }
  return [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, row]) => [...row].sort((left, right) => left.col - right.col))
}

/**
 * 숨긴 타일을 빼고 그 아래 줄을 당긴 배치. 보여 줄 것이 없는 위젯이 타일째 숨을 때 쓴다.
 *
 * 가로 전체 타일만 받는다. 옆 칸이 있는 타일을 빼면 그 자리가 빈 칸으로 남는다.
 *
 * @param hiddenIds 숨길 위젯 id
 */
export function omitHiddenTiles<T extends WidgetPlacement>(layout: readonly T[], hiddenIds: ReadonlySet<string>): T[] {
  const hidden = layout.filter((placement) => hiddenIds.has(placement.id))
  for (const placement of hidden) {
    if (placement.w !== GRID_COLUMNS) {
      throw new Error(`가로 전체가 아닌 타일은 숨길 수 없다: ${placement.id} (w ${placement.w})`)
    }
  }
  return layout
    .filter((placement) => !hiddenIds.has(placement.id))
    .map((placement) => {
      const lift = hidden.filter((gone) => gone.row < placement.row).length
      return lift === 0 ? placement : { ...placement, row: placement.row - lift }
    })
}
