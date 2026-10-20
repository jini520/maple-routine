import { formatMesoShort } from '../boss/boss-profit-delta'

describe('formatMesoShort', () => {
  it('억 이상은 억 단위 소수 1자리로 접는다', () => {
    expect(formatMesoShort(1_284_500_000)).toBe('12.8억')
  })

  it('억에 못 미치면 만 단위, 만에도 못 미치면 그대로 쓴다', () => {
    expect(formatMesoShort(85_600_000)).toBe('8,560만')
    expect(formatMesoShort(8_080)).toBe('8,080')
  })
})
