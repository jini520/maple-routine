import {
  formatBasisDate,
  formatChangePct,
  formatIndex,
  formatIndexArrow,
  formatIndexSigned,
  formatMarketRange,
  formatTick,
  MARKET_PERIODS,
  niceScale,
  sliceSeries,
  toneOf,
  trendOf,
} from '../format'

describe('지수와 등락 표기', () => {
  it('지수는 소수 둘째 자리와 천 단위 쉼표이고, 값이 없으면 0.00 이다', () => {
    expect([formatIndex(9082.3), formatIndex(10000), formatIndex(null)]).toEqual(['9,082.30', '10,000.00', '0.00'])
  })

  it('MASPI 카드는 부호, today 위젯은 화살표로 적고, 같거나 없으면 부호 없이 0.00 이다', () => {
    expect([formatIndexSigned(36.7), formatIndexSigned(-24.82), formatIndexSigned(0), formatIndexSigned(null)]).toEqual([
      '+36.70',
      '-24.82',
      '0.00',
      '0.00',
    ])
    expect([formatIndexArrow(36.7), formatIndexArrow(-24.82), formatIndexArrow(0), formatIndexArrow(null)]).toEqual([
      '▲ 36.70',
      '▼ 24.82',
      '0.00',
      '0.00',
    ])
  })

  it('전일 대비(%)는 소수 첫째 자리에 부호를 붙이고, 앞 날이 없으면 0.0% 다', () => {
    expect([formatChangePct(3.2), formatChangePct(-5), formatChangePct(0), formatChangePct(null)]).toEqual([
      '+3.2%',
      '-5.0%',
      '0.0%',
      '0.0%',
    ])
  })

  it('색은 등락이 정하고, 꺾은선 색은 처음과 끝을 견준다', () => {
    expect([toneOf(1), toneOf(-1), toneOf(0), toneOf(null)]).toEqual(['rise', 'fall', 'flat', 'flat'])
    expect([trendOf([10, 8, 12]), trendOf([12, 15, 9]), trendOf([5, 9, 5]), trendOf([7]), trendOf([])]).toEqual([
      'rise',
      'fall',
      'flat',
      'flat',
      'flat',
    ])
  })

  it('범위는 억 소수 둘째 자리의 짧은 금액이라 목록 줄에서 접히지 않는다', () => {
    expect(formatMarketRange(2_688_888_889, 2_877_777_777)).toBe('26.89억 ~ 28.78억')
    expect(formatMarketRange(299_999_999, 338_333_333)).toBe('3억 ~ 3.38억')
  })

  it('값의 날짜를 `11/14 기준` 으로 적고, 날짜가 없으면 비운다', () => {
    expect([formatBasisDate('2026-11-14'), formatBasisDate('2026-01-05'), formatBasisDate(null)]).toEqual([
      '11/14 기준',
      '1/5 기준',
      '',
    ])
  })
})

describe('sliceSeries', () => {
  const daily = Array.from({ length: 400 }, (_, index) => {
    const date = new Date(Date.UTC(2025, 9, 12 + index)).toISOString().slice(0, 10)
    return { date }
  })
  const last = daily[daily.length - 1].date

  it('마지막 날부터 거꾸로 7일 · 30일 · 3개월 · 6개월 · 1년을 자른다', () => {
    expect(last).toBe('2026-11-15')
    const lengths = MARKET_PERIODS.map((period) => sliceSeries(daily, period).length)
    // 3개월은 8/16 ~ 11/15, 6개월은 5/16 ~ 11/15, 1년은 2025-11-16 ~ 2026-11-15 다.
    expect(lengths).toEqual([7, 30, 92, 184, 365])
    expect(sliceSeries(daily, '3개월')[0].date).toBe('2026-08-16')
  })

  it('날이 기간보다 적으면 있는 날만 준다', () => {
    expect(sliceSeries(daily.slice(-12), '30일')).toHaveLength(12)
    expect(sliceSeries([], '7일')).toEqual([])
  })
})

describe('niceScale', () => {
  it('눈금 간격은 1 · 2 · 5 에 10 의 거듭제곱을 곱한 값이고, 범위를 그 간격의 배수로 넓힌다', () => {
    expect(niceScale(1_022_000_000, 1_458_000_000)).toEqual({
      lo: 1_000_000_000,
      hi: 1_600_000_000,
      step: 200_000_000,
      ticks: [1_000_000_000, 1_200_000_000, 1_400_000_000, 1_600_000_000],
    })
    expect(niceScale(172_440_000, 181_500_000).ticks).toEqual([170_000_000, 175_000_000, 180_000_000, 185_000_000])
  })

  it('값이 모두 같으면 위아래로 벌려 선이 가운데에 선다', () => {
    const scale = niceScale(300_000_000, 300_000_000)
    expect(scale.lo).toBeLessThan(300_000_000)
    expect(scale.hi).toBeGreaterThan(300_000_000)
    expect(scale.hi - 300_000_000).toBe(300_000_000 - scale.lo)
  })
})

describe('formatTick', () => {
  it('눈금 글자는 간격이 갈리는 자리까지 소수로 적어, 이웃한 눈금이 같은 글자가 되지 않는다', () => {
    expect([1_000_000_000, 1_200_000_000].map((tick) => formatTick(tick, 200_000_000))).toEqual(['10억', '12억'])
    expect([170_000_000, 175_000_000].map((tick) => formatTick(tick, 5_000_000))).toEqual(['1.70억', '1.75억'])
    expect([76_000_000, 77_000_000].map((tick) => formatTick(tick, 1_000_000))).toEqual(['7,600만', '7,700만'])
    expect(formatTick(0, 1_000_000)).toBe('0')
  })
})
