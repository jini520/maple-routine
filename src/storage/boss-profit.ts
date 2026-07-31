import { getBossProfitDb } from './sqlite/db'
import type { BossCycle } from '../types/scheduler'

export interface BossProfitRecord {
  ocid: string
  boss: string
  difficulty: string
  cycle: BossCycle
  periodKey: string
  partySize: number
  priceMeso: number
  payoutMeso: number
  recordedAt: string // ISO 8601
  /**
   * 기록 시점의 월드 스냅샷([[ADR-069]] 결정 1). `null` 이면 "월드 모름"이고 월드별 결정석 집계에서
   * 제외된다([[ADR-054]] 결정 5의 기존 처리를 그대로 탄다).
   *
   * 파생값(캐시된 `character/basic` 의 `world_name`)으로 두면 **월드 리프가 모든 과거 주의 귀속을
   * 소급 이동**시킨다 — 분모(`90 × 월드 수`)까지 바뀐다. 판매 한도가 월드마다 따로 산정된다는
   * 사실(사용자 확인)과 정면으로 어긋나므로 기록에 박아 고정한다.
   */
  world: string | null
}

const UPSERT_SQL = `
  INSERT INTO boss_profit_records
    (ocid, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, recorded_at, world)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss, difficulty, period_key) DO UPDATE SET
    cycle = excluded.cycle,
    party_size = excluded.party_size,
    price_meso = excluded.price_meso,
    payout_meso = excluded.payout_meso,
    recorded_at = excluded.recorded_at,
    -- 월드는 아는 값이 있을 때만 덮어쓴다. 파티원 수 수정처럼 월드를 모르는 경로에서 upsert가
    -- 일어나도(그때 world를 null로 넘긴다) 이미 박아둔 스냅샷을 지우지 않는다.
    world = COALESCE(excluded.world, boss_profit_records.world)
`

export async function upsertBossProfitRecord(record: BossProfitRecord): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    record.ocid,
    record.boss,
    record.difficulty,
    record.cycle,
    record.periodKey,
    record.partySize,
    record.priceMeso,
    record.payoutMeso,
    record.recordedAt,
    record.world,
  ])
}

const FILL_MISSING_WORLD_SQL = `
  UPDATE boss_profit_records SET world = ? WHERE ocid = ? AND world IS NULL
`

/**
 * `world` 가 비어 있는 기존 기록을 **지금 아는 월드**로 채운다([[ADR-069]] 결정 3).
 *
 * 컬럼을 새로 더했으므로 그전 기록에는 월드가 없다. `NULL` 로 두면 안전하지만 기존 사용자의 과거 주
 * 결정석 칩이 통째로 사라지고, 현재 월드로 채우면 **이미 리프한 캐릭터의 과거만** 잘못 고정된다 —
 * 아직 실사용자가 없어(사용자 확인 2026-07-31) 후자를 택했다. **배포 후에는 할 수 없는 선택이므로
 * 지금 하지 않으면 비용이 커진다.**
 *
 * `world IS NULL` 조건이 멱등성을 보장한다 — 한 번 채워진 기록은 이후 호출에 걸리지 않으므로 리프
 * 후에 다시 실행돼도 과거 스냅샷을 덮어쓰지 않는다.
 */
export async function fillMissingRecordWorlds(worldByOcid: Map<string, string>): Promise<void> {
  if (worldByOcid.size === 0) {
    return
  }
  const db = await getBossProfitDb()
  for (const [ocid, world] of worldByOcid) {
    await db.run(FILL_MISSING_WORLD_SQL, [world, ocid])
  }
}

function rowToRecord(row: Record<string, unknown>): BossProfitRecord {
  return {
    ocid: row.ocid as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    cycle: row.cycle as BossCycle,
    periodKey: row.period_key as string,
    partySize: row.party_size as number,
    priceMeso: row.price_meso as number,
    payoutMeso: row.payout_meso as number,
    recordedAt: row.recorded_at as string,
    // 컬럼을 더하기 전 기록에는 없다 — undefined도 null로 정규화해 호출부가 한 형태만 다루게 한다.
    world: (row.world as string | null | undefined) ?? null,
  }
}

export async function getBossProfitRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<BossProfitRecord[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodKeyPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders}) AND period_key IN (${periodKeyPlaceholders})`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToRecord)
}

/**
 * 이 기간 **또는 그보다 과거**에 기록이 하나라도 있는지 확인한다([[ADR-068]] 결정 5).
 *
 * 이전 기간 게이트(`canReachPreviousPeriod`)가 **바로 이전 한 칸만** 봐서, 기록이 없는 기간이 벽이
 * 되어 그 뒤의 기록 전체가 화면에서 사라졌다 — 3·4주차에 접속하지 않은 캐릭터는 1·2주차 기록이
 * DB에 남아 있어도 도달할 수 없었다(이슈 #78). 키 목록을 열거하는 `getBossProfitRecords` 로는 답할
 * 수 없어(그 목록이 무한히 길어진다) 부등호 비교를 SQL에 맡긴다.
 *
 * `tab` 이 기준을 정한다 — 주간 탭은 weekly 기록만 보고, 월간 탭은 그 달의 monthly 기록과 **그 달에
 * 속한 weekly 기록**을 함께 본다(화면이 둘을 함께 그리므로, `hasCachedRecordsForPeriod` 와 같은 규약).
 * weekly `period_key` 는 `YYYY-MM-DD` 라 앞 7자가 그 달이다.
 */
export async function hasBossProfitRecordsAtOrBefore(
  ocids: string[],
  tab: BossCycle,
  periodKey: string,
): Promise<boolean> {
  if (ocids.length === 0) {
    return false
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const condition =
    tab === 'monthly'
      ? `((cycle = 'monthly' AND period_key <= ?) OR (cycle = 'weekly' AND substr(period_key, 1, 7) <= ?))`
      : `(cycle = 'weekly' AND period_key <= ?)`
  const parameters = tab === 'monthly' ? [...ocids, periodKey, periodKey] : [...ocids, periodKey]

  const { values } = await db.query(
    `SELECT 1 FROM boss_profit_records WHERE ocid IN (${ocidPlaceholders}) AND ${condition} LIMIT 1`,
    parameters,
  )

  return (values?.length ?? 0) > 0
}
