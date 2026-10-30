/**
 * 보스 수익 화면이 스케줄 회차에서 읽는 것. 동기화가 실패한 캐릭터의 배지와 토스트 이름, 회차 자체의 실패다.
 *
 * 스토어에 사본(`error` · `staleCharacterNames` · `characterIssues`)을 두지 않는다. 회차 쿼리가 든 값을 그 자리에서 만든다.
 */
import { useMemo } from 'react'

import { isMaintenanceSyncError } from '../schedule-sync/errors'
import type { ScheduleSyncError } from '../schedule-sync/schedule-sync'
import { useScheduleQueries, type ScheduleSnapshot, type ScheduleStatus } from '../schedule-sync/use-schedule-queries'

/**
 * 동기화가 실패한 캐릭터의 카드에 붙일 표식. `unavailable` 은 400 OPENAPI00003 이라 이 캐릭터를 조회할 수 없다(영구)이고
 * `failed` 는 그 외 실패(네트워크 · 타임아웃)다. 전자는 재시도가 무의미하고 할 수 있는 것이 추적 해제뿐이다.
 */
export type CharacterIssueKind = 'unavailable' | 'failed'

export interface BossProfitRoundView {
  characterIssues: Readonly<Record<string, CharacterIssueKind>>
  /** 토스트가 셀 실패 캐릭터의 이름. 점검은 배너가 말하므로 안 센다. */
  staleCharacterNames: string[]
}

export function buildRoundView(snapshot: ScheduleSnapshot): BossProfitRoundView {
  const characterIssues: Record<string, CharacterIssueKind> = {}
  const staleCharacterNames: string[] = []
  const round = snapshot.round
  if (round === undefined) return { characterIssues, staleCharacterNames }

  for (const [ocid, outcome] of Object.entries(round.outcomes)) {
    if (!outcome.isStale) continue
    characterIssues[ocid] = outcome.error?.kind === 'characterUnavailable' ? 'unavailable' : 'failed'
    if (isMaintenanceSyncError(outcome.error)) continue
    const name = snapshot.schedules.get(ocid)?.state.characterName ?? snapshot.basics.get(ocid)?.profile.name
    if (name !== undefined) staleCharacterNames.push(name)
  }
  // 동기화가 한 번도 답하지 않은 캐릭터. 실패한 캐릭터와 같은 표를 쓴다. 처방이 같다(해제하거나 바꾼다).
  for (const one of round.stranded) characterIssues[one.ocid] = 'unavailable'
  return { characterIssues, staleCharacterNames }
}

export interface BossProfitRound extends BossProfitRoundView {
  status: ScheduleStatus
  /** 회차 자체가 던진 실패(키 없음 등). */
  error: ScheduleSyncError | null
}

export function useBossProfitRound(): BossProfitRound {
  const { snapshot, status, error } = useScheduleQueries()
  const view = useMemo(() => buildRoundView(snapshot), [snapshot])
  return { ...view, status, error }
}
