/**
 * today 위젯의 **좌표 배치** — 검증과 해석 ([[ADR-147]] 결정 2 · 정정 1).
 *
 * ## 왜 흐름이 아니라 좌표인가
 *
 * 자동 패킹(순서 배열을 주면 알고리즘이 빈칸을 채운다)을 기각한 이유가 이 파일의 존재 이유다 —
 * **검증할 것이 없어지기 때문**이다. 알고리즘은 늘 «어딘가에» 넣으므로 배치 실수가 실수로 드러나지
 * 않는다. 좌표를 손으로 적는 대신 그 실수를 여기서 잡는다.
 *
 * 행(shelf) 단위 배치도 아니다 — 한 행의 높이가 하나면 `1x2`·`2x2` 같은 세로로 긴 타일이 원리적으로
 * 표현되지 않는다.
 *
 * **v1 에서 배치 배열은 코드 상수다.** 나중에 편집이 오면 배열만 저장소로 옮기고 이 검증 함수를
 * 그대로 재사용한다.
 */

import { tileHeightPx, tileWidthPx, type WidgetGridMetrics } from './widget-grid-metrics'

/**
 * 타일의 세로 크기 — 행 수, 또는 **내용이 정하는 높이**.
 *
 * `'auto'` 는 «높이를 미리 알 수 없다» 는 뜻이고, 그 값은 `resolveWidgetPositions` 에 실측으로
 * 들어온다. 선언한 `h` 는 그때 **최소 높이**로 남는다.
 */
export type WidgetHeight = number | 'auto'

export interface WidgetPlacement {
  id: string
  /** 0..3 */
  col: number
  row: number
  /** 1..4 */
  w: number
  h: WidgetHeight
}

/** 위젯이 감당한다고 선언한 크기 하나. */
export interface WidgetSize {
  w: number
  h: WidgetHeight
}

export interface LayoutViolation {
  id: string
  reason: string
}

/** `'auto'` 타일이 좌표계에서 차지하는 행 수 — 선언한 `h` 가 없으므로 최소인 1이다. */
const AUTO_NOMINAL_ROWS = 1

const GRID_COLUMNS = 4

function nominalRows(h: WidgetHeight): number {
  return h === 'auto' ? AUTO_NOMINAL_ROWS : h
}

function formatSize(w: number, h: WidgetHeight): string {
  return `${w}x${h}`
}

/**
 * 배치의 실수를 잡는다. **반환값이 빈 배열이면 유효한 배치다.**
 *
 * 검증 다섯 — ① 겹치는 타일 없음 ② `col + w ≤ 4` ③ 통째로 빈 행 없음 ④ `(w, h)` 가 그 위젯이
 * 선언한 크기 안 ⑤ `h === 'auto'` 이면 `w === 4`.
 *
 * ④ 가 «크기별로 다르게 그린다»([[ADR-147]] 결정 3)를 **약속으로 만드는** 자리다 — 선언 안 한
 * 크기를 받으면 위젯은 그리는 방법을 모른다.
 */
