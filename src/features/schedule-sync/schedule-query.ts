/**
 * 스케줄 회차를 쿼리 하나로 두고, 결과를 캐릭터 열쇠에 나눠 넣는 자리.
 *
 * 회차 규칙(첫 캐릭터를 먼저 부르고, 전역 실패면 나머지를 캐시로 채운다)은 캐릭터를 따로 부르면 지킬 수 없다. 그래서
 * `scheduleRound()` 쿼리 하나가 `syncSchedules` 를 부르고, 화면은 `schedule(ocid)` · `characterBasic(ocid)` 를 본다.
 *
 * 신선함은 `scheduleStaleTime` 이 정한다(5분 + KST 자정). 자동 진입은 신선하면 캐시로 끝나고, 당김 · 다시 시도는
 * `refreshSchedules` 로 신선해도 받는다. 앱 복귀는 `refetchOnWindowFocus: 'always'` 로 신선해도 한 번 받는다. 배경에 가서
 * 끊긴 회차는 실패로 남기지 않는다(`isCutByBackground`).
 */
import { focusManager, queryOptions, skipToken } from '@tanstack/react-query'

import type { CachedSchedulerEntry } from '../../storage/scheduler-cache'
import { clearCachedSchedulerState, getCachedSchedulerState } from '../../storage/scheduler-cache'
import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import { clearCachedCharacterBasic, getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getTrackedCharacterOcids } from '../../storage/character-selection'
import { readLegacyEventWorldNames, readLegacyMesoRates, runLegacyCleanupOnce } from '../../storage/legacy-cleanup'
import { resolveDefeatDates } from '../boss-profit/defeat-dates'
import { recordBossProfitFromRound } from '../boss-profit/round-record'
import { backgroundedAt } from '../query/app-focus'
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
  /** 회차가 끝난 시각(ISO). 캐시로 채운 결과를 가르는 데 쓴다. */
  fetchedAt: string
  /**
   * 넥슨에서 **실제로 받은** 마지막 시각(ISO). 머리의 `hh:mm:ss 기준` 이 읽는다. 전원이 캐시로 채워진 회차(401 · 429 ·
   * 점검)는 이전 값을 그대로 든다. 쿼리의 `dataUpdatedAt` 은 그런 회차에도 오르므로 그것으로 그리면 아무것도 안 받은
   * 진입이 방금 받은 것처럼 보인다. 받은 적이 없으면 `null`.
   */
  receivedAt: string | null
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

/**
 * 받은 스케줄로 지금 기간의 보스 수익을 기록하고 처치 날짜를 캔다. 동기화 뒤에 이 차례로 한다. 없는 기록은 날짜를 캘 수
 * 없다. 둘은 던져도 회차를 깨지 않는다. 기록이 덜 된 것은 다음 회차가 다시 하고, 받은 스케줄은 이미 캐시에 들었다.
 */
async function recordAfterSync(
  ocids: readonly string[],
  results: readonly CharacterScheduleSync[],
  requestedAt: Date,
): Promise<void> {
  const now = new Date()
  await recordBossProfitFromRound(ocids, results, now, requestedAt).catch(() => undefined)
  await resolveDefeatDates(ocids, now).catch(() => undefined)
}

/** 이번에 실제로 받은 결과 중 가장 늦은 시각. 전부 캐시로 채웠으면 이전 회차의 값이다. */
function latestReceivedAt(results: readonly CharacterScheduleSync[], previous: string | null): string | null {
  let latest: string | null = null
  for (const result of results) {
    if (result.isStale || result.syncedAt === null) continue
    if (latest === null || result.syncedAt > latest) latest = result.syncedAt
  }
  return latest ?? previous
}

function previousReceivedAt(): string | null {
  return queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())?.receivedAt ?? null
}

const roundReceivedListeners = new Set<() => void>()

/** OS 가 깨운 배경 실행의 회차인가. 그 회차는 서버 동기화를 깨우지 않는다. */
let inBackground = false

/**
 * 회차가 넥슨에서 실제로 받으면 부를 함수를 건다. 셸이 서버 동기화를 깨우려고 건다. 하나도 받지 못한 회차와 배경 실행의 회차는
 * 부르지 않는다. 동기화는 화면에 보일 기록을 맞추는 일이고, 배경 실행은 OS 가 주는 시간이 짧다.
 *
 * @returns 떼는 함수
 */
export function subscribeScheduleRoundReceived(listener: () => void): () => void {
  roundReceivedListeners.add(listener)
  return () => {
    roundReceivedListeners.delete(listener)
  }
}

/** 받은 결과가 하나라도 있으면 듣는 쪽을 부른다. 기다리지 않는다. 회차가 받은 스케줄로 화면을 먼저 그린다. */
function announceReceived(results: readonly CharacterScheduleSync[]): void {
  if (inBackground || !results.some((result) => !result.isStale && result.syncedAt !== null)) return
  for (const listener of roundReceivedListeners) listener()
}

/** 회차 하나를 넥슨에서 받는 함수. `requestedAt` 은 묻기 직전의 시각이고, 기록할 때 기간이 바뀌었으면 받은 완료는 지난 기간의 것이다. */
async function receiveRound(ocids: string[]): Promise<{ requestedAt: Date; results: CharacterScheduleSync[] }> {
  const requestedAt = new Date()
  return { requestedAt, results: await syncSchedules(ocids) }
}

/**
 * 회차가 도는 중에 앱이 배경에 가서 끊긴 회차인가. iOS 는 배경에 간 앱의 진행 중인 요청을 끊어, 그 캐릭터가 네트워크 실패로
 * 끝난다. 사용자는 잠깐 나갔다 왔을 뿐이라 동기화 실패로 남기지 않는다.
 */
