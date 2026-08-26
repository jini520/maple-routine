/**
 * 처치 **날짜**를 캐낸다 — [[ADR-172]] · 이슈 #239.
 *
 * `boss_profit_records` 의 `period_key` 는 주(목요일)·달이라 «며칟날 잡았나» 를 못 든다. 그런데
 * 스케줄러 API 도 그것을 **직접 알려 주지 않는다** — `date=D` 응답은 «D 시점의 완료 현황» 이라
 * 주간 보스가 완료로 보이면 «D 또는 그 이전(같은 주)» 이다.
 *
 * **답은 두 날의 차이에 있다.** D−1 이 미완료이고 D 가 완료이면 그 보스는 D 에 잡혔다. 그래서 이
 * 모듈이 하는 일은 «한 날짜를 조회» 가 아니라 **«그 기간의 날짜들을 훑어 뒤집힌 지점을 찾기»** 다.
 *
 * ## 비용이 보스 수가 아니라 날짜 수다
 *
 * 응답 하나가 그 캐릭터의 **그날 보스 전부**를 담으므로, 한 주를 훑으면 그 주의 모든 보스가
 * 한꺼번에 풀린다 — 캐릭터당 주 7회가 상한이다. 날짜끼리 서로를 모르므로 **한꺼번에 나간다**
 * ([[ADR-148]] 결정 1).
 *
 * ## 두 번 불려도 안 겹친다
 *
 * 부르는 자리가 둘이다(결정 9) — 보스 수익 동기화 뒤와 가계부 진입. 겹침을 막는 것이 둘이다:
 * **조회 원장**이 «이미 본 날짜» 를 들고([[ADR-086]] 결정 4 + `bosses`), 아래 `inFlight` 가 같은
 * 순간에 두 번 도는 것을 막는다. 그래서 이 함수는 **어디서 몇 번 불려도 결과가 같다.**
 */
import { getAuthConfig } from '../../storage/api-key'
import {
  MIN_SCHEDULER_DATE,
  getAdjacentPeriodKey,
  getCurrentBossProfitPeriod,
  getMaxQueryableDate,
  getMinQueryableDate,
  getPeriodDateKeys,
} from '../../lib/boss-profit-period'
import { getCurrentKstDateKey } from '../../lib/reset-clock'
import { bossCompletionKey, toProbeObservation } from '../../lib/scheduler-activity'
import { fetchSchedulerCharacterState } from '../../nexon/schedule'
import {
  getUndatedBossProfitRecords,
  setBossProfitDefeatedOn,
  type UndatedBossProfitRecord,
} from '../../storage/boss-profit'
import {
  getScheduleProbeLedger,
  markScheduleProbeUnavailable,
  recordScheduleProbe,
} from '../../storage/schedule-probe-ledger'
import { BOSS_CYCLES, type BossCycle } from '../../types'
import { toScheduleSyncError } from '../schedule-sync/errors'
import { withSqliteFallback } from './sqlite-guards'

export interface DefeatDateInput {
  /** 그 기간의 날짜들 — **오름차순**(`getPeriodDateKeys`). 오늘 뒤는 안 본다. */
  readonly periodDays: readonly string[]
  /** 관측한 날짜 → 그날 완료로 본 보스 키 집합. **없는 날짜는 «못 봤다»** 이지 «완료 0건» 이 아니다. */
  readonly observed: ReadonlyMap<string, ReadonlySet<string>>
  readonly todayDateKey: string
  /** `bossCompletionKey(boss, difficulty)` — 기록의 키와 같은 이름·같은 난이도여야 한다. */
  readonly bossKey: string
}

/**
 * 이 보스를 **며칟날 잡았나** — 모르면 `null` 이다([[ADR-172]] 결정 2·3).
 *
 * 시작일부터 훑는다. 셋 중 하나로 끝난다:
 *
 * | 만나는 것 | 답 |
 * |---|---|
 * | 그날 완료로 관측됐다 | **그날이다** — 그 앞은 전부 미완료로 봤다 |
 * | 못 본 날인데 그날이 **오늘**이다 | **오늘이다**(소거법 — 어제까지 미완료인데 기록이 있다) |
 * | 못 본 날인데 오늘이 아니다 | **`null`** — 구멍이라 그 뒤의 완료를 못 믿는다 |
 *
 * 소거법이 (a)«앱이 기록한 날» 과 다른 점: **어제가 미완료였다는 관측**이 있어야만 오늘이라고
 * 말한다. 하루 뒤에 열었다면 어제가 완료로 관측되어 어제로 적힌다. 이 함수는 **틀린 날짜를 만들
 * 수 없고**, 만들 수 있는 것은 `null` 뿐이다.
 */
export function resolveDefeatedOn(input: DefeatDateInput): string | null {
  for (const day of input.periodDays) {
    // 아직 오지 않은 날에 잡을 수는 없다. 기간은 오늘 뒤로도 이어질 수 있다(진행 중인 주).
    if (day > input.todayDateKey) {
      return null
    }

    const seen = input.observed.get(day)
    if (seen === undefined) {
      return day === input.todayDateKey ? day : null
    }
    if (seen.has(input.bossKey)) {
      return day
    }
  }
  return null
}

