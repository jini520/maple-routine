/**
 * 스케줄 회차를 쿼리 하나로 두고, 결과를 캐릭터 열쇠에 나눠 넣는 자리.
 *
 * 회차 규칙(첫 캐릭터를 먼저 부르고, 전역 실패면 나머지를 캐시로 채운다)은 캐릭터를 따로 부르면 지킬 수 없다. 그래서
 * `scheduleRound()` 쿼리 하나가 `syncSchedules` 를 부르고, 화면은 `schedule(ocid)` · `characterBasic(ocid)` 를 본다.
 *
 * 신선함은 `scheduleStaleTime` 이 정한다(10분 + KST 자정). 자동 진입은 신선하면 캐시로 끝나고, 당김 · 다시 시도는
 * `refreshSchedules` 로 신선해도 받는다. 앱 복귀는 `refetchOnWindowFocus: 'always'` 로 신선해도 한 번 받는다.
 */
import { queryOptions, skipToken } from '@tanstack/react-query'

import type { CachedSchedulerEntry } from '../../storage/scheduler-cache'
import { getCachedSchedulerState } from '../../storage/scheduler-cache'
import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import { scheduleStaleTime } from '../query/freshness'
import { NEXON_QUERY_SOURCE } from '../query/reset-timer'
import { syncSchedules, type CharacterScheduleSync, type ScheduleSyncError } from './schedule-sync'
import { resolveStrandedCharacters, type StrandedCharacter } from './stranded-characters'

