import type { DayRecord } from '../../cashbook/records'
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import {
  bossTotalsBetween,
  categoryTotalsBetween,
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
    memo: null,
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
    memo: null,
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
      { key: 'boss_crystal', name: '보스 결정석', meso: 500 },
      { key: 'boss_drop', name: '보스 드롭', meso: 100 },
      { key: 'item_sale', name: '아이템 판매', meso: 50 },
      { key: 'etc', name: '기타', meso: 30 },
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
      { key: 'enhancement:starforce', name: '스타포스', meso: 400 },
      { key: 'symbol', name: '심볼 강화', meso: 70 },
      { key: 'enhancement:cube_reset', name: '큐브 재설정', meso: 50 },
    ])
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