function isCutByBackground(results: readonly CharacterScheduleSync[], requestedAt: Date): boolean {
  const leftAt = backgroundedAt()
  if (leftAt === null || leftAt < requestedAt.getTime()) return false
  return results.some((result) => result.isStale && result.error?.kind === 'network')
}

async function runScheduleRound(): Promise<ScheduleRoundResult> {
  const ocids = (await readTrackedOcids()) ?? []
  if (ocids.length === 0) {
    return { fetchedAt: new Date().toISOString(), receivedAt: previousReceivedAt(), ocids: [], outcomes: {}, stranded: [] }
  }
  let { requestedAt, results } = await receiveRound(ocids)
  if (!inBackground && isCutByBackground(results, requestedAt)) {
    // 아직 배경이면 앞 회차를 그대로 둔다. 돌아오면 복귀 규칙이 새 회차를 돌린다.
    if (!focusManager.isFocused()) {
      const previous = queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound())
      if (previous !== undefined) return previous
    } else {
      // 복귀 신호가 이 회차가 도는 중에 왔으면 복귀가 이 회차를 함께 쓴다. 다시 돌리지 않으면 복귀에 받은 것이 끊긴 결과다.
      ;({ requestedAt, results } = await receiveRound(ocids))
    }
  }
  const outcomes = distribute(results)
  const stranded = await resolveStrandedCharacters(ocids, results)
  await recordAfterSync(ocids, results, requestedAt)
  announceReceived(results)
  return {
    fetchedAt: new Date().toISOString(),
    receivedAt: latestReceivedAt(results, previousReceivedAt()),
    ocids,
    outcomes,
    stranded,
  }
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

/** OS 가 깨운 배경 실행의 회차. 신선해도 받고, 서버 동기화는 깨우지 않는다. */
export async function refreshSchedulesInBackground(): Promise<void> {
  inBackground = true
  try {
    await refreshSchedules()
  } finally {
    inBackground = false
  }
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
  const requestedAt = new Date()
  const results = await syncSchedules([...added], onProgress)
  const outcomes = distribute(results)
  const stranded = await resolveStrandedCharacters(added, results)
  await recordAfterSync(added, results, requestedAt)
  queryClient.setQueryData<ScheduleRoundResult>(queryKeys.scheduleRound(), (previous) => ({
    fetchedAt: previous?.fetchedAt ?? new Date().toISOString(),
    receivedAt: latestReceivedAt(results, previous?.receivedAt ?? null),
    ocids: [...new Set([...(previous?.ocids ?? []), ...added])],
    outcomes: { ...(previous?.outcomes ?? {}), ...outcomes },
    stranded: [...(previous?.stranded ?? []).filter((one) => !added.includes(one.ocid)), ...stranded],
  }))
}

/**
 * 1.0.13 전 앱이 Preferences 에 둔 캐시(`schedulerCache:{ocid}` · `characterBasicCache:{ocid}`)를 쿼리 캐시에 옮기고 그 키를
 * 지운다. 쿼리에 없는 캐릭터만 옮기고, 받은 시각은 캐시의 것을 그대로 쓴다. 버리기만 하면 업데이트 직후 오프라인이거나
 * 점검일 때 화면이 빈다. 옮긴 뒤에는 쿼리 캐시가 드므로 지운다.
 *
 * 지우기 실패는 던진다. 표식이 안 남아 다음 실행이 다시 옮기려다 쿼리에 이미 있어 건너뛰고 또 지운다.
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
      await clearCachedSchedulerState(ocid)
      if (queryClient.getQueryData(queryKeys.characterBasic(ocid)) === undefined) {
        const cached = await getCachedCharacterBasic(ocid).catch(() => null)
        if (cached !== null) {
          queryClient.setQueryData(queryKeys.characterBasic(ocid), cached, {
            updatedAt: new Date(cached.cachedAt).getTime(),
          })
        }
      }
      await clearCachedCharacterBasic(ocid)
    }),
  )
}

/** 1.0.13 전 앱이 남긴 메소 획득량과 이벤트 월드 이름을 쿼리에 심는다. 쿼리에 든 값이 더 새것이라 덮지 않는다. */
async function seedMesoRatesAndEventNames(): Promise<void> {
  for (const [ocid, percent] of await readLegacyMesoRates()) {
    if (queryClient.getQueryData(queryKeys.mesoRate(ocid)) === undefined) {
      queryClient.setQueryData(queryKeys.mesoRate(ocid), percent)
    }
  }
  const names = await readLegacyEventWorldNames()
  if (names !== null && queryClient.getQueryData(queryKeys.eventWorldNames()) === undefined) {
    queryClient.setQueryData(queryKeys.eventWorldNames(), names)
  }
}

async function seedQueriesFromLegacyKeys(): Promise<void> {
  await seedScheduleQueriesFromLegacyCache()
  await seedMesoRatesAndEventNames()
}

/**
 * 저장된 캐시를 올린 뒤 한 번 부른다. 옛 캐시를 옮기고, 회차를 만료로 표시한다. 앱을 켜는 것은 지금 상태를 보겠다는
 * 뜻이라 신선해도 첫 진입은 한 번 받는다.
 */
export async function onQueryCacheRestored(): Promise<void> {
  await runLegacyCleanupOnce(seedQueriesFromLegacyKeys).catch(() => undefined)
  await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleRound(), refetchType: 'none' })
}
