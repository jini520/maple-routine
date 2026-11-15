// 파티 분배 비율의 계산.
//
// 이 파일이 지키는 것은 숫자 하나가 아니라 **불변식 둘**이다.
// ① 비율이 균등이면 값이 `floor(가격 / 인원)` 과 한 메소도 안 다르다. 비율을 안 쓰는 파티와 옛
//    기록의 금액이 이 기능 때문에 움직이면 안 된다.
// ② 두 쪽의 몫을 더하면 수수료를 뺀 총액이 된다. 돈이 새거나 생기지 않는다. 화면은 오가는
//    금액을 안 적으므로 **이 합이 수수료가 어디로 갔는지 말하는 유일한 자리**다.
// ③ **파티 인원이 값을 안 흔든다.** 비율은 `나 : 나머지` 라 두 쪽이고, 몇 명이 그 나머지를
//    이루는지는 내 몫에도 송금액에도 안 쓰인다.

import {
  acceptSharePercentText,
  crystalPayoutMeso,
  formatSharePercent,
  formatShareRatio,
  parseShares,
  sharePercentText,
  sharesFromPercentText,
  type PartyShares,
} from '../party-shares'

/** 균등 분배. 비율을 안 쓰는 파티가 이 값을 쓴다. */
const EVEN: PartyShares = { myShare: null, sharesTotal: null, splitFeePercent: null }

describe('parseShares: 저장 칸 셋을 계산이 쓰는 모양으로', () => {
  it('둘 다 NULL 이면 균등이다', () => {
    expect(parseShares(EVEN)).toEqual({ myShare: 1, sharesTotal: 2, splitFeePercent: 3, isEven: true })
  })

  it('수수료율을 안 적었으면 3 이다', () => {
    expect(parseShares({ myShare: 2, sharesTotal: 3, splitFeePercent: null }).splitFeePercent).toBe(3)
  })

  it('반반이면 균등으로 본다. 1:1 은 오갈 것이 없다', () => {
    expect(parseShares({ myShare: 2, sharesTotal: 4, splitFeePercent: 3 }).isEven).toBe(true)
  })

  // 이 몫을 하나도 안 갖는 약속이다. 균등으로 읽으면 안 받은 돈을 받은 것으로 센다.
  it('내 비율 0 은 균등이 아니다', () => {
    expect(parseShares({ myShare: 0, sharesTotal: 3, splitFeePercent: 3 })).toEqual({
      myShare: 0,
      sharesTotal: 3,
      splitFeePercent: 3,
      isEven: false,
    })
  })

  it('한쪽만 적힌 행은 균등으로 읽는다. 반쯤 쓰다 만 값으로 금액을 세지 않는다', () => {
    expect(parseShares({ myShare: 2, sharesTotal: null, splitFeePercent: null }).isEven).toBe(true)
    expect(parseShares({ myShare: null, sharesTotal: 3, splitFeePercent: null }).isEven).toBe(true)
  })
})

