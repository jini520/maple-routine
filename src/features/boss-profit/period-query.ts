/**
 * 보스 수익 한 기간을 드는 쿼리 `bossProfitPeriod(tab, periodKey)`. 화면은 `useBossProfitPeriod` 로 보고 today 는 이번 주 열쇠를 본다.
 *
 * 기간마다 쿼리가 따로라 느린 회차가 다른 기간의 화면을 덮을 수 없다. 전에는 스토어가 회차 번호로 그것을 막았다. 기록 · 드롭 ·
 * 조회 원장의 판이 오르거나 스케줄 회차가 새 데이터를 들면 무효화된다(`features/query/invalidation.ts`).
 */
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { create } from 'zustand'

import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import type { BossCycle } from '../../types'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import type { RecordTable } from '../query/meta'
import { readTrackedOcids } from '../schedule-sync/schedule-query'
import { loadObservedPeriodKeys, loadUnqueryablePeriodKeys } from '../schedule-window/records'
import { buildPeriodSnapshot, periodNeedsWindowSync, resolveDisplayOcids, type PeriodSnapshot } from './period-snapshot'
import { resolvePeriodWindow } from './period-window'

/** 이 쿼리가 읽는 표. 지난 기간의 상태는 기록 없이 조회 원장만으로도 바뀐다. */
export const PERIOD_TABLES: readonly RecordTable[] = ['boss_profit_records', 'boss_drop_records', 'schedule_probe_ledger']

function periodCacheKey(tab: BossCycle, periodKey: string): string {
  return `${tab}|${periodKey}`
}

interface WindowSyncState {
  /** 창 동기화를 기다리는 기간(`periodCacheKey`). 없으면 `null`. 화면이 이것으로 불러오는 중을 그린다. */
  syncingKey: string | null
}

const useWindowSyncState = create<WindowSyncState>()(() => ({ syncingKey: null }))

export function bossProfitPeriodOptions(tab: BossCycle, periodKey: string) {
  return queryOptions<PeriodSnapshot>({
    queryKey: queryKeys.bossProfitPeriod(tab, periodKey),
    queryFn: async () => {
      const ocids = (await readTrackedOcids()) ?? []
      const key = periodCacheKey(tab, periodKey)
      try {
        return await buildPeriodSnapshot({
          tab,
          periodKey,
          ocids,
          now: new Date(),
          onWindowSyncStart: () => useWindowSyncState.setState({ syncingKey: key }),
        })
      } finally {
        if (useWindowSyncState.getState().syncingKey === key) useWindowSyncState.setState({ syncingKey: null })
      }
    },
    staleTime: Number.POSITIVE_INFINITY,
    meta: { tables: PERIOD_TABLES, dependsOn: ['schedule-round'] },
  })
}

export interface BossProfitPeriod {
  /** 아직 한 번도 못 읽었으면 `null`. 기간을 옮기면 새 값이 올 때까지 앞 기간의 값이 그대로다. */
  snapshot: PeriodSnapshot | null
  /**
   * `snapshot` 이 어느 기간의 것인가. 카운트업의 신원이 이것이어야 새 기간 키에 옛 금액이 기억되지 않는다.
   * 보고 있는 `tab` · `periodKey` 는 데이터보다 먼저 바뀐다.
   */
  loadedTab: BossCycle
  loadedPeriodKey: string
  /** 이 기간이 창 동기화를 기다리는 중인가. 그동안 화면은 행 대신 불러오는 중을 그린다. */
  isWindowSyncing: boolean
}

