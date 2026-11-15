/**
 * 거래 내역의 줄 · 필터 · 날짜 묶음. 가계부 기록과 판 드롭에서 아이템을 사고판 것만 골라 기록 하나를 한 줄로 세운다.
 * 이름 · 그림 · 금액은 가계부 하루 목록과 같은 함수에서 낸다. 같은 기록이 두 화면에서 다르게 보이면 안 되기 때문이다.
 */
import { solErdaFragmentIcon, dropItemIconOf } from '../../lib/assets/asset-lookup'
import { formatDayLabel, formatMonthDay, getAdjacentMonthKey, monthBounds, monthKeyOf } from '../../lib/calendar'
import { formatMesoSigned } from '../../lib/cashbook/meso-compact'
import { compareByName } from '../../lib/character-order'
import { dropItemNameOf } from '../../lib/drop/drop-items'
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import { withRingLevel } from '../../lib/item-catalog'
import { searchItems } from '../../lib/item-search'
import type { BossDropRecord } from '../../storage/boss-drops'
import type { ImageAssetRef } from '../../types/image-asset'
import {
  autoRecordTitleOf,
  dropTradeQuantityOf,
  incomeMesoOf,
  recordCardOf,
  recordCashOf,
  spendMesoOf,
  tradeLineOf,
  type DatedSoldDrop,
  type ManualDayRecord,
} from '../cashbook/records'
import { recordIconOf } from '../cashbook/row-icon'
import { dropItemKindOf } from '../inventory/cells'

export type TradeSide = 'sale' | 'purchase'

/** 기록의 주인. 캐릭터 기록과 메이플 ID 기록(인벤토리 판매 등)이 있다 */
export type TradeOwner = { kind: 'character'; ocid: string } | { kind: 'account'; accountId: string }

/** 줄이 나온 기록. `거래로 이동` 이 이것으로 가계부에서 열 것을 고른다 */
export type TradeSource =
  | { kind: 'entry'; entry: ManualDayRecord }
  | { kind: 'drop'; drop: BossDropRecord; characterName: string }

/** 판 드롭과 그 드롭을 가진 캐릭터의 이름. */
export interface TradeDrop extends DatedSoldDrop {
  characterName: string
}

export interface TradeRow {
  /** 손입력은 기록 id, 드롭은 `drop:{dropRecordId}` */
  key: string
  dateKey: string
  side: TradeSide
  /** 윗줄의 아이템 이름 */
  name: string
  /** 윗줄의 개수(`3,000개`). 장비는 `null` */
  quantity: string | null
  icon: ImageAssetRef | null
  owner: TradeOwner | null
  /** 캐릭터 이름이나 메이플 ID 이름. 주인을 모르는 옛 기록은 빈 문자열 */
  ownerName: string
  /** 기록이 나온 경로. 가계부 하루 목록 첫 줄의 분류 이름이자 상세 시트 머리의 기록 이름이다 */
  originName: string
  /** 부호와 통화가 붙은 금액(`+9,975만` · `−5,500원`) */
  amountText: string
  memo: string | null
  /** 아이템 검색이 찾는 이름. 지출 목록 항목은 `null` 이라 검색어가 있으면 빠진다 */
  searchName: string | null
  /** 같은 날 안의 차례. 손입력은 적은 시각, 드롭은 가격을 넣은 시각 */
  sortAt: string
  source: TradeSource
}

export interface TradeFilter {
  side: 'all' | TradeSide
  /** KST `YYYY-MM-DD`. 두 끝을 포함한다 */
  from: string
  to: string
  /** `ownerKeyOf` 의 값. `null` 이면 모든 주인 */
  owner: string | null
  query: string
}

/** 캐릭터 드롭다운의 보기 하나. */
export interface TradeOwnerOption {
  value: string
  label: string
  owner: TradeOwner
}

export function ownerKeyOf(owner: TradeOwner): string {
  return owner.kind === 'character' ? `character:${owner.ocid}` : `account:${owner.accountId}`
}

function ownerOfRecord(record: { ocid: string | null; accountId?: string }): TradeOwner | null {
  if (record.accountId !== undefined) return { kind: 'account', accountId: record.accountId }
  return record.ocid === null ? null : { kind: 'character', ocid: record.ocid }
}