describe('crystalPayoutMeso: 결정석에서 내가 쥐는 메소', () => {
  // 사용자가 확인한 값이다(2026-09-21). 30억을 2인이 2:1 로 나누고 송금 수수료 3%.
  it('30억 · 2:1 · 3% 에서 받는 쪽은 1,989,898,989 다', () => {
    expect(crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 3 })).toBe(
      1_989_898_989,
    )
  })

  it('같은 파티에서 보내는 쪽은 994,949,494 다', () => {
    expect(crystalPayoutMeso(3_000_000_000, 2, { myShare: 1, sharesTotal: 3, splitFeePercent: 3 })).toBe(
      994_949_494,
    )
  })

  // 불변식 ②. 합이 30억이 아닌 것은 수수료가 그만큼 사라졌기 때문이다.
  it('둘의 합은 수수료를 뺀 총액이다. 돈이 생기지 않는다', () => {
    const 받는쪽 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 3 })
    const 보내는쪽 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 1, sharesTotal: 3, splitFeePercent: 3 })
    expect(받는쪽 + 보내는쪽).toBe(2_984_848_483)
    expect(받는쪽 + 보내는쪽).toBeLessThan(3_000_000_000)
  })

  it('약속한 비율대로 갈린다. 받는 쪽이 보내는 쪽의 두 배다', () => {
    const 받는쪽 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 3 })
    const 보내는쪽 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 1, sharesTotal: 3, splitFeePercent: 3 })
    // 내림으로 한 메소가 흔들린다. 그 폭 안에서 2:1 이다.
    expect(Math.abs(받는쪽 - 보내는쪽 * 2)).toBeLessThanOrEqual(2)
  })

  // 불변식 ①. 이 기능이 옛 기록을 안 건드린다는 보증이다.
  it('비율이 균등이면 floor(가격 / 인원) 과 같다', () => {
    for (const partySize of [1, 2, 3, 4, 5, 6]) {
      for (const price of [3_000_000_000, 1_234_567_891, 7, 0]) {
        expect(crystalPayoutMeso(price, partySize, EVEN)).toBe(Math.floor(price / partySize))
      }
    }
  })

  it('반반으로 적으면 균등이다. 파티 인원으로 나눈 값이 된다', () => {
    expect(crystalPayoutMeso(3_000_000_000, 3, { myShare: 2, sharesTotal: 4, splitFeePercent: 5 })).toBe(
      Math.floor(3_000_000_000 / 3),
    )
  })

  // 불변식 ③. 비율을 쓰면 인원은 식에 없다.
  it('비율이 있으면 파티 인원이 값을 안 흔든다', () => {
    const 비율 = { myShare: 2, sharesTotal: 3, splitFeePercent: 3 }
    const 값들 = [1, 2, 3, 4, 5, 6].map((partySize) => crystalPayoutMeso(3_000_000_000, partySize, 비율))
    expect(new Set(값들).size).toBe(1)
    expect(값들[0]).toBe(1_989_898_989)
  })

  it('수수료율 5% 는 3% 보다 적게 남긴다. 보내는 쪽이 더 문다', () => {
    const 삼 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 3 })
    const 오 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 5 })
    expect(오).toBeLessThan(삼)
  })

  // 경매장을 안 거치는 약속. 차액을 그대로 보내니 잃는 것이 없다.
  it('수수료가 0 이면 약속한 비율 그대로다. 합이 가격과 같다', () => {
    const 받는쪽 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 0 })
    const 보내는쪽 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 1, sharesTotal: 3, splitFeePercent: 0 })

    expect(받는쪽).toBe(2_000_000_000)
    expect(보내는쪽).toBe(1_000_000_000)
    expect(받는쪽 + 보내는쪽).toBe(3_000_000_000)
  })

  // `??` 는 0 을 안 걸러야 한다. `||` 였으면 0 이 3 으로 바뀌어 조용히 수수료를 문다.
  it('수수료 0 과 안 적은 것은 다르다', () => {
    const 영 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 0 })
    const 안적음 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: null })

    expect(영).toBeGreaterThan(안적음)
  })

  // 결정석을 다 넘기고 아이템만 갖는 약속.
  it('내 비율이 0 이면 한 메소도 안 쥔다', () => {
    expect(crystalPayoutMeso(3_000_000_000, 2, { myShare: 0, sharesTotal: 3, splitFeePercent: 3 })).toBe(0)
  })

  it('다 넘긴 쪽의 상대는 수수료만 뗀 전액을 쥔다', () => {
    const 다가짐 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 3, sharesTotal: 3, splitFeePercent: 3 })
    const 안가짐 = crystalPayoutMeso(3_000_000_000, 2, { myShare: 0, sharesTotal: 3, splitFeePercent: 3 })

    // 내 절반은 그대로, 상대가 보낸 절반에서만 수수료가 빠진다.
    expect(다가짐).toBe(1_500_000_000 + 1_500_000_000 - 45_000_000)
    expect(다가짐 + 안가짐).toBe(2_955_000_000)
  })

  // 친 % 는 비율 합 100000 으로 담긴다. 그 합과 큰 가격을 곱하면 중간값이 안전 정수를 넘어,
  // 부동소수로 세면 내림이 한 메소 어긋난다(이 값은 부동소수 셈이 8,366,702,264,779 를 낸다).
  it('비율 합 100000 과 큰 가격에서도 한 메소도 어긋나지 않는다', () => {
    expect(crystalPayoutMeso(9_071_425_049_121, 2, { myShare: 93_452, sharesTotal: 100_000, splitFeePercent: 3 })).toBe(
      8_366_702_264_778,
    )
  })

  // 불변식 ②. 비율 합이 커져도 두 쪽의 합은 수수료를 뺀 총액이다.
  it('85% 와 15% 의 합은 보낸 금액의 수수료만 뺀 총액이다', () => {
    const 받는쪽 = crystalPayoutMeso(6_000_000_000, 2, { myShare: 85_000, sharesTotal: 100_000, splitFeePercent: 3 })
    const 보내는쪽 = crystalPayoutMeso(6_000_000_000, 2, { myShare: 15_000, sharesTotal: 100_000, splitFeePercent: 3 })
    expect(받는쪽).toBe(5_046_207_935)
    // 보내는 쪽은 게임이 준 절반(30억)에서 제 몫을 남기고 나머지를 보낸다. 사라진 돈은 그 송금의 3% 다.
    // 내림 두 번으로 두 메소까지 흔들린다.
    const 사라진돈 = 6_000_000_000 - (받는쪽 + 보내는쪽)
    expect(Math.abs(사라진돈 - (3_000_000_000 - 보내는쪽) * 0.03)).toBeLessThanOrEqual(2)
  })
})

