import { cumulativeRanges, statsRanges } from '../periods'

describe('statsRanges', () => {
  it('주간은 그 주와 그 주까지의 8주를 낸다', () => {
    const ranges = statsRanges('weekly', '2026-09-24')
    expect(ranges.current).toEqual({ from: '2026-09-24', to: '2026-09-30' })
    expect(ranges.previous).toEqual({ from: '2026-09-17', to: '2026-09-23' })
    expect(ranges.trend).toHaveLength(8)
    expect(ranges.trend[0]).toEqual({ periodKey: '2026-08-06', from: '2026-08-06', to: '2026-08-12' })
    expect(ranges.trend[7]).toEqual({ periodKey: '2026-09-24', from: '2026-09-24', to: '2026-09-30' })
  })

  it('월간은 그 달과 그 달까지의 6개월을 낸다', () => {
    const ranges = statsRanges('monthly', '2026-03')
    expect(ranges.current).toEqual({ from: '2026-03-01', to: '2026-03-31' })
    expect(ranges.previous).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(ranges.trend.map((range) => range.periodKey)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })
})

describe('cumulativeRanges', () => {
  it('기록이 처음 있는 주부터 고른 주까지 주마다 범위를 낸다', () => {
    const ranges = cumulativeRanges('weekly', '2026-09-24', '2026-09-05')
    expect(ranges.map((range) => range.periodKey)).toEqual(['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24'])
  })

  it('월간은 기록이 처음 있는 달부터다', () => {
    const ranges = cumulativeRanges('monthly', '2026-09', '2026-07-30')
    expect(ranges.map((range) => range.periodKey)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('처음 기록이 고른 기간보다 늦거나 없으면 고른 기간 하나다', () => {
    expect(cumulativeRanges('weekly', '2026-09-24', null).map((range) => range.periodKey)).toEqual(['2026-09-24'])
    expect(cumulativeRanges('weekly', '2026-09-24', '2026-10-02').map((range) => range.periodKey)).toEqual(['2026-09-24'])
  })
})
