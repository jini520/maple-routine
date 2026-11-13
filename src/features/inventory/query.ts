/**
 * 인벤토리 격자의 쿼리. 보스 드롭 · 가계부 · 인벤토리 표의 판이 오르면 무효화된다. 칸이 그 기록에서 세어지기 때문이다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'

import { getCurrentKstDateKey } from '../../lib/scheduler/reset-clock'
import { queryKeys } from '../query/keys'
import { loadInventory, type InventoryView } from './load'

export function inventoryOptions(now: Date) {
  const todayDateKey = getCurrentKstDateKey(now)
  return queryOptions<InventoryView>({
    queryKey: queryKeys.inventory(todayDateKey),
    queryFn: () => loadInventory(todayDateKey, new Date()),
    staleTime: Number.POSITIVE_INFINITY,
    meta: {
      tables: ['boss_drop_records', 'income_records', 'spend_records', 'inventory_items'],
      dependsOn: ['tracked-ocids'],
    },
  })
}

/** 아직 못 읽었으면 `undefined` 다. 화면은 그동안 빈 칸만 그린다. */
export function useInventory(now: Date): { data: InventoryView | undefined; isError: boolean; refetch: () => unknown } {
  const { data, isError, refetch } = useQuery(inventoryOptions(now))
  return { data, isError, refetch }
}
