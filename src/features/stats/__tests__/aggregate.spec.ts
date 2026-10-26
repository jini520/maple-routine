import type { DayRecord } from '../../cashbook/records'
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import {
  bossTotalsBetween,
  categoryTotalsBetween,
  characterCategoriesBetween,
  characterTotalsBetween,
  cumulativeNet,
  totalsBetween,
  totalsSeries,
} from '../aggregate'

function incomeRecord(overrides: Partial<IncomeRecord>): IncomeRecord {
  return {
    id: 'i',
    ocid: null,
    earnedOn: '2026-09-24',
    category: 'etc',
    item: null,
    itemKey: null,
    mesoAmount: null,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    quantity: null,
    itemKind: null,
    saleFeePercent: null,
    saleFeeMeso: null,
    saleFeeAuto: false,
    hunt: null,
    recordedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  }
}

function spendRecord(overrides: Partial<SpendRecord>): SpendRecord {
  return {
    id: 's',
    ocid: null,
    spentOn: '2026-09-24',
    category: 'etc',
    item: null,
    itemKey: null,
    formItemKeys: null,
    itemKind: null,
    levelFrom: null,
    levelTo: null,
    quantity: null,
    mesoAmount: null,
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    recordedAt: '2026-09-24T00:00:00.000Z',
    ...overrides,
  } as SpendRecord
}

function income(ocid: string | null, characterName: string, overrides: Partial<IncomeRecord>): DayRecord {
  return { kind: 'income', record: incomeRecord({ ocid, ...overrides }), characterName }
}

function spend(ocid: string | null, characterName: string, overrides: Partial<SpendRecord>): DayRecord {
  return { kind: 'spend', record: spendRecord({ ocid, ...overrides }), characterName }
}

function crystal(ocid: string, characterName: string, payoutMeso: number): DayRecord {
  return {
    kind: 'bossCrystal',
    ocid,
    characterName,
    payoutMeso,
    count: 1,
    bosses: [{ bossKey: 'lucid', bossName: '루시드', difficulty: 'hard', payoutMeso }],
  }
}

function dropSale(ocid: string, characterName: string, payoutMeso: number): DayRecord {
  return {
    kind: 'dropSale',
    ocid,
    characterName,
    payoutMeso,
    count: 1,
    items: [{ itemKey: null, itemName: '루즈 컨트롤 머신 마크', payoutMeso }],
  }
}

function enhancement(characterName: string, category: 'starforce' | 'cube_reset', payoutMeso: number): DayRecord {
  return {
    kind: 'enhancement',
    category,
    characterName,
    payoutMeso,
    count: 1,
    unpricedCount: 0,
    items: [{ itemKey: null, targetItem: '아케인셰이드 투구', count: 1, costMeso: payoutMeso, unpricedCount: 0 }],
  }
}

const WEEK = { from: '2026-09-24', to: '2026-09-30' }

describe('totalsBetween', () => {
  it('범위 안의 날만 더하고 순 수익은 수입 − 지출이다', () => {
    const byDate = {
      '2026-09-23': [crystal('a', '낟낟', 999)],
      '2026-09-24': [crystal('a', '낟낟', 500), spend(null, '', { mesoAmount: 120 })],
      '2026-09-30': [enhancement('낟낟', 'starforce', 80)],
      '2026-10-01': [income(null, '', { mesoAmount: 777 })],
    }
    expect(totalsBetween(byDate, WEEK)).toEqual({ incomeMeso: 500, expenseMeso: 200, netMeso: 300 })
  })

  // 가계부와 같은 축이다. 메포는 시세로 환산해 넣고 캐시는 뺀다.
  it('메포는 시세로 환산하고 캐시는 안 센다', () => {
    const byDate = {
      '2026-09-25': [
        income(null, '', { pointAmount: 1000, pointPer100mMeso: 1000 }),
        spend(null, '', { cashAmount: 50000 }),
      ],
    }
    expect(totalsBetween(byDate, WEEK)).toEqual({ incomeMeso: 100_000_000, expenseMeso: 0, netMeso: 100_000_000 })
  })
})

