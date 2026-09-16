// 지출 참조표를 **읽는 쪽**.
//
// 파일의 **형태**는 `data/__tests__/spend-catalog.spec.ts` 가 붙든다(사용자가 준 값 그대로인가).
// 여기서 보는 것은 **화면이 그 값을 어떻게 집어 오는가** 다. 갈래별 묶음과 환산 둘.
import {
  BASE_TIER,
  SPEND_TARIFF_PERCENT,
  buildSpendRewardName,
  findSpendChoice,
  findSpendRewardChoice,
  isOptionAxisOpen,
  legacySpendKeysOf,
  optionAxesOf,
  optionItemOf,
  pickSpendOption,
  pointToMeso,
  spendGroupsOf,
  rewardCoinMeso,
  spendRewardCoins,
  spendRewardItemKeys,
  spendRewardPrice,
  tariffMesoOf,
  withTariffMeso,
} from '../cashbook/spend-catalog'

/** 모든 항목이 서는 날. 아우룸 레기스(2026-09-17 부터)까지 든다. */
const 패치후 = '2026-09-17'

describe('spendGroupsOf: 갈래 → 묶음들', () => {
  it('사용자가 적어 준 묶음 그대로 묶는다. 앱이 다시 묶지 않는다', () => {
    const groups = spendGroupsOf('content', 패치후)

    expect(groups.map((group) => group.key)).toEqual(['epic_dungeon_bonus_reward', 'monster_park', 'quick_pass'])
    expect(groups.map((group) => group.group)).toEqual([
      '에픽던전 추가 리워드',
      '몬스터 파크',
      '퀵 패스',
    ])
  })

  // **단계가 여럿인 항목은 대표 하나로 접힌다**. 목록에 여덟이 서면
  // 그 여덟이 실은 넷 × 두 단계라는 사실이 화면에서 사라진다.
  it('같은 대표는 한 칸으로 접힌다. 여덟이 넷이 된다', () => {
    const [first] = spendGroupsOf('content', 패치후)

    expect(first.choices.map((choice) => choice.key)).toEqual([
      'high_mountain',
      'angler_company',
      'nightmare_paradise',
      'aurum_regis',
    ])
    expect(first.choices.map((choice) => choice.label)).toEqual([
      '하이마운틴',
      '앵글러 컴퍼니',
      '악몽선경',
      '아우룸 레기스',
    ])
  })

  it('접힌 칸이 자기 단계들을 그대로 든다', () => {
    const [first] = spendGroupsOf('content', 패치후)

    expect(first.choices[0].items.map((item) => item.tier)).toEqual(['1단계', '2단계'])
    expect(first.choices[0].items.map((item) => item.unitPrice)).toEqual([7_500, 30_000])
  })

  it('단계가 없는 항목은 자기 이름이 곧 칸 이름이다', () => {
    const [, monsterPark] = spendGroupsOf('content', 패치후)

    expect(monsterPark.choices.map((choice) => choice.label)).toEqual(['몬스터 파크'])
    expect(monsterPark.choices[0].items).toHaveLength(1)
  })

  it('목록 갈래 넷이 마흔다섯을 나눠 갖는다. 접혀도 항목 수는 그대로다', () => {
    const counted = (['content', 'event_bm', 'buff', 'scroll'] as const).map((category) =>
      spendGroupsOf(category, 패치후).reduce(
        (sum, group) => sum + group.choices.reduce((n, choice) => n + choice.items.length, 0),
        0,
      ),
    )

    // 보약 버프 둘이 `버프` 에서 `이벤트·BM` 으로 옮겨갔다. 아우룸 레기스 둘과 주문서 열아홉은
    // 2026-09-11 사용자 제공분이다.
    expect(counted).toEqual([12, 10, 4, 19])
    expect(counted.reduce((sum, count) => sum + count, 0)).toBe(45)
  })

  // 직접 입력 둘은 목록이 없다. 빈 배열이지 예외가 아니다.
  it('직접 입력 갈래는 묶음이 없다', () => {
    expect(spendGroupsOf('item_purchase', 패치후)).toEqual([])
    expect(spendGroupsOf('etc', 패치후)).toEqual([])
  })

  /**
   * **`버프` 는 이제 메소뿐**이다. 메포짜리 보약 둘이
   * 이벤트·BM 으로 옮겨가고 영약 넷만 남았다.
   *
   * 통화가 둘인 목록 갈래는 이제 이벤트·BM 이다. 그 갈래 안에서도 항목이 통화를 안다는
   * 계약이 그대로 서 있는지를 여기서 본다.
   */
  it('갈래 안에서 통화가 갈리는 자리가 있다. 항목이 안다', () => {
    const 버프 = new Set(
      spendGroupsOf('buff', 패치후).flatMap((group) =>
        group.choices.flatMap((choice) => choice.items.map((item) => item.currency)),
      ),
    )
    expect(버프).toEqual(new Set(['meso']))

    const 이벤트 = new Set(
      spendGroupsOf('event_bm', 패치후).flatMap((group) =>
        group.choices.flatMap((choice) => choice.items.map((item) => item.currency)),
      ),
    )
    expect(이벤트).toEqual(new Set(['point']))
  })

  // 사용자가 적어 준 묶음 차례 그대로다. 앱이 다시 묶지도, 정렬하지도 않는다.
  it('이벤트·BM 의 묶음 넷이 지정한 차례로 선다', () => {
    expect(spendGroupsOf('event_bm', 패치후).map((group) => group.group)).toEqual([
      '메이플 포인트 샵',
      '이벤트',
      'VIP 사우나',
      '기타',
    ])
  })
})

