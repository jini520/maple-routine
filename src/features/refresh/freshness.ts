/**
 * 화면 머리 아래 `hh:mm:ss 기준` 이 읽는 값. **실시간 데이터를 마지막으로 받은 시각 하나**다.
 *
 * 페이지마다 따로 재지 않는다. 화면 다섯이 같은 실시간 원천(스케줄 회차 · 오늘 강화)을 공유하므로, 따로 재면 같은 한
 * 번의 조회로 그린 데이터인데 값이 갈린다. 회차 쿼리의 `dataUpdatedAt` 과 오늘 강화 수집이 넣은 시각 중 늦은 쪽이다.
 * 회차 쿼리는 기기에 저장되므로 앱을 다시 켜도 그 시각이 남는다. 기기 DB 읽기와 과거 기간 조회는 여기 안 닿는다.
 */
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query'

import { queryKeys } from '../query/keys'
import { scheduleRoundOptions } from '../schedule-sync/schedule-query'

export interface EnhancementTodayFetch {
  /** ISO 8601. 오늘이 든 강화 수집이 끝난 시각. */
  fetchedAt: string
}

/** 오늘 강화 수집의 시각. 수집기(`collectEnhancementHistory`)가 `setQueryData` 로 넣고 스스로 받지 않는다. */
export const enhancementTodayOptions = queryOptions<EnhancementTodayFetch>({
  queryKey: queryKeys.enhancementToday(),
  queryFn: skipToken,
  staleTime: Number.POSITIVE_INFINITY,
})

/**
 * 둘 중 늦은 시각. 둘 다 없으면 `null` 이고 그때는 줄을 안 그린다. 못 읽는 값은 버린다.
 *
 * @param roundReceivedAt 회차가 넥슨에서 실제로 받은 마지막 시각. 전원 캐시 폴백인 회차는 이 값을 안 올린다
 * @param enhancementFetchedAt 오늘 강화 수집의 시각
 */
export function latestRealtimeFetchedAt(
  roundReceivedAt: string | null | undefined,
  enhancementFetchedAt: string | undefined,
): string | null {
  const roundMs = roundReceivedAt == null ? Number.NaN : new Date(roundReceivedAt).getTime()
  const enhancementMs = enhancementFetchedAt === undefined ? Number.NaN : new Date(enhancementFetchedAt).getTime()
  if (Number.isNaN(roundMs) && Number.isNaN(enhancementMs)) return null
  if (Number.isNaN(enhancementMs) || roundMs >= enhancementMs) return roundReceivedAt as string
  return enhancementFetchedAt as string
}

export function useRealtimeFetchedAt(): string | null {
  // 보기만 한다(`enabled: false`). 머리 줄 때문에 회차를 받으면 안 된다. 받는 계기는 화면과 복귀가 따로 건다.
  const round = useQuery({ ...scheduleRoundOptions, enabled: false, notifyOnChangeProps: ['data'] })
  const enhancement = useQuery(enhancementTodayOptions)
  return latestRealtimeFetchedAt(round.data?.receivedAt, enhancement.data?.fetchedAt)
}
