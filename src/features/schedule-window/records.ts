/**
 * 창의 관측을 **보스 수익 기록으로 굳히는** 자리.
 *
 * 전에는 지난 기간 백필이 그 기간의 마지막 날 하나를 직접 물어 이 일을 했다. 이제 창이 그
 * 날짜들을 이미 들고 있으므로 **부르지 않고 읽어서** 만든다.
 */
import { monthKeyOf, resetWeekStartOf } from '../../lib/calendar'
import { getBossCycleByName } from '../../lib/boss/boss-matching'
import { findPriceEntry } from '../../lib/boss/boss-crystal-prices'
import {
  getCurrentBossProfitPeriod,
  getMaxQueryableDate,
  getMinQueryableDate,
  getPeriodDateKeys,
  getAdjacentPeriodKey,
  MIN_SCHEDULER_DATE,
} from '../../lib/boss/boss-profit-period'
import { getBossDropRecords } from '../../storage/boss-drops'
import { getBossPartySize } from '../../storage/boss-party-settings'
import { getBossProfitRecords, upsertBossProfitRecord } from '../../storage/boss-profit'
import { getCachedCharacterBasic } from '../../storage/character-basic-cache'
import { getScheduleProbeLedger } from '../../storage/schedule-probe-ledger'
import { BOSS_CYCLES, type BossCycle, type BossDifficulty } from '../../types'
import { migrateDropsToConfirmedDifficulty } from '../boss-profit/drops-loader'
import { withSqliteFallback, withSqliteTimeout } from '../boss-profit/sqlite-guards'
import type { WindowFailure } from './window'

/** 원장의 `이름|난이도` 를 가른다. 보스 이름에는 `|` 가 없다. */
function splitBossKey(key: string): CompletedBoss | null {
  const bar = key.indexOf('|')
  // 난이도는 참조 데이터가 낸 값이 원장을 거쳐 돌아온 것이라 다섯 중 하나다. 값을 다시
  // 검사하지 않는 것은 `rows.ts`·`drop-price-store.ts` 가 같은 단언을 하는 것과 같은 이유다.
  return bar <= 0 ? null : { boss: key.slice(0, bar), difficulty: key.slice(bar + 1) as BossDifficulty }
}

interface CompletedBoss {
  boss: string
  difficulty: BossDifficulty
}

/** 창에 **하루라도 걸치는** 기간들. 걸친 날에서 그 기간의 상태를 읽는다. */
function periodsInWindow(now: Date, floorDateKey: string): { cycle: BossCycle; periodKey: string }[] {
  const periods: { cycle: BossCycle; periodKey: string }[] = []
  for (const cycle of BOSS_CYCLES) {
    let periodKey = getCurrentBossProfitPeriod(cycle, now).periodKey
    for (;;) {
      const days = getPeriodDateKeys(cycle, periodKey)
      if (days[days.length - 1] < floorDateKey) break
      periods.push({ cycle, periodKey })
      periodKey = getAdjacentPeriodKey(cycle, periodKey, 'prev')
    }
  }
  return periods
}

/**
 * 그 기간의 **확정 상태**를 든 관측. 그 기간 안에서 **가장 늦게 관측한 날**의 것이다.
 *
 * 그 날이 곧 조회 가능한 마지막 날이다(창 안 날짜는 전부 부르므로). 조회가 실패한 날이 있으면
 * 그 앞으로 물러나는데, 주간 보스는 리셋까지 완료가 유지되므로 답이 같거나 더 적을 뿐 틀리지 않는다.
 */
function settledObservation(
  dates: Record<string, { kind: string; bosses?: readonly string[] }>,
  cycle: BossCycle,
  periodKey: string,
  ceilingDateKey: string,
): readonly string[] | null {
  const days = getPeriodDateKeys(cycle, periodKey).filter((day) => day <= ceilingDateKey)
  for (const day of [...days].reverse()) {
    const record = dates[day]
    if (record?.kind === 'observed' && record.bosses !== undefined) {
      return record.bosses
    }
  }
  return null
}

/** 이 (캐릭터, 기간)의 완료 보스를 기록으로 굳힌다. **이미 있는 행은 안 건드린다.** */
async function recordPeriod(
  ocid: string,
  cycle: BossCycle,
  periodKey: string,
  completed: readonly CompletedBoss[],
  now: Date,
): Promise<void> {
  if (completed.length === 0) {
    return
  }

  const [existingRecords, dropRecords, cachedBasic] = await Promise.all([
    withSqliteFallback(getBossProfitRecords([ocid], [periodKey]), []),
    withSqliteFallback(getBossDropRecords([ocid], [periodKey]), []),
    getCachedCharacterBasic(ocid).catch(() => null),
  ])
  const world = cachedBasic?.profile.world ?? null

  for (const { boss, difficulty } of completed) {
    // 이관은 `alreadyRecorded` 판정보다 앞에 둔다. 이미 수익 기록이 있든 없든 이 관측이 말하는
    // 처치 난이도는 같고, 아래 continue 들에 막히면 안 된다.
    await migrateDropsToConfirmedDifficulty({ ocid, boss, difficulty, periodKey }, dropRecords, now)

    const alreadyRecorded = existingRecords.some(
      (record) =>
        record.ocid === ocid &&
        record.boss === boss &&
        record.difficulty === difficulty &&
        record.periodKey === periodKey,
    )
    if (alreadyRecorded) continue

    const priceEntry = findPriceEntry(boss, difficulty)
    if (priceEntry === undefined || priceEntry.priceMeso === null) continue

    const partySize = (await withSqliteFallback(getBossPartySize(ocid, boss, difficulty), null)) ?? 1

    await withSqliteTimeout(
      upsertBossProfitRecord({
        ocid,
        boss,
        difficulty,
        cycle,
        periodKey,
        partySize,
        priceMeso: priceEntry.priceMeso,
        payoutMeso: Math.floor(priceEntry.priceMeso / partySize),
        recordedAt: now.toISOString(),
        world,
      }),
    )
  }
}

