// 거래 내역의 줄 · 필터 · 날짜 묶음. 가계부 기록과 판 드롭에서 아이템을 사고판 것만 골라 한 줄씩 세운다.
import type { ManualDayRecord, DatedSoldDrop } from '../../cashbook/records'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import {
  defaultTradePeriod,
  filterTradeRows,
  tradeDateLabel,
  tradeOwnerOptionsOf,
  tradeRowsOf,
  tradeSectionsOf,
  type TradeFilter,
  type TradeRow,
} from '../rows'

const income = (over: Partial<IncomeRecord> & Pick<IncomeRecord, 'id' | 'category'>, name = '단풍잎'): ManualDayRecord => ({
  kind: 'income',
  characterName: name,
  record: {
    ocid: 'ocid-maple',
    earnedOn: '2026-11-14',
    item: null,
    itemKey: null,
    mesoAmount: 0,
    pointAmount: null,
    pointPer100mMeso: null,
    cashAmount: null,
    quantity: null,
    itemKind: null,
    saleFeePercent: null,
    saleFeeMeso: null,
    saleFeeAuto: false,
    hunt: null,
    recordedAt: '2026-11-14T03:00:00Z',
    ...over,
  },
})

const spend = (over: Partial<SpendRecord> & Pick<SpendRecord, 'id' | 'category'>, name = '단풍잎'): ManualDayRecord => ({
  kind: 'spend',
  characterName: name,
  record: {
    ocid: 'ocid-maple',
    spentOn: '2026-11-14',
    item: null,
    itemKey: null,
    formItemKeys: null,
    itemKind: null,
    levelFrom: null,
    levelTo: null,
    quantity: null,
    mesoAmount: 0,
    tariffMeso: null,
    pointAmount: null,
    pointPer100mMeso: null,
    mesoMarketFeePercent: null,
    cashAmount: null,
    hexa: null,
    recordedAt: '2026-11-14T03:00:00Z',
    ...over,
  },
})

const drop = (over: Partial<BossDropRecord> & { dateKey: string }): DatedSoldDrop & { characterName: string } => {
  const { dateKey, ...rest } = over
  return {
    dateKey,
    characterName: '슬라임',
    drop: {
      dropRecordId: 'drop-1',
      ocid: 'ocid-slime',
      bossKey: 'black_mage',
      boss: '검은 마법사',
      difficulty: 'hard',
      periodKey: '2026-11',
      dropIndex: 0,
      category: 'equipment',
      itemKey: 'magic_eyepatch',
      itemName: '마력이 깃든 안대',
      boxOriginKey: null,
      boxOrigin: null,
      ringLevel: null,
      quantity: 1,
      recordedAt: '2026-11-13T05:00:00Z',
      pricedAt: '2026-11-13T05:00:00Z',
      world: null,
      worldKey: null,
      priceState: 'entered',
      priceMeso: 4_000_000_000,
      priceSplitMode: 'even',
      pricePartySize: 1,
      priceShare: null,
      priceMyShare: null,
      saleFeePercent: 5,
      splitFeePercent: null,
      saleFeeAuto: false,
      splitFeeAuto: false,
      ...rest,
    },
  }
}

const hunt = (fragments: number, fragmentPrice: number | null): IncomeRecord['hunt'] => ({
  mode: 'manual',
  typedMeso: 300_000_000,
  fragments,
  fragmentPrice,
})

const ids = (rows: readonly TradeRow[]): string[] => rows.map((row) => row.key)

const ALL: TradeFilter = { side: 'all', from: '2025-05-01', to: '2026-11-14', owner: null, query: '' }

