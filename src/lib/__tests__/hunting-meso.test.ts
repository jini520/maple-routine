import {
  MESO_BOOSTS,
  appliedMesoRatePercent,
  boostMultiplierOf,
  MINUTES_PER_SOJAE,
  MISSED_MOB_OPTIONS,
  boostPercentOf,
  efficiencyPercentOf,
  huntingMesoOf,
  huntingTotalOf,
  levelPenaltyPercent,
} from '../hunting-meso'
import { getItemIconUrlByFile } from '../asset-lookup'

/** 사용자가 준 예시의 맵 — 「밤의 길 3」(탈라하트, 40마리, lv.294). */
const NIGHT_ROAD_3 = { name: '밤의 길 3', force: 700, mobs: 40, levels: [294] } as const
/** 레벨이 둘인 맵 — 「풍화된 기쁨과 분노의 땅」(소멸의 여로). */
const TWO_LEVEL_MAP = { name: '풍화된 기쁨과 분노의 땅', force: 30, mobs: 29, levels: [200, 201] } as const

/** 34마리 맵 — 반올림이 실제로 일어나는 자리다(33/34 = 97.06%). */
const ODIUM_1 = { name: '성문으로 가는 길 1', force: 130, mobs: 34, levels: [270] } as const

const BASE = {
  characterLevel: null,
  missedMobs: 0,
  boostPercent: 0,
  boostMultiplier: 1,
  sojae: 2,
} as const

describe('levelPenaltyPercent', () => {
  it('레벨 차이가 10 이하면 페널티가 없다 — 방향 무관', () => {
    expect(levelPenaltyPercent(200, 200)).toBe(0)
    expect(levelPenaltyPercent(200, 210)).toBe(0)
    expect(levelPenaltyPercent(210, 200)).toBe(0)
  })

  describe('몬스터가 높을 때 — 11부터 -3%씩, 21부터 -5%씩', () => {
    it.each([
      [11, 3],
      [15, 15],
      [20, 30],
      [21, 35],
      [34, 100],
    ])('차이 %i → -%i%%', (diff, percent) => {
      expect(levelPenaltyPercent(200, 200 + diff)).toBe(percent)
    })

    it('34 를 넘으면 -100% 에 머문다 — 표 밖으로 안 넘어간다', () => {
      expect(levelPenaltyPercent(200, 235)).toBe(100)
      expect(levelPenaltyPercent(200, 300)).toBe(100)
    })
  })

  describe('몬스터가 낮을 때 — 11부터 -2%씩, 21부터 고르지 않은 표', () => {
    it.each([
      [11, 2],
      [20, 20],
      [21, 25],
      [22, 31],
      [23, 38],
      [24, 46],
      [25, 55],
      [26, 65],
      [27, 76],
      // 여기서 감소폭이 -11 → -8 로 **내려간다**. 규칙이 아니라 게임의 표가 그렇다.
      [28, 84],
      [29, 97],
      [30, 100],
    ])('차이 %i → -%i%%', (diff, percent) => {
      expect(levelPenaltyPercent(200 + diff, 200)).toBe(percent)
    })

    it('30 을 넘으면 -100% 에 머문다', () => {
      expect(levelPenaltyPercent(240, 200)).toBe(100)
    })
  })

  it('두 표 다 **정확히 -100% 에서 끝난다** — 옮겨 적다 틀리면 여기서 잡힌다', () => {
    expect(levelPenaltyPercent(200, 234)).toBe(100)
    expect(levelPenaltyPercent(200, 233)).toBe(95)
    expect(levelPenaltyPercent(230, 200)).toBe(100)
    expect(levelPenaltyPercent(229, 200)).toBe(97)
  })
})