describe('totalsSeries 와 cumulativeNet', () => {
  it('기간마다 합계를 내고 누적은 순 수익을 차례로 더한다', () => {
    const byDate = {
      '2026-09-17': [crystal('a', '낟낟', 100)],
      '2026-09-24': [crystal('a', '낟낟', 50), spend(null, '', { mesoAmount: 80 })],
    }
    const series = totalsSeries(byDate, [
      { from: '2026-09-17', to: '2026-09-23' },
      { from: '2026-09-24', to: '2026-09-30' },
    ])
    expect(series.map((totals) => totals.netMeso)).toEqual([100, -30])
    expect(cumulativeNet(series)).toEqual([100, 70])
  })
})

describe('characterTotalsBetween', () => {
  it('캐릭터마다 수입 · 지출 · 순 수익을 낸다', () => {
    const byDate = {
      '2026-09-24': [
        crystal('a', '낟낟', 500),
        dropSale('a', '낟낟', 100),
        income('b', '낟넘', { mesoAmount: 70 }),
        spend('b', '낟넘', { mesoAmount: 20 }),
      ],
    }
    expect(characterTotalsBetween(byDate, WEEK)).toEqual([
      { key: 'ocid:a', ocid: 'a', name: '낟낟', incomeMeso: 600, expenseMeso: 0, netMeso: 600 },
      { key: 'ocid:b', ocid: 'b', name: '낟넘', incomeMeso: 70, expenseMeso: 20, netMeso: 50 },
    ])
  })

  it('캐릭터를 고르지 않은 손입력은 뺀다', () => {
    const byDate = { '2026-09-24': [income(null, '', { mesoAmount: 70 }), spend(null, '', { mesoAmount: 20 })] }
    expect(characterTotalsBetween(byDate, WEEK)).toEqual([])
  })

  // 강화 기록은 이름만 든다. 지금 이름과 같으면 그 캐릭터에 붙고, 개명 전 이름이면 따로 선다.
  it('강화 지출은 기록의 이름으로 붙고 모르는 이름은 따로 선다', () => {
    const byDate = {
      '2026-09-24': [crystal('a', '낟낟', 500), enhancement('낟낟', 'starforce', 300), enhancement('단풍라떼', 'cube_reset', 40)],
    }
    expect(characterTotalsBetween(byDate, WEEK)).toEqual([
      { key: 'ocid:a', ocid: 'a', name: '낟낟', incomeMeso: 500, expenseMeso: 300, netMeso: 200 },
      { key: 'name:단풍라떼', ocid: null, name: '단풍라떼', incomeMeso: 0, expenseMeso: 40, netMeso: -40 },
    ])
  })
})

// today 의 이번 주 수익 위젯이 캐릭터 줄을 누르면 띄우는 항목별 금액이다. 캐릭터를 가르는 기준은
// characterTotalsBetween 과 같아야 한다. 다르면 줄의 금액과 팝오버의 합이 어긋난다.
describe('characterCategoriesBetween', () => {
  it('캐릭터마다 수입 · 지출 갈래별 합계를 큰 순서로 내고, 합은 그 캐릭터의 수입 · 지출과 같다', () => {
    const byDate = {
      '2026-09-24': [
        crystal('a', '낟낟', 500),
        dropSale('a', '낟낟', 100),
        crystal('a', '낟낟', 200),
        enhancement('낟낟', 'starforce', 300),
        income('b', '낟넘', { category: 'hunting', mesoAmount: 70 }),
        spend('b', '낟넘', { category: 'buff', mesoAmount: 20 }),
        enhancement('단풍라떼', 'cube_reset', 40),
      ],
    }
    const byKey = characterCategoriesBetween(byDate, WEEK)

    expect(byKey.get('ocid:a')).toEqual({
      income: [
        { key: 'boss_crystal', name: '보스 결정석', meso: 700 },
        { key: 'boss_drop', name: '보스 드롭', meso: 100 },
      ],
      expense: [{ key: 'enhancement:starforce', name: '스타포스', meso: 300 }],
    })
    expect(byKey.get('ocid:b')?.income.map((total) => total.key)).toEqual(['hunting'])
    expect(byKey.get('ocid:b')?.expense.map((total) => total.key)).toEqual(['buff'])
    expect(byKey.get('name:단풍라떼')?.expense.map((total) => total.meso)).toEqual([40])

    for (const row of characterTotalsBetween(byDate, WEEK)) {
      const categories = byKey.get(row.key)!
      expect(categories.income.reduce((sum, total) => sum + total.meso, 0)).toBe(row.incomeMeso)
      expect(categories.expense.reduce((sum, total) => sum + total.meso, 0)).toBe(row.expenseMeso)
    }
  })
})

