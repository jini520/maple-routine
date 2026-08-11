import { Preferences } from '@capacitor/preferences'
import { getKstDateKeyDaysAgo } from '@core/lib/reset-clock'
import { scheduleProbeKey } from './keys'

/**
 * (ocid, 날짜) 조회 원장 — [[ADR-086]] 결정 4(= [[ADR-067]] 결정 5의 "포기 기록").
 *
 * "이 캐릭터를 이 날짜로 이미 조회했고 결과가 이랬다"를 남겨 **같은 날짜를 두 번 부르지 않게** 한다.
 * 소비자가 둘이다 — ① 후보 자격 스윕(`features/schedule-sync/character-eligibility`)이 미조회
 * 날짜만 호출하고, ② 선채움(`fillMissingSections`, [[ADR-034]])이 "이 날짜는 이미 봤고 그 섹션이
 * 없었다"를 알아 그 날짜를 건너뛴다. ②가 이슈 #87 문제 1(보스 0건 캐릭터의 매 동기화 14회 영구
 * 반복)의 처방이다.
 *
 * **모르는 실패는 기록하지 않는다.** 성공·`OPENAPI00003`·`OPENAPI00004` 만 남기고
 * `OPENAPI00009`(집계 전)·네트워크·타임아웃은 미기록으로 둔다 — 잘못 기록하면 복원 가능한
 * 데이터를 영원히 버린다([[ADR-067]] "모르는 실패 = 재시도 가능"과 같은 방향).
 */

/** 그 날짜 응답에 각 섹션의 **캐릭터 범위** 내용이 있었는가(백필 스킵 판정용). */
export interface ProbeSectionPresence {
  daily: boolean
  weekly: boolean
  weeklyBoss: boolean
  monthlyBoss: boolean
}

export type ScheduleProbeRecord =
  | { kind: 'observed'; hasCompletion: boolean; sections: ProbeSectionPresence }
  // 400 OPENAPI00004 — 그 날짜에 대해 영구. 윈도우 밖·월드 이전 이전([[ADR-067]] 결정 1).
  | { kind: 'outOfRange' }

export interface ScheduleProbeLedger {
  /** 400 `OPENAPI00003` — 이 ocid 는 어느 날짜로도 조회할 수 없다(영구). */
  unavailable: boolean
  dates: Record<string, ScheduleProbeRecord>
}

// 오늘 … 오늘−13. [[ADR-067]] 이 실측으로 확정한 `date` 실효 구간(오늘−13 ~ 오늘−1)에 오늘을 더한 폭이다.
export const PROBE_WINDOW_DAYS = 14

function parseLedger(value: string | null): ScheduleProbeLedger {
  if (value === null) {
    return { unavailable: false, dates: {} }
  }

  try {
    const parsed = JSON.parse(value) as Partial<ScheduleProbeLedger>
    return {
      unavailable: parsed.unavailable === true,
      dates: parsed.dates ?? {},
    }
  } catch {
    return { unavailable: false, dates: {} }
  }
}

async function readLedger(ocid: string): Promise<ScheduleProbeLedger> {
  const { value } = await Preferences.get({ key: scheduleProbeKey(ocid) })
  return parseLedger(value)
}

// YYYY-MM-DD 는 사전순 비교가 곧 날짜 비교라 경계 두 개만 있으면 된다.
function pruneToWindow(ledger: ScheduleProbeLedger, now: Date): ScheduleProbeLedger {
  const newest = getKstDateKeyDaysAgo(now, 0)
  const oldest = getKstDateKeyDaysAgo(now, PROBE_WINDOW_DAYS - 1)

  const dates: Record<string, ScheduleProbeRecord> = {}
  for (const [dateKey, record] of Object.entries(ledger.dates)) {
    if (dateKey >= oldest && dateKey <= newest) {
      dates[dateKey] = record
    }
  }
  return { unavailable: ledger.unavailable, dates }
}

// 원장은 읽고-수정하고-쓰는 구간이라, 자격 스윕과 선채움이 같은 캐릭터에 겹쳐 돌면 한쪽 기록이
// 덮어써져 유실된다(character-basic-cache 인덱스와 동일한 문제·동일한 해법). ocid별로 체인을
// 나눠 서로 다른 캐릭터끼리는 계속 병렬로 쓴다 — 예열은 캐릭터 수만큼 동시에 돈다.
const writeLocks = new Map<string, Promise<void>>()

function withLedgerLock(ocid: string, task: () => Promise<void>): Promise<void> {
  const previous = writeLocks.get(ocid) ?? Promise.resolve()
  const result = previous.then(task, task)
  writeLocks.set(
    ocid,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

/** 윈도우(14일) 밖 날짜는 읽는 시점에 떨어져 나간다 — 만료를 위한 별도 트리거를 두지 않는다. */
export async function getScheduleProbeLedger(ocid: string, now: Date): Promise<ScheduleProbeLedger> {
  return pruneToWindow(await readLedger(ocid), now)
}

export async function recordScheduleProbe(
  ocid: string,
  dateKey: string,
  record: ScheduleProbeRecord,
): Promise<void> {
  await withLedgerLock(ocid, async () => {
    const ledger = await readLedger(ocid)
    await Preferences.set({
      key: scheduleProbeKey(ocid),
      value: JSON.stringify({
        ...ledger,
        dates: { ...ledger.dates, [dateKey]: record },
      }),
    })
  })
}

export async function markScheduleProbeUnavailable(ocid: string): Promise<void> {
  await withLedgerLock(ocid, async () => {
    const ledger = await readLedger(ocid)
    await Preferences.set({
      key: scheduleProbeKey(ocid),
      value: JSON.stringify({ ...ledger, unavailable: true }),
    })
  })
}

export async function clearScheduleProbeLedger(ocid: string): Promise<void> {
  await withLedgerLock(ocid, async () => {
    await Preferences.remove({ key: scheduleProbeKey(ocid) })
  })
}