describe('huntingMesoOf', () => {
  it('사용자가 준 예시를 그대로 낸다 — 290레벨 40마리 1시간 = 41,760,000', () => {
    const meso = huntingMesoOf({
      ...BASE,
      ground: { name: '가상', force: 0, mobs: 40, levels: [290] },
    })
    expect(meso).toBe(41_760_000)
  })

  it('소재는 30분이다 — 하나면 절반이고 넷이면 두 배다', () => {
    const one = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, sojae: 1 })
    const two = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, sojae: 2 })
    const four = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, sojae: 4 })
    expect(MINUTES_PER_SOJAE).toBe(30)
    expect(two).toBe(one * 2)
    expect(four).toBe(two * 2)
  })

  it('소재가 0 이면 0 이다 — 안 사냥한 시간에 메소가 나오지 않는다', () => {
    expect(huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, sojae: 0 })).toBe(0)
  })

  it('놓친 마릿수만큼 덜 잡는다 — 40마리에서 둘을 놓치면 38/40 이다', () => {
    const full = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })
    const missedTwo = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, missedMobs: 2 })
    expect(missedTwo).toBe(Math.floor((full * 38) / 40))
  })

  /**
   * **반올림은 라벨에만** 한다([[ADR-175]] 결정 3). 34마리에서 하나를 놓치면 세그먼트는 「97%」로
   * 적히지만 곱하는 것은 33/34(=97.06%)다 — «33마리를 잡았다» 가 실제로 일어난 일이라, 표시하려고
   * 자른 값으로 돈을 세면 세그먼트 글자가 계산을 끌고 다니게 된다.
   */
  it('반올림한 퍼센트가 아니라 **실제 분수**로 곱한다', () => {
    const meso = huntingMesoOf({ ...BASE, ground: ODIUM_1, missedMobs: 1, sojae: 1 })
    const base = 270 * 7.5 * 34 * 8 * 30

    expect(efficiencyPercentOf(34, 1)).toBe(97) // 라벨은 97%
    expect(meso).toBe((base * 33) / 34) // 셈은 33/34
    expect(meso).not.toBe(Math.floor(base * 0.97))
  })

  /**
   * **재획비만 통 밖이다**([[ADR-177]] 정정 1, 사용자 지정 2026-08-28).
   *
   *   (기본 100% + 템메획 + 유니온의 부 + 어빌/유니온/스킬) × 재획비(1.2배)
   *
   * [[ADR-175]] 결정 3 은 둘을 한 통에 넣어 ×1.7 을 냈는데, 재획비는 **합산 결과 전체에** 곱하는
   * 것이라 유니온의 부만 켠 150% 에 1.2 가 걸려 **×1.8** 이 된다.
   */
  it('유니온의 부는 통 안, 재획비는 통 밖이다 — 둘 다 켜면 ×1.8', () => {
    const base = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })
    const both = huntingMesoOf({
      ...BASE,
      ground: NIGHT_ROAD_3,
      boostPercent: 50,
      boostMultiplier: 1.2,
    })
    expect(both).toBe(Math.floor(base * 1.5 * 1.2))
    // [[ADR-175]] 가 내던 값이다 — 정정으로 갈렸다.
    expect(both).not.toBe(Math.floor(base * 1.7))
  })

  it('가산끼리는 여전히 합연산이다 — 메획과 유니온의 부가 한 통이다', () => {
    const base = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })
    // 메획 149 + 유니온의 부 50 = 199 → (1 + 1.99) = ×2.99
    const additive = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, boostPercent: 199 })
    expect(additive).toBe(Math.floor(base * 2.99))
  })

  it('재획비는 **합산 결과 전체에** 곱한다 — 메획 149 + 유니온의 부 50 이면 ×3.588', () => {
    const base = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })
    const all = huntingMesoOf({
      ...BASE,
      ground: NIGHT_ROAD_3,
      boostPercent: 199,
      boostMultiplier: 1.2,
    })
    expect(all).toBe(Math.floor(base * 2.99 * 1.2))
    // 재획비를 통에 넣었을 때의 값(×3.19) 과 다르다.
    expect(all).not.toBe(Math.floor(base * 3.19))
  })

  it('캐릭터 레벨을 모르면 페널티가 없다 — 고르개가 「선택 안함」 인 상태다', () => {
    const unknown = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, characterLevel: null })
    const same = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, characterLevel: 294 })
    expect(unknown).toBe(same)
  })

  it('레벨 차이가 벌어지면 그만큼 깎인다', () => {
    const even = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, characterLevel: 294 })
    // 캐릭터 274 · 몬스터 294 → 몬스터가 20 높다 → -30%
    const under = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, characterLevel: 274 })
    expect(under).toBe(Math.floor(even * 0.7))
  })

  it('페널티가 -100% 면 0 이다', () => {
    expect(
      huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3, characterLevel: 260 }),
    ).toBe(0)
  })

  it('레벨이 둘인 맵은 **레벨마다 재서 평균**낸다 — 페널티가 레벨마다 다르기 때문이다', () => {
    // 캐릭터 221 · 몬스터 200/201 → 차이 21(-25%) 과 20(-20%). 평균 레벨 200.5 로 접으면
    // 차이가 20.5 가 되어 정수 표에 안 들어간다.
    const characterLevel = 221
    const perMinute = TWO_LEVEL_MAP.mobs * 8
    const minutes = 2 * 30
    const at200 = 200 * 7.5 * perMinute * minutes * 0.75
    const at201 = 201 * 7.5 * perMinute * minutes * 0.8
    expect(
      huntingMesoOf({ ...BASE, ground: TWO_LEVEL_MAP, characterLevel }),
    ).toBe(Math.floor((at200 + at201) / 2))
  })

  it('레벨이 하나인 맵은 평균 갈래를 안 탄다 — 곱셈 그대로다', () => {
    const perMinute = NIGHT_ROAD_3.mobs * 8
    expect(huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })).toBe(
      Math.floor(294 * 7.5 * perMinute * 60),
    )
  })

  it('**언제나 정수**를 낸다 — 메소에 소수점은 없다', () => {
    // 레벨 계수 7.5 와 평균 갈래가 소수를 만들 수 있는 자리다. 실제 값으로는 8젠·30분이 늘
    // 걷어 가지만(그래서 이 단언이 통과한다) 내림은 그 사실에 기대지 않는다.
    for (const missedMobs of MISSED_MOB_OPTIONS) {
      // 메획이 든 통도 훑는다 — 149 처럼 큰 값이 실제로 들어온다([[ADR-177]]).
      for (const boostPercent of [0, 20, 50, 70, 149, 199]) {
        // 통 밖의 배율 축([[ADR-177]] 정정 1) — 1.2 가 소수를 새로 만든다.
        for (const boostMultiplier of [1, 1.2]) {
          for (const characterLevel of [null, 200, 221, 294]) {
            for (const ground of [NIGHT_ROAD_3, TWO_LEVEL_MAP, ODIUM_1]) {
              const meso = huntingMesoOf({
                ground,
                characterLevel,
                missedMobs,
                boostPercent,
                boostMultiplier,
                sojae: 3,
              })
              expect(Number.isInteger(meso)).toBe(true)
              expect(meso).toBeGreaterThanOrEqual(0)
            }
          }
        }
      }
    }
  })
})

