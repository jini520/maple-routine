/**
 * 직접 완료를 열어 둔 보스. today 의 안내 줄과 보스 수익의 단추가 이 쿼리를 본다.
 *
 * `staleTime` 이 0 이라 보는 화면이 포커스될 때마다 다시 묻고(`useRefetchStaleOnFocus`), 복귀에도 받는다. 스케줄러 회차에
 * 안 싣는 것은 이 값이 늦게 와서 늘어나는 것이 없어서다. 배너가 늦게 설 뿐이다. 겹친 호출은 쿼리가 하나로 접는다.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getCurrentBossProfitPeriod } from '../../lib/boss/boss-profit-period'
import { fetchManualCompletionBosses } from '../../server/manual-completion'
import type { ManualCompletionBoss } from '../../types/manual-completion'
import { queryKeys } from '../query/keys'
import { useManualCompletionDismissal } from './store'

/** `null` 은 못 받았다는 뜻이고 빈 배열은 아무것도 안 열렸다는 사실이다. */
export const manualCompletionOptions = queryOptions<ManualCompletionBoss[] | null>({
  queryKey: queryKeys.manualCompletion(),
  queryFn: fetchManualCompletionBosses,
  staleTime: 0,
  refetchOnWindowFocus: 'always',
  meta: { source: 'server' },
})

/** 열린 보스가 있고 이번 주에 안 닫았을 때만 참. */
export function isManualCompletionVisible(
  bosses: ManualCompletionBoss[] | null | undefined,
  dismissedWeek: string | null,
  now: Date,
): boolean {
  if (bosses == null || bosses.length === 0) return false
  return getCurrentBossProfitPeriod('weekly', now).periodKey !== dismissedWeek
}

/** 서버가 연 보스. 보스 수익의 행이 단추를 세울지 이것으로 가른다. 못 받았으면 `null`. */
export function useManualCompletionBosses(): ManualCompletionBoss[] | null {
  const { data } = useQuery(manualCompletionOptions)
  return data ?? null
}

export interface ManualCompletionBannerState {
  visible: boolean
  /** 이번 주 동안 줄을 닫는다. 다음 주에는 다시 선다. */
  dismiss: () => Promise<void>
}

export function useManualCompletionBanner(): ManualCompletionBannerState {
  const bosses = useManualCompletionBosses()
  const dismissedWeek = useManualCompletionDismissal((state) => state.dismissedWeek)
  const restore = useManualCompletionDismissal((state) => state.restore)
  useEffect(() => {
    void restore()
  }, [restore])

  const now = new Date()
  const visible = isManualCompletionVisible(bosses, dismissedWeek, now)
  return {
    visible,
    // 줄이 안 서 있으면 닫을 것도 없다. 빈 회차에 키를 적으면 다음 주 판정이 그 값에 걸린다.
    dismiss: () =>
      visible
        ? useManualCompletionDismissal.getState().dismiss(getCurrentBossProfitPeriod('weekly', new Date()).periodKey)
        : Promise.resolve(),
  }
}
