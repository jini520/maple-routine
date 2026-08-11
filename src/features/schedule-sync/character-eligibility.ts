import { getBackfillDateKeys } from '../../lib/reset-clock'
import { hasCharacterScopeCompletion, toProbeObservation } from '../../lib/scheduler-activity'
import { fetchSchedulerCharacterState } from '@core/nexon/schedule'
import {
  getScheduleProbeLedger,
  markScheduleProbeUnavailable,
  recordScheduleProbe,
  type ScheduleProbeLedger,
} from '../../storage/schedule-probe-ledger'
import type { SchedulerCharacterState } from '@core/types'
import { toScheduleSyncError } from './schedule-sync'

/**
 * 후보 목록에 넣을 자격 — [[ADR-086]] 결정 3·5.
 *
 * - `eligible`   목록에 넣는다
 * - `ineligible` 최근 14일간 활동 증거가 없다 — 추적 중이 아니면 목록에서 뺀다
 * - `unavailable` 400 `OPENAPI00003` — 조회 자체가 불가(영구). 추적 중이면 해제 경로로 남긴다
 */
export type CharacterEligibility = 'eligible' | 'ineligible' | 'unavailable'

/** 이미 가진 원장만으로 내리는 판정 — API를 부르지 않는다. `null` 이면 아직 모른다(스윕이 필요하다). */
function judgeFromLedger(ledger: ScheduleProbeLedger): CharacterEligibility | null {
  if (ledger.unavailable) {
    return 'unavailable'
  }
  const hasCompletion = Object.values(ledger.dates).some(
    (record) => record.kind === 'observed' && record.hasCompletion,
  )
  return hasCompletion ? 'eligible' : null
}

/**
 * 네트워크 없이, 이미 가진 것만으로 내리는 판정([[ADR-086]] 결정 3). 피커의 stub 단계처럼
 * `character/list` 응답을 기다리지 않고 먼저 그려야 하는 자리가 쓴다([[ADR-017]] 결정 6).
 * `'unknown'` 은 "아직 확인하지 못했다"이고, 확인 전에는 목록에 넣지 않는다([[ADR-053]] 결정 1).
 */
export async function readKnownEligibility(
  ocid: string,
  accessFlag: boolean,
  now: Date,
): Promise<CharacterEligibility | 'unknown'> {
  if (accessFlag) {
    return 'eligible'
  }
  return judgeFromLedger(await getScheduleProbeLedger(ocid, now)) ?? 'unknown'
}

/**
 * `access_flag` 가 false 인 캐릭터에게 "최근 14일 안에 활동한 적이 있는가"를 묻는다([[ADR-086]] 결정 3).
 *
 * 호출 비용은 조회 원장이 결정한다 — 이미 본 날짜는 다시 부르지 않으므로, 예열이 한 번 훑고 나면
 * 그 뒤로는 **그날 새로 윈도우에 들어온 날짜 1개**만 남는다(결정 4). 완료를 찾으면 즉시 멈추므로
 * 실제로 게임을 하는 캐릭터는 1~2회에 끝나고, 13일을 다 쓰는 것은 정말 휴면인 캐릭터뿐이다.
 *
 * `todayState` 는 이미 오늘 응답을 손에 쥔 호출부(예열)가 넘긴다 — 같은 호출을 두 번 하지 않기
 * 위해서다. 오늘 응답은 **원장에 기록하지 않는다**: 오늘은 아직 끝나지 않은 날이라 "완료 없음"을
 * 굳히면 그날 안에 접속한 캐릭터가 내일까지 목록에 못 들어온다.
 */
export async function resolveCharacterEligibility(
  apiKey: string,
  ocid: string,
  accessFlag: boolean,
  now: Date,
  todayState?: SchedulerCharacterState | null,
): Promise<CharacterEligibility> {
  // access_flag 는 배제 게이트가 아니라 자격의 **충분조건**이다 — true 면 호출 0회로 통과한다.
  if (accessFlag) {
    return 'eligible'
  }

  const ledger = await getScheduleProbeLedger(ocid, now)
  const known = judgeFromLedger(ledger)
  if (known !== null) {
    return known
  }

  if (todayState != null && hasCharacterScopeCompletion(todayState)) {
    return 'eligible'
  }

  for (const dateKey of getBackfillDateKeys(now)) {
    if (ledger.dates[dateKey] !== undefined) {
      continue
    }

    let dayState: SchedulerCharacterState
    try {
      dayState = await fetchSchedulerCharacterState(apiKey, ocid, dateKey)
    } catch (error) {
      const kind = toScheduleSyncError(error).kind
      if (kind === 'characterUnavailable') {
        await markScheduleProbeUnavailable(ocid)
        return 'unavailable'
      }
      if (kind === 'periodOutOfRange') {
        await recordScheduleProbe(ocid, dateKey, { kind: 'outOfRange' })
        continue
      }
      // notCollected(집계 전)·네트워크·파싱은 기록하지 않는다 — 나중에 다시 시도한다([[ADR-086]] 결정 4).
      continue
    }

    const observation = toProbeObservation(dayState)
    await recordScheduleProbe(ocid, dateKey, { kind: 'observed', ...observation })
    if (observation.hasCompletion) {
      return 'eligible'
    }
  }

  return 'ineligible'
}
