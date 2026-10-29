import {
  type MvpGradeEntry,
  editDateBounds,
  moveGradeEntry,
  mvpGradeAt,
  removeGradeEntry,
  setGradeFrom,
} from '../history'

// 6/11 실버 · 7/30 골드 · 9/20 다이아. 9/20 은 일요일이다.
const HISTORY: MvpGradeEntry[] = [
  { startDate: '2026-09-20', grade: 'diamond' },
  { startDate: '2026-07-30', grade: 'gold' },
  { startDate: '2026-06-11', grade: 'silver' },
]

describe('그 날의 등급', () => {
  it('주 중간에 시작한 등급은 그 날부터이고, 같은 주의 앞 날은 앞 등급이다', () => {
    expect(mvpGradeAt(HISTORY, '2026-09-17')).toBe('gold') // 그 주 목요일
    expect(mvpGradeAt(HISTORY, '2026-09-19')).toBe('gold') // 토요일
    expect(mvpGradeAt(HISTORY, '2026-09-20')).toBe('diamond')
  })

  it('첫 시작보다 앞이면 등급이 없다', () => {
    expect(mvpGradeAt(HISTORY, '2026-06-10')).toBeNull()
    expect(mvpGradeAt([], '2026-09-22')).toBeNull()
  })
})

describe('등급 변경', () => {
  it('같은 날을 다시 고르면 그 줄을 덮는다', () => {
    const next = setGradeFrom(HISTORY, '2026-09-20', 'black')
    expect(next).toHaveLength(3)
    expect(mvpGradeAt(next, '2026-09-20')).toBe('black')
  })

  it('지난 날을 고르면 다음 기록 전날까지만 그 등급이다', () => {
    const next = setGradeFrom(HISTORY, '2026-07-05', 'red')
    expect(mvpGradeAt(next, '2026-07-04')).toBe('silver')
    expect(mvpGradeAt(next, '2026-07-29')).toBe('red')
    expect(mvpGradeAt(next, '2026-07-30')).toBe('gold')
  })
})

describe('기록 지우기', () => {
  it('그 줄을 지우면 앞 등급이 다음 기록 전날까지 이어진다', () => {
    const next = removeGradeEntry(HISTORY, '2026-07-30')
    expect(mvpGradeAt(next, '2026-09-19')).toBe('silver')
  })
})

describe('기록 고치기', () => {
  it('날을 옮기고 등급을 바꾼다', () => {
    expect(moveGradeEntry(HISTORY, '2026-07-30', '2026-08-02', 'red')).toEqual([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-08-02', grade: 'red' },
      { startDate: '2026-09-20', grade: 'diamond' },
    ])
  })

  it('옮길 수 있는 날은 앞 기록 다음 날부터 다음 기록 전날까지다', () => {
    expect(editDateBounds(HISTORY, '2026-07-30', '2025-02-27', '2026-10-29')).toEqual({ min: '2026-06-12', max: '2026-09-19' })
    expect(editDateBounds(HISTORY, '2026-06-11', '2025-02-27', '2026-10-29')).toEqual({ min: '2025-02-27', max: '2026-07-29' })
    expect(editDateBounds(HISTORY, '2026-09-20', '2025-02-27', '2026-10-29')).toEqual({ min: '2026-07-31', max: '2026-10-29' })
  })
})
