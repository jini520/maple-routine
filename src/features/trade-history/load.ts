/**
 * 거래 내역이 읽는 기록. 고를 수 있는 기간 전체(가계부 시트와 같은 조회 한도부터 오늘까지)를 한 번에 읽는다. 캐릭터 드롭다운이
 * 기간 전체의 기록으로 서고, 기간 · 판매 · 구매 · 검색은 읽은 줄에서 좁히기 때문이다.
 *
 * 읽기는 가계부 하루 목록과 같은 저장소 함수다. 따로 판정하면 가계부와 다른 기록이 섞인다.
 */
import { getIncomeRecordsBetween } from '../../storage/income'
import { getSpendRecordsBetween } from '../../storage/spend'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { withSqliteFallback } from '../boss-profit/sqlite-guards'
import { loadAccountLabels, loadSheetAccounts } from '../cashbook/account-names'
import { historyFloorDateKey } from '../cashbook/range'
import { loadSoldDropsBetween, namesByOcid, type ManualDayRecord } from '../cashbook/records'
import { tradeOwnerOptionsOf, tradeRowsOf, type TradeOwnerOption, type TradeRow } from './rows'

export interface TradeHistoryData {
  rows: TradeRow[]
  owners: TradeOwnerOption[]
  /** 고를 수 있는 첫날. 가계부 시트의 날짜와 같은 범위라 `거래로 이동` 으로 간 날짜를 가계부가 언제나 연다 */
  floorDateKey: string
}

/** 읽기 실패는 빈 값으로 진행한다. 한쪽만 실패하면 다른 쪽은 보인다. 가계부와 같다. */
export async function loadTradeHistory(todayDateKey: string): Promise<TradeHistoryData> {
  const floorDateKey = historyFloorDateKey(todayDateKey)
  const [incomes, spends, soldDrops, tracked, accounts] = await Promise.all([
    withSqliteFallback(getIncomeRecordsBetween(floorDateKey, todayDateKey), []),
    withSqliteFallback(getSpendRecordsBetween(floorDateKey, todayDateKey), []),
    loadSoldDropsBetween(floorDateKey, todayDateKey),
    getTrackedCharacterOcids().catch(() => null),
    loadSheetAccounts().catch(() => []),
  ])
  const records = [...incomes, ...spends]
  const [names, accountLabels] = await Promise.all([
    namesByOcid([
      ...records.flatMap((record) => (record.ocid === null ? [] : [record.ocid])),
      ...soldDrops.map((sold) => sold.drop.ocid),
    ]),
    loadAccountLabels([...new Set(records.flatMap((record) => (record.accountId === undefined ? [] : [record.accountId])))]),
  ])
  const nameOf = (record: { ocid: string | null; accountId?: string }): string =>
    record.accountId !== undefined
      ? (accountLabels.get(record.accountId) ?? '')
      : record.ocid === null
        ? ''
        : (names.get(record.ocid) ?? '')

  const entries: ManualDayRecord[] = [
    ...incomes.map((record): ManualDayRecord => ({ kind: 'income', record, characterName: nameOf(record) })),
    ...spends.map((record): ManualDayRecord => ({ kind: 'spend', record, characterName: nameOf(record) })),
  ]
  const rows = tradeRowsOf(
    entries,
    soldDrops.map((sold) => ({ ...sold, characterName: names.get(sold.drop.ocid) ?? '' })),
  )
  return {
    rows,
    owners: tradeOwnerOptionsOf(rows, tracked ?? [], accounts.map((account) => account.accountId)),
    floorDateKey,
  }
}