describe('categoryTotalsBetween', () => {
  it('수입 갈래는 결정석 · 보스 드롭 · 손입력 갈래이고 큰 순서다. 보스 드롭과 아이템 판매는 다른 갈래다', () => {
    const byDate = {
      '2026-09-24': [
        crystal('a', '낟낟', 500),
        dropSale('a', '낟낟', 100),
        income(null, '', { category: 'item_sale', mesoAmount: 50 }),
        income(null, '', { category: 'etc', mesoAmount: 30 }),
        spend(null, '', { mesoAmount: 999 }),
      ],
    }
    expect(categoryTotalsBetween(byDate, WEEK, 'income')).toEqual([
      // 보스 결정석만 줄이 없다. 아래 보스별 수익 카드가 나눈다
      { key: 'boss_crystal', name: '보스 결정석', meso: 500 },
      {
        key: 'boss_drop',
        name: '보스 드롭',
        meso: 100,
        parts: [{ key: 'item:루즈 컨트롤 머신 마크', name: '루즈 컨트롤 머신 마크', meso: 100 }],
      },
      { key: 'item_sale', name: '아이템 판매', meso: 50, parts: [{ key: 'unnamed', name: '이름 없음', meso: 50 }] },
      { key: 'etc', name: '기타', meso: 30, parts: [{ key: 'unnamed', name: '이름 없음', meso: 30 }] },
    ])
  })

  it('사냥과 솔 에르다 조각은 사냥 한 갈래이고, 사냥 기록의 조각 값은 조각 쪽으로 나눈다', () => {
    const byDate = {
      '2026-09-24': [
        income(null, '', {
          category: 'hunting',
          mesoAmount: 1000,
          hunt: { mode: 'manual', typedMeso: 700, fragments: 3, fragmentPrice: 100 },
        }),
        // 조각 가격을 안 적은 사냥은 조각 값이 합계에 없다
        income(null, '', {
          category: 'hunting',
          mesoAmount: 400,
          hunt: { mode: 'manual', typedMeso: 400, fragments: 5, fragmentPrice: null },
        }),
        // 계산기 도입 전의 사냥 행은 합계가 곧 사냥 메소다
        income(null, '', { category: 'hunting', mesoAmount: 50 }),
        income(null, '', { category: 'sol_erda_fragment', mesoAmount: 200 }),
      ],
    }
    expect(categoryTotalsBetween(byDate, WEEK, 'income')).toEqual([
      {
        key: 'hunting',
        name: '사냥',
        meso: 1650,
        parts: [
          { key: 'hunting_meso', name: '사냥 메소', meso: 1150 },
          { key: 'sol_erda_fragment', name: '솔 에르다 조각', meso: 500 },
        ],
      },
    ])
  })

  it('조각만 있는 사냥도 사냥 갈래이고 0 인 줄은 나눈 목록에 없다', () => {
    const byDate = { '2026-09-24': [income(null, '', { category: 'sol_erda_fragment', mesoAmount: 200 })] }
    expect(categoryTotalsBetween(byDate, WEEK, 'income')).toEqual([
      {
        key: 'hunting',
        name: '사냥',
        meso: 200,
        parts: [{ key: 'sol_erda_fragment', name: '솔 에르다 조각', meso: 200 }],
      },
    ])
  })

  it('버프는 한 갈래이고 선택 목록의 묶음(보스 버프 · 사냥 버프)으로 나눈다', () => {
    const byDate = {
      '2026-09-24': [
        spend(null, '', { category: 'buff', itemKey: 'seiram_elixir', mesoAmount: 2000000 }),
        spend(null, '', { category: 'buff', itemKey: 'vip_buff_stat', mesoAmount: 500000 }),
        spend(null, '', { category: 'buff', itemKey: 'vip_buff_exp', mesoAmount: 1500000 }),
      ],
    }
    expect(categoryTotalsBetween(byDate, WEEK, 'expense')).toEqual([
      {
        key: 'buff',
        name: '버프',
        meso: 4000000,
        parts: [
          { key: 'boss_buff', name: '보스 버프', meso: 2500000 },
          { key: 'hunting_buff', name: '사냥 버프', meso: 1500000 },
        ],
      },
    ])
  })

  it('지출 갈래는 강화 갈래와 손입력 갈래이고 0 인 갈래는 없다', () => {
    const byDate = {
      '2026-09-24': [
        enhancement('낟낟', 'starforce', 300),
        enhancement('낟넘', 'starforce', 100),
        enhancement('낟넘', 'cube_reset', 50),
        spend(null, '', { category: 'symbol', mesoAmount: 70 }),
        spend(null, '', { category: 'etc', cashAmount: 10000 }),
      ],
    }
    expect(categoryTotalsBetween(byDate, WEEK, 'expense')).toEqual([
      {
        key: 'enhancement:starforce',
        name: '스타포스',
        meso: 400,
        parts: [{ key: 'equipment:아케인셰이드 투구', name: '아케인셰이드 투구', meso: 400 }],
      },
      { key: 'symbol', name: '심볼 강화', meso: 70, parts: [{ key: 'unnamed', name: '이름 없음', meso: 70 }] },
      {
        key: 'enhancement:cube_reset',
        name: '큐브 재설정',
        meso: 50,
        parts: [{ key: 'equipment:아케인셰이드 투구', name: '아케인셰이드 투구', meso: 50 }],
      },
    ])
  })

  // 이슈 #632. 사냥 · 버프만 나뉘던 것을 보스 결정석 빼고 전부 나눈다. 줄의 축은 갈래마다 하나다.
  describe('조각마다의 줄', () => {
    it('보스 드롭은 아이템별이고 같은 아이템은 합친다', () => {
      const sale = (ocid: string, items: { itemKey: string | null; itemName: string; payoutMeso: number }[]): DayRecord => ({
        kind: 'dropSale',
        ocid,
        characterName: '낟낟',
        payoutMeso: items.reduce((sum, item) => sum + item.payoutMeso, 0),
        count: items.length,
        items,
      })
      const byDate = {
        '2026-09-24': [
          sale('a', [
            { itemKey: 'genesis_badge', itemName: '창세의 뱃지', payoutMeso: 300 },
            { itemKey: 'immortal_legacy', itemName: '불멸의 유산', payoutMeso: 100 },
          ]),
          sale('b', [{ itemKey: 'genesis_badge', itemName: '창세의 뱃지', payoutMeso: 200 }]),
        ],
      }
      expect(categoryTotalsBetween(byDate, WEEK, 'income')[0].parts).toEqual([
        { key: 'item:genesis_badge', name: '창세의 뱃지', meso: 500 },
        { key: 'item:immortal_legacy', name: '불멸의 유산', meso: 100 },
      ])
    })

    it('컨텐츠 · 이벤트·BM · 주문서는 선택 목록의 타일별이다. 단계와 형태별 항목은 타일에 접힌다', () => {
      const byDate = {
        '2026-09-24': [
          spend(null, '', { category: 'content', itemKey: 'high_mountain_1', mesoAmount: 100 }),
          spend(null, '', {
            category: 'content',
            itemKey: null,
            formItemKeys: { exp: 'high_mountain_1', sol_erda: 'high_mountain_2' },
            mesoAmount: 50,
          }),
          spend(null, '', { category: 'content', itemKey: 'angler_company_1', mesoAmount: 30 }),
          spend(null, '', { category: 'event_bm', itemKey: 'mechaberry_farm', mesoAmount: 20 }),
          spend(null, '', { category: 'scroll', itemKey: 'magical_one_handed_weapon_attack_scroll_100', mesoAmount: 10 }),
          spend(null, '', { category: 'scroll', itemKey: 'magical_two_handed_weapon_attack_scroll_100', mesoAmount: 5 }),
        ],
      }
      const totals = categoryTotalsBetween(byDate, WEEK, 'expense')
      expect(totals.find((total) => total.key === 'content')?.parts).toEqual([
        { key: 'tile:high_mountain', name: '하이마운틴', meso: 150 },
        { key: 'tile:angler_company', name: '앵글러 컴퍼니', meso: 30 },
      ])
      expect(totals.find((total) => total.key === 'event_bm')?.parts).toEqual([
        { key: 'tile:mechaberry_farm', name: '메카베리 농장', meso: 20 },
      ])
      expect(totals.find((total) => total.key === 'scroll')?.parts).toEqual([
        { key: 'tile:magical_scroll', name: '매지컬 주문서', meso: 15 },
      ])
    })

    it('심볼 강화는 심볼별이고 표에 없는 key 는 친 이름이다', () => {
      const byDate = {
        '2026-09-24': [
          spend(null, '', { category: 'symbol', itemKey: 'road_of_vanishing', item: '소멸의 여로 Lv.3 → 7', mesoAmount: 100 }),
          spend(null, '', { category: 'symbol', itemKey: 'road_of_vanishing', item: '소멸의 여로 Lv.7 → 9', mesoAmount: 50 }),
          spend(null, '', { category: 'symbol', itemKey: 'no_such_symbol', item: '옛 심볼', mesoAmount: 10 }),
        ],
      }
      expect(categoryTotalsBetween(byDate, WEEK, 'expense')[0].parts).toEqual([
        { key: 'symbol:road_of_vanishing', name: '소멸의 여로', meso: 150 },
        { key: 'name:옛 심볼', name: '옛 심볼', meso: 10 },
      ])
    })

    // 비슷한 이름을 추정해 묶지 않는다. 공백과 NFC 만 맞춘다.
    it('아이템 구매 · 판매 · 기타는 친 이름별이고 앞뒤 공백 · NFC 만 맞춘다. 이름이 없으면 이름 없음이다', () => {
      const byDate = {
        '2026-09-24': [
          spend(null, '', { category: 'item_purchase', item: '칠흑 장신구 ', mesoAmount: 100 }),
          spend(null, '', { category: 'item_purchase', item: '칠흑 장신구'.normalize('NFD'), mesoAmount: 50 }),
          spend(null, '', { category: 'item_purchase', item: '칠흑장신구', mesoAmount: 20 }),
          spend(null, '', { category: 'item_purchase', item: null, mesoAmount: 5 }),
          income(null, '', { category: 'item_sale', item: '여명 펜던트', mesoAmount: 70 }),
          income(null, '', { category: 'etc', item: null, mesoAmount: 30 }),
        ],
      }
      expect(categoryTotalsBetween(byDate, WEEK, 'expense')[0].parts).toEqual([
        { key: 'name:칠흑 장신구', name: '칠흑 장신구', meso: 150 },
        { key: 'name:칠흑장신구', name: '칠흑장신구', meso: 20 },
        { key: 'unnamed', name: '이름 없음', meso: 5 },
      ])
      const income_ = categoryTotalsBetween(byDate, WEEK, 'income')
      expect(income_.find((total) => total.key === 'item_sale')?.parts).toEqual([
        { key: 'name:여명 펜던트', name: '여명 펜던트', meso: 70 },
      ])
      expect(income_.find((total) => total.key === 'etc')?.parts).toEqual([{ key: 'unnamed', name: '이름 없음', meso: 30 }])
    })

    it('강화는 장비별이고 값을 못 매긴 건은 금액에 없다', () => {
      const byDate = {
        '2026-09-24': [
          {
            kind: 'enhancement' as const,
            category: 'starforce' as const,
            characterName: '낟낟',
            payoutMeso: 300,
            count: 3,
            unpricedCount: 1,
            items: [
              { itemKey: 'arcane_shade_hat', targetItem: '아케인셰이드 투구', count: 2, costMeso: 300, unpricedCount: 0 },
              { itemKey: null, targetItem: '모르는 장비', count: 1, costMeso: 0, unpricedCount: 1 },
            ],
          },
        ],
      }
      expect(categoryTotalsBetween(byDate, WEEK, 'expense')[0].parts).toEqual([
        { key: 'equipment:arcane_shade_hat', name: '아케인셰이드 투구', meso: 300 },
      ])
    })

    // 팝오버는 스크롤이 없다. 도넛이 조각 넷 뒤를 묶듯 줄도 일곱 뒤를 묶는다.
    it('줄이 일곱을 넘으면 그 외 n 으로 묶고, 남는 것이 하나면 묶지 않는다', () => {
      const names = (count: number): DayRecord[] =>
        Array.from({ length: count }, (_, index) =>
          spend(null, '', { category: 'etc', item: `항목 ${index + 1}`, mesoAmount: 100 - index }),
        )
      const eight = categoryTotalsBetween({ '2026-09-24': names(8) }, WEEK, 'expense')[0].parts
      expect(eight).toHaveLength(8)
      expect(eight?.some((part) => part.key === 'rest')).toBe(false)

      const nine = categoryTotalsBetween({ '2026-09-24': names(9) }, WEEK, 'expense')[0].parts
      expect(nine).toHaveLength(8)
      expect(nine?.[7]).toEqual({ key: 'rest', name: '그 외 2', meso: 93 + 92 })
    })
  })
})