describe('huntingTotalOf', () => {
  it('합계는 **메소 + 조각 × 개당 가격**이다', () => {
    const meso = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })
    expect(
      huntingTotalOf({ ...BASE, ground: NIGHT_ROAD_3, fragments: 12, fragmentPrice: 8_000_000 }),
    ).toBe(meso + 96_000_000)
  })

  it('조각을 안 넣으면 메소뿐이다', () => {
    const meso = huntingMesoOf({ ...BASE, ground: NIGHT_ROAD_3 })
    expect(
      huntingTotalOf({ ...BASE, ground: NIGHT_ROAD_3, fragments: 0, fragmentPrice: 8_000_000 }),
    ).toBe(meso)
  })

  it('사냥터를 아직 안 골랐으면 조각 값만 선다 — 계산기가 반쯤 찬 상태다', () => {
    expect(
      huntingTotalOf({ ...BASE, ground: null, fragments: 3, fragmentPrice: 1_000_000 }),
    ).toBe(3_000_000)
  })
})

describe('boostPercentOf — 통 **안**의 것만 더한다', () => {
  it('가산 아이템의 %를 더한다', () => {
    expect(boostPercentOf([])).toBe(0)
    expect(boostPercentOf(['union'])).toBe(50)
    expect(boostPercentOf(['union', 'potion'])).toBe(50)
  })

  it('재획비는 여기 안 든다 — 통 밖에서 곱한다([[ADR-177]] 정정 1)', () => {
    expect(boostPercentOf(['potion'])).toBe(0)
  })

  it('모르는 id 는 0 으로 친다 — 옛 기록이 지운 아이템을 들고 있을 수 있다', () => {
    expect(boostPercentOf(['union', 'gone'])).toBe(50)
  })
})

describe('boostMultiplierOf — 통 **밖**의 것만 곱한다', () => {
  it('아무것도 안 켜면 1 이다 — 곱해도 값이 안 변한다', () => {
    expect(boostMultiplierOf([])).toBe(1)
    expect(boostMultiplierOf(['union'])).toBe(1)
  })

  it('재획비는 1.2 배다', () => {
    expect(boostMultiplierOf(['potion'])).toBe(1.2)
    expect(boostMultiplierOf(['union', 'potion'])).toBe(1.2)
  })

  it('모르는 id 는 1 로 친다', () => {
    expect(boostMultiplierOf(['gone'])).toBe(1)
  })
})

