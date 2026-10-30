/**
 * React 밖에서 스케줄 캐시를 읽는 함수. 화면은 `useScheduleQueries` 를 쓰고, 스토어 · 계산기처럼 렌더 밖에서 읽는
 * 곳이 이것을 쓴다. 둘이 같은 캐시를 보므로 값이 갈리지 않는다.
 */
import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import type { CachedSchedulerEntry } from '../../storage/scheduler-cache'
import { queryClient } from '../query/client'
import { queryKeys } from '../query/keys'
import type { ScheduleRoundResult } from './schedule-query'
import type { ScheduleSnapshot } from './use-schedule-queries'

export function readScheduleSnapshot(): ScheduleSnapshot {
  const ocids = queryClient.getQueryData<string[] | null>(queryKeys.trackedOcids()) ?? []
  const schedules = new Map<string, CachedSchedulerEntry>()
  const basics = new Map<string, CachedCharacterBasicEntry>()
  for (const ocid of ocids) {
    const entry = queryClient.getQueryData<CachedSchedulerEntry>(queryKeys.schedule(ocid))
    if (entry !== undefined) schedules.set(ocid, entry)
    const basic = queryClient.getQueryData<CachedCharacterBasicEntry>(queryKeys.characterBasic(ocid))
    if (basic !== undefined) basics.set(ocid, basic)
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
