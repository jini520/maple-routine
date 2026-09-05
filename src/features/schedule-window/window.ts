/**
 * 스케줄러 조회의 **한 문**.
 *
 * 같은 API 를 부르는 길이 셋이었다. 라이브 동기화 · 지난 기간 백필 · 처치 날짜 캐기. 셋이 각자
 * 언제 부를지를 정하고 겹침도 각자 막았다. 그래서 백필이 그 기간의 마지막 날 하나만 물어
 * `defeated_on` 이 통째로 비었고, 백필 대상이 사용자 이동에 매여 주간 탭에서 월간 보스를 영영
 * 안 불렀다.
 *
 * 여기서는 **탭도 기간도 안 본다.** 관리 캐릭터마다 창 하나를 채운다. 그러면 창 안의 기간은
 * 언제 열어도 이미 값이 있다.
 *
 * 원장이 호출 여부를 든다. 원장을 읽는 다른 셋(자격 스윕 · 선채움 · 날짜 캐기)은 이 함수가
 * 채워 둔 것을 그대로 보므로 **조회가 저절로 0 이 된다.** 지우지 않아도 통합된다.
 */
import { getMaxQueryableDate, getMinQueryableDate, MIN_SCHEDULER_DATE } from '../../lib/boss/boss-profit-period'
import { getKstDateKeyDaysAgo } from '../../lib/scheduler/reset-clock'
import { toProbeObservation } from '../../lib/scheduler/scheduler-activity'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import { getAuthConfig } from '../../storage/api-key'
import {
  getScheduleProbeLedger,
  isSettledProbe,
  markScheduleProbeUnavailable,
  recordScheduleProbe,
} from '../../storage/schedule-probe-ledger'
import { toScheduleSyncError } from '../schedule-sync/errors'
import { mapWithLimit } from './gate'

/**
 * 한 번에 나가는 조회 수. 캐릭터를 가로질러 센다.
 *
 * 서비스 키 한도(초당 500건)를 실측할 방법이 없어 보수적으로 잡았다. 정상 운영에서는 하루에
 * 새로 생기는 날짜가 하나라 캐릭터 수만큼만 나가고, 이 값이 드는 것은 설치·초기화 때뿐이다.
 */
export const WINDOW_CALL_LIMIT = 6

/** 이 캐릭터의 창에서 **아직 확정 관측이 없는** 날짜들. 오름차순. */
function missingDays(
  dates: Record<string, unknown>,
  floorDateKey: string,
  ceilingDateKey: string,
  todayDateKey: string,
): string[] {
  const days: string[] = []
  for (let back = 0; ; back += 1) {
    const dateKey = getKstDateKeyDaysAgo(new Date(`${ceilingDateKey}T12:00:00+09:00`), back)
    if (dateKey < floorDateKey) break
    if (!isSettledProbe(dates[dateKey] as never, dateKey, todayDateKey)) {
      days.push(dateKey)
    }
  }
  return days.reverse()
}

/**
 * 못 채운 날짜 하나. 화면이 **아직** 과 **못 불러왔다** 를 가르는 데 쓴다.
 *
 * `notCollected` 는 집계 전(OPENAPI00009)이라 시간이 지나면 저절로 풀린다. 그 자리에 재시도를
 * 권하면 안 된다.
 */
export interface WindowFailure {
  ocid: string
  dateKey: string
  outcome: 'notCollected' | 'failed'
}

/**
 * 마지막 회차가 못 채운 날짜들. **세션 안에서만 산다.**
 *
 * 창 채우기는 화면을 안 기다리게 하려고 뒤에서 도므로, 그 결과를 화면이 받을 길이 이것뿐이다.
 * 비어 있으면 실패가 없었거나 아직 안 돌았다는 뜻이고, 둘 다 화면은 기록 유무로 판정한다.
 */
let lastFailures: readonly WindowFailure[] = []

export function getLastWindowFailures(): readonly WindowFailure[] {
  return lastFailures
}

/** 테스트 전용. 회차 사이의 잔여 상태를 비운다. */
export function __resetWindowFailuresForTest(): void {
  lastFailures = []
}

/**
 * 창을 채운다. **오늘은 안 부른다** (`date=오늘` 이 400 이라 라이브 동기화가 맡는다).
 *
 * 던지지 않는다. 못 채운 날짜는 원장에 안 남아 다음 회차가 다시 온다.
 */
export async function fillScheduleWindow(ocids: readonly string[], now: Date): Promise<void> {
  if (ocids.length === 0) {
    lastFailures = []
    return
  }

  const authConfig = await getAuthConfig()
  if (authConfig === null) {
    return
  }

  const rollingFloor = getMinQueryableDate(now)
  const floorDateKey = rollingFloor > MIN_SCHEDULER_DATE ? rollingFloor : MIN_SCHEDULER_DATE
  const ceilingDateKey = getMaxQueryableDate(now)
  const todayDateKey = getKstDateKeyDaysAgo(now, 0)

  // 캐릭터 × 날짜를 한 줄로 펴서 게이트에 넘긴다. 캐릭터별로 나눠 돌리면 상한이 캐릭터 수만큼
  // 곱해져 게이트가 뜻을 잃는다.
  const jobs: { ocid: string; dateKey: string }[] = []
  for (const ocid of ocids) {
    const ledger = await getScheduleProbeLedger(ocid, now)
    if (ledger.unavailable) continue
    for (const dateKey of missingDays(ledger.dates, floorDateKey, ceilingDateKey, todayDateKey)) {
      jobs.push({ ocid, dateKey })
    }
  }

  // 이 회차에 못 부르게 된 캐릭터. 400 OPENAPI00003 은 영구라 남은 날짜를 부를 이유가 없다.
  const unavailable = new Set<string>()
  const failures: WindowFailure[] = []

  await mapWithLimit(jobs, WINDOW_CALL_LIMIT, async ({ ocid, dateKey }) => {
    if (unavailable.has(ocid)) return

    let state
    try {
      state = await fetchSchedulerCharacterState(authConfig.apiKey, ocid, dateKey)
    } catch (error) {
      const kind = toScheduleSyncError(error).kind
      if (kind === 'characterUnavailable') {
        unavailable.add(ocid)
        await markScheduleProbeUnavailable(ocid)
        return
      }
      if (kind === 'periodOutOfRange') {
        await recordScheduleProbe(ocid, dateKey, { kind: 'outOfRange' })
        return
      }
      // 집계 전(00009)·429·네트워크·파싱은 **원장에 기록하지 않는다.** 나중에 풀린다.
      // 다만 화면이 `아직` 과 `못 불러왔다` 를 가를 수 있게 이 회차의 사실로는 남긴다.
      failures.push({ ocid, dateKey, outcome: kind === 'notCollected' ? 'notCollected' : 'failed' })
      return
    }

    await recordScheduleProbe(ocid, dateKey, { kind: 'observed', ...toProbeObservation(state) })
  })

  lastFailures = failures
}