interface ResolvablePeriod {
  cycle: BossCycle
  periodKey: string
}

/**
 * 지금 **캐낼 수 있는** 기간들 — 기간의 **첫 날**이 조회 창 안이어야 한다([[ADR-172]] 결정 4).
 *
 * 첫 날을 못 보면 «그 앞엔 없었다» 를 말할 수 없어 어떤 조회도 답을 못 낸다. 그래서 그 기간은
 * 캐는 대상이 아니라 **부르지도 않는 대상**이다.
 *
 * 그래서 월간(달 1일)은 **달의 앞 2주 안에서만** 캘 수 있다. 그 뒤에 잡은 검은마법사는 영영 NULL 이다.
 */
function resolvablePeriods(now: Date, floorDateKey: string): ResolvablePeriod[] {
  const periods: ResolvablePeriod[] = []
  for (const cycle of BOSS_CYCLES) {
    let periodKey = getCurrentBossProfitPeriod(cycle, now).periodKey
    // 한 칸씩 과거로 가며 첫 날이 창 안인 동안만 담는다 — 첫 날은 단조 감소라 반드시 끝난다.
    while (getPeriodDateKeys(cycle, periodKey)[0] >= floorDateKey) {
      periods.push({ cycle, periodKey })
      periodKey = getAdjacentPeriodKey(cycle, periodKey, 'prev')
    }
  }
  return periods
}

/** 이 캐릭터를 위해 **아직 안 본 날짜**들 — 창 안이고, 원장이 답을 안 들고 있는 날. */
function missingDays(
  ledgerDates: Record<string, { kind: string; bosses?: readonly string[] }>,
  periods: ResolvablePeriod[],
  floorDateKey: string,
  ceilingDateKey: string,
): string[] {
  const days = new Set<string>()
  for (const period of periods) {
    for (const day of getPeriodDateKeys(period.cycle, period.periodKey)) {
      if (day < floorDateKey || day > ceilingDateKey) continue
      const record = ledgerDates[day]
      // `outOfRange` 는 그 날짜에 대해 영구다([[ADR-067]] 결정 1) — 다시 부르지 않는다.
      if (record?.kind === 'outOfRange') continue
      // **`bosses` 가 없는 관측은 미조회로 친다.** 이 칸이 생기기 전에 남은 기록이라 보스를 안 봤고,
      // 빈 배열(«그날 완료 0건»)로 읽으면 처치일이 그 뒤 어느 날로 밀린다([[ADR-172]] 결정 5).
      if (record?.kind === 'observed' && record.bosses !== undefined) continue
      days.add(day)
    }
  }
  return [...days]
}

/** 한 캐릭터의 미조회 날짜를 훑어 관측을 모은다. 실패한 날은 **비워 둔다**(구멍 → 확정 안 함). */
async function probeDays(
  apiKey: string,
  ocid: string,
  days: string[],
): Promise<Map<string, ReadonlySet<string>>> {
  const observed = new Map<string, ReadonlySet<string>>()

  await Promise.all(
    days.map(async (dateKey) => {
      let state
      try {
        state = await fetchSchedulerCharacterState(apiKey, ocid, dateKey)
      } catch (error) {
        const kind = toScheduleSyncError(error).kind
        if (kind === 'characterUnavailable') {
          await markScheduleProbeUnavailable(ocid)
          return
        }
        if (kind === 'periodOutOfRange') {
          await recordScheduleProbe(ocid, dateKey, { kind: 'outOfRange' })
          return
        }
        // 집계 전(00009)·네트워크·파싱은 **기록하지 않는다** — 나중에 풀린다([[ADR-086]] 결정 4).
        return
      }

      const observation = toProbeObservation(state)
      await recordScheduleProbe(ocid, dateKey, { kind: 'observed', ...observation })
      observed.set(dateKey, new Set(observation.bosses))
    }),
  )

  return observed
}

const EMPTY_OBSERVED: ReadonlyMap<string, ReadonlySet<string>> = new Map()

/** 기록 하나의 날짜 판정 — 기간의 날짜들과 보스 키를 그 기록에서 뽑아 순수 함수에 넘긴다. */
function resolveFor(
  record: UndatedBossProfitRecord,
  observed: ReadonlyMap<string, ReadonlySet<string>>,
  todayDateKey: string,
): string | null {
  return resolveDefeatedOn({
    periodDays: getPeriodDateKeys(record.cycle, record.periodKey),
    observed,
    todayDateKey,
    bossKey: bossCompletionKey(record.boss, record.difficulty),
  })
}

/** 이 기록들이 걸쳐 있는 기간들 — 조회할 날짜를 그 기간에서만 뽑는다. */
function periodsOf(records: readonly UndatedBossProfitRecord[]): ResolvablePeriod[] {
  const seen = new Map<string, ResolvablePeriod>()
  for (const record of records) {
    seen.set(`${record.cycle}:${record.periodKey}`, {
      cycle: record.cycle,
      periodKey: record.periodKey,
    })
  }
  return [...seen.values()]
}