describe('tradeRowsOf', () => {
  // 아이템을 사고판 기록 여섯 가지만 든다. `기타` 는 보스 수입 이전 · 메소마켓 수수료와 가를 수 없어 빠진다.
  it('아이템 판매 · 구매, 사냥 전리품, 조각 정산, 조각을 판 사냥, 지출 목록 항목만 줄이 된다', () => {
    const rows = tradeRowsOf(
      [
        income({ id: 'sale', category: 'item_sale', itemKey: 'spell_trace', itemKind: 'etc', quantity: 3000 }),
        income({ id: 'loot', category: 'hunt_loot_sale', itemKey: 'reindeer_milk', quantity: 40 }),
        income({ id: 'settle', category: 'sol_erda_fragment', quantity: 30 }),
        income({ id: 'hunt-sold', category: 'hunting', hunt: hunt(30, 5_700_000) }),
        income({ id: 'hunt-zero', category: 'hunting', hunt: hunt(10, 0) }),
        income({ id: 'hunt-kept', category: 'hunting', hunt: hunt(30, null) }),
        income({ id: 'income-etc', category: 'etc', item: '메소마켓 환전 수수료' }),
        spend({ id: 'buy', category: 'item_purchase', itemKey: 'dreamy_belt', itemKind: 'equipment' }),
        spend({ id: 'scroll', category: 'scroll', itemKey: 'premium_accessory_attack_scroll_100', quantity: 2 }),
        spend({ id: 'spend-etc', category: 'etc', item: '주간 보스 수입 이전' }),
        spend({ id: 'symbol', category: 'symbol', itemKey: 'arcane_vanishing_journey' }),
      ],
      [],
    )

    expect(new Set(ids(rows))).toEqual(new Set(['sale', 'loot', 'settle', 'hunt-sold', 'hunt-zero', 'buy', 'scroll']))
  })

  // 장비 · 장신구는 늘 하나라 개수를 안 보인다. 사냥 기록 줄은 사냥 메소를 빼고 판 조각 몫만 금액이다.
  it('윗줄은 아이템 이름과 개수이고 장비는 개수가 없으며, 사냥 기록 줄은 조각 몫만 금액이다', () => {
    const rows = tradeRowsOf(
      [
        income({ id: 'sale', category: 'item_sale', itemKey: 'spell_trace', itemKind: 'etc', quantity: 3000, mesoAmount: 99_750_000 }),
        spend({ id: 'buy', category: 'item_purchase', itemKey: 'dreamy_belt', itemKind: 'equipment', mesoAmount: 3_200_000_000 }),
        income({ id: 'hunt', category: 'hunting', hunt: hunt(30, 5_700_000), mesoAmount: 300_000_000 + 171_000_000 }),
      ],
      [],
    )
    const byKey = new Map(rows.map((row) => [row.key, row]))

    expect(byKey.get('sale')).toMatchObject({ side: 'sale', name: '주문의 흔적', quantity: '3,000개', amountText: '+9,975만' })
    expect(byKey.get('buy')).toMatchObject({ side: 'purchase', name: '몽환의 벨트', quantity: null, amountText: '−32억' })
    expect(byKey.get('hunt')).toMatchObject({ side: 'sale', name: '솔 에르다 조각', quantity: '30개', amountText: '+1.71억' })
  })

  // 드롭은 판 날이 없어 처치한 날에 서고, 금액은 가계부와 같은 분배 · 수수료를 뗀 몫이다.
  it('판 드롭은 한 건이 한 줄이고 처치한 날 · 내 몫 금액으로 서며 장비는 개수가 없다', () => {
    const [row] = tradeRowsOf([], [drop({ dateKey: '2026-11-12' })])

    expect(row).toMatchObject({
      dateKey: '2026-11-12',
      side: 'sale',
      name: '마력이 깃든 안대',
      quantity: null,
      ownerName: '슬라임',
      amountText: '+38억',
    })
  })

  // 메이플 ID 로 적은 기록(인벤토리 판매)은 둘째 줄에 메이플 ID 이름이 선다. 메모는 줄 카드에 본문 전체가 선다.
  it('메이플 ID 기록은 메이플 ID 를 주인으로 들고, 메모를 줄에 싣는다', () => {
    const [row] = tradeRowsOf(
      [
        income(
          { id: 'inv', category: 'item_sale', ocid: null, accountId: 'acc-1', itemKey: 'spell_trace', itemKind: 'etc', quantity: 10, memo: '작업장 남은 흔적 정리' },
          '메이플ID-da9b2f21',
        ),
      ],
      [],
    )

    expect(row).toMatchObject({ owner: { kind: 'account', accountId: 'acc-1' }, ownerName: '메이플ID-da9b2f21', memo: '작업장 남은 흔적 정리' })
  })

  // 최신이 위다. 같은 날은 나중에 적은 기록이 위이고, 드롭은 가격을 넣은 시각으로 센다.
  it('날짜는 최신 순, 같은 날은 나중에 적은 기록이 위다', () => {
    const rows = tradeRowsOf(
      [
        income({ id: 'old', category: 'item_sale', item: '아무 아이템', earnedOn: '2026-11-01' }),
        income({ id: 'early', category: 'item_sale', item: '아무 아이템', recordedAt: '2026-11-13T01:00:00Z', earnedOn: '2026-11-13' }),
        income({ id: 'late', category: 'item_sale', item: '아무 아이템', recordedAt: '2026-11-13T09:00:00Z', earnedOn: '2026-11-13' }),
      ],
      [drop({ dateKey: '2026-11-13', pricedAt: '2026-11-13T05:00:00Z' })],
    )

    expect(ids(rows)).toEqual(['late', 'drop:drop-1', 'early', 'old'])
  })
})