// 항목 줄이 시작 기간을 든다. 목록은 **적는 날짜**가 든 주간 기간으로 거른다. 오늘이 아니다.
describe('spendGroupsOf: 적는 날짜의 기간으로 거른다', () => {
  const 대표들 = (dateKey: string): string[] =>
    spendGroupsOf('content', dateKey).flatMap((group) => group.choices.map((choice) => choice.label))

  it('적는 날짜가 2026-09-16 이면 아우룸 레기스 타일이 없다', () => {
    expect(대표들('2026-09-16')).not.toContain('아우룸 레기스')
    expect(대표들('2026-09-16')).toContain('악몽선경')
  })

  it('적는 날짜가 2026-09-17 이면 선다. 리셋 목요일이라 그 주 전체가 같다', () => {
    expect(대표들('2026-09-17')).toContain('아우룸 레기스')
    expect(대표들('2026-09-23')).toContain('아우룸 레기스')
  })

  // 목록이 시계를 안 본다. 09-20 에 지난 날짜(09-16)로 적어도 그 날의 기간으로 거른다.
  it('오늘이 언제든 적는 날짜만 본다', () => {
    jest.useFakeTimers({ now: new Date('2026-09-20T03:00:00.000Z') })
    try {
      expect(대표들('2026-09-16')).not.toContain('아우룸 레기스')
    } finally {
      jest.useRealTimers()
    }
  })

  // 1.0.8 에서 09-17 전 날짜로 적힌 기록이 있을 수 있다. 되짚기가 거르면 수정 시트가 세부를 못 편다.
  it('기록을 되짚는 두 함수는 기간을 안 본다', () => {
    expect(findSpendChoice('content', 'aurum_regis_2')?.choice.label).toBe('아우룸 레기스')
    expect(
      findSpendRewardChoice('content', { exp: 'aurum_regis_1', sol_erda: 'aurum_regis_2' })?.tierByForm,
    ).toEqual({ exp: '1단계', sol_erda: '2단계' })
  })
})

describe('pointToMeso: 나눗셈이다', () => {
  // 시세의 단위가 **1억 메소당 메포**라 환산은 곱셈이 아니다.
  // 곱셈으로 짜면 결과가 **1억 배** 어긋난다.
  it('메포 × 1억 ÷ 시세', () => {
    expect(pointToMeso(30_000, 1_180)).toBe(2_542_372_881)
  })

  it('시세가 오르면 같은 메포가 더 적은 메소다', () => {
    expect(pointToMeso(1_000, 2_000)).toBeLessThan(pointToMeso(1_000, 1_000))
  })

  it('시세와 메포가 같은 배로 늘면 값이 그대로다', () => {
    expect(pointToMeso(600, 1_180)).toBe(pointToMeso(1_200, 2_360))
  })

  // 이 저장소의 돈 계산은 버림이 기본이다(`netProceedsMeso`· `perPersonMeso`).
  it('버린다. 올리지 않는다', () => {
    expect(pointToMeso(1, 3)).toBe(33_333_333)
  })

  it('메포가 0 이면 0 이다', () => {
    expect(pointToMeso(0, 1_180)).toBe(0)
  })

  // 어댑터가 이미 막지만(`storage/spend.ts`) 여기서도 0 을 안 나눈다. 화면이 입력 중간 상태로
  // 0 을 들고 있을 수 있고, 그때 `Infinity` 가 뜨면 금액 칸이 깨진다.
  it('시세가 0 이하면 0 이다. Infinity 를 만들지 않는다', () => {
    expect(pointToMeso(30_000, 0)).toBe(0)
    expect(pointToMeso(30_000, -1)).toBe(0)
  })
})

