import { dropFeeFields, dropFeeSeeds } from '../drop-fees'

const drop = { category: 'equipment' as const, itemKey: 'x', itemName: 'x', quantity: 1 }

describe('dropFeeSeeds', () => {
  it('새로 매기면 두 줄 다 자동이다', () => {
    expect(dropFeeSeeds(drop, undefined)).toEqual([{ auto: true, percent: null }, { auto: true, percent: null }])
  })

  it('매긴 기록은 적힌 대로 연다. 수수료 칸이 없던 옛 기록은 없음이다', () => {
    expect(dropFeeSeeds({ ...drop, priceState: 'entered', priceMeso: 1 }, undefined)).toEqual([
      { auto: false, percent: null },
      { auto: false, percent: null },
    ])
    expect(
      dropFeeSeeds({ ...drop, priceState: 'entered', priceMeso: 1, saleFeePercent: 3, saleFeeAuto: true, splitFeePercent: 5 }, undefined),
    ).toEqual([{ auto: true, percent: 3 }, { auto: false, percent: 5 }])
  })

  it('이 연쇄에서 방금 매긴 값이 이긴다', () => {
    const edit = { saleFeePercent: 5, saleFeeAuto: false, splitFeePercent: 3, splitFeeAuto: true }
    expect(dropFeeSeeds(drop, edit)).toEqual([{ auto: false, percent: 5 }, { auto: true, percent: 3 }])
  })
})

describe('dropFeeFields', () => {
  it('카드가 준 수수료를 드롭 칸으로 옮긴다. 없음과 수동은 칸을 비운다', () => {
    expect(dropFeeFields({ saleFeePercent: 3, saleFeeAuto: true, splitFeePercent: null, splitFeeAuto: false })).toEqual({
      saleFeePercent: 3,
      saleFeeAuto: true,
      splitFeePercent: undefined,
      splitFeeAuto: undefined,
    })
    expect(dropFeeFields(undefined)).toEqual({
      saleFeePercent: undefined,
      saleFeeAuto: undefined,
      splitFeePercent: undefined,
      splitFeeAuto: undefined,
    })
  })
})
