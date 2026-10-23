// 좌표 배치의 **검증과 묶기**. 배치를 손으로 적기로 한 이상 그
// 실수는 반드시 나므로, 자동 패킹 대신 **검증** 을 산 값이 여기서 회수된다.

import { groupWidgetRows, omitHiddenTiles, validateWidgetLayout, type WidgetPlacement } from '../today/widget-layout'

const widths = {
  대표: 4,
  초기화: 2,
  결정석: 2,
  스케줄: 4,
  수익: 4,
} as const

/** 기본 배치 앞부분. 실제로 쓸 좌표를 그대로 쓴다. */
const 유효한_배치: WidgetPlacement[] = [
  { id: '대표', col: 0, row: 0, w: 4 },
  { id: '초기화', col: 0, row: 1, w: 2 },
  { id: '결정석', col: 2, row: 1, w: 2 },
  { id: '스케줄', col: 0, row: 2, w: 4 },
  { id: '수익', col: 0, row: 3, w: 4 },
]

describe('validateWidgetLayout: 손으로 적은 좌표를 지킨다', () => {
  it('유효한 배치는 빈 배열이다', () => {
    expect(validateWidgetLayout(유효한_배치, widths)).toEqual([])
  })

  it('같은 줄에서 겹치는 타일을 잡는다', () => {
    const violations = validateWidgetLayout(
      [
        { id: '초기화', col: 0, row: 0, w: 2 },
        // 결정석이 한 칸 왼쪽으로 밀려 초기화와 겹친다.
        { id: '결정석', col: 1, row: 0, w: 2 },
      ],
      widths,
    )

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('결정석')
    expect(violations[0].reason).toContain('겹')
  })

  it('가로가 격자를 넘으면 잡는다. col + w > 4', () => {
    const violations = validateWidgetLayout([{ id: '결정석', col: 3, row: 0, w: 2 }], widths)

    expect(violations.map((violation) => violation.id)).toEqual(['결정석'])
    expect(violations[0].reason).toContain('4')
  })

  // 중간에 빈 줄이 나오면 `row` 를 잘못 적은 것이다. 위젯을 하나 끼우고 아래를 미는 과정에서
  // 가장 흔한 실수다.
  it('통째로 빈 줄을 잡는다', () => {
    const violations = validateWidgetLayout(
      [
        { id: '대표', col: 0, row: 0, w: 4 },
        { id: '초기화', col: 0, row: 2, w: 2 },
      ],
      widths,
    )

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('초기화')
    expect(violations[0].reason).toContain('빈 줄')
  })

  it('첫 줄이 비어도 잡는다', () => {
    const violations = validateWidgetLayout([{ id: '대표', col: 0, row: 1, w: 4 }], widths)

    expect(violations.map((violation) => violation.id)).toEqual(['대표'])
  })

  // 위젯은 폭 하나만 그린다. 다른 폭을 받으면 그리는 방법을 모른다.
  it('위젯이 선언하지 않은 폭을 잡는다', () => {
    const violations = validateWidgetLayout([{ id: '초기화', col: 0, row: 0, w: 4 }], widths)

    expect(violations).toHaveLength(1)
    expect(violations[0].id).toBe('초기화')
    expect(violations[0].reason).toContain('선언')
  })

  it('레지스트리에 없는 id 도 같은 규칙으로 잡는다', () => {
    const violations = validateWidgetLayout([{ id: '없는위젯', col: 0, row: 0, w: 4 }], widths)

    expect(violations.map((violation) => violation.id)).toEqual(['없는위젯'])
  })
})

describe('groupWidgetRows: 줄 단위로 묶는다', () => {
  // 같은 줄의 타일이 한 묶음이어야 격자가 그 줄의 높이를 가장 높은 타일에 맞출 수 있다.
  it('같은 row 의 타일을 한 줄로 묶고, 줄은 row 순서 · 줄 안은 col 순서다', () => {
    const 섞인_배치: WidgetPlacement[] = [
      { id: '수익', col: 0, row: 2, w: 4 },
      { id: '결정석', col: 2, row: 1, w: 2 },
      { id: '대표', col: 0, row: 0, w: 4 },
      { id: '초기화', col: 0, row: 1, w: 2 },
    ]

    expect(groupWidgetRows(섞인_배치).map((row) => row.map((tile) => tile.id))).toEqual([
      ['대표'],
      ['초기화', '결정석'],
      ['수익'],
    ])
  })
})

// 보여 줄 것이 없는 위젯을 타일째 숨긴다. 가로 전체 타일만 숨겨 그 줄만큼 아래를 올리면 빈 자리가 안 남는다.
describe('omitHiddenTiles', () => {
  it('숨긴 가로 전체 타일을 빼고, 그 아래 줄을 한 줄 올린다', () => {
    const result = omitHiddenTiles(유효한_배치, new Set(['스케줄']))

    expect(result.map((placement) => placement.id)).toEqual(['대표', '초기화', '결정석', '수익'])
    expect(result.find((placement) => placement.id === '수익')?.row).toBe(2)
    expect(validateWidgetLayout(result, widths)).toEqual([])
  })

  // 옆 칸이 있는 타일을 빼면 그 자리가 빈 칸으로 남는다.
  it('가로 전체가 아닌 타일은 숨길 수 없다', () => {
    expect(() => omitHiddenTiles(유효한_배치, new Set(['초기화']))).toThrow()
  })
})