let inFlight: Promise<number> | null = null

/**
 * 아직 날짜를 모르는 보스 기록을 캐내 `defeated_on` 을 채운다. **채운 건수**를 돌려준다 —
 * 0 이면 화면이 다시 읽을 이유가 없다.
 *
 * 한 번도 API 를 안 부르는 길이 넷이다: 캐릭터가 없다 · 캘 수 있는 기간에 **미확정 기록이 없다** ·
 * **가진 관측만으로 다 풀렸다**(리셋 당일·소거법) · 키가 없다. 정상 상태(전부 캐 놓은 뒤)가 그
 * 둘째라, 화면을 오갈 때마다 호출이 나가지 않는다.
 *
 * **키가 없어도 채울 수 있는 것은 채운다** — 소거법과 리셋 당일은 조회가 필요 없다(결정 3).
 */
export async function resolveDefeatDates(ocids: readonly string[], now: Date): Promise<number> {
  // 두 화면이 같은 순간에 부를 수 있다(결정 9). 원장은 **차례로** 부를 때만 겹침을 막으므로,
  // 동시에 도는 것은 여기서 하나로 접는다 — 아니면 같은 날짜가 두 번 나간다.
  if (inFlight !== null) {
    return inFlight
  }
  inFlight = runResolveDefeatDates(ocids, now).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runResolveDefeatDates(ocids: readonly string[], now: Date): Promise<number> {
  if (ocids.length === 0) {
    return 0
  }

  const rollingFloor = getMinQueryableDate(now)
  const floorDateKey = rollingFloor > MIN_SCHEDULER_DATE ? rollingFloor : MIN_SCHEDULER_DATE
  const ceilingDateKey = getMaxQueryableDate(now)
  const todayDateKey = getCurrentKstDateKey(now)

  const periods = resolvablePeriods(now, floorDateKey)
  const candidates = await withSqliteFallback(
    getUndatedBossProfitRecords(
      [...ocids],
      periods.map((period) => period.periodKey),
    ),
    [],
  )
  if (candidates.length === 0) {
    return 0
  }

  /**
   * **키는 조회할 때만 필요하다** — 여기서 막지 않는다(2026-08-27 실사용 조사).
   *
   * 소거법과 리셋 당일은 **관측이 하나도 없어도 답이 나온다**([[ADR-172]] 결정 3). 키 검사를 함수
   * 맨 앞에 두었더니 조회할 것이 없는 건까지 0 으로 나갔고, 키를 지운 기기에서는 오늘 잡은 보스가
   * 영영 캘린더에 안 찍혔다.
   */
  const authConfig = await getAuthConfig()

  const byOcid = new Map<string, UndatedBossProfitRecord[]>()
  for (const candidate of candidates) {
    const bucket = byOcid.get(candidate.ocid)
    if (bucket === undefined) byOcid.set(candidate.ocid, [candidate])
    else bucket.push(candidate)
  }

  // 조회는 캐릭터끼리 나란히, **쓰기는 뒤에서 차례로**. 단일 공유 커넥션이라 동시에 쓰면 트랜잭션이
  // 겹쳐 던진다(`auto-record.ts` 가 같은 이유로 순차다).
  const observedByOcid = await Promise.all(
    [...byOcid.entries()].map(async ([ocid, records]) => {
      const ledger = await getScheduleProbeLedger(ocid, now)
      if (ledger.unavailable) {
        return [ocid, new Map<string, ReadonlySet<string>>()] as const
      }

      const observed = new Map<string, ReadonlySet<string>>()
      for (const [dateKey, record] of Object.entries(ledger.dates)) {
        if (record.kind === 'observed' && record.bosses !== undefined) {
          observed.set(dateKey, new Set(record.bosses))
        }
      }

      // **가진 것으로 먼저 풀어 본다.** 원장이 이미 답을 들고 있으면(다른 경로가 훑어 둔 날짜들)
      // 호출이 0회다 — 그러지 않으면 «이미 아는 것» 을 확인하려고 그 주를 다시 훑게 된다.
      const unresolved = records.filter(
        (record) => resolveFor(record, observed, todayDateKey) === null,
      )
      // 키가 없으면 **부를 수가 없다** — 가진 것으로 푼 만큼만 채우고 나머지는 NULL 로 둔다.
      if (unresolved.length > 0 && authConfig !== null) {
        const days = missingDays(ledger.dates, periodsOf(unresolved), floorDateKey, ceilingDateKey)
        for (const [dateKey, keys] of await probeDays(authConfig.apiKey, ocid, days)) {
          observed.set(dateKey, keys)
        }
      }
      return [ocid, observed] as const
    }),
  )
  const observedFor = new Map(observedByOcid)

  let dated = 0
  for (const candidate of candidates) {
    const defeatedOn = resolveFor(
      candidate,
      observedFor.get(candidate.ocid) ?? EMPTY_OBSERVED,
      todayDateKey,
    )
    if (defeatedOn === null) continue

    await withSqliteFallback(setBossProfitDefeatedOn(candidate, defeatedOn), undefined)
    dated += 1
  }
  return dated
}
