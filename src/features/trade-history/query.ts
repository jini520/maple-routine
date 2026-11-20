/**
 * 거래 내역 쿼리. 기기 DB 읽기라 저장하지 않고 신선함도 재지 않는다. 읽는 표의 판이 오르면 무효화되어(`features/query/invalidation.ts`),
 * `거래로 이동` 으로 고친 기록이 거래 내역을 다시 열면 바로 반영된다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../query/keys'
import type { RecordTable } from '../query/meta'
import { loadTradeHistory, type TradeHistoryData } from './load'

/** 보스 수익 표는 드롭의 처치 날짜를 준다. 드롭 · 수입 · 지출 표가 줄의 원천이다. */
export const TRADE_HISTORY_TABLES: readonly RecordTable[] = [
  'boss_profit_records',
  'boss_drop_records',
  'income_records',
  'spend_records',
]

export function tradeHistoryOptions(todayDateKey: string) {
  return queryOptions<TradeHistoryData>({
    queryKey: queryKeys.tradeHistory(todayDateKey),
    queryFn: () => loadTradeHistory(todayDateKey),
    staleTime: Number.POSITIVE_INFINITY,
    meta: { tables: TRADE_HISTORY_TABLES },
  })
}

/** 아직 한 번도 못 읽었으면 `null` 이다. 화면은 그때 빈 목록을 사실처럼 그리지 않는다. */
export function useTradeHistory(todayDateKey: string): TradeHistoryData | null {
  return useQuery(tradeHistoryOptions(todayDateKey)).data ?? null
}
