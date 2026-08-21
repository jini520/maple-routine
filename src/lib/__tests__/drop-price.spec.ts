// 드롭 판매가 → 수익 환산([[ADR-124]] 결정 7). 이 함수가 틀리면 캐릭터 합계·총 수익·증감 칩이
// 한꺼번에 틀리므로 규칙을 여기서 못 박는다.
import { dropPayoutMeso, formatMesoUnits, sumDropPayout } from '../drop-price'

describe('dropPayoutMeso', () => {
  it('분배 인원으로 나눈 몫을 내림한다', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 10_000_000_000, priceShare: 3 })).toBe(
      3_333_333_333,
    )
  })

  it('1인이면 입력한 총액 그대로다', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 1 })).toBe(
      1_200_000_000,
    )
  })

  it('기록 안함은 0이다 — 값을 매기지 않기로 한 것이지 0원에 판 것이 아니다', () => {
    expect(dropPayoutMeso({ priceState: 'excluded' })).toBe(0)
  })

  it('미입력은 0이다', () => {
    expect(dropPayoutMeso({})).toBe(0)
  })

  it("금액이 있어도 상태가 'entered' 가 아니면 세지 않는다 — 스킵으로 바꾸며 남은 값이 새지 않게", () => {
    expect(dropPayoutMeso({ priceState: 'excluded', priceMeso: 5_000_000_000 })).toBe(0)
  })

  it('저장 계층의 null 도 그대로 받는다 — BossDropRecord 와 RecordedDrop 이 같은 함수를 쓴다', () => {
    expect(dropPayoutMeso({ priceState: null, priceMeso: null, priceShare: null })).toBe(0)
  })

  it('분배 인원이 없거나 0이면 1인으로 본다 — Infinity 가 수익에 섞이지 않게', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900, priceShare: 0 })).toBe(900)
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900 })).toBe(900)
  })
})

describe('sumDropPayout', () => {
  it('입력된 것만 더한다', () => {
    expect(
      sumDropPayout([
        { priceState: 'entered', priceMeso: 15_000_000_000, priceShare: 3 },
        { priceState: 'excluded' },
        {},
        { priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 1 },
      ]),
    ).toBe(6_200_000_000)
  })

  it('빈 배열은 0이다', () => {
    expect(sumDropPayout([])).toBe(0)
  })
})

describe('formatMesoUnits', () => {
  it('억·만·나머지를 순서대로 접는다', () => {
    expect(formatMesoUnits(3_250_000_000)).toBe('32억 5,000만')
  })

  it('0은 그대로 0이다', () => {
    expect(formatMesoUnits(0)).toBe('0')
  })

  it('비어 있는 자리는 건너뛴다 — "32억 0만" 을 만들지 않는다', () => {
    expect(formatMesoUnits(3_200_000_000)).toBe('32억')
    expect(formatMesoUnits(5_000)).toBe('5,000')
  })
})

