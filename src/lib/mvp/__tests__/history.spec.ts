import {
  type MvpGradeEntry,
  insertEndLimit,
  insertPeriod,
  mvpGradeAt,
  removeGradeEntry,
  setGradeFrom,
} from '../history'

// 7/30 골드 · 6/11 실버 · 9/17 다이아. 시작은 모두 목요일이다.
const HISTORY: MvpGradeEntry[] = [
  { startDate: '2026-09-17', grade: 'diamond' },
  { startDate: '2026-07-30', grade: 'gold' },
  { startDate: '2026-06-11', grade: 'silver' },
]

describe('그 날의 등급', () => {
  it('그 날이 든 주의 목요일 이하에서 가장 늦은 시작의 등급이다', () => {
    expect(mvpGradeAt(HISTORY, '2026-07-29')).toBe('silver') // 수요일. 7/30 주 전이다
    expect(mvpGradeAt(HISTORY, '2026-07-30')).toBe('gold')
    expect(mvpGradeAt(HISTORY, '2026-08-05')).toBe('gold') // 다음 수요일까지 같은 주
    expect(mvpGradeAt(HISTORY, '2026-09-22')).toBe('diamond')
  })

  it('첫 시작보다 앞이면 등급이 없다', () => {
    expect(mvpGradeAt(HISTORY, '2026-06-10')).toBeNull()
    expect(mvpGradeAt([], '2026-09-22')).toBeNull()
  })

  it('등급이 빈 줄부터 다음 줄 전까지도 등급이 없다', () => {
    const history: MvpGradeEntry[] = [
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-07-16', grade: null },
      { startDate: '2026-07-30', grade: 'gold' },
    ]
    expect(mvpGradeAt(history, '2026-07-20')).toBeNull()
    expect(mvpGradeAt(history, '2026-07-30')).toBe('gold')
  })
})

describe('등급 변경', () => {
  it('고른 주부터 새 등급이다', () => {
    const next = setGradeFrom(HISTORY, '2026-09-24', 'red')
    expect(mvpGradeAt(next, '2026-09-23')).toBe('diamond')
    expect(mvpGradeAt(next, '2026-09-24')).toBe('red')
  })

  it('같은 주를 다시 고르면 그 줄을 덮는다', () => {
    const next = setGradeFrom(HISTORY, '2026-09-17', 'black')
    expect(next).toHaveLength(3)
    expect(mvpGradeAt(next, '2026-09-17')).toBe('black')
  })
})

describe('기간 추가', () => {
  it('종료 주 다음 주부터 감싸던 등급이 다시 이어진다', () => {
    const next = insertPeriod(HISTORY, '2026-07-02', '2026-07-09', 'red')
    expect(next).toEqual([
      { startDate: '2026-06-11', grade: 'silver' },
      { startDate: '2026-07-02', grade: 'red' },
      { startDate: '2026-07-16', grade: 'silver' },
      { startDate: '2026-07-30', grade: 'gold' },
      { startDate: '2026-09-17', grade: 'diamond' },
    ])
  })

  it('다음 기록 바로 앞까지면 줄을 하나만 더한다', () => {
    const next = insertPeriod(HISTORY, '2026-07-16', '2026-07-23', 'red')
    expect(next.map((entry) => entry.startDate)).toEqual(['2026-06-11', '2026-07-16', '2026-07-30', '2026-09-17'])
  })

  it('첫 기록보다 앞선 기간이면 종료 뒤는 등급 없음이다', () => {
    const next = insertPeriod(HISTORY, '2026-05-07', '2026-05-14', 'red')
    expect(next.slice(0, 3)).toEqual([
      { startDate: '2026-05-07', grade: 'red' },
      { startDate: '2026-05-21', grade: null },
      { startDate: '2026-06-11', grade: 'silver' },
    ])
    expect(mvpGradeAt(next, '2026-05-30')).toBeNull()
  })

  it('첫 기록 바로 앞까지면 등급 없음 줄을 안 적는다', () => {
    const next = insertPeriod(HISTORY, '2026-05-28', '2026-06-04', 'red')
    expect(next.map((entry) => entry.grade)).toEqual(['red', 'silver', 'gold', 'diamond'])
  })

  it('지금 기록 안의 지난 기간이면 지금 등급이 다시 이어진다', () => {
    const history: MvpGradeEntry[] = [{ startDate: '2026-08-06', grade: 'diamond' }]
    const next = insertPeriod(history, '2026-08-20', '2026-08-27', 'red')
    expect(next).toEqual([
      { startDate: '2026-08-06', grade: 'diamond' },
      { startDate: '2026-08-20', grade: 'red' },
      { startDate: '2026-09-03', grade: 'diamond' },
    ])
  })
})

describe('종료 주의 한계', () => {
  it('시작 주 뒤 첫 기록의 앞 주다', () => {
    expect(insertEndLimit(HISTORY, '2026-07-02', '2026-09-17')).toBe('2026-07-23')
  })

  it('지난주를 넘지 않는다', () => {
    expect(insertEndLimit([{ startDate: '2026-08-06', grade: 'diamond' }], '2026-08-20', '2026-09-17')).toBe('2026-09-10')
  })
})

describe('기록 지우기', () => {
  it('그 줄만 지운다', () => {
    expect(removeGradeEntry(HISTORY, '2026-07-30').map((entry) => entry.startDate)).toEqual(['2026-06-11', '2026-09-17'])
  })

  it('맨 앞에 남는 등급 없음 줄은 뜻이 없어 함께 지운다', () => {
    const history: MvpGradeEntry[] = [
      { startDate: '2026-05-07', grade: 'red' },
      { startDate: '2026-05-21', grade: null },
      { startDate: '2026-06-11', grade: 'silver' },
    ]
    expect(removeGradeEntry(history, '2026-05-07')).toEqual([{ startDate: '2026-06-11', grade: 'silver' }])
  })
})
