/**
 * 거래 내역 상세 시트의 머리 · 칸 · 금액. 칸은 그 기록을 적은 폼의 금액 칸과 같은 이름 · 값이고, 시트에서는 바꿀 수 없다.
 * 단가는 저장하지 않으므로 수정 폼처럼 금액과 수량에서 거꾸로 센다.
 */
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { IncomeRecord } from '../../storage/income'
import type { SpendRecord } from '../../storage/spend'
import { incomeMesoOf, recordCardOf, spendMesoOf, type ManualDayRecord } from '../cashbook/records'
import type { TradeRow } from './rows'

export interface TradeDetailCell {
  label: string
  value: string
  /** 값 오른쪽의 단위(`메소` · `메포` · `원`). 요율 · 인원처럼 값에 붙은 것은 `null` */
  unit: string | null
}

export interface TradeDetail {
  /** 머리의 기록 이름. 가계부 하루 목록 첫 줄의 분류 이름이다 */
  title: string
  cells: TradeDetailCell[]
  amount: { value: number; unit: '메소' | '원' }
}

const DROP_TITLE = '보스 드롭 판매'

function meso(label: string, value: number): TradeDetailCell {
  return { label, value: value.toLocaleString(), unit: '메소' }
}

function percent(label: string, value: number | null): TradeDetailCell[] {
  return value === null ? [] : [{ label, value: `${value}%`, unit: null }]
}

/** 수량으로 나눈 값. 수정 폼과 같이 반올림한다. 저장된 총액이 단가 × 수량이라 나누어떨어진다. */
function perUnit(total: number, quantity: number | null): number {
  return Math.round(total / (quantity ?? 1))
}

function incomeCells(record: IncomeRecord): TradeDetailCell[] {
  const gross = (record.mesoAmount ?? 0) + (record.saleFeeMeso ?? 0)
  switch (record.category) {
    case 'hunting':
      return [meso('개당 가격', record.hunt?.fragmentPrice ?? 0)]
    case 'item_sale': {
      // 장비는 하나라 판매 대금을 친다. 인벤토리에서 판 기타 조각은 그 시트처럼 개당 가격이다.
      const equipment = (record.itemKind ?? 'equipment') === 'equipment'
      const label = equipment ? '판매 대금' : record.itemKey === 'sol_erda_fragment' ? '개당 가격' : '단가'
      return [meso(label, equipment ? gross : perUnit(gross, record.quantity)), ...percent('수수료', record.saleFeePercent)]
    }
    default:
      return [meso('개당 가격', perUnit(gross, record.quantity)), ...percent('수수료', record.saleFeePercent)]
  }
}

function spendCells(record: SpendRecord): TradeDetailCell[] {
  const total = record.mesoAmount ?? 0
  if (record.category === 'item_purchase') {
    const equipment = (record.itemKind ?? 'equipment') === 'equipment'
    const tariff = record.tariffMeso
    if (equipment) return [meso('구매 비용', total - (tariff ?? 0)), ...(tariff === null ? [] : [meso('관세', tariff)])]
    return [meso('단가', perUnit(total - (tariff ?? 0), record.quantity))]
  }
  // 지출 목록 항목은 통화가 셋이다. 메포는 그 기록의 시세를 함께 보인다.
  const label = record.quantity === null ? '가격' : '개당 가격'
  if (record.cashAmount !== null) {
    return [{ label, value: perUnit(record.cashAmount, record.quantity).toLocaleString(), unit: '원' }]
  }
  if (record.pointAmount !== null) {
    return [
      { label, value: perUnit(record.pointAmount, record.quantity).toLocaleString(), unit: '메포' },
      ...(record.pointPer100mMeso === null ? [] : [{ label: '시세', value: record.pointPer100mMeso.toLocaleString(), unit: '메포' }]),
    ]
  }
  return [meso(label, perUnit(total, record.quantity))]
}

function entryDetail(entry: ManualDayRecord): TradeDetail {
  const title = recordCardOf({ ...entry, characterName: '' }).title
  if (entry.kind === 'income') {
    const record = entry.record
    const hunt = record.category === 'hunting' ? record.hunt : null
    const value = hunt !== null ? hunt.fragments * (hunt.fragmentPrice ?? 0) : incomeMesoOf(record)
    return { title, cells: incomeCells(record), amount: { value, unit: '메소' } }
  }
  const record = entry.record
  return {
    title,
    cells: spendCells(record),
    amount: record.cashAmount !== null ? { value: record.cashAmount, unit: '원' } : { value: spendMesoOf(record), unit: '메소' },
  }
}

/** 분배 비율의 글자. 인원으로 나눴으면 `3인`, 비율로 나눴으면 `내 몫 / 합` 이다. */
function shareText(drop: BossDropRecord): string | null {
  if (drop.priceSplitMode === 'ratio' && drop.priceShare !== null) return `${drop.priceMyShare ?? 1} / ${drop.priceShare}`
  if (drop.pricePartySize !== null) return `${drop.pricePartySize}인`
  return null
}

function dropDetail(drop: BossDropRecord): TradeDetail {
  const share = shareText(drop)
  return {
    title: DROP_TITLE,
    cells: [
      meso('판매 가격', drop.priceMeso ?? 0),
      ...(share === null ? [] : [{ label: '분배 비율', value: share, unit: null }]),
      ...percent('판매 수수료', drop.saleFeePercent),
      ...percent('분배 수수료', drop.splitFeePercent),
    ],
    amount: { value: dropPayoutMeso(drop), unit: '메소' },
  }
}

export function tradeDetailOf(row: TradeRow): TradeDetail {
  return row.source.kind === 'entry' ? entryDetail(row.source.entry) : dropDetail(row.source.drop)
}