function cashText(cash: number, sign: '+' | '−'): string {
  return `${cash === 0 ? '' : sign}${cash.toLocaleString()}원`
}

function entryRowOf(entry: ManualDayRecord): TradeRow | null {
  const line = tradeLineOf(entry)
  if (line === null) return null
  const sale = entry.kind === 'income'
  const sign = sale ? '+' : '−'
  const record = entry.record
  // 사냥 기록의 금액에는 사냥 메소가 들어 있어, 판 조각의 몫만 센다.
  const huntDetail = entry.kind === 'income' && entry.record.category === 'hunting' ? entry.record.hunt : null
  const cash = recordCashOf(entry)
  const amountText =
    huntDetail !== null
      ? formatMesoSigned(huntDetail.fragments * (huntDetail.fragmentPrice ?? 0), '+')
      : cash !== null
        ? cashText(cash, sign)
        : formatMesoSigned(entry.kind === 'income' ? incomeMesoOf(entry.record) : spendMesoOf(entry.record), sign)
  return {
    key: record.id,
    dateKey: entry.kind === 'income' ? entry.record.earnedOn : entry.record.spentOn,
    side: sale ? 'sale' : 'purchase',
    name: line.name,
    quantity: line.quantity,
    icon: huntDetail !== null ? solErdaFragmentIcon() : recordIconOf(entry),
    owner: ownerOfRecord(record),
    ownerName: entry.characterName,
    originName: recordCardOf({ ...entry, characterName: '' }).title,
    amountText,
    memo: record.memo ?? null,
    searchName: line.searchable ? line.name : null,
    sortAt: record.recordedAt,
    source: { kind: 'entry', entry },
  }
}

function dropRowOf(sold: TradeDrop): TradeRow {
  const { drop } = sold
  const name = withRingLevel(dropItemNameOf(drop.itemKey, drop.itemName), drop.ringLevel)
  return {
    key: `drop:${drop.dropRecordId}`,
    dateKey: sold.dateKey,
    side: 'sale',
    name,
    quantity: dropTradeQuantityOf(dropItemKindOf(drop)),
    icon: dropItemIconOf(drop.itemKey),
    owner: { kind: 'character', ocid: drop.ocid },
    ownerName: sold.characterName,
    originName: autoRecordTitleOf('dropSale'),
    // 가계부의 드롭 판매 줄과 같은 내 몫이다(분배와 수수료를 뗀 값).
    amountText: formatMesoSigned(dropPayoutMeso(drop), '+'),
    memo: null,
    searchName: name,
    sortAt: drop.pricedAt ?? drop.recordedAt,
    source: { kind: 'drop', drop, characterName: sold.characterName },
  }
}

/**
 * 줄 둘째 줄의 왼쪽 글자. `경로 이름 · 캐릭터` 이고, 주인을 모르는 옛 기록은 경로 이름만이다. 같은 아이템을 어디서 사고팔았는지
 * 줄에서 가르려고 둔다.
 */
export function tradeOwnerLineOf(row: TradeRow): string {
  return row.ownerName === '' ? row.originName : `${row.originName} · ${row.ownerName}`
}

/** 아이템을 사고판 기록의 줄. 최신 날짜가 위이고, 같은 날은 나중에 적은 기록이 위다. */
export function tradeRowsOf(entries: readonly ManualDayRecord[], drops: readonly TradeDrop[]): TradeRow[] {
  const rows = [
    ...entries.flatMap((entry) => {
      const row = entryRowOf(entry)
      return row === null ? [] : [row]
    }),
    ...drops.map(dropRowOf),
  ]
  return rows.sort((left, right) =>
    left.dateKey === right.dateKey ? right.sortAt.localeCompare(left.sortAt) : right.dateKey.localeCompare(left.dateKey),
  )
}

/**
 * 네 필터가 모두 맞는 줄. 검색은 아이템 고르기와 같은 `searchItems` 로 찾히는지만 보고, 차례는 받은 날짜 차례 그대로다.
 * 붙어서 맞은 이름을 위로 올리면 날짜 제목 아래 차례가 흐트러지기 때문이다.
 */
