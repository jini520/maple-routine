import { withSaleFee } from '../cashbook/sale-fee'

describe('수입 기록에 새 판매 수수료', () => {
  it('아이템 판매는 받은 돈과 뗀 몫에서 판매 대금을 되짚어 새 요율로 뗀다', () => {
    // 12억을 5% 로 판 기록을 3% 로
    const record = { category: 'item_sale' as const, mesoAmount: 1_140_000_000, saleFeeMeso: 60_000_000, hunt: null }
    expect(withSaleFee(record, 3)).toEqual({ mesoAmount: 1_164_000_000, saleFeePercent: 3, saleFeeMeso: 36_000_000 })
  })

  it('수수료가 없던 행은 받은 돈이 판매 대금이다', () => {
    const record = { category: 'sol_erda_fragment' as const, mesoAmount: 100_000_000, saleFeeMeso: null, hunt: null }
    expect(withSaleFee(record, 5)).toEqual({ mesoAmount: 95_000_000, saleFeePercent: 5, saleFeeMeso: 5_000_000 })
  })

  it('사냥은 조각 몫에만 뗀다', () => {
    // 사냥 메소 5억 + 조각 20개 × 500만. 조각 몫 1억에 5% 가 붙어 있던 것을 3% 로
    const record = {
      category: 'hunting' as const,
      mesoAmount: 595_000_000,
      saleFeeMeso: 5_000_000,
      hunt: { fragments: 20, fragmentPrice: 5_000_000 },
    }
    expect(withSaleFee(record, 3)).toEqual({ mesoAmount: 597_000_000, saleFeePercent: 3, saleFeeMeso: 3_000_000 })
  })

  it('조각 가격을 안 적은 사냥과 그 밖의 갈래는 수수료를 안 붙인다', () => {
    expect(withSaleFee({ category: 'hunting', mesoAmount: 500_000_000, saleFeeMeso: null, hunt: { fragments: 20, fragmentPrice: null } }, 3)).toBeNull()
    expect(withSaleFee({ category: 'etc', mesoAmount: 500_000_000, saleFeeMeso: null, hunt: null }, 3)).toBeNull()
  })
})
