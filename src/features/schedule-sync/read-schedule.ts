/**
 * React 밖에서 스케줄 캐시를 읽는 함수. 화면은 `useScheduleQueries` 를 쓰고, 스토어 · 계산기 · 동기화처럼 렌더 밖에서 읽는
 * 곳이 이것을 쓴다. 둘이 같은 캐시를 보므로 값이 갈리지 않는다.
 */
import { clearPastPeriodProgress } from '../../lib/scheduler/scheduler-merge'
import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import type { CachedSchedulerEntry } from '../../storage/scheduler-cache'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import type { ScheduleRoundResult } from './schedule-query'
import type { ScheduleSnapshot } from './use-schedule-queries'

/** 캐릭터 하나의 마지막 스케줄. 받은 적이 없으면 `null`. */
export function readScheduleEntry(ocid: string): CachedSchedulerEntry | null {
  return queryClient.getQueryData<CachedSchedulerEntry>(queryKeys.schedule(ocid)) ?? null
}

/** 캐릭터 하나의 마지막 `character/basic`. 받은 적이 없으면 `null`. */
export function readCharacterBasic(ocid: string): CachedCharacterBasicEntry | null {
  return queryClient.getQueryData<CachedCharacterBasicEntry>(queryKeys.characterBasic(ocid)) ?? null
}

/** `character/basic` 을 받아 둔 캐릭터 전부. 추적 목록과 무관하게 캐시에 든 것을 센다. */
export function readCachedBasicOcids(): string[] {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: ['character-basic'] })
    .flatMap((query) => (query.state.data === undefined ? [] : [String(query.queryKey[1])]))
}

/**
 * 화면에 넘길 스케줄. 받은 뒤 초기화 시각을 넘긴 주기는 진행을 비운다. 새로 받기 전이나 받기에 실패했을 때 지난 기간의
 * 완료가 이번 기간 이름으로 서지 않게 하려는 것이다. 캐시는 다음 회차의 병합이 이전 상태로 읽으므로 고치지 않는다.
 */
export function toCurrentPeriodEntry(entry: CachedSchedulerEntry, now: Date): CachedSchedulerEntry {
  const state = clearPastPeriodProgress(entry.state, entry.syncedAt, now)
  return state === entry.state ? entry : { ...entry, state }
}

/** 화면에 넘길 스케줄 스냅샷. 각 스케줄은 `toCurrentPeriodEntry` 를 거친다. */
export function readScheduleSnapshot(now: Date = new Date()): ScheduleSnapshot {
  const ocids = queryClient.getQueryData<string[] | null>(queryKeys.trackedOcids()) ?? []
  const schedules = new Map<string, CachedSchedulerEntry>()
  const basics = new Map<string, CachedCharacterBasicEntry>()
  for (const ocid of ocids) {
    const entry = readScheduleEntry(ocid)
    if (entry !== null) schedules.set(ocid, toCurrentPeriodEntry(entry, now))
    const basic = readCharacterBasic(ocid)
    if (basic !== null) basics.set(ocid, basic)
  }
  return {
    ocids,
    schedules,
    basics,
    round: queryClient.getQueryData<ScheduleRoundResult>(queryKeys.scheduleRound()),
  }
}

/** 추적 목록을 캐시에서 읽는다. 아직 안 읽었으면 `null` 이다(저장소를 읽지 않는다). */
export function readTrackedOcidsSync(): string[] | null {
  return queryClient.getQueryData<string[] | null>(queryKeys.trackedOcids()) ?? null
}
