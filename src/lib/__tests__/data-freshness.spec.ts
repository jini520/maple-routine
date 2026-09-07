import { formatFetchedAt } from '../data-freshness'

describe('갱신 시각 표기', () => {
  it('시·분·초와 `기준`', () => {
    expect(formatFetchedAt(new Date(2026, 8, 8, 14, 3, 22).toISOString())).toBe('14:03:22 기준')
  })

  // 자리가 흔들리면 헤더 아래 한 줄이 값마다 길이가 달라진다.
  it('한 자리는 0 을 채운다', () => {
    expect(formatFetchedAt(new Date(2026, 8, 8, 9, 5, 1).toISOString())).toBe('09:05:01 기준')
  })

  it('자정은 00 이다', () => {
    expect(formatFetchedAt(new Date(2026, 8, 8, 0, 0, 0).toISOString())).toBe('00:00:00 기준')
  })

  // 부르는 쪽이 이 빈 문자열로 줄을 통째로 뺀다.
  it('받은 적이 없으면 빈 문자열', () => {
    expect(formatFetchedAt(null)).toBe('')
    expect(formatFetchedAt(undefined)).toBe('')
  })

  it('못 읽는 값도 빈 문자열', () => {
    expect(formatFetchedAt('시각이 아니다')).toBe('')
  })
})