describe('관세. 구입가의 10% 고정', () => {
  it('요율은 카탈로그가 든다. 화면이 하드코딩하지 않는다', () => {
    expect(SPEND_TARIFF_PERCENT).toBe(10)
  })

  it('구입가의 10% 다', () => {
    expect(tariffMesoOf(850_000_000)).toBe(85_000_000)
  })

  it('버린다. `netProceedsMeso` 와 같은 방향이다', () => {
    expect(tariffMesoOf(999)).toBe(99)
  })

  // 저장은 **총액과 그 몫을 둘 다** 박는다. 집계가 한 칸만 보면 되도록.
  it('총액과 관세분을 함께 낸다', () => {
    expect(withTariffMeso(850_000_000)).toEqual({
      mesoAmount: 935_000_000,
      tariffMeso: 85_000_000,
    })
  })

  it('총액에서 관세분을 빼면 구입가다. 반올림으로 어긋나지 않는다', () => {
    for (const price of [1, 999, 1_234_567, 850_000_000]) {
      const { mesoAmount, tariffMeso } = withTariffMeso(price)
      expect(mesoAmount - tariffMeso).toBe(price)
    }
  })
})


// 적어 둔 기록으로 시트를 되채우려면 **항목 key 에서 자리를 되짚어야** 한다.
describe('findSpendChoice: 항목 key 로 대표와 단계를 되짚는다', () => {
  it('단계가 있는 항목은 대표와 그 단계를 함께 준다', () => {
    const found = findSpendChoice('content', 'high_mountain_2')

    expect(found?.choice.label).toBe('하이마운틴')
    expect(found?.item.tier).toBe('2단계')
  })

  it('단계가 없는 항목은 대표 안에 하나뿐이다', () => {
    const found = findSpendChoice('content', 'monster_park')

    expect(found?.choice.items).toHaveLength(1)
    expect(found?.item.name).toBe('몬스터 파크')
  })

  // 카탈로그가 바뀌어 못 찾는 이름이 생길 수 있다. 그때 시트가 안 열리면 안 된다
  // (대가). 못 찾음을 **값으로** 돌려주고 화면이 정한다.
  it('없는 key 는 null 이다', () => {
    expect(findSpendChoice('content', 'removed_item')).toBeNull()
    expect(findSpendChoice('content', null)).toBeNull()
  })

  // 갈래를 잘못 대면 못 찾는다. 갈래가 다른 기록이 엉뚱한 목록으로 되살아나지 않는다.
  it('갈래가 다르면 못 찾는다', () => {
    expect(findSpendChoice('buff', 'monster_park')).toBeNull()
  })

  // 카탈로그에서 이름을 바꿔도 key 는 그대로라 옛 기록이 같은 항목을 찾는다.
  it('이름이 아니라 key 로 찾는다', () => {
    expect(findSpendChoice('content', '하이마운틴 2단계')).toBeNull()
  })
})