describe('appliedMesoRatePercent — 화면에 적히는 증가량', () => {
  it('아무것도 안 켜면 캐릭터 메획 그대로다', () => {
    expect(appliedMesoRatePercent(149, 1)).toBe(149)
    expect(appliedMesoRatePercent(0, 1)).toBe(0)
  })

  it('가산은 그대로 더해진다 — 메획 149 + 유니온의 부 50', () => {
    expect(appliedMesoRatePercent(199, 1)).toBe(199)
  })

  it('곱셈은 **기본 100% 를 포함해** 걸린다 — 재획비만 켜면 198%', () => {
    // (100 + 149) × 1.2 = 298.8 → 298 − 100
    expect(appliedMesoRatePercent(149, 1.2)).toBe(198)
  })

  it('둘 다 켜면 258% 다 — (100+149+50)×1.2 = 358.8', () => {
    expect(appliedMesoRatePercent(199, 1.2)).toBe(258)
  })

  it('**소수점은 버린다** — 반올림이 아니다', () => {
    // 358.8 은 259 로 오르지 않는다.
    expect(appliedMesoRatePercent(199, 1.2)).toBe(258)
    // (100+0)×1.2 = 120 → 20 (딱 떨어지는 자리)
    expect(appliedMesoRatePercent(0, 1.2)).toBe(20)
  })

  it('부동소수가 1 을 깎지 않는다 — 가산 전 구간을 훑는다', () => {
    for (let boostPercent = 0; boostPercent <= 400; boostPercent += 1) {
      // 정수 연산으로 낸 참값과 같아야 한다.
      const exact = Math.floor(((100 + boostPercent) * 12) / 10) - 100
      expect(appliedMesoRatePercent(boostPercent, 1.2)).toBe(exact)
    }
  })
})

describe('efficiencyPercentOf', () => {
  it('조각은 다섯이고 **안 놓치는 것**이 첫 조각이다', () => {
    expect(MISSED_MOB_OPTIONS).toEqual([0, 1, 2, 3, 4])
  })

  /**
   * 효율은 **맵마다 다르다**([[ADR-175]] 결정 3, 사용자 지정 2026-08-28) — 40마리에서 하나를
   * 놓치는 것과 22마리에서 하나를 놓치는 것은 같은 손해가 아니다.
   */
  it.each([
    [40, [100, 98, 95, 93, 90]],
    [34, [100, 97, 94, 91, 88]],
    [22, [100, 95, 91, 86, 82]],
    [22, [100, 95, 91, 86, 82]],
  ])('%i마리 맵의 조각 다섯', (mobs, expected) => {
    expect(MISSED_MOB_OPTIONS.map((missed) => efficiencyPercentOf(mobs, missed))).toEqual(expected)
  })

  it('**소수 첫째자리에서 반올림**한다 — 라벨은 언제나 정수다', () => {
    expect(efficiencyPercentOf(40, 1)).toBe(98) // 97.5 → 98
    expect(efficiencyPercentOf(34, 2)).toBe(94) // 94.12 → 94
    expect(efficiencyPercentOf(22, 2)).toBe(91) // 90.91 → 91
  })
})

describe('표', () => {

  it('아이템은 둘이고 값·거는 자리는 사용자 확정분이다 ([[ADR-006]])', () => {
    // **`kind` 가 곧 계산식의 자리**다 — 유니온의 부는 합산 통 안, 재획비는 그 결과에 곱한다.
    expect(MESO_BOOSTS.map((each) => [each.id, each.percent, each.kind])).toEqual([
      ['union', 50, 'additive'],
      ['potion', 20, 'multiplier'],
    ])
  })

  // 칩이 **글자가 아니라 그림**이라([[ADR-177]] 정정 4) 파일명이 어긋나면 칩이 빈 채로 뜬다.
  it('파일명이 번들 에셋으로 실제로 풀린다 — 오타면 칩이 조용히 빈다', () => {
    for (const boost of MESO_BOOSTS) {
      expect(getItemIconUrlByFile(boost.icon)).not.toBeNull()
    }
  })

  it('아이템마다 그림 파일명이 붙어 있다', () => {
    expect(MESO_BOOSTS.map((each) => [each.id, each.icon])).toEqual([
      ['union', 'union_wealth.webp'],
      ['potion', 'wealth_acquisition_potion_small.webp'],
    ])
  })
})