/** 창에 걸친 모든 기간의 기록을 굳힌다. 창을 채운 **뒤에** 부른다. */
export async function recordBossProfitFromWindow(ocids: readonly string[], now: Date): Promise<void> {
  if (ocids.length === 0) {
    return
  }

  const rollingFloor = getMinQueryableDate(now)
  const floorDateKey = rollingFloor > MIN_SCHEDULER_DATE ? rollingFloor : MIN_SCHEDULER_DATE
  const ceilingDateKey = getMaxQueryableDate(now)
  const periods = periodsInWindow(now, floorDateKey)

  for (const ocid of ocids) {
    const ledger = await getScheduleProbeLedger(ocid, now).catch(() => null)
    if (ledger === null || ledger.unavailable) continue

    for (const { cycle, periodKey } of periods) {
      const bosses = settledObservation(ledger.dates, cycle, periodKey, ceilingDateKey)
      if (bosses === null) continue

      const completed = bosses
        .map(splitBossKey)
        .filter((entry): entry is CompletedBoss => entry !== null)
        .filter((entry) => getBossCycleByName(entry.boss) === cycle)

      // **한 기간의 실패가 나머지를 죽이면 안 된다.** 쓰기는 타임아웃을 성공으로 위장하지 않아
      // 실제로 던지고(`withSqliteTimeout`), 그것이 여기서 새면 뒤의 기간과 뒤의 캐릭터가
      // 통째로 안 써진다. 옛 백필은 (캐릭터, 기간)마다 자기 try 를 가져 그 성질이 있었다.
      try {
        await recordPeriod(ocid, cycle, periodKey, completed, now)
      } catch {
        // 다음 회차가 다시 온다. 이 기간만 비어 있다.
      }
    }
  }
}

/** `${ocid}|${cycle}|${periodKey}` 한 줄로 접은 키. 화면이 캐릭터·기간별 상태를 이 키로 찾는다. */
export function periodStateKey(ocid: string, cycle: BossCycle, periodKey: string): string {
  return `${ocid}|${cycle}|${periodKey}`
}

/**
 * 창이 **확정 관측한** (캐릭터, 기간)들. 화면이 `조회해서 0건` 과 `아직 못 받았다` 를 이걸로 가른다.
 *
 * 전에는 `boss_profit_period_checks` 표가 이 답을 들었다. 이제 조회 원장이 든다. 표를 따로 두면
 * 원장과 어긋나고, 어긋나면 조회한 주가 미조회로 보인다.
 */
export async function loadObservedPeriodKeys(
  ocids: readonly string[],
  now: Date,
): Promise<Set<string>> {
  const observed = new Set<string>()
  if (ocids.length === 0) {
    return observed
  }

  const rollingFloor = getMinQueryableDate(now)
  const floorDateKey = rollingFloor > MIN_SCHEDULER_DATE ? rollingFloor : MIN_SCHEDULER_DATE
  const ceilingDateKey = getMaxQueryableDate(now)
  const periods = periodsInWindow(now, floorDateKey)

  for (const ocid of ocids) {
    const ledger = await getScheduleProbeLedger(ocid, now).catch(() => null)
    if (ledger === null || ledger.unavailable) continue
    for (const { cycle, periodKey } of periods) {
      if (settledObservation(ledger.dates, cycle, periodKey, ceilingDateKey) !== null) {
        observed.add(periodStateKey(ocid, cycle, periodKey))
      }
    }
  }
  return observed
}

/**
 * 못 채운 날짜들을 **그 날이 속한 기간**의 결과로 옮긴다.
 *
 * 한 기간에 여러 실패가 있으면 `failed` 가 이긴다. `notCollected`(집계 전)는 시간이 지나면
 * 저절로 풀리므로, 아직 안 풀린 실패가 섞여 있는데 `아직` 이라고 말하면 안 된다.
 */
export function toPeriodOutcomes(
  failures: readonly WindowFailure[],
): Map<string, 'notCollected' | 'failed'> {
  const outcomes = new Map<string, 'notCollected' | 'failed'>()
  for (const failure of failures) {
    for (const cycle of BOSS_CYCLES) {
      const periodKey = cycle === 'weekly' ? resetWeekStartOf(failure.dateKey) : monthKeyOf(failure.dateKey)
      const key = periodStateKey(failure.ocid, cycle, periodKey)
      if (outcomes.get(key) !== 'failed') {
        outcomes.set(key, failure.outcome)
      }
    }
  }
  return outcomes
}