describe('formatSharePercent: 내 몫을 백분율로', () => {
  // 사용자가 셋째 자리까지 칠 수 있으므로 친 값을 그대로 보이려면 셋째 자리까지 적어야 한다.
  it('소수 셋째 자리까지 적는다', () => {
    expect(formatSharePercent(2, 3)).toBe('66.667%')
    expect(formatSharePercent(1, 3)).toBe('33.333%')
    expect(formatSharePercent(3, 7)).toBe('42.857%')
    expect(formatSharePercent(33_333, 100_000)).toBe('33.333%')
  })

  it('끝의 0 은 뗀다', () => {
    expect(formatSharePercent(85_000, 100_000)).toBe('85%')
    expect(formatSharePercent(12_500, 100_000)).toBe('12.5%')
    expect(formatSharePercent(1, 8)).toBe('12.5%')
  })

  // 큰 숫자의 축약 표기(`formatMesoCompact`)와 같은 규칙이다.
  it('딱 떨어지면 소수를 안 적는다', () => {
    expect(formatSharePercent(1, 2)).toBe('50%')
    expect(formatSharePercent(3, 4)).toBe('75%')
    expect(formatSharePercent(2, 5)).toBe('40%')
  })

  // `나 : 나머지` 로 적으면 둘이 다른 값처럼 보인다. 같은 약속이다.
  it('같은 약속은 같은 글자다. 2:1 과 4:2', () => {
    expect(formatSharePercent(2, 3)).toBe(formatSharePercent(4, 6))
  })

  // 부동소수로 나누면 33.300000000000004 가 나온다.
  it('소수가 튀지 않는다', () => {
    for (let total = 2; total <= 9; total += 1) {
      for (let my = 1; my <= total; my += 1) {
        expect(formatSharePercent(my, total)).toMatch(/^\d+(\.\d{0,2}[1-9])?%$/)
      }
    }
  })
})

describe('formatShareRatio: 화면이 적는 글자', () => {
  it('균등이면 null 이다. 인원만 적는다', () => {
    expect(formatShareRatio(EVEN)).toBeNull()
  })

  it('내 몫을 백분율로 적는다', () => {
    expect(formatShareRatio({ myShare: 2, sharesTotal: 3, splitFeePercent: null })).toBe('66.667%')
  })

  it('0 은 0% 다. 인원으로 떨어지지 않는다', () => {
    expect(formatShareRatio({ myShare: 0, sharesTotal: 3, splitFeePercent: null })).toBe('0%')
  })

  it('나머지가 여럿이어도 한 쪽으로 본다', () => {
    expect(formatShareRatio({ myShare: 3, sharesTotal: 5, splitFeePercent: null })).toBe('60%')
  })
})

