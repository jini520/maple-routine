import { getBackfillDateKeys } from '../../lib/scheduler/reset-clock'
import { hasCharacterScopeCompletion, toProbeObservation } from '../../lib/scheduler/scheduler-activity'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import {
  getScheduleProbeLedger,
  markScheduleProbeUnavailable,
  recordScheduleProbe,
  type ScheduleProbeLedger,
} from '../../storage/schedule-probe-ledger'
import type { SchedulerCharacterState } from '../../types'
// 정의처에서 직접 가져온다. `schedule-sync.ts` 는 이것을 재수출만 하는데, 그 파일이 다시
// `character-roster.ts` → 이 파일을 부르므로 거기서 가져오면 런타임 import 사이클이 된다
// (`character-roster.ts` 도 같은 이유로 `./errors` 를 직접 본다).
import { toScheduleSyncError } from './errors'

/**
 * 후보 목록에 넣을 자격.
 *
 * - `eligible`   목록에 넣는다
 * - `ineligible` 최근 14일간 활동 증거가 없다. 추적 중이 아니면 목록에서 뺀다
 * - `unavailable` 400 `OPENAPI00003`. 조회 자체가 불가(영구). 추적 중이면 해제 경로로 남긴다
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
 * 네트워크 없이, 이미 가진 것만으로 내리는 판정. 피커의 stub 단계처럼
 * `character/list` 응답을 기다리지 않고 먼저 그려야 하는 자리가 쓴다.
 * `'unknown'` 은 "아직 확인하지 못했다"이고, 확인 전에는 목록에 넣지 않는다.
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

/** 한 날짜가 스윕에 남기는 것. 날짜끼리 독립이라 이것만 모으면 판정이 선다. */
type DayOutcome = 'completion' | 'observed' | 'unavailable' | 'skipped'

/**
 * `access_flag` 가 false 인 캐릭터에게 "최근 14일 안에 활동한 적이 있는가"를 묻는다.
 *
 * 호출 비용은 조회 원장이 결정한다. 이미 본 날짜는 다시 부르지 않으므로, 예열이 한 번 훑고 나면
 * 그 뒤로는 **그날 새로 윈도우에 들어온 날짜 1개**만 남는다(결정 4).
 *
 * **미조회 날짜는 한꺼번에 나간다**. 옛 루프는 하루씩 순서대로 물으며 완료를
 * 찾은 날짜에서 멈췄는데, 이 함수가 피커의 캐릭터별 체인 안에서 `character/basic` **뒤에** 붙어
 * 있어서 그 직렬 구간이 그대로 캐릭터가 화면에 뜨는 시간 이었다(최대 13 RTT). 날짜끼리는 서로를
 * 모르므로 — 각 날짜가 하는 일은 원장에 기록 과 완료를 봤는가 뿐이다. 순서를 없애도 답이
 * 바뀌지 않는다. 바뀌는 것은 **조기 종료가 아끼던 호출**뿐이고(결정 2), 그 대가는 서비스 단계 키의
 * 초당 500건 예산 안에서 치른다(개발 단계 키는 온보딩을 통과하지 못한다).
 *
 * `todayState` 는 이미 오늘 응답을 손에 쥔 호출부(예열)가 넘긴다. 같은 호출을 두 번 하지 않기
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
  // access_flag 는 배제 게이트가 아니라 자격의 **충분조건**이다. true 면 호출 0회로 통과한다.
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

  const dateKeys = getBackfillDateKeys(now).filter((dateKey) => ledger.dates[dateKey] === undefined)

  const outcomes = await Promise.all(
    dateKeys.map(async (dateKey): Promise<DayOutcome> => {
      let dayState: SchedulerCharacterState
      try {
        dayState = await fetchSchedulerCharacterState(apiKey, ocid, dateKey)
      } catch (error) {
        const kind = toScheduleSyncError(error).kind
        if (kind === 'characterUnavailable') {
          // 여러 날짜가 함께 003 이면 여기도 여러 번 불린다. ocid 별 락 안의 멱등한 쓰기라 무해하다.
          await markScheduleProbeUnavailable(ocid)
          return 'unavailable'
        }
        if (kind === 'periodOutOfRange') {
          await recordScheduleProbe(ocid, dateKey, { kind: 'outOfRange' })
          return 'skipped'
        }
        // notCollected(집계 전)·네트워크·파싱은 기록하지 않는다. 나중에 다시 시도한다.
        return 'skipped'
      }

      const observation = toProbeObservation(dayState)
      await recordScheduleProbe(ocid, dateKey, { kind: 'observed', ...observation })
      return observation.hasCompletion ? 'completion' : 'observed'
    }),
  )

  // **`unavailable` 이 `completion` 을 이긴다**. 위 `judgeFromLedger` 가 원장을
  // 그 순서로 읽으므로(unavailable 먼저), 여기서 뒤집으면 같은 입력에 이번 회차와 다음 회차의 답이
  // 갈린다. 003 은 **그 ocid 는 어느 날짜로도 조회 불가** 라 실제로 섞일 일이 없고, 이 줄은 그 전제가
  // 깨졌을 때의 안전망이다.
  if (outcomes.includes('unavailable')) {
    return 'unavailable'
  }
  return outcomes.includes('completion') ? 'eligible' : 'ineligible'
}
