// 드롭 판매가 → 수익 환산. 이 함수가 틀리면 캐릭터 합계·총 수익·증감 칩이
// 한꺼번에 틀리므로 규칙을 여기서 못 박는다.
import { dropPayoutMeso, dropSplitLabel, formatMesoCompact, formatMesoUnits, sumDropPayout } from '../drop/drop-price'

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

  it('기록 안함은 0이다. 값을 매기지 않기로 한 것이지 0원에 판 것이 아니다', () => {
    expect(dropPayoutMeso({ priceState: 'excluded' })).toBe(0)
  })

  it('미입력은 0이다', () => {
    expect(dropPayoutMeso({})).toBe(0)
  })

  it("금액이 있어도 상태가 'entered' 가 아니면 세지 않는다. 스킵으로 바꾸며 남은 값이 새지 않게", () => {
    expect(dropPayoutMeso({ priceState: 'excluded', priceMeso: 5_000_000_000 })).toBe(0)
  })

  it('저장 계층의 null 도 그대로 받는다. BossDropRecord 와 RecordedDrop 이 같은 함수를 쓴다', () => {
    expect(dropPayoutMeso({ priceState: null, priceMeso: null, priceShare: null })).toBe(0)
  })

  it('분배 인원이 없거나 0이면 1인으로 본다. Infinity 가 수익에 섞이지 않게', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900, priceShare: 0 })).toBe(900)
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900 })).toBe(900)
  })

  // 비율 약속. priceShare 가 비율 합이고 priceMyShare 가 내 비율이다.
  it('내 비율만큼 가져간다. 30억을 2:1 로 나누면 20억이다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 3_000_000_000, priceShare: 3, priceMyShare: 2 }),
    ).toBe(2_000_000_000)
  })

  it('나눠 떨어지지 않으면 내림한다. 남는 메소는 안 센다', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 1_000, priceShare: 3, priceMyShare: 2 })).toBe(666)
  })

  // 옛 행에는 이 칸이 없다. 그 행의 금액이 이 기능 때문에 움직이면 안 된다.
  it('내 비율이 없으면 1 이다. 분배 인원만 적힌 옛 기록이 그대로 맞는다', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 10_000_000_000, priceShare: 3 })).toBe(
      3_333_333_333,
    )
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 10_000_000_000, priceShare: 3, priceMyShare: null }),
    ).toBe(3_333_333_333)
  })

  it('비율이 합과 같으면 전액이다. 혼자 다 갖는 약속', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 3, priceMyShare: 3 }),
    ).toBe(1_200_000_000)
  })

  /**
   * 슬라이더의 0 은 `이 드롭의 돈을 하나도 안 받는다` 는 약속이라 그대로 센다(사용자 결정
   * 2026-09-23). 1 로 바꾸던 옛 규칙은 0% 로 저장한 드롭을 `1/N` 번 것으로 잡았다.
   */
  it('내 비율이 0 이면 0원이다', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900, priceShare: 3, priceMyShare: 0 })).toBe(0)
  })

  it('내 비율이 0 이면 수수료를 매긴 기록도 0원이다', () => {
    expect(
      dropPayoutMeso({
        priceState: 'entered',
        priceMeso: 10_000_000_000,
        priceShare: 10,
        priceMyShare: 0,
        saleFeePercent: 3,
        splitFeePercent: 3,
      }),
    ).toBe(0)
  })

  // 비율을 안 적은 옛 기록은 1 그대로다. 안 그러면 옛 기록의 금액이 통째로 0 이 된다.
  it('내 비율이 NULL 인 옛 기록은 1 로 본다', () => {
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900, priceShare: 3, priceMyShare: null })).toBe(300)
    expect(dropPayoutMeso({ priceState: 'entered', priceMeso: 900, priceShare: 3 })).toBe(300)
  })
})