describe('filterTradeRows', () => {
  const rows = tradeRowsOf(
    [
      income({ id: 'trace-sale', category: 'item_sale', itemKey: 'spell_trace', itemKind: 'etc', quantity: 10, memo: '벨트' }),
      income({ id: 'typed-sale', category: 'item_sale', item: '아케인셰이드 장갑', earnedOn: '2026-10-01' }, '주황버섯'),
      spend({ id: 'trace-buy', category: 'item_purchase', itemKey: 'spell_trace', itemKind: 'etc', quantity: 5000, spentOn: '2026-11-08' }),
      spend({ id: 'scroll', category: 'scroll', itemKey: 'premium_accessory_attack_scroll_100', quantity: 2 }),
      income({ id: 'acc-sale', category: 'item_sale', ocid: null, accountId: 'acc-1', item: '주문의 흔적', itemKind: 'etc', quantity: 1 }, '메이플ID-da9b2f21'),
    ],
    [],
  )

  // 판매 · 구매, 기간, 주인, 검색이 함께 걸린다.
  it('네 필터는 모두 맞는 줄만 남긴다', () => {
    expect(ids(filterTradeRows(rows, { ...ALL, side: 'purchase' }))).toEqual(['scroll', 'trace-buy'])
    expect(ids(filterTradeRows(rows, { ...ALL, from: '2026-11-01' }))).not.toContain('typed-sale')
    expect(ids(filterTradeRows(rows, { ...ALL, owner: 'account:acc-1' }))).toEqual(['acc-sale'])
    expect(ids(filterTradeRows(rows, { ...ALL, side: 'sale', owner: 'character:ocid-maple', query: '흔적' }))).toEqual(['trace-sale'])
  })

  // 고른 아이템은 아이템 표의 이름으로, 친 이름은 그 글자로 찾는다. 지출 목록 항목의 이름과 메모는 찾지 않는다.
  it('검색은 아이템 이름만 찾고 지출 목록 항목 이름과 메모로는 안 찾힌다', () => {
    expect(ids(filterTradeRows(rows, { ...ALL, query: '주흔' }))).toEqual(['trace-sale', 'acc-sale', 'trace-buy'])
    expect(ids(filterTradeRows(rows, { ...ALL, query: '셰이드' }))).toEqual(['typed-sale'])
    expect(ids(filterTradeRows(rows, { ...ALL, query: '주문서' }))).toEqual([])
    expect(ids(filterTradeRows(rows, { ...ALL, query: '벨트' }))).toEqual([])
  })
})

describe('tradeSectionsOf · tradeDateLabel', () => {
  // 기간이 1년 6개월까지 걸쳐 같은 월 · 일이 두 번 나올 수 있다. 올해가 아닌 날은 연도를 붙인다.
  it('날짜마다 묶고, 올해가 아닌 날짜에는 연도를 붙인다', () => {
    const rows = tradeRowsOf(
      [
        income({ id: 'now', category: 'item_sale', item: '아이템', earnedOn: '2026-11-14' }),
        income({ id: 'last-year', category: 'item_sale', item: '아이템', earnedOn: '2025-11-14' }),
      ],
      [],
    )

    expect(tradeSectionsOf(rows, '2026-11-14').map((section) => [section.title, ids(section.rows)])).toEqual([
      ['11월 14일 (토)', ['now']],
      ['2025년 11월 14일 (금)', ['last-year']],
    ])
    expect(tradeDateLabel('2025-08-14', '2026-11-14', false)).toBe('2025년 8월 14일')
  })
})

describe('defaultTradePeriod', () => {
  // 처음 기간은 오늘부터 3개월 전 같은 날까지다. 그 달에 같은 날이 없으면 그 달 마지막 날이다.
  it('3개월 전 같은 날부터 오늘까지이고, 없는 날은 그 달 마지막 날로 당긴다', () => {
    expect(defaultTradePeriod('2026-11-14')).toEqual({ from: '2026-08-14', to: '2026-11-14' })
    expect(defaultTradePeriod('2026-05-31')).toEqual({ from: '2026-02-28', to: '2026-05-31' })
    expect(defaultTradePeriod('2026-01-31')).toEqual({ from: '2025-10-31', to: '2026-01-31' })
  })
})

describe('tradeOwnerOptionsOf', () => {
  // 기록이 있는 주인만 선다. 캐릭터는 캐릭터 관리 순서이고 추적을 그만둔 캐릭터는 그 뒤에, 메이플 ID 는 캐릭터들 뒤에 선다.
  it('기록이 있는 캐릭터만 관리 순서로 세우고, 추적 밖 캐릭터와 메이플 ID 를 뒤에 세운다', () => {
    const rows = tradeRowsOf(
      [
        income({ id: 'a', category: 'item_sale', item: '아이템', ocid: 'ocid-orange' }, '주황버섯'),
        income({ id: 'b', category: 'item_sale', item: '아이템', ocid: 'ocid-gone' }, '가나다'),
        income({ id: 'c', category: 'item_sale', item: '아이템', ocid: null, accountId: 'acc-2' }, '메이플ID-2'),
        income({ id: 'd', category: 'item_sale', item: '아이템', ocid: null, accountId: 'acc-1' }, '메이플ID-1'),
        income({ id: 'e', category: 'item_sale', item: '아이템' }, '단풍잎'),
        income({ id: 'f', category: 'item_sale', item: '아이템', ocid: null }, ''),
      ],
      [],
    )

    const options = tradeOwnerOptionsOf(rows, ['ocid-maple', 'ocid-unused', 'ocid-orange'], ['acc-1', 'acc-2'])

    expect(options.map((option) => option.label)).toEqual(['단풍잎', '주황버섯', '가나다', '메이플ID-1', '메이플ID-2'])
  })
})
