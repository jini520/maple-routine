/**
 * 화면이 스케줄 캐시를 보는 훅. 추적 목록 · 회차 · 캐릭터마다의 스케줄과 기본 정보를 한 스냅샷으로 낸다.
 *
 * `useQuery(scheduleRound)` 가 곧 자동 진입이다. 마운트에 만료면 받고, 앱이 돌아오면 신선해도 받는다. 캐릭터 열쇠는
 * 회차가 넣는 값이라 스스로 받지 않고 보기만 한다.
 */
import { useCallback, useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'

import type { CachedCharacterBasicEntry } from '../../storage/character-basic-cache'
import type { CharacterBasicProfile } from '../../types'
import type { CachedSchedulerEntry } from '../../storage/scheduler-cache'
import {
  characterBasicOptions,
  scheduleOptions,
  scheduleRoundOptions,
  trackedOcidsOptions,
  type ScheduleRoundResult,
} from './schedule-query'
import { toScheduleSyncError, type ScheduleSyncError } from './errors'

export type ScheduleStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface ScheduleSnapshot {
  /** 추적 목록 순서 그대로. 아직 안 읽었으면 빈 배열이고 `trackedOcids` 가 `null` 이다. */
  ocids: readonly string[]
  schedules: ReadonlyMap<string, CachedSchedulerEntry>
  basics: ReadonlyMap<string, CachedCharacterBasicEntry>
  round: ScheduleRoundResult | undefined
}

export interface ScheduleQueries {
  snapshot: ScheduleSnapshot
  /** 회차의 상태. `loading` 은 도는 중이고 그동안 캐릭터 열쇠의 값은 그대로 보인다. */
  status: ScheduleStatus
  /** 회차 자체가 던진 실패(키 없음 등). 캐릭터마다의 실패는 스냅샷의 `round.outcomes` 에 있다. */
  error: ScheduleSyncError | null
  /** `null` 은 0명이 아니라 저장소를 아직 안 읽었다 다. */
  trackedOcids: string[] | null
}

/** 추적 캐릭터 목록. 저장이 덮는 값이라 이 훅으로 읽은 곳은 저장과 함께 바뀐다. */
export function useTrackedOcids(): string[] | null {
  const { data } = useQuery(trackedOcidsOptions)
  return data ?? null
}

function toMap<T>(ocids: readonly string[], values: readonly (T | undefined)[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>()
  ocids.forEach((ocid, index) => {
    const value = values[index]
    if (value !== undefined) map.set(ocid, value)
  })
  return map
}

export function useScheduleQueries(): ScheduleQueries {
  const trackedOcids = useTrackedOcids()
  const ocids = useMemo(() => trackedOcids ?? [], [trackedOcids])
  const round = useQuery(scheduleRoundOptions)

  // `combine` 이 렌더마다 새 함수면 결과도 렌더마다 새로 만들어져 아래 스냅샷이 매번 바뀐다. 목록이 바뀔 때만 새로 만든다.
  const combineSchedules = useCallback(
    (results: { data: CachedSchedulerEntry | undefined }[]) => toMap(ocids, results.map((result) => result.data)),
    [ocids],
  )
  const combineBasics = useCallback(
    (results: { data: CachedCharacterBasicEntry | undefined }[]) => toMap(ocids, results.map((result) => result.data)),
    [ocids],
  )
  const schedules = useQueries({ queries: ocids.map((ocid) => scheduleOptions(ocid)), combine: combineSchedules })
  const basics = useQueries({ queries: ocids.map((ocid) => characterBasicOptions(ocid)), combine: combineBasics })

  const snapshot = useMemo<ScheduleSnapshot>(
    () => ({ ocids, schedules, basics, round: round.data }),
    [ocids, schedules, basics, round.data],
  )

  const status: ScheduleStatus =
    round.fetchStatus === 'fetching'
      ? 'loading'
      : round.status === 'error'
        ? 'error'
        : round.status === 'success'
          ? 'loaded'
          : 'idle'

  return {
    snapshot,
    status,
    error: round.status === 'error' ? toScheduleSyncError(round.error) : null,
    trackedOcids,
  }
}

/**
 * 추적 캐릭터 전원의 프로필. 캐시에 없는 캐릭터는 항목이 없다. 이름 없이 카드를 그릴 수 없고 ocid 는 사용자에게 뜻이
 * 없는 값이라 대신 넣지 않는다. 회차나 캐릭터 관리가 `character/basic` 을 받으면 그 자리에서 바뀐다.
 */
export function useCharacterProfiles(): Readonly<Record<string, CharacterBasicProfile>> {
  const trackedOcids = useTrackedOcids()
  const ocids = useMemo(() => trackedOcids ?? [], [trackedOcids])
  const combine = useCallback(
    (results: { data: CachedCharacterBasicEntry | undefined }[]) =>
      Object.fromEntries(
        results.flatMap((result, index) => (result.data === undefined ? [] : [[ocids[index], result.data.profile] as const])),
      ),
    [ocids],
  )
  return useQueries({ queries: ocids.map((ocid) => characterBasicOptions(ocid)), combine })
}