// 에픽던전은 **형태마다 단계를 고른다**. 그 고름을 값 하나(금액)와 글자 하나(기록 이름)로
// 접는 자리가 여기다. 되짚기는 그 글자를 앱이 다시 읽는 일이라 **왕복**을 본다.
describe('형태별 단계: 값과 이름', () => {
  const 하이마운틴 = spendGroupsOf('content', 패치후)[0].choices[0]

  describe('spendRewardPrice: 고른 단계 값의 합', () => {
    // 형태마다 따로 사므로 합이다(사용자 확인 2026-09-10).
    it('둘 다 고르면 두 값을 더한다', () => {
      expect(spendRewardPrice(하이마운틴, { exp: '1단계', sol_erda: '2단계' })).toBe(37_500)
    })

    it('하나만 고르면 그 값 하나다', () => {
      expect(spendRewardPrice(하이마운틴, { exp: '2단계' })).toBe(30_000)
    })

    // 0단계는 **사는 것이 아니라 기본 보상**이라 참조표에 자리가 없다. 더할 값도 없다.
    it('0단계는 값이 없다. 둘 다 0단계면 0 이다', () => {
      expect(spendRewardPrice(하이마운틴, { exp: BASE_TIER, sol_erda: BASE_TIER })).toBe(0)
      expect(spendRewardPrice(하이마운틴, {})).toBe(0)
    })
  })

  // 추가 리워드를 사면 세라자르 주화를 받고, 그 판매가가 지출에서 빠진다(사용자 제공 2026-09-16).
  describe('spendRewardCoins: 고른 단계가 주는 주화', () => {
    // 형태마다 각각 준다. 금액이 합인 것과 같은 이유다.
    it('둘 다 고르면 두 개수를 더한다', () => {
      expect(spendRewardCoins(하이마운틴, { exp: '1단계', sol_erda: '2단계' })).toBe(12)
    })

    it('하나만 고르면 그 개수 하나다', () => {
      expect(spendRewardCoins(하이마운틴, { exp: '1단계' })).toBe(4)
    })

    // 0단계는 산 것이 아니라 받을 주화도 없다.
    it('0단계는 주화가 없다. 둘 다 0단계면 0 이다', () => {
      expect(spendRewardCoins(하이마운틴, { exp: BASE_TIER, sol_erda: BASE_TIER })).toBe(0)
      expect(spendRewardCoins(하이마운틴, {})).toBe(0)
    })

    // 주화를 안 주는 대표(몬스터 파크)는 단계를 골라도 0 이다.
    it('주화를 안 주는 대표는 0 이다', () => {
      const 몬스터파크 = spendGroupsOf('content', 패치후)[1].choices[0]

      expect(spendRewardCoins(몬스터파크, { exp: '1단계' })).toBe(0)
    })

    it('개수를 판매가로 바꾼다', () => {
      expect(rewardCoinMeso(12)).toBe(480_000_000)
      expect(rewardCoinMeso(0)).toBe(0)
    })
  })

  describe('buildSpendRewardName: 기록에 적히는 이름', () => {
    // 하루 목록의 줄 이름이 이 글자다. 기록의 이름 칸에도 그때 이름으로 남는다.
    it('고른 단계를 형태 차례대로 적는다', () => {
      expect(buildSpendRewardName(하이마운틴, { exp: '1단계', sol_erda: '2단계' })).toBe(
        '하이마운틴 EXP 1단계, 솔 2단계',
      )
    })

    it('0단계인 형태는 안 적는다', () => {
      expect(buildSpendRewardName(하이마운틴, { sol_erda: '2단계' })).toBe('하이마운틴 솔 2단계')
    })

    // 산 것이 없는 지출은 지출이 아니다. 이름이 없는 것이 곧 **저장할 수 없다** 다.
    it('아무것도 안 골랐으면 null 이다', () => {
      expect(buildSpendRewardName(하이마운틴, { exp: BASE_TIER })).toBeNull()
    })
  })

  // 기록은 이름이 아니라 형태별 항목 key 를 저장한다. 수정 시트는 그것으로 단계를 되살린다.
  describe('spendRewardItemKeys · findSpendRewardChoice: 형태별 항목 key', () => {
    it('고른 단계를 형태 key 에서 항목 key 로 적는다. 0단계는 안 적는다', () => {
      expect(spendRewardItemKeys(하이마운틴, { exp: '2단계', sol_erda: BASE_TIER })).toEqual({ exp: 'high_mountain_2' })
      expect(spendRewardItemKeys(하이마운틴, { exp: '1단계', sol_erda: '2단계' })).toEqual({
        exp: 'high_mountain_1',
        sol_erda: 'high_mountain_2',
      })
    })

    it('아무것도 안 골랐으면 null 이다', () => {
      expect(spendRewardItemKeys(하이마운틴, {})).toBeNull()
    })

    it('왕복한다. 적은 key 로 대표와 형태별 단계가 되돌아온다', () => {
      const tierByForm = { exp: '1단계', sol_erda: '2단계' }
      const found = findSpendRewardChoice('content', spendRewardItemKeys(하이마운틴, tierByForm))

      expect(found?.choice.key).toBe('high_mountain')
      expect(found?.tierByForm).toEqual(tierByForm)
    })

    // 한 조각이라도 못 찾으면 지어내지 않는다. 안 고른 단계가 골라진 채로 시트가 열리면 안 된다.
    it('모르는 형태 · 항목, 타일이 섞인 key 는 null 이다', () => {
      expect(findSpendRewardChoice('content', { exp: 'removed_item' })).toBeNull()
      expect(findSpendRewardChoice('content', { unknown: 'high_mountain_1' })).toBeNull()
      expect(findSpendRewardChoice('content', { exp: 'high_mountain_1', sol_erda: 'angler_company_1' })).toBeNull()
      expect(findSpendRewardChoice('content', { exp: 'monster_park' })).toBeNull()
      expect(findSpendRewardChoice('content', null)).toBeNull()
    })
  })
})