export function useBossProfitPeriod(tab: BossCycle, periodKey: string): BossProfitPeriod {
  const query = useQuery({ ...bossProfitPeriodOptions(tab, periodKey), placeholderData: keepPreviousData })
  const [loaded, setLoaded] = useState({ tab, periodKey })
  const settled = query.data !== undefined && !query.isPlaceholderData
  // 이 기간의 값이 섰으면 그 자리에서 신원을 맞춘다. 렌더 중의 상태 조정이라 그 커밋에 값과 신원이 함께 도착한다.
  // 효과로 미루면 한 커밋 동안 새 값에 옛 신원이 붙어 카운트업이 옛 금액을 기억한다.
  if (settled && (loaded.tab !== tab || loaded.periodKey !== periodKey)) {
    setLoaded({ tab, periodKey })
  }

  useEffect(() => {
    if (!settled) return
    // 이 기간이 섰으니 앞뒤 기간을 미리 읽는다. 화살표를 눌렀을 때 기다리지 않게.
    void prefetchPeriodWindow(tab, periodKey)
  }, [settled, tab, periodKey, query.dataUpdatedAt])

  const syncingKey = useWindowSyncState((state) => state.syncingKey)
  return {
    snapshot: query.data ?? null,
    loadedTab: loaded.tab,
    loadedPeriodKey: loaded.periodKey,
    isWindowSyncing: syncingKey === periodCacheKey(tab, periodKey),
  }
}

/** 지금 도는 미리 읽기의 번호. 새 미리 읽기가 시작되면 앞의 것은 남은 기간을 안 읽는다. */
let prefetchToken = 0

/**
 * 보는 기간의 앞뒤 기간을 차례로 읽어 둔다(`period-window.ts`). 창 동기화가 있어야 답이 나오는 기간은 건너뛴다.
 * 배경에서 넥슨을 부르지도, 조회 전의 빈 상태를 0건 확정으로 굳히지도 않는다. 사용자가 실제로 가면 그때 돈다.
 */
export async function prefetchPeriodWindow(tab: BossCycle, periodKey: string): Promise<void> {
  prefetchToken += 1
  const token = prefetchToken
  const now = new Date()
  const ocids = (await readTrackedOcids().catch(() => null)) ?? []
  // 창도 화살표와 같은 목록으로 계산한다. 추적 목록으로 계산하면 실제로 갈 기간이 아닌 곳을 미리 채운다.
  const displayOcids = await resolveDisplayOcids(ocids)
  const window = await resolvePeriodWindow(tab, periodKey, displayOcids, now)
  const [observedKeys, unqueryableKeys] = await Promise.all([
    loadObservedPeriodKeys(ocids, now),
    loadUnqueryablePeriodKeys(ocids, now),
  ])

  for (const entry of window) {
    if (token !== prefetchToken) return
    if (entry.tab === tab && entry.periodKey === periodKey) continue
    const state = queryClient.getQueryState(queryKeys.bossProfitPeriod(entry.tab, entry.periodKey))
    if (state?.data !== undefined && !state.isInvalidated) continue
    if (periodNeedsWindowSync(entry.tab, entry.periodKey, ocids, observedKeys, unqueryableKeys, now)) continue
    await queryClient.prefetchQuery(bossProfitPeriodOptions(entry.tab, entry.periodKey))
  }
}

/** 이번 주 기간을 미리 읽는다. today 의 보스 수익 위젯이 첫 페인트에 그릴 값이다. 부팅 예열이 부른다. */
export async function prefetchCurrentWeekProfit(): Promise<void> {
  await queryClient.prefetchQuery(bossProfitPeriodOptions('weekly', getCurrentBossProfitPeriod('weekly', new Date()).periodKey))
}

/** 이 기간을 신선해도 다시 읽는다. 실패한 기간의 다시 시도와 조회 버튼이 부른다. */
export async function refetchPeriod(tab: BossCycle, periodKey: string): Promise<void> {
  await queryClient.refetchQueries({ queryKey: queryKeys.bossProfitPeriod(tab, periodKey), exact: true })
}

/** 이 기간의 스냅샷을 캐시에서 읽는다. 스토어의 쓰기가 행을 찾을 때 쓴다. */
export function readPeriodSnapshot(tab: BossCycle, periodKey: string): PeriodSnapshot | undefined {
  return queryClient.getQueryData<PeriodSnapshot>(queryKeys.bossProfitPeriod(tab, periodKey))
}
