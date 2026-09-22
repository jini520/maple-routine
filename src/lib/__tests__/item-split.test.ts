// 아이템 분배 계산기의 계산.
//
// 이 파일이 지키는 것은 **숫자 하나** 가 아니라 **불변식**이다. 화면이 검산표를 안 그리기로 했으므로
//  **이 값이 맞나** 를 물을 수 있는 자리가 여기뿐이다.

import { MAX_SALE_PRICE_MESO, netProceedsMeso, transferPerMember } from '../cashbook/item-split'

/** 수수료를 내림으로 뗀 실수령. 게임의 반올림 방향은 미확인이다(열린 질문). */
function afterFee(amount: number, feePercent: number): number {
  return amount - Math.floor((amount * feePercent) / 100)
}

describe('netProceedsMeso: 판매 수수료를 뗀다', () => {
  it('3% 와 5% 를 뗀다', () => {
    expect(netProceedsMeso(1_000_000_000, 3)).toBe(970_000_000)
    expect(netProceedsMeso(1_000_000_000, 5)).toBe(950_000_000)
  })

  // 수수료 쪽을 내림한다 = 정산 대상이 커지는 쪽. 방향을 뒤집으면 1 메소가 움직인다.
  it('수수료를 내림한다. 딱 떨어지지 않는 금액에서', () => {
    expect(netProceedsMeso(1_001, 3)).toBe(1_001 - 30) // 30.03 → 30
  })

  it('0 이면 0 이다', () => {
    expect(netProceedsMeso(0, 5)).toBe(0)
  })
})

describe('transferPerMember: 수수료를 거쳐도 같아지는 **보낼 금액**', () => {
  // 분배 규칙의 표를 그대로 고정한다.
  it('판매가 10억 · 6인 · 판매 3% · 분배 3% 이면 162,479,061 을 보낸다', () => {
    expect(
      transferPerMember({ salePriceMeso: 1_000_000_000, partySize: 6, saleFeePercent: 3, splitFeePercent: 3 }),
    ).toBe(162_479_061)
  })

  // 이것이 이 도구의 존재 이유다. 명목 ÷n(161,666,666)을 보내면 먹은 사람만 480만을 더 갖는다.
  it('명목 ÷n 보다 많이 보낸다. 먹은 사람도 분배 수수료를 나눠 지기 때문이다', () => {
    const netProceeds = netProceedsMeso(1_000_000_000, 3)
    const naive = Math.floor(netProceeds / 6)

    const transfer = transferPerMember({
      salePriceMeso: 1_000_000_000,
      partySize: 6,
      saleFeePercent: 3,
      splitFeePercent: 3,
    })

    expect(transfer).toBeGreaterThan(naive)
    expect(naive).toBe(161_666_666)
  })

  it('파티원이 1인이면 보낼 곳이 없다', () => {
    expect(
      transferPerMember({ salePriceMeso: 1_000_000_000, partySize: 1, saleFeePercent: 3, splitFeePercent: 3 }),
    ).toBeNull()
  })

  it('판매가가 0 이면 보낼 금액도 0 이다', () => {
    expect(transferPerMember({ salePriceMeso: 0, partySize: 4, saleFeePercent: 3, splitFeePercent: 5 })).toBe(0)
  })
})

// 위의 고정값 하나는 표를 베낀 것이고, 아래는 왜 그 값인가 다.
describe('불변식. 여섯이 같아진다', () => {
  const CASES = [
    { salePriceMeso: 1_000_000_000, partySize: 6, saleFeePercent: 3, splitFeePercent: 3 },
    { salePriceMeso: 1_000_000_000, partySize: 6, saleFeePercent: 3, splitFeePercent: 5 },
    { salePriceMeso: 1_000_000_000, partySize: 6, saleFeePercent: 5, splitFeePercent: 5 },
    { salePriceMeso: 1_000_000_000, partySize: 5, saleFeePercent: 5, splitFeePercent: 3 },
    { salePriceMeso: 123_456_789, partySize: 2, saleFeePercent: 3, splitFeePercent: 5 },
    { salePriceMeso: 7, partySize: 3, saleFeePercent: 5, splitFeePercent: 5 },
    { salePriceMeso: MAX_SALE_PRICE_MESO, partySize: 6, saleFeePercent: 5, splitFeePercent: 5 },
  ] as const

  it.each(CASES)(
    '판매가 $salePriceMeso · $partySize 인 · 판매 $saleFeePercent% · 분배 $splitFeePercent%: 차이가 파티원 수 이하다',
    (input) => {
      const transfer = transferPerMember(input)
      if (transfer === null) throw new Error('보낼 금액이 없다')

      const netProceeds = netProceedsMeso(input.salePriceMeso, input.saleFeePercent)
      const received = afterFee(transfer, input.splitFeePercent)
      const keptByLooter = netProceeds - (input.partySize - 1) * transfer

      expect(Math.abs(keptByLooter - received)).toBeLessThanOrEqual(input.partySize)
    },
  )

  // 버림이라 남는 메소는 먹은 사람에게 간다. 파티원이 더 받는 일은 없다…
  // …단 **내림한 수수료** 가 최대 1 메소를 되돌려 주므로 그만큼은 허용한다.
  it.each(CASES)(
    '판매가 $salePriceMeso · $partySize 인. 먹은 사람이 손해 보지 않는다',
    (input) => {
      const transfer = transferPerMember(input)
      if (transfer === null) throw new Error('보낼 금액이 없다')

      const netProceeds = netProceedsMeso(input.salePriceMeso, input.saleFeePercent)
      const received = afterFee(transfer, input.splitFeePercent)
      const keptByLooter = netProceeds - (input.partySize - 1) * transfer

      expect(keptByLooter).toBeGreaterThanOrEqual(received - 1)
    },
  )

  // 중간값 `N × 100` 이 안전 정수를 넘으면 계산이 조용히 틀린다.
  it('상한 판매가에서도 중간값이 안전 정수 안이다', () => {
    expect(netProceedsMeso(MAX_SALE_PRICE_MESO, 3) * 100).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
  })

  // 보내는 쪽이 가진 것보다 많이 보내는 일은 없다. 2인에서 가장 아슬아슬하다.
  it.each(CASES)('판매가 $salePriceMeso · $partySize 인. 가진 것보다 많이 보내지 않는다', (input) => {
    const transfer = transferPerMember(input)
    if (transfer === null) throw new Error('보낼 금액이 없다')

    const netProceeds = netProceedsMeso(input.salePriceMeso, input.saleFeePercent)
    expect((input.partySize - 1) * transfer).toBeLessThanOrEqual(netProceeds)
  })
})

