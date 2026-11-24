// 거래 내역 상세 시트의 칸. 그 기록을 적은 폼의 금액 칸과 같은 이름 · 값을 읽기 전용으로 보인다.
import type { ManualDayRecord } from '../../cashbook/records'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { IncomeRecord } from '../../../storage/income'
import type { SpendRecord } from '../../../storage/spend'
import { tradeDetailOf } from '../detail'
import { tradeRowsOf, type TradeRow } from '../rows'

const income = (over: Partial<IncomeRecord> & Pick<IncomeRecord, 'id' | 'category'>): ManualDayRecord => ({
  kind: 'income',
  characterName: '단풍잎',
  record: {
    ocid: 'ocid-maple', earnedOn: '2026-11-14', item: null, itemKey: null, mesoAmount: 0, pointAmount: null, pointPer100mMeso: null,
    cashAmount: null, quantity: null, itemKind: null, saleFeePercent: null, saleFeeMeso: null, saleFeeAuto: false, hunt: null,
    recordedAt: '2026-11-14T03:00:00Z', ...over,
  },
})

const spend = (over: Partial<SpendRecord> & Pick<SpendRecord, 'id' | 'category'>): ManualDayRecord => ({
  kind: 'spend',
  characterName: '단풍잎',
  record: {
    ocid: 'ocid-maple', spentOn: '2026-11-14', item: null, itemKey: null, formItemKeys: null, itemKind: null, levelFrom: null,
    levelTo: null, quantity: null, mesoAmount: 0, tariffMeso: null, pointAmount: null, pointPer100mMeso: null,
    mesoMarketFeePercent: null, cashAmount: null, hexa: null, recordedAt: '2026-11-14T03:00:00Z', ...over,
  },
})

const drop = {
  dropRecordId: 'drop-1', ocid: 'ocid-slime', bossKey: 'black_mage', boss: '검은 마법사', difficulty: 'hard', periodKey: '2026-11',
  dropIndex: 0, itemId: 'item-1', category: 'equipment', itemKey: 'magic_eyepatch', itemName: '마력이 깃든 안대', boxOriginKey: null, boxOrigin: null,
  ringLevel: null, quantity: 1, recordedAt: '2026-11-13T05:00:00Z', pricedAt: '2026-11-13T05:00:00Z', world: null, worldKey: null,
  priceState: 'entered', priceMeso: 4_000_000_000, priceSplitMode: 'even', pricePartySize: 2, priceShare: null, priceMyShare: null,
  saleFeePercent: 5, splitFeePercent: null, saleFeeAuto: false, splitFeeAuto: false,
} satisfies BossDropRecord

function only(entries: ManualDayRecord[], drops: Parameters<typeof tradeRowsOf>[1] = []): TradeRow {
  const [row] = tradeRowsOf(entries, drops)
  if (row === undefined) throw new Error('줄이 없다')
  return row
}

describe('tradeDetailOf', () => {
  // 소비 · 기타 판매는 수정 폼처럼 뗀 수수료를 되돌려 수량으로 나눈 단가를 보인다.
  it('아이템 판매는 단가 · 수수료, 금액은 수수료를 뗀 값이다', () => {
    const detail = tradeDetailOf(
      only([income({ id: 'sale', category: 'item_sale', itemKey: 'spell_trace', itemKind: 'etc', quantity: 3000, mesoAmount: 99_750_000, saleFeeMeso: 5_250_000, saleFeePercent: 5 })]),
    )

    expect(detail).toEqual({
      title: '아이템 판매',
      cells: [
        { label: '단가', value: '35,000', unit: '메소' },
        { label: '수수료', value: '5%', unit: null },
      ],
      amount: { value: 99_750_000, unit: '메소' },
    })
  })

  // 장비 구매는 관세를 뺀 구매 비용과 관세를 따로 보인다.
  it('장비 구매는 구매 비용 · 관세다', () => {
    const detail = tradeDetailOf(
      only([spend({ id: 'buy', category: 'item_purchase', itemKey: 'dreamy_belt', itemKind: 'equipment', mesoAmount: 3_520_000_000, tariffMeso: 320_000_000 })]),
    )

    expect(detail.cells).toEqual([
      { label: '구매 비용', value: '3,200,000,000', unit: '메소' },
      { label: '관세', value: '320,000,000', unit: '메소' },
    ])
  })

  // 사냥 기록의 조각 판매는 조각의 개당 가격만 보이고 금액도 조각 몫이다.
  it('사냥 기록의 조각 판매는 개당 가격과 조각 몫 금액이다', () => {
    const detail = tradeDetailOf(
      only([income({ id: 'hunt', category: 'hunting', mesoAmount: 471_000_000, hunt: { mode: 'manual', typedMeso: 300_000_000, fragments: 30, fragmentPrice: 5_700_000 } })]),
    )

    expect(detail.cells).toEqual([{ label: '개당 가격', value: '5,700,000', unit: '메소' }])
    expect(detail.amount).toEqual({ value: 171_000_000, unit: '메소' })
  })

  // 드롭은 가격 입력 카드의 판매 가격 · 분배 · 수수료다.
  it('보스 드롭 판매는 판매 가격 · 분배 비율 · 판매 수수료이고 금액은 내 몫이다', () => {
    const detail = tradeDetailOf(only([], [{ dateKey: '2026-11-12', drop, characterName: '슬라임' }]))

    expect(detail).toEqual({
      title: '보스 드롭 판매',
      cells: [
        { label: '판매 가격', value: '4,000,000,000', unit: '메소' },
        { label: '분배 비율', value: '2인', unit: null },
        { label: '판매 수수료', value: '5%', unit: null },
      ],
      amount: { value: 1_900_000_000, unit: '메소' },
    })
  })
})
