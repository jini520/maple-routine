// 메소마켓 환전 수수료의 금액. 판 메소와 산 메소를 같은 메소로 보고 빼고, 쓰고 남은 메포는 본 월드 시세로 메소로 되돌린다.
//
// 양수면 지출, 음수면 수입이다. 예시는 이슈 #955 와 사용자가 정한 판매만 적는 경우다.

import { mesoMarketExchangeMeso } from '../cashbook/meso-market-exchange'

const SOLD = 500_000_000

describe('mesoMarketExchangeMeso', () => {
  it('판매만 적으면 판매 수수료만큼의 지출이다', () => {
    expect(mesoMarketExchangeMeso({ soldMeso: SOLD, sellRate: 2_116, boughtMeso: null, buyRate: null, feePercent: 1 })).toBe(4_962_193)
  })

  it('구매 월드에서 시세가 높으면 지출이다', () => {
    expect(mesoMarketExchangeMeso({ soldMeso: SOLD, sellRate: 2_116, boughtMeso: 400_000_000, buyRate: 2_200, feePercent: 1 })).toBe(20_841_210)
  })

  it('구매 월드에서 시세가 낮으면 수입이다', () => {
    expect(mesoMarketExchangeMeso({ soldMeso: SOLD, sellRate: 2_116, boughtMeso: SOLD, buyRate: 2_000, feePercent: 1 })).toBe(-22_448_015)
  })

  // 남아 있던 메포를 보태 더 산 경우다. 모자란 메포를 본 월드 시세로 메소로 바꿔 더한다.
  it('쓴 메포가 받은 메포보다 많아도 같은 식으로 센다', () => {
    const meso = mesoMarketExchangeMeso({ soldMeso: 100_000_000, sellRate: 2_116, boughtMeso: 200_000_000, buyRate: 2_116, feePercent: 1 })
    expect(meso).toBe(100_000_000 - 200_000_000 - Math.floor(((2_095 - 4_232) * 100_000_000) / 2_116))
  })

  it('본 월드 시세가 0 이하이면 0 이다', () => {
    expect(mesoMarketExchangeMeso({ soldMeso: SOLD, sellRate: 0, boughtMeso: null, buyRate: null, feePercent: 1 })).toBe(0)
  })
})
