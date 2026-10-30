/**
 * 가계부의 날짜별 줄을 드는 쿼리. today 의 이번 주 수입 · 가계부의 달 · 통계의 전 기간이 범위만 달리 같은 열쇠를 쓴다.
 *
 * 기기 DB 읽기라 저장하지 않고 신선함도 재지 않는다. 읽는 표 다섯의 판이 오르면 무효화된다(`features/query/invalidation.ts`).
 * 그래서 화면은 판을 견주지 않는다. 다른 화면이 기록을 쓰면 보고 있는 화면은 그 자리에서, 아닌 화면은 다시 보일 때 읽는다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../query/keys'
import type { RecordTable } from '../query/meta'
import { loadMonthDays, type DayRecord } from './records'

/** 이 쿼리가 읽는 표. 보스 결정석 · 드롭 판매 · 수입 · 지출 · 강화 지출이 한 줄 묶음에 든다. */
export const LEDGER_TABLES: readonly RecordTable[] = [
  'boss_profit_records',
  'boss_drop_records',
  'income_records',
  'spend_records',
  'enhancement_totals',
]

export type LedgerDays = Readonly<Record<string, readonly DayRecord[]>>

export interface LedgerRange {
  /** KST `YYYY-MM-DD`. 두 끝을 포함한다. */
  from: string
  to: string
}

export function ledgerDaysOptions(from: string, to: string) {
  return queryOptions<LedgerDays>({
    queryKey: queryKeys.ledgerDays(from, to),
    queryFn: () => loadMonthDays(from, to),
    staleTime: Number.POSITIVE_INFINITY,
    meta: { tables: LEDGER_TABLES },
  })
}

/**
 * 한 범위의 줄. `days` 가 `null` 이면 아직 한 번도 못 읽었다는 뜻이고, 화면이 그때의 0 을 사실처럼 그리지 않는다.
 *
 * @param enabled 거짓이면 안 읽는다. 층이 기록을 채우는 동안 그 값이 자라는 중이라 읽어도 버린다
 */
export function useLedgerDays(range: LedgerRange, enabled = true): { days: LedgerDays | null; isFetching: boolean } {
  const { data, isFetching } = useQuery({ ...ledgerDaysOptions(range.from, range.to), enabled })
  return { days: data ?? null, isFetching }
}