// 판매 수수료를 뗀 N 에서 파티원에게 보낼 금액을 역산하고, 내 몫은 N 에서 보낸 금액을 뺀 것이다.
describe('dropPayoutMeso 수수료', () => {
  it('혼자면 판매 수수료만 뗀다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 1_000_000_000, priceShare: 1, saleFeePercent: 3, splitFeePercent: 3 }),
    ).toBe(970_000_000)
  })

  it('균등이면 보낸 뒤에도 받는 쪽과 몫이 같도록 역산한다', () => {
    // N = 11억 6400만, 한 명에게 floor(100N / 297) = 391,919,191, 둘에게 보낸 나머지가 내 몫
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 3, saleFeePercent: 3, splitFeePercent: 3 }),
    ).toBe(380_161_618)
  })

  it('비율이면 상대 한 쪽에 보낼 금액을 역산한다', () => {
    // N = 28억 5천만, 상대에게 floor(100N / (2×95 + 100)) = 982,758,620
    expect(
      dropPayoutMeso({
        priceState: 'entered',
        priceMeso: 3_000_000_000,
        priceShare: 3,
        priceMyShare: 2,
        saleFeePercent: 5,
        splitFeePercent: 5,
      }),
    ).toBe(1_867_241_380)
  })

  it('분배 수수료가 없으면 판매 수수료를 뗀 금액을 나눈다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 1_000_000_000, priceShare: 2, saleFeePercent: 5, splitFeePercent: null }),
    ).toBe(475_000_000)
  })

  it('두 칸이 다 비면 옛 식 그대로다. 칸을 더해도 옛 기록의 금액이 안 움직인다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 10_000_000_000, priceShare: 3, saleFeePercent: null, splitFeePercent: null }),
    ).toBe(3_333_333_333)
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

  // 단위 나눗셈이 음수에서 0개로 떨어져 글자가 통째로 비어 있었다. 에픽던전 리워드의 주화
  // 판매가를 빼면 시세가 높은 날 합계가 음수가 된다.
  it('음수는 부호를 붙여 접는다. 빈 글자가 되지 않는다', () => {
    expect(formatMesoUnits(-85_000_000)).toBe('-8500만')
    expect(formatMesoUnits(-1_234_567_890_000)).toBe('-1조 2345억 6789만')
  })

  it('비어 있는 자리는 건너뛴다. "32억 0만" 을 만들지 않는다', () => {
    expect(formatMesoUnits(3_200_000_000)).toBe('32억')
    expect(formatMesoUnits(5_000)).toBe('5000')
  })

  // 단위가 붙는 자리가 **천 단위로 떨어지면** 접는다. `5,000만` 보다
  // `5천만` 이 한 번에 읽힌다. 큰 숫자가 이 서식으로 서므로 자릿수를 눈으로 세지 않게 된다.
  it('천 단위로 떨어지면 `천` 으로 접는다', () => {
    expect(formatMesoUnits(850_000_000)).toBe('8억 5천만')
    expect(formatMesoUnits(500_000_000_000)).toBe('5천억')
  })

  // 단위가 안 붙는 **나머지**에는 안 접는다. `1만 5천` 은 15,000 과 5,000 이 헷갈린다.
  it('나머지는 접지 않는다', () => {
    expect(formatMesoUnits(15_000)).toBe('1만 5000')
  })

  // 조·억·만 세 자리는 각각 9999 를 못 넘어 콤마가 필요 없다. 단위가 이미 자릿수를 끊는다.
  it('단위가 붙는 자리에는 콤마를 안 넣는다', () => {
    expect(formatMesoUnits(123_456_789)).toBe('1억 2345만 6789')
  })

  // 조 자리만 위가 안 막혀 있다. 거기서는 콤마가 자릿수를 읽게 해 준다.
  it('조 자리가 다섯 자리를 넘으면 콤마를 넣는다', () => {
    expect(formatMesoUnits(12_345_000_000_000_000)).toBe('12,345조')
  })
})

/**
 * 좁은 자리에 넣는 축약 금액. 72px 타일의 알약이 쓴다.
 *
 * 여기서 지키는 것은 **안 받은 돈을 받은 것처럼 안 적는가**다. 올리면 그렇게 된다.
 */