export function validateWidgetLayout(
  layout: readonly WidgetPlacement[],
  sizesById: Readonly<Record<string, readonly WidgetSize[]>>,
): LayoutViolation[] {
  const violations: LayoutViolation[] = []

  for (const placement of layout) {
    const { id, col, w, h } = placement

    if (col + w > GRID_COLUMNS) {
      violations.push({ id, reason: `가로가 격자를 넘는다 — col ${col} + w ${w} > ${GRID_COLUMNS}` })
    }

    // 가로를 다 쓰면 **옆에 아무도 없으므로** 늘어난 만큼 아래 전부가 같은 값으로 내려가 겹침이
    // 생길 수 없다. 좁은 타일에 auto 를 허용하면 옆 칸과 아래 칸이 서로 다른 만큼 밀려 좌표가
    // 무너진다 — 자동 패킹을 기각한 것과 같은 이유(«검증할 것이 없어진다»)가 여기서 되살아난다.
    if (h === 'auto' && w !== GRID_COLUMNS) {
      violations.push({ id, reason: `h: 'auto' 는 w === ${GRID_COLUMNS} 일 때만 쓸 수 있다 — w ${w}` })
    }

    const declared = sizesById[id] ?? []
    if (!declared.some((size) => size.w === w && size.h === h)) {
      violations.push({ id, reason: `위젯이 선언하지 않은 크기다 — ${formatSize(w, h)}` })
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
    const rows = nominalRows(placement.h)
    let collidedWith: string | null = null

    for (let row = placement.row; row < placement.row + rows; row += 1) {
      for (let col = placement.col; col < placement.col + placement.w; col += 1) {
        const cell = `${col},${row}`
        const owner = ownerByCell.get(cell)

        if (owner === undefined) ownerByCell.set(cell, placement.id)
        else collidedWith ??= owner
      }
    }

    if (collidedWith !== null) {
      violations.push({ id: placement.id, reason: `다른 타일과 겹친다 — ${collidedWith}` })
    }
  }

  return violations
}

/**
 * 통째로 빈 행을 찾는다.
 *
 * 위반은 **그 아래 첫 타일**의 것으로 적는다 — 빈 행 자체는 주인이 없고, 실수는 언제나 «그 아래
 * 타일의 `row` 를 밀어 놓고 위를 안 채운 것» 이기 때문이다.
 */
function findEmptyRows(layout: readonly WidgetPlacement[]): LayoutViolation[] {
  if (layout.length === 0) return []

  const occupied = new Set<number>()
  let lastRow = 0

  for (const placement of layout) {
    const rows = nominalRows(placement.h)
    for (let row = placement.row; row < placement.row + rows; row += 1) occupied.add(row)
    lastRow = Math.max(lastRow, placement.row + rows - 1)
  }

  const violations: LayoutViolation[] = []

  for (let row = 0; row <= lastRow; row += 1) {
    if (occupied.has(row)) continue

    // 빈 행 아래에는 반드시 타일이 있다(`lastRow` 까지만 훑으므로).
    const below = layout
      .filter((placement) => placement.row > row)
      .reduce<WidgetPlacement | null>(
        (nearest, placement) => (nearest === null || placement.row < nearest.row ? placement : nearest),
        null,
      )

    if (below !== null) violations.push({ id: below.id, reason: `위에 통째로 빈 행이 있다 — ${row} 행` })
  }

  return violations
}

export interface ResolvedTile {
  id: string
  leftPx: number
  topPx: number
  widthPx: number
  heightPx: number
}

/**
 * 좌표를 격자 컨테이너 안의 **절대 위치**로 푼다.
 *
 * `'auto'` 타일이 최소 높이보다 커지면 **그 아래(`row` 가 큰) 타일 전부**를 그 초과분만큼 내린다 —
 * `y = 적어 둔 y + Σ(위쪽 auto 타일들의 초과분)`. auto 는 `w === 4` 일 때만 허용되므로(검증 ⑤)
 * 그 행에 옆 타일이 있을 수 없고, 그래서 «아래 전부가 같은 값으로 내려간다» 가 성립한다.
 *
 * **`row` 를 재계산해 다시 채우지 않는다**(자동 패킹) — 배치가 적어 둔 순서·자리를 그대로 지키는
 * 것이 결정 2 의 요점이다.
 *
 * @param autoHeightsById `'auto'` 타일의 실측 높이(px). 없는 id 는 최소 높이로 친다.
 */
export function resolveWidgetPositions(
  layout: readonly WidgetPlacement[],
  metrics: WidgetGridMetrics,
  autoHeightsById: Readonly<Record<string, number>>,
): { tiles: ResolvedTile[]; containerHeightPx: number } {
  const overflows: { row: number; overflowPx: number }[] = []

  for (const placement of layout) {
    if (placement.h !== 'auto') continue

    const minHeightPx = tileHeightPx(AUTO_NOMINAL_ROWS, metrics)
    const measuredPx = autoHeightsById[placement.id] ?? minHeightPx
    const overflowPx = Math.max(0, measuredPx - minHeightPx)

    if (overflowPx > 0) overflows.push({ row: placement.row, overflowPx })
  }

  const tiles = layout.map((placement) => {
    const rows = nominalRows(placement.h)
    const nominalHeightPx = tileHeightPx(rows, metrics)
    // 선언한 `h` 는 **최소 높이**다 — 실측이 그보다 작아도 줄이지 않는다.
    const heightPx =
      placement.h === 'auto'
        ? Math.max(nominalHeightPx, autoHeightsById[placement.id] ?? nominalHeightPx)
        : nominalHeightPx

    const shiftPx = overflows
      .filter((entry) => entry.row < placement.row)
      .reduce((sum, entry) => sum + entry.overflowPx, 0)

    return {
      id: placement.id,
      leftPx: placement.col * (metrics.colWidthPx + metrics.gapPx),
      topPx: placement.row * (metrics.rowHeightPx + metrics.gapPx) + shiftPx,
      widthPx: tileWidthPx(placement.w, metrics),
      heightPx,
    }
  })

  return {
    tiles,
    containerHeightPx: tiles.reduce((bottom, tile) => Math.max(bottom, tile.topPx + tile.heightPx), 0),
  }
}
