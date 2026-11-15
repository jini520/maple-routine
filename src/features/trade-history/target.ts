/**
 * `거래로 이동` 이 가계부에 넘기는 기록. 가계부는 그 날짜를 고르고, 손입력은 수정 시트를, 드롭은 가격 입력 카드를 연다.
 * 라우트 파라미터로 가므로 함수 없는 평범한 값만 든다.
 */
import type { BossDropRecord } from '../../storage/boss-drops'
import type { ManualDayRecord } from '../cashbook/records'
import type { TradeRow } from './rows'

export type CashbookTradeTarget =
  | { kind: 'entry'; dateKey: string; entry: ManualDayRecord }
  | { kind: 'drop'; dateKey: string; drop: BossDropRecord; characterName: string }

export function tradeTargetOf(row: TradeRow): CashbookTradeTarget {
  return row.source.kind === 'entry'
    ? { kind: 'entry', dateKey: row.dateKey, entry: row.source.entry }
    : { kind: 'drop', dateKey: row.dateKey, drop: row.source.drop, characterName: row.source.characterName }
}