// 이름만 저장된 옛 기록을 key 로 옮기는 이관이 쓴다. 옛 모양이 셋이다.
describe('legacySpendKeysOf: 옛 기록의 이름에서 key', () => {
  it('항목 이름 하나면 항목 key 다', () => {
    expect(legacySpendKeysOf('content', '몬스터 파크', null)).toEqual({ itemKey: 'monster_park', formItemKeys: null })
    expect(legacySpendKeysOf('scroll', '귀 장식 공격력(운) 주문서 10%', null)).toEqual({
      itemKey: 'earring_attack_luk_scroll_10',
      formItemKeys: null,
    })
  })

  it('형태별 단계를 이어 붙인 이름은 형태별 항목 key 다', () => {
    expect(legacySpendKeysOf('content', '하이마운틴 EXP 1단계, 솔 2단계', null)).toEqual({
      itemKey: null,
      formItemKeys: { exp: 'high_mountain_1', sol_erda: 'high_mountain_2' },
    })
    expect(legacySpendKeysOf('content', '악몽선경 솔 2단계', null)).toEqual({
      itemKey: null,
      formItemKeys: { sol_erda: 'nightmare_paradise_2' },
    })
  })

  // 형태 칸이 따로 있던 시절의 행이다(`악몽선경 2단계` + `경험치`).
  it('항목 이름과 형태 칸이 따로 있는 옛 행도 형태별 항목 key 다', () => {
    expect(legacySpendKeysOf('content', '악몽선경 2단계', '경험치')).toEqual({
      itemKey: null,
      formItemKeys: { exp: 'nightmare_paradise_2' },
    })
  })

  // 못 찾은 이름은 지우지 않는다. key 만 비고 이름은 그대로 남는다.
  it('못 찾는 이름과 직접 친 이름은 둘 다 null 이다', () => {
    expect(legacySpendKeysOf('content', '없어진 항목', null)).toEqual({ itemKey: null, formItemKeys: null })
    expect(legacySpendKeysOf('content', '하이마운틴 EXP 9단계', null)).toEqual({ itemKey: null, formItemKeys: null })
    expect(legacySpendKeysOf('item_purchase', '루즈 컨트롤 머신 마크', null)).toEqual({ itemKey: null, formItemKeys: null })
    expect(legacySpendKeysOf('content', null, null)).toEqual({ itemKey: null, formItemKeys: null })
  })
})

