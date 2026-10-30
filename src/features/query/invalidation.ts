/**
 * 표의 판과 다른 쿼리의 새 데이터를 무효화로 잇는 한 자리. 기록을 쓰는 쪽은 화면을 모르고, 화면은 판을 견주지 않는다.
 *
 * 쿼리가 `meta.tables` 에 읽는 표를, `meta.dependsOn` 에 기대는 쿼리를 적는다. 표의 판이 오르면 그 표를 적은 쿼리를,
 * 회차가 새 데이터를 들면 거기 기댄 쿼리를 무효화한다. 보고 있는 화면은 그 자리에서 다시 읽고, 아닌 화면은 다시 보일 때 읽는다.
 */
import type { QueryCacheNotifyEvent, QueryClient } from '@tanstack/react-query'

import { subscribeBossDropRecordsRevision } from '../../storage/boss-drops'
import { subscribeBossProfitRecordsRevision } from '../../storage/boss-profit'
import { subscribeEnhancementTotalsRevision } from '../../storage/enhancement-totals'
import { subscribeIncomeRecordsRevision } from '../../storage/income'
import { subscribeScheduleProbeLedgerRevision } from '../../storage/schedule-probe-ledger'
import { subscribeSpendRecordsRevision } from '../../storage/spend'
import { queryKeys } from './keys'
import type { QueryDependency, RecordTable } from './meta'

const TABLE_SUBSCRIBERS: Record<RecordTable, (listener: () => void) => () => void> = {
  boss_profit_records: subscribeBossProfitRecordsRevision,
  boss_drop_records: subscribeBossDropRecordsRevision,
  income_records: subscribeIncomeRecordsRevision,
  spend_records: subscribeSpendRecordsRevision,
  enhancement_totals: subscribeEnhancementTotalsRevision,
  schedule_probe_ledger: subscribeScheduleProbeLedgerRevision,
}

/** 기대는 쿼리의 이름 → 그 쿼리의 열쇠. 열쇠 전체가 같을 때만 그 쿼리가 바뀐 것으로 본다. */
const DEPENDENCY_KEYS: Record<QueryDependency, readonly unknown[]> = {
  'schedule-round': queryKeys.scheduleRound(),
  'tracked-ocids': queryKeys.trackedOcids(),
}

function sameKey(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((part, index) => part === right[index])
}

/** 쿼리가 새 데이터를 들었나. 받아서든 `setQueryData` 로든 성공 데이터가 들어온 사건만 본다. */
function dependencyOf(event: QueryCacheNotifyEvent): QueryDependency | null {
  if (event.type !== 'updated' || event.action.type !== 'success') return null
  for (const name of Object.keys(DEPENDENCY_KEYS) as QueryDependency[]) {
    if (sameKey(event.query.queryKey, DEPENDENCY_KEYS[name])) return name
  }
  return null
}

/**
 * 표 여섯의 판과 쿼리 캐시를 구독한다. 포트 주입 뒤 한 번 부른다.
 *
 * @returns 구독을 전부 떼는 함수. 테스트가 쓴다
 */
export function startRecordInvalidation(client: QueryClient): () => void {
  const stops = (Object.keys(TABLE_SUBSCRIBERS) as RecordTable[]).map((table) =>
    TABLE_SUBSCRIBERS[table](() => {
      void client.invalidateQueries({ predicate: (query) => query.meta?.tables?.includes(table) === true })
    }),
  )
  const stopCache = client.getQueryCache().subscribe((event) => {
    const dependency = dependencyOf(event)
    if (dependency === null) return
    void client.invalidateQueries({ predicate: (query) => query.meta?.dependsOn?.includes(dependency) === true })
  })
  return () => {
    for (const stop of stops) stop()
    stopCache()
  }
}