describe('비율 약속. 1/n 이 아니라 2:1 로 나눌 때', () => {
  // 이 기능이 비율을 안 쓰는 사용자의 값을 건드리지 않는다는 보증이다.
  it.each([2, 3, 4, 5, 6])('비율을 안 적으면 옛 식과 한 메소도 안 다르다. %i 인', (partySize) => {
    for (const splitFeePercent of [3, 5] as const) {
      const base = { salePriceMeso: 1_000_000_000, partySize, saleFeePercent: 3, splitFeePercent } as const
      expect(transferPerMember({ ...base, myShare: null, sharesTotal: null })).toBe(transferPerMember(base))
    }
  })

  // 비율은 `나 : 나머지` 라 두 쪽이다. 반반이면 2인 균등과 같은 수다.
  it.each([3, 5] as const)('반반(1:1)은 2인 균등과 같다. 분배 %i%%', (splitFeePercent) => {
    const base = { salePriceMeso: 1_000_000_000, partySize: 2, saleFeePercent: 3, splitFeePercent } as const

    expect(transferPerMember({ ...base, myShare: 1, sharesTotal: 2 })).toBe(transferPerMember(base))
  })

  // 파티 인원은 비율 식에 안 들어간다.
  it('비율이 있으면 파티원 수가 값을 안 흔든다', () => {
    const 값들 = [2, 3, 4, 5, 6].map((partySize) =>
      transferPerMember({
        salePriceMeso: 1_000_000_000,
        partySize,
        saleFeePercent: 3,
        splitFeePercent: 3,
        myShare: 2,
        sharesTotal: 3,
      }),
    )

    expect(new Set(값들).size).toBe(1)
  })

  it('10억 · 2인 · 내가 2, 합 3 · 판매 3% · 분배 3% 이면 329,931,972 를 보낸다', () => {
    expect(
      transferPerMember({
        salePriceMeso: 1_000_000_000,
        partySize: 2,
        saleFeePercent: 3,
        splitFeePercent: 3,
        myShare: 2,
        sharesTotal: 3,
      }),
    ).toBe(329_931_972)
  })

  // 계산기의 존재 이유가 비율에서도 그대로다. 수수료를 거치고도 약속한 비가 나와야 한다.
  it('수수료를 거친 잔액이 약속한 비가 된다. 파는 사람이 두 배를 쥔다', () => {
    const input = {
      salePriceMeso: 1_000_000_000,
      partySize: 2,
      saleFeePercent: 3,
      splitFeePercent: 3,
      myShare: 2,
      sharesTotal: 3,
    } as const
    const transfer = transferPerMember(input)
    if (transfer === null) throw new Error('보낼 금액이 없다')

    const keptByLooter = netProceedsMeso(input.salePriceMeso, input.saleFeePercent) - transfer
    const received = afterFee(transfer, input.splitFeePercent)
    expect(Math.abs(keptByLooter - received * 2)).toBeLessThanOrEqual(2)
  })

  it('내 비율이 작으면 명목 절반보다 많이 보낸다', () => {
    const 많이가짐 = transferPerMember({
      salePriceMeso: 1_000_000_000,
      partySize: 2,
      saleFeePercent: 3,
      splitFeePercent: 3,
      myShare: 2,
      sharesTotal: 3,
    })
    const 적게가짐 = transferPerMember({
      salePriceMeso: 1_000_000_000,
      partySize: 2,
      saleFeePercent: 3,
      splitFeePercent: 3,
      myShare: 1,
      sharesTotal: 3,
    })
    expect(적게가짐).toBeGreaterThan(많이가짐 as number)
  })

  // 아이템을 다 넘기고 결정석만 갖는 약속. 판 사람이 정산 대상 전부를 보낸다.
  it('내 비율이 0 이면 정산 대상을 전부 보낸다', () => {
    expect(
      transferPerMember({
        salePriceMeso: 1_000_000_000,
        partySize: 2,
        saleFeePercent: 3,
        splitFeePercent: 3,
        myShare: 0,
        sharesTotal: 3,
      }),
    ).toBe(netProceedsMeso(1_000_000_000, 3))
  })

  it('혼자 다 갖는 약속이면 보낼 금액이 0 이다', () => {
    expect(
      transferPerMember({
        salePriceMeso: 1_000_000_000,
        partySize: 2,
        saleFeePercent: 3,
        splitFeePercent: 3,
        myShare: 3,
        sharesTotal: 3,
      }),
    ).toBe(0)
  })

  // 중간값이 안전 정수를 넘으면 계산이 조용히 틀린다. 비율이 곱을 하나 더 만든다.
  it('상한 판매가 · 합 9 · 내 비율 1 에서도 중간값이 안전 정수 안이다', () => {
    expect(netProceedsMeso(MAX_SALE_PRICE_MESO, 3) * 100 * 8).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER)
  })
})
