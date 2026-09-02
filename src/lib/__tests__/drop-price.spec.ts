// 드롭 판매가 → 수익 환산. 이 함수가 틀리면 캐릭터 합계·총 수익·증감 칩이
// 한꺼번에 틀리므로 규칙을 여기서 못 박는다.
import { dropPayoutMeso, formatMesoUnits, sumDropPayout } from '../drop/drop-price'

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
  it('조·억·만·나머지를 순서대로 접는다', () => {
    expect(formatMesoUnits(1_234_567_890_000)).toBe('1조 2345억 6789만')
  })

  it('0은 그대로 0이다', () => {
    expect(formatMesoUnits(0)).toBe('0')
  })

  it('비어 있는 자리는 건너뛴다 — "32억 0만" 을 만들지 않는다', () => {
    expect(formatMesoUnits(3_200_000_000)).toBe('32억')
    expect(formatMesoUnits(5_000)).toBe('5000')
  })

  // 단위가 붙는 자리가 **천 단위로 떨어지면** 접는다 — `5,000만` 보다
  // `5천만` 이 한 번에 읽힌다. 큰 숫자가 이 서식으로 서므로 자릿수를 눈으로 세지 않게 된다.
  it('천 단위로 떨어지면 `천` 으로 접는다', () => {
    expect(formatMesoUnits(850_000_000)).toBe('8억 5천만')
    expect(formatMesoUnits(500_000_000_000)).toBe('5천억')
  })

  // 단위가 안 붙는 **나머지**에는 안 접는다 — `1만 5천` 은 15,000 과 5,000 이 헷갈린다.
  it('나머지는 접지 않는다', () => {
    expect(formatMesoUnits(15_000)).toBe('1만 5000')
  })

  // 조·억·만 세 자리는 각각 9999 를 못 넘어 콤마가 필요 없다. 단위가 이미 자릿수를 끊는다.
  it('단위가 붙는 자리에는 콤마를 안 넣는다', () => {
    expect(formatMesoUnits(123_456_789)).toBe('1억 2345만 6789')
  })

  // 조 자리만 위가 안 막혀 있다 — 거기서는 콤마가 자릿수를 읽게 해 준다.
  it('조 자리가 다섯 자리를 넘으면 콤마를 넣는다', () => {
    expect(formatMesoUnits(12_345_000_000_000_000)).toBe('12,345조')
  })
})