// 줄이 둘인 주문서 타일. 항목이 축 값을 들고, 누름 한 번이 규칙 넷을 차례로 한다.
describe('축 값: 줄 둘로 항목 하나를 고른다', () => {
  const tileOf = (label: string) => {
    for (const group of spendGroupsOf('scroll', 패치후)) {
      const found = group.choices.find((choice) => choice.label === label)
      if (found !== undefined) return found
    }
    throw new Error(`${label} 타일이 없다`)
  }
  const 매지컬 = tileOf('매지컬 주문서')
  const 귀장식 = tileOf('귀 장식 주문서')

  it('줄과 값은 항목에 처음 나온 차례다', () => {
    expect(optionAxesOf(매지컬)).toEqual([
      { axis: '무기', values: ['한손무기', '두손무기'] },
      { axis: '능력치', values: ['공격력', '마력'] },
    ])
    expect(optionAxesOf(귀장식)).toEqual([
      { axis: '능력치', values: ['공격력', '마력'] },
      { axis: '스탯', values: ['힘', '민첩', '운'] },
    ])
  })

  it('축 값이 없는 타일은 줄이 없다', () => {
    expect(optionAxesOf(tileOf('놀긍'))).toEqual([])
    expect(optionAxesOf(null)).toEqual([])
  })

  it('처음에는 아무것도 안 골랐고 두 줄 모두 열려 있다', () => {
    expect(isOptionAxisOpen(귀장식, {}, '능력치')).toBe(true)
    expect(isOptionAxisOpen(귀장식, {}, '스탯')).toBe(true)
    expect(optionItemOf(귀장식, {})).toBeNull()
  })

  describe('매지컬', () => {
    it('마력을 누르면 한손무기가 골라진다. 두손무기 마력은 없다', () => {
      expect(pickSpendOption(매지컬, {}, '능력치', '마력')).toEqual({ 능력치: '마력', 무기: '한손무기' })
    })

    it('두손무기를 골라 둔 채 마력을 누르면 두손무기가 지워지고 한손무기가 골라진다', () => {
      expect(pickSpendOption(매지컬, { 무기: '두손무기', 능력치: '공격력' }, '능력치', '마력')).toEqual({
        능력치: '마력',
        무기: '한손무기',
      })
    })

    it('두손무기를 누르면 능력치가 공격력으로 바뀐다', () => {
      expect(pickSpendOption(매지컬, { 무기: '한손무기', 능력치: '마력' }, '무기', '두손무기')).toEqual({
        무기: '두손무기',
        능력치: '공격력',
      })
    })

    it('한손무기를 누르면 능력치는 그대로다. 둘 다 있다', () => {
      expect(pickSpendOption(매지컬, { 능력치: '마력' }, '무기', '한손무기')).toEqual({
        무기: '한손무기',
        능력치: '마력',
      })
      expect(pickSpendOption(매지컬, {}, '무기', '한손무기')).toEqual({ 무기: '한손무기' })
    })

    it('잠기는 줄이 없다', () => {
      const cases: Record<string, string>[] = [{}, { 무기: '두손무기', 능력치: '공격력' }, { 무기: '한손무기', 능력치: '마력' }]
      for (const picked of cases) {
        expect(isOptionAxisOpen(매지컬, picked, '무기')).toBe(true)
        expect(isOptionAxisOpen(매지컬, picked, '능력치')).toBe(true)
      }
    })
  })

  describe('귀 장식', () => {
    it('능력치 없이 힘을 누르면 공격력이 골라진다', () => {
      expect(pickSpendOption(귀장식, {}, '스탯', '힘')).toEqual({ 스탯: '힘', 능력치: '공격력' })
    })

    it('마력을 누르면 스탯이 지워지고 스탯 줄이 잠긴다', () => {
      const picked = pickSpendOption(귀장식, { 능력치: '공격력', 스탯: '운' }, '능력치', '마력')

      expect(picked).toEqual({ 능력치: '마력' })
      expect(isOptionAxisOpen(귀장식, picked, '스탯')).toBe(false)
      expect(isOptionAxisOpen(귀장식, picked, '능력치')).toBe(true)
    })

    // 사용자 확인. 마력 전에 고른 스탯을 되살리지 않는다.
    it('공격력으로 돌아오면 스탯 줄이 열리고 비어 있다', () => {
      const picked = pickSpendOption(귀장식, { 능력치: '마력' }, '능력치', '공격력')

      expect(picked).toEqual({ 능력치: '공격력' })
      expect(isOptionAxisOpen(귀장식, picked, '스탯')).toBe(true)
    })
  })

  describe('optionItemOf: 항목 하나가 정해져야 저장이 켜진다', () => {
    it('고른 값이 한 항목의 축 값과 꼭 맞으면 그 항목이다', () => {
      expect(optionItemOf(귀장식, { 능력치: '공격력', 스탯: '민첩' })?.name).toBe('귀 장식 공격력(민첩) 주문서 10%')
      expect(optionItemOf(매지컬, { 무기: '두손무기', 능력치: '공격력' })?.name).toBe(
        '매지컬 두손무기 공격력 주문서 100%',
      )
    })

    it('줄이 없는 항목은 그 줄을 안 골라도 정해진다', () => {
      expect(optionItemOf(귀장식, { 능력치: '마력' })?.name).toBe('귀 장식 마력 주문서 10%')
    })

    it('한 줄만 골라 항목이 여럿 남으면 null 이다', () => {
      expect(optionItemOf(귀장식, { 능력치: '공격력' })).toBeNull()
      expect(optionItemOf(매지컬, { 무기: '한손무기' })).toBeNull()
    })
  })

  it('수정으로 열 때 항목 key 가 항목과 축 값을 되짚는다', () => {
    const found = findSpendChoice('scroll', 'earring_attack_luk_scroll_10')

    expect(found?.choice.label).toBe('귀 장식 주문서')
    expect(found?.item.options).toEqual({ 능력치: '공격력', 스탯: '운' })
  })
})