export function filterTradeRows(rows: readonly TradeRow[], filter: TradeFilter): TradeRow[] {
  const query = filter.query.trim()
  const kept = rows.filter(
    (row) =>
      (filter.side === 'all' || row.side === filter.side) &&
      row.dateKey >= filter.from &&
      row.dateKey <= filter.to &&
      (filter.owner === null || (row.owner !== null && ownerKeyOf(row.owner) === filter.owner)),
  )
  if (query === '') return kept
  const candidates = kept.flatMap((row) => (row.searchName === null ? [] : [{ name: row.searchName, row }]))
  const found = new Set(searchItems(candidates, query).map((candidate) => candidate.row))
  return kept.filter((row) => found.has(row))
}

/**
 * 날짜 제목 · 기간 알약의 날짜. 올해가 아니면 앞에 연도를 붙인다. 기간이 1년 6개월까지 걸쳐 같은 월 · 일이 두 번 나오기 때문이다.
 *
 * @param weekday 참이면 `11월 14일 (토)`, 거짓이면 `11월 14일`
 */
export function tradeDateLabel(dateKey: string, todayDateKey: string, weekday: boolean): string {
  const label = weekday ? formatDayLabel(dateKey) : formatMonthDay(dateKey)
  const year = dateKey.slice(0, 4)
  return year === todayDateKey.slice(0, 4) ? label : `${year}년 ${label}`
}

export interface TradeSection {
  dateKey: string
  title: string
  rows: TradeRow[]
}

/** 날짜마다 묶은 목록. 받은 줄의 차례를 지킨다. */
export function tradeSectionsOf(rows: readonly TradeRow[], todayDateKey: string): TradeSection[] {
  const sections: TradeSection[] = []
  for (const row of rows) {
    const last = sections[sections.length - 1]
    if (last !== undefined && last.dateKey === row.dateKey) last.rows.push(row)
    else sections.push({ dateKey: row.dateKey, title: tradeDateLabel(row.dateKey, todayDateKey, true), rows: [row] })
  }
  return sections
}

/** 처음 기간. 오늘부터 3개월 전 같은 날까지이고, 그 달에 같은 날이 없으면 그 달 마지막 날부터다. */
export function defaultTradePeriod(todayDateKey: string): { from: string; to: string } {
  const monthKey = getAdjacentMonthKey(monthKeyOf(todayDateKey), -3)
  const sameDay = `${monthKey}-${todayDateKey.slice(8)}`
  const lastDay = monthBounds(monthKey).to
  return { from: sameDay > lastDay ? lastDay : sameDay, to: todayDateKey }
}

/**
 * 캐릭터 드롭다운의 보기. 기록이 있는 주인만 선다. 캐릭터는 캐릭터 관리 순서이고, 추적을 그만둔 캐릭터는 그 뒤에 이름 순이다.
 * 메이플 ID 는 캐릭터들 뒤에 가계부 시트와 같은 순서로 선다.
 *
 * @param trackedOcids 캐릭터 관리 순서
 * @param accountOrder 가계부 시트의 메이플 ID 순서(`sheetAccountsOf`)
 */
export function tradeOwnerOptionsOf(
  rows: readonly TradeRow[],
  trackedOcids: readonly string[],
  accountOrder: readonly string[],
): TradeOwnerOption[] {
  const byKey = new Map<string, TradeOwnerOption>()
  for (const row of rows) {
    if (row.owner === null || row.ownerName === '') continue
    const value = ownerKeyOf(row.owner)
    if (!byKey.has(value)) byKey.set(value, { value, label: row.ownerName, owner: row.owner })
  }
  const options = [...byKey.values()]
  const rank = (order: readonly string[], id: string): number => {
    const index = order.indexOf(id)
    return index === -1 ? order.length : index
  }
  const characters = options
    .filter((option) => option.owner.kind === 'character')
    .sort((left, right) => {
      const leftRank = rank(trackedOcids, (left.owner as { ocid: string }).ocid)
      const rightRank = rank(trackedOcids, (right.owner as { ocid: string }).ocid)
      return leftRank !== rightRank ? leftRank - rightRank : compareByName(left.label, right.label)
    })
  const accounts = options
    .filter((option) => option.owner.kind === 'account')
    .sort((left, right) => {
      const leftRank = rank(accountOrder, (left.owner as { accountId: string }).accountId)
      const rightRank = rank(accountOrder, (right.owner as { accountId: string }).accountId)
      return leftRank !== rightRank ? leftRank - rightRank : compareByName(left.label, right.label)
    })
  return [...characters, ...accounts]
}