describe('crystalPayoutMeso: 분배 방식 `제외`', () => {
  // 결정석을 팔지 않은 처치다. 숨겨 둔 분배가 무엇이든 받은 메소가 없다.
  it('균등이든 비율이든 내 몫이 0 이다', () => {
    expect(crystalPayoutMeso(1_000_000_000, 3, { ...EVEN, excluded: true })).toBe(0)
    expect(crystalPayoutMeso(1_000_000_000, 2, { myShare: 2, sharesTotal: 3, splitFeePercent: 3, excluded: true })).toBe(0)
  })

  it('`제외` 가 아니면 숨긴 분배 그대로 센다', () => {
    expect(crystalPayoutMeso(900, 3, { ...EVEN, excluded: false })).toBe(300)
  })
})

describe('sharesFromPercentText: 친 % 를 저장 칸으로', () => {
  it('% × 1000 과 100000 이 된다', () => {
    expect(sharesFromPercentText('85')).toEqual({ myShare: 85_000, sharesTotal: 100_000 })
    expect(sharesFromPercentText('100')).toEqual({ myShare: 100_000, sharesTotal: 100_000 })
    expect(sharesFromPercentText('0')).toEqual({ myShare: 0, sharesTotal: 100_000 })
  })

  // 부동소수로 33.333 × 1000 을 곱하면 33332.99… 가 되어 한 칸 어긋난다. 글자에서 바로 옮긴다.
  it('소수를 부동소수 오차 없이 옮긴다', () => {
    expect(sharesFromPercentText('33.333')?.myShare).toBe(33_333)
    expect(sharesFromPercentText('0.001')?.myShare).toBe(1)
    expect(sharesFromPercentText('4.35')?.myShare).toBe(4_350)
    expect(sharesFromPercentText('1.')?.myShare).toBe(1_000)
  })

  it('받지 않는 글자는 null 이다', () => {
    for (const text of ['', '.', '33.3333', '100.001', '101', '-1', '1a', '1.2.3']) {
      expect(sharesFromPercentText(text)).toBeNull()
    }
  })
})

describe('sharePercentText: 저장 칸을 칸에 다시 적을 글자로', () => {
  it('백분율 글자에서 % 만 뺀 것이다', () => {
    expect(sharePercentText(2, 3)).toBe('66.667')
    expect(sharePercentText(85_000, 100_000)).toBe('85')
  })

  // 칸에 다시 적은 글자를 그대로 저장해도 같은 비율이다. 옛 2/3 은 66.667 로 옮겨진다.
  it('% 로 친 값은 다시 적어도 그대로다', () => {
    for (const text of ['85', '33.333', '0.001', '100', '0']) {
      const shares = sharesFromPercentText(text)
      expect(shares).not.toBeNull()
      expect(sharePercentText(shares!.myShare, shares!.sharesTotal)).toBe(text)
    }
  })
})

describe('acceptSharePercentText: 칠 수 있는 글자만 받는다', () => {
  it('받을 수 있으면 친 글자다', () => {
    expect(acceptSharePercentText('', '8')).toBe('8')
    expect(acceptSharePercentText('8', '85')).toBe('85')
    expect(acceptSharePercentText('33', '33.')).toBe('33.')
    expect(acceptSharePercentText('33.33', '33.333')).toBe('33.333')
    expect(acceptSharePercentText('10', '100')).toBe('100')
    expect(acceptSharePercentText('85', '')).toBe('')
  })

  it('넷째 자리 · 100 초과 · 숫자가 아닌 글자는 앞 글자로 남는다', () => {
    expect(acceptSharePercentText('33.333', '33.3333')).toBe('33.333')
    expect(acceptSharePercentText('85', '851')).toBe('85')
    expect(acceptSharePercentText('100', '100.5')).toBe('100')
    expect(acceptSharePercentText('1', '1a')).toBe('1')
    expect(acceptSharePercentText('1.2', '1.2.')).toBe('1.2')
  })

  // 앞자리 0 은 걷는다. `05` 는 5 다. 소수점으로 시작하면 0 을 붙인다.
  it('앞자리 0 을 걷고, 소수점으로 시작하면 0 을 붙인다', () => {
    expect(acceptSharePercentText('0', '05')).toBe('5')
    expect(acceptSharePercentText('', '.')).toBe('0.')
    expect(acceptSharePercentText('0', '0.')).toBe('0.')
  })
})
