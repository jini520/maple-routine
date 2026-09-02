// 좌표 배치의 **검증과 해석**. 배치를 손으로 적기로 한 이상 그
// 실수는 반드시 나므로, 자동 패킹 대신 **검증** 을 산 값이 여기서 회수된다.

import { GRID_GAP, GRID_ROW_HEIGHT, resolveWidgetGridMetrics } from '../today/widget-grid-metrics'
import { resolveWidgetPositions, validateWidgetLayout, type WidgetPlacement } from '../today/widget-layout'

const sizes = {
  대표: [{ w: 4, h: 1 }],
  초기화: [{ w: 2, h: 1 }],
  결정석: [{ w: 2, h: 1 }],
  스케줄: [{ w: 4, h: 'auto' as const }],
  수익: [{ w: 4, h: 3 }],
} as const

/** 의 기본 배치 앞부분 — 실제로 쓸 좌표를 그대로 쓴다. */
const 유효한_배치: WidgetPlacement[] = [
  { id: '대표', col: 0, row: 0, w: 4, h: 1 },
  { id: '초기화', col: 0, row: 1, w: 2, h: 1 },
  { id: '결정석', col: 2, row: 1, w: 2, h: 1 },
  { id: '스케줄', col: 0, row: 2, w: 4, h: 'auto' },
  { id: '수익', col: 0, row: 3, w: 4, h: 3 },
]

describe('validateWidgetLayout — 손으로 적은 좌표를 지킨다', () => {
  it('유효한 배치는 빈 배열이다', () => {
    expect(validateWidgetLayout(유효한_배치, sizes)).toEqual([])
  })

  it('빈 배치도 유효하다', () => {
    expect(validateWidgetLayout([], sizes)).toEqual([])
  })

  it('겹치는 타일을 잡는다', () => {
    const violations = validateWidgetLayout(
      [
        { id: '초기화', col: 0, row: 0, w: 2, h: 1 },
        // 결정석이 한 칸 왼쪽으로 밀려 초기화와 겹친다.
        { id: '결정석', col: 1, row: 0, w: 2, h: 1 },
      ],
      sizes,
    )

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('결정석')
    expect(violations[0].reason).toContain('겹')
  })

  it('세로로 겹치는 것도 잡는다 — 높이가 2 이상인 타일', () => {
    const violations = validateWidgetLayout(
      [
        { id: '수익', col: 0, row: 0, w: 4, h: 3 },
        // 수익이 0~2 행을 먹는데 대표가 1 행에 앉았다.
        { id: '대표', col: 0, row: 1, w: 4, h: 1 },
      ],
      { ...sizes, 대표: [{ w: 4, h: 1 }] },
    )

    expect(violations.map((violation) => violation.id)).toEqual(['대표'])
  })

  it('가로가 격자를 넘으면 잡는다 — col + w > 4', () => {
    const violations = validateWidgetLayout(
      [{ id: '결정석', col: 3, row: 0, w: 2, h: 1 }],
      { 결정석: [{ w: 2, h: 1 }] },
    )

    expect(violations.map((violation) => violation.id)).toEqual(['결정석'])
    expect(violations[0].reason).toContain('4')
  })

  // 중간에 빈 행이 나오면 `row` 를 잘못 적은 것이다. 위젯을 하나 끼우고 아래를 미는 과정에서
  // 가장 흔한 실수이고, 화면에는 **빈 사각형** 으로만 나타나 눈으로는 원인을 모른다.
  it('통째로 빈 행을 잡는다', () => {
    const violations = validateWidgetLayout(
      [
        { id: '대표', col: 0, row: 0, w: 4, h: 1 },
        // 1 행이 통째로 빈다.
        { id: '초기화', col: 0, row: 2, w: 2, h: 1 },
      ],
      sizes,
    )

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('초기화')
    expect(violations[0].reason).toContain('빈 행')
  })

  it('첫 행이 비어도 잡는다', () => {
    const violations = validateWidgetLayout([{ id: '대표', col: 0, row: 1, w: 4, h: 1 }], sizes)

    expect(violations.map((violation) => violation.id)).toEqual(['대표'])
  })

  // 이것이 **크기별로 다르게 그린다** 를 **약속으로 만드는** 자리다. 선언 안 한 크기를 받으면
  // 위젯은 그리는 방법을 모른다.
  it('위젯이 선언하지 않은 크기를 잡는다', () => {
    const violations = validateWidgetLayout([{ id: '대표', col: 0, row: 0, w: 4, h: 2 }], sizes)

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('대표')
    expect(violations[0].reason).toContain('선언')
  })

  it('레지스트리에 없는 id 도 같은 규칙으로 잡는다', () => {
    const violations = validateWidgetLayout([{ id: '없는위젯', col: 0, row: 0, w: 4, h: 1 }], sizes)

    expect(violations.map((violation) => violation.id)).toEqual(['없는위젯'])
  })

  it("'auto' 크기 선언도 그대로 대조한다", () => {
    expect(validateWidgetLayout([{ id: '스케줄', col: 0, row: 0, w: 4, h: 'auto' }], sizes)).toEqual([])
    // 같은 위젯이라도 고정 높이는 선언 밖이다.
    expect(validateWidgetLayout([{ id: '스케줄', col: 0, row: 0, w: 4, h: 1 }], sizes)).toHaveLength(1)
  })

  // 가로를 다 쓰면 옆에 아무도 없으므로 늘어난 만큼 아래 전부가 **같은 값으로** 내려간다.
  // 좁은 타일에 auto 를 허용하면 옆 칸과 아래 칸이 서로 다른 만큼 밀려 좌표가 무너진다.
  it("w < 4 인 타일은 h: 'auto' 를 쓸 수 없다", () => {
    const violations = validateWidgetLayout([{ id: '반쪽', col: 0, row: 0, w: 2, h: 'auto' }], {
      반쪽: [{ w: 2, h: 'auto' }],
    })

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('반쪽')
    expect(violations[0].reason).toContain('auto')
  })
})