/** 한 캐릭터의 회차 결과 종류. 화면이 `isStale` 과 `error` 로 토스트 · 배지를 정한다. */
export interface ScheduleOutcome {
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export interface ScheduleRoundResult {
  /** 회차가 끝난 시각(ISO). 머리의 `hh:mm:ss 기준` 이 아니라 캐시로 채운 결과를 가르는 데 쓴다. */
  fetchedAt: string
  /** 이 회차가 덮은 캐릭터. 추적 목록에 이 밖의 캐릭터가 생기면 회차는 바로 만료다. */
  ocids: string[]
  outcomes: Record<string, ScheduleOutcome>
  /** 동기화가 한 번도 답하지 않은 추적 캐릭터. 자리를 남기고 조회 불가라고 말한다. */
  stranded: StrandedCharacter[]
}

export const trackedOcidsOptions = queryOptions({
  queryKey: queryKeys.trackedOcids(),
  queryFn: () => getTrackedCharacterOcids(),
  // 저장이 `setQueryData` 로 덮는다. 다시 읽을 계기가 없다.
  staleTime: Number.POSITIVE_INFINITY,
})

/** 추적 목록. 아직 안 읽었으면 읽는다. 저장된 적이 없으면 `null` 이다. */
export function readTrackedOcids(): Promise<string[] | null> {
  return queryClient.ensureQueryData(trackedOcidsOptions)
}

export function scheduleOptions(ocid: string) {
  return queryOptions<CachedSchedulerEntry>({
    queryKey: queryKeys.schedule(ocid),
    // 회차가 넣는 값이라 스스로 받지 않는다.
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { persist: true, source: NEXON_QUERY_SOURCE },
  })
}

export function characterBasicOptions(ocid: string) {
  return queryOptions<CachedCharacterBasicEntry>({
    queryKey: queryKeys.characterBasic(ocid),
    queryFn: skipToken,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { persist: true, source: NEXON_QUERY_SOURCE },
  })
}

/** 받은 결과를 캐릭터 열쇠에 넣는다. 캐시로 채운 결과(`isStale`)는 든 값을 덮지 않는다. */
function distribute(results: readonly CharacterScheduleSync[]): Record<string, ScheduleOutcome> {
  const outcomes: Record<string, ScheduleOutcome> = {}
  for (const result of results) {
    if (!result.isStale && result.state !== null && result.syncedAt !== null) {
      queryClient.setQueryData<CachedSchedulerEntry>(
        queryKeys.schedule(result.ocid),
        { state: result.state, syncedAt: result.syncedAt },
        { updatedAt: new Date(result.syncedAt).getTime() },
      )
    }
    outcomes[result.ocid] = { isStale: result.isStale, syncedAt: result.syncedAt, error: result.error }
  }
  return outcomes
}

async function runScheduleRound(): Promise<ScheduleRoundResult> {
  const ocids = (await readTrackedOcids()) ?? []
  if (ocids.length === 0) {
    return { fetchedAt: new Date().toISOString(), ocids: [], outcomes: {}, stranded: [] }
  }
  const results = await syncSchedules(ocids)
  const outcomes = distribute(results)
  const stranded = await resolveStrandedCharacters(ocids, results)
  return { fetchedAt: new Date().toISOString(), ocids, outcomes, stranded }
}

export const scheduleRoundOptions = queryOptions({
  queryKey: queryKeys.scheduleRound(),
  queryFn: runScheduleRound,
  staleTime: (query) =>
    scheduleStaleTime(
      query.state.dataUpdatedAt,
      query.state.data?.ocids ?? [],
      queryClient.getQueryData(queryKeys.trackedOcids()) ?? null,
    ),
  // 돌아오는 것은 지금 상태를 보겠다는 뜻이다(사용자 지정). 신선해도 한 번 받는다.
  refetchOnWindowFocus: 'always',
  meta: { persist: true, source: NEXON_QUERY_SOURCE },
})

/**
 * 신선해도 받는다. 당김 · 다시 시도 · 헤더 버튼이 부른다. 실패는 쿼리 상태에 남고 여기서는 안 던진다.
 * 도는 회차가 있으면 그것을 기다린다.
 */
export async function refreshSchedules(): Promise<void> {
  await queryClient.fetchQuery({ ...scheduleRoundOptions, staleTime: 0 }).catch(() => undefined)
}

/** 만료됐을 때만 받는다. 예열과 설정 뒤 다시 읽기가 부른다. */
export async function prefetchSchedules(): Promise<void> {
  await queryClient.prefetchQuery(scheduleRoundOptions)
}

/**
 * 새로 추적한 캐릭터만 받아 넣는다. 추적 목록을 저장할 때 부른다. 유지되는 캐릭터는 이미 든 값을 그대로 쓴다.
 * 회차가 덮은 목록에 더해 `scheduleStaleTime` 이 빠진 캐릭터로 만료시키지 않게 한다.
 */
export async function syncAddedCharacters(
  added: readonly string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<void> {
  if (added.length === 0) return
  const results = await syncSchedules([...added], onProgress)
  const outcomes = distribute(results)
  const stranded = await resolveStrandedCharacters(added, results)
  queryClient.setQueryData<ScheduleRoundResult>(queryKeys.scheduleRound(), (previous) => ({
    fetchedAt: previous?.fetchedAt ?? new Date().toISOString(),
    ocids: [...new Set([...(previous?.ocids ?? []), ...added])],
    outcomes: { ...(previous?.outcomes ?? {}), ...outcomes },
    stranded: [...(previous?.stranded ?? []).filter((one) => !added.includes(one.ocid)), ...stranded],
  }))
}

/**
 * 1.0.13 전 앱이 Preferences 에 둔 캐시(`schedulerCache:{ocid}` · `characterBasicCache:{ocid}`)를 쿼리 캐시에 옮긴다.
 * 쿼리에 없는 캐릭터만 옮기고, 받은 시각은 캐시의 것을 그대로 쓴다. 버리기만 하면 업데이트 직후 오프라인이거나
 * 점검일 때 화면이 빈다. 옛 키는 아직 다른 읽는 곳(보스 수익 · 13일 창 · 캐릭터 관리)이 있어 지우지 않는다.
 */
export async function seedScheduleQueriesFromLegacyCache(): Promise<void> {
  const ocids = (await readTrackedOcids()) ?? []
  await Promise.all(
    ocids.map(async (ocid) => {
      if (queryClient.getQueryData(queryKeys.schedule(ocid)) === undefined) {
        const cached = await getCachedSchedulerState(ocid).catch(() => null)
        if (cached !== null) {
          queryClient.setQueryData(queryKeys.schedule(ocid), cached, { updatedAt: new Date(cached.syncedAt).getTime() })
        }
      }
      if (queryClient.getQueryData(queryKeys.characterBasic(ocid)) === undefined) {
        const cached = await getCachedCharacterBasic(ocid).catch(() => null)
        if (cached !== null) {
          queryClient.setQueryData(queryKeys.characterBasic(ocid), cached, {
            updatedAt: new Date(cached.cachedAt).getTime(),
          })
        }
      }
    }),
  )
}

/**
 * 저장된 캐시를 올린 뒤 한 번 부른다. 옛 캐시를 옮기고, 회차를 만료로 표시한다. 앱을 켜는 것은 지금 상태를 보겠다는
 * 뜻이라 10분 안이어도 첫 진입은 한 번 받는다.
 */
export async function onQueryCacheRestored(): Promise<void> {
  await seedScheduleQueriesFromLegacyCache().catch(() => undefined)
  await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleRound(), refetchType: 'none' })
}