describe('bossTotalsBetween', () => {
  function crystalOf(ocid: string, bosses: [string, 'hard' | 'normal', number][]): DayRecord {
    return {
      kind: 'bossCrystal',
      ocid,
      characterName: ocid,
      payoutMeso: bosses.reduce((sum, [, , meso]) => sum + meso, 0),
      count: bosses.length,
      bosses: bosses.map(([bossKey, difficulty, payoutMeso]) => ({ bossKey, bossName: bossKey, difficulty, payoutMeso })),
    }
  }
  const byDate = {
    '2026-09-24': [crystalOf('a', [['lucid', 'hard', 300], ['chosen_seren', 'hard', 500]])],
    '2026-09-25': [crystalOf('b', [['lucid', 'normal', 100], ['chosen_seren', 'hard', 500]])],
    '2026-10-01': [crystalOf('a', [['lucid', 'hard', 999]])],
  }

  it('난이도별은 보스 · 난이도마다 금액과 처치 횟수를 내고 이름은 alias 다', () => {
    expect(bossTotalsBetween(byDate, WEEK, 'difficulty', 'monthly')).toEqual([
      { key: 'chosen_seren|hard', bossKey: 'chosen_seren', name: '세렌', difficulty: 'hard', meso: 1000, count: 2 },
      { key: 'lucid|hard', bossKey: 'lucid', name: '루시드', difficulty: 'hard', meso: 300, count: 1 },
      { key: 'lucid|normal', bossKey: 'lucid', name: '루시드', difficulty: 'normal', meso: 100, count: 1 },
    ])
  })

  it('보스별은 난이도를 합치고 난이도를 안 든다', () => {
    expect(bossTotalsBetween(byDate, WEEK, 'boss', 'monthly')).toEqual([
      { key: 'chosen_seren', bossKey: 'chosen_seren', name: '세렌', difficulty: null, meso: 1000, count: 2 },
      { key: 'lucid', bossKey: 'lucid', name: '루시드', difficulty: null, meso: 400, count: 2 },
    ])
  })

  // 한 달에 한 번 잡는 보스가 주간 타일에 서면 그 주만 튄다. 합계(순 수익 · 추이)에서는 안 뺀다.
  describe('월간 보스', () => {
    const withMonthly = {
      '2026-09-24': [crystalOf('a', [['lucid', 'hard', 300], ['black_mage', 'hard', 5000]])],
    }

    it('주간이면 보스 표에서 월간인 보스를 뺀다', () => {
      expect(bossTotalsBetween(withMonthly, WEEK, 'boss', 'weekly').map((row) => row.bossKey)).toEqual(['lucid'])
      expect(bossTotalsBetween(withMonthly, WEEK, 'difficulty', 'weekly').map((row) => row.bossKey)).toEqual(['lucid'])
    })

    it('월간이면 그대로 선다', () => {
      expect(bossTotalsBetween(withMonthly, WEEK, 'boss', 'monthly').map((row) => row.bossKey)).toEqual([
        'black_mage',
        'lucid',
      ])
    })

    it('표에 없는 key 는 주기를 몰라 주간에도 그대로 둔다', () => {
      const unknown = { '2026-09-24': [crystalOf('a', [['no_such_boss', 'hard', 700]])] }
      expect(bossTotalsBetween(unknown, WEEK, 'boss', 'weekly').map((row) => row.bossKey)).toEqual(['no_such_boss'])
    })
  })
})
