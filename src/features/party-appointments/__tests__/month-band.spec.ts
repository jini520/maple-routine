import { monthSegments, stickyLabelLeft } from '../month-band'

describe('monthSegments', () => {
  it('이어진 같은 달의 칸을 한 조각으로 묶는다', () => {
    expect(monthSegments(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])).toEqual([
      { month: 9, first: 0, last: 1 },
      { month: 10, first: 2, last: 3 },
    ])
  })

  it('빈 목록은 조각이 없다', () => {
    expect(monthSegments([])).toEqual([])
  })
})

describe('stickyLabelLeft', () => {
  // 칸 폭 100, 이름 폭 30. 조각은 0~300(세 칸).
  const segment = { start: 0, end: 300 }

  it('조각 첫 칸이 보이면 그 칸 왼쪽에 선다', () => {
    expect(stickyLabelLeft(0, segment.start + 200, segment.end + 200, 30)).toBe(200)
  })

  it('조각 첫 칸이 화면 왼쪽으로 지나가면 화면 왼쪽 끝에 붙는다', () => {
    expect(stickyLabelLeft(120, segment.start, segment.end, 30)).toBe(0)
  })

  it('조각 끝이 다가오면 그 끝에 밀려 함께 나간다', () => {
    expect(stickyLabelLeft(280, segment.start, segment.end, 30)).toBe(-10)
  })
})