describe('resolveWidgetPositions — 좌표를 절대 위치로', () => {
  const metrics = resolveWidgetGridMetrics(360)

  it('빈 배치는 높이 0 이다', () => {
    expect(resolveWidgetPositions([], metrics, {})).toEqual({ tiles: [], containerHeightPx: 0 })
  })

  it('칸과 간격으로 좌표를 만든다', () => {
    const { tiles } = resolveWidgetPositions(유효한_배치, metrics, {})
    const byId = Object.fromEntries(tiles.map((tile) => [tile.id, tile] as const))

    // 왼쪽 = col × (열 폭 + 간격)
    expect(byId['초기화'].leftPx).toBe(0)
    expect(byId['결정석'].leftPx).toBe(2 * (73 + 12))
    expect(byId['결정석'].widthPx).toBe(73 * 2 + 12)

    // 위 = row × (행 높이 + 간격)
    expect(byId['대표'].topPx).toBe(0)
    // 세로는 **행 높이의 함수**다. 숫자를 손으로 적으면 행 높이를 조정할 때마다 여기가 깨진다
    // (으로 76 → 82 가 됐다).
    expect(byId['초기화'].topPx).toBe(GRID_ROW_HEIGHT + GRID_GAP)
    expect(byId['수익'].topPx).toBe(3 * (GRID_ROW_HEIGHT + GRID_GAP))
    expect(byId['수익'].heightPx).toBe(GRID_ROW_HEIGHT * 3 + GRID_GAP * 2)
  })

  it('입력 순서를 지킨다', () => {
    const { tiles } = resolveWidgetPositions(유효한_배치, metrics, {})

    expect(tiles.map((tile) => tile.id)).toEqual(유효한_배치.map((placement) => placement.id))
  })

  // auto 타일의 `h` 는 **최소 높이**다. 실측이 그와 같으면 배치가 적어 둔 좌표 그대로여야 한다.
  it('auto 실측이 최소 높이와 같으면 좌표가 그대로다', () => {
    const 기준 = resolveWidgetPositions(유효한_배치, metrics, {})
    const 실측 = resolveWidgetPositions(유효한_배치, metrics, { 스케줄: GRID_ROW_HEIGHT })

    expect(실측).toEqual(기준)
  })

  it('실측이 없는 auto 타일은 최소 높이로 친다', () => {
    const { tiles } = resolveWidgetPositions(유효한_배치, metrics, {})

    expect(tiles.find((tile) => tile.id === '스케줄')?.heightPx).toBe(GRID_ROW_HEIGHT)
  })

  it('실측이 최소 높이보다 작아도 줄어들지 않는다', () => {
    const 기준 = resolveWidgetPositions(유효한_배치, metrics, {})
    const 실측 = resolveWidgetPositions(유효한_배치, metrics, { 스케줄: 40 })

    expect(실측).toEqual(기준)
  })

  // 캐릭터 4명이면 `55 + 45 × 4 = 235` 인데 최소 높이가 행 높이라 그만큼이 초과분이다.
  it('auto 초과분만큼 아래 타일 전부가 내려간다', () => {
    const 기준 = resolveWidgetPositions(유효한_배치, metrics, {})
    const 늘어남 = resolveWidgetPositions(유효한_배치, metrics, { 스케줄: GRID_ROW_HEIGHT + 160 })

    const 기준_by = Object.fromEntries(기준.tiles.map((tile) => [tile.id, tile] as const))
    const 늘어남_by = Object.fromEntries(늘어남.tiles.map((tile) => [tile.id, tile] as const))

    // 위쪽 타일은 안 움직인다.
    expect(늘어남_by['대표'].topPx).toBe(기준_by['대표'].topPx)
    expect(늘어남_by['초기화'].topPx).toBe(기준_by['초기화'].topPx)
    expect(늘어남_by['결정석'].topPx).toBe(기준_by['결정석'].topPx)

    // auto 타일 자신은 제자리에서 커진다.
    expect(늘어남_by['스케줄'].topPx).toBe(기준_by['스케줄'].topPx)
    expect(늘어남_by['스케줄'].heightPx).toBe(GRID_ROW_HEIGHT + 160)

    // 아래 타일은 정확히 초과분만큼 내려간다.
    expect(늘어남_by['수익'].topPx).toBe(기준_by['수익'].topPx + 160)
    expect(늘어남.containerHeightPx).toBe(기준.containerHeightPx + 160)
  })

  it('auto 가 둘이면 초과분이 누적된다', () => {
    const 배치: WidgetPlacement[] = [
      { id: 'a', col: 0, row: 0, w: 4, h: 'auto' },
      { id: 'b', col: 0, row: 1, w: 4, h: 'auto' },
      { id: 'c', col: 0, row: 2, w: 4, h: 1 },
    ]
    const 기준 = resolveWidgetPositions(배치, metrics, {})
    const 늘어남 = resolveWidgetPositions(배치, metrics, { a: GRID_ROW_HEIGHT + 100, b: GRID_ROW_HEIGHT + 30 })

    const 기준_by = Object.fromEntries(기준.tiles.map((tile) => [tile.id, tile] as const))
    const 늘어남_by = Object.fromEntries(늘어남.tiles.map((tile) => [tile.id, tile] as const))

    expect(늘어남_by['a'].topPx).toBe(기준_by['a'].topPx)
    expect(늘어남_by['b'].topPx).toBe(기준_by['b'].topPx + 100)
    expect(늘어남_by['c'].topPx).toBe(기준_by['c'].topPx + 130)
    expect(늘어남.containerHeightPx).toBe(기준.containerHeightPx + 130)
  })

  it('컨테이너 높이는 가장 아래 타일의 끝이다', () => {
    const { containerHeightPx } = resolveWidgetPositions(유효한_배치, metrics, {})

    // 수익 타일: top 3×(행+간격) · 높이 3×행 + 2×간격
    const top = 3 * (GRID_ROW_HEIGHT + GRID_GAP)
    expect(containerHeightPx).toBe(top + GRID_ROW_HEIGHT * 3 + GRID_GAP * 2)
  })
})