describe('formatMesoCompact', () => {
  it('가장 큰 단위 하나에 소수 첫째 자리까지 적는다', () => {
    expect(formatMesoCompact(3_250_000_000)).toBe('32.5억')
    expect(formatMesoCompact(1_000_000_000)).toBe('10억')
    expect(formatMesoCompact(100_000_000)).toBe('1억')
  })

  it('만 단위도 같은 규칙이다', () => {
    expect(formatMesoCompact(10_000_000)).toBe('1000만')
    expect(formatMesoCompact(12_340_000)).toBe('1234만')
    expect(formatMesoCompact(15_000)).toBe('1.5만')
  })

  it('조 단위까지 올라간다', () => {
    expect(formatMesoCompact(1_000_000_000_000)).toBe('1조')
    expect(formatMesoCompact(1_250_000_000_000)).toBe('1.2조')
  })

  /** 올리면 안 받은 돈을 받은 것처럼 적는다. */
  it('소수 둘째 자리는 버린다', () => {
    expect(formatMesoCompact(325_000_000)).toBe('3.2억')
    expect(formatMesoCompact(399_000_000)).toBe('3.9억')
  })

  it('만 미만은 단위 없이 그대로다', () => {
    expect(formatMesoCompact(9_999)).toBe('9999')
    expect(formatMesoCompact(0)).toBe('0')
  })
})

// 비율로 나눈 드롭에 `÷ N인` 을 적으면 화면이 금액과 다른 말을 한다. 그 드롭은 인원으로 안 나눴다.
describe('dropSplitLabel', () => {
  it('균등이면 인원을 적는다', () => {
    expect(dropSplitLabel({ priceState: 'entered', priceMeso: 100, priceShare: 4 })).toBe('4인')
  })

  it('비율이면 내 몫을 백분율로 적는다', () => {
    expect(dropSplitLabel({ priceState: 'entered', priceMeso: 100, priceShare: 4, priceMyShare: 3 })).toBe('75%')
  })

  // 0 을 1 로 접으면 `10인` 이 서서 안 받은 몫을 균등으로 나눈 것처럼 읽힌다(사용자가 잡았다).
  it('내 비율이 0 이면 0% 로 적는다. 인원으로 안 적는다', () => {
    expect(dropSplitLabel({ priceState: 'entered', priceMeso: 100, priceShare: 10, priceMyShare: 0 })).toBe('0%')
  })

  it('안 나눈 드롭은 적을 것이 없다', () => {
    expect(dropSplitLabel({ priceState: 'entered', priceMeso: 100, priceShare: 1 })).toBeNull()
    expect(dropSplitLabel({ priceState: 'entered', priceMeso: 100, priceShare: 3, priceMyShare: 3 })).toBeNull()
  })

  it('값을 안 매긴 드롭도 적을 것이 없다. 정해진 값처럼 읽힌다', () => {
    expect(dropSplitLabel({ priceState: null, priceShare: 4 })).toBeNull()
  })
})

// 보내는 쪽이 수수료를 문다. 몫이 작은 쪽이 보내면 큰 금액에 수수료가 붙어 둘 다 손해다.
describe('비율에서 보내는 쪽은 몫이 큰 쪽이다', () => {
  const 백억 = 10_000_000_000

  it('내 몫이 작으면 상대가 보낸 것으로 센다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 백억, priceShare: 4, priceMyShare: 1, splitFeePercent: 3 }),
    ).toBe(2_480_818_414)
  })

  it('내 몫이 크면 내가 보낸 것으로 센다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 백억, priceShare: 4, priceMyShare: 3, splitFeePercent: 3 }),
    ).toBe(7_442_455_243)
  })

  // 반반은 어느 쪽이 보내든 같은 값이다.
  it('반반이면 방향이 갈리지 않는다', () => {
    expect(
      dropPayoutMeso({ priceState: 'entered', priceMeso: 백억, priceShare: 2, priceMyShare: 1, splitFeePercent: 3 }),
    ).toBe(4_923_857_869)
  })
})
