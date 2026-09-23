/**
 * 미완료 보스 행에서 고친 **그 기간만의** 파티 인원과 결정석 비율.
 *
 * 한 줄이 있으면 그 (캐릭터, 보스, 난이도, 기간)은 파티 관리 설정을 안 따라간다. 읽는 자리는 전부
 * `override ?? setting` 차례다.
 *
 * 기록 표에 못 넣어서 표가 따로 있다. `boss_profit_records` 에 줄이 생기면 그 조합은 완료로 읽혀
 * (`mergeRecordsIntoRows`), 잡지도 않은 보스가 완료로 선다.
 */
import type { BossPartyShareColumns } from './boss-party-settings'
import { getBossProfitDb } from './sqlite/db'

export interface BossPartyPeriodOverride extends BossPartyShareColumns {
  ocid: string
  /** 보스 key. */
  bossKey: string
  difficulty: string
  /** 주간이면 주차, 월간이면 달. 이 칸이 주기를 겸해서 가른다 */
  periodKey: string
  partySize: number
  updatedAt: string // ISO 8601
}

const UPSERT_SQL = `
  INSERT INTO boss_party_period_overrides
    (ocid, boss_key, difficulty, period_key, party_size,
     crystal_my_share, crystal_shares_total, split_fee_percent, split_fee_auto, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss_key, difficulty, period_key) DO UPDATE SET
    party_size = excluded.party_size,
    crystal_my_share = excluded.crystal_my_share,
    crystal_shares_total = excluded.crystal_shares_total,
    split_fee_percent = excluded.split_fee_percent,
    split_fee_auto = excluded.split_fee_auto,
    updated_at = excluded.updated_at
`

/**
 * 그 기간의 파티 인원과 비율을 한 번에 쓴다. 파티 관리 설정은 안 건드린다.
 *
 * 비율 칸을 안 넘기고 인원만 고치는 길을 두지 않는 것은 `setBossPartySetting` 과 같다. 둘이 따로
 * 가면 화면이 보고 있는 약속과 저장된 약속이 갈린다.
 */
export async function setBossPartyPeriodOverride(override: BossPartyPeriodOverride): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    override.ocid,
    override.bossKey,
    override.difficulty,
    override.periodKey,
    override.partySize,
    override.crystalMyShare,
    override.crystalSharesTotal,
    override.splitFeePercent,
    override.splitFeeAuto === true ? 1 : null,
    override.updatedAt,
  ])
}

function shareColumn(row: Record<string, unknown>, column: string): number | null {
  const value = row[column]
  return typeof value === 'number' ? value : null
}

function rowToOverride(row: Record<string, unknown>): BossPartyPeriodOverride {
  return {
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    difficulty: row.difficulty as string,
    periodKey: row.period_key as string,
    partySize: row.party_size as number,
    crystalMyShare: shareColumn(row, 'crystal_my_share'),
    crystalSharesTotal: shareColumn(row, 'crystal_shares_total'),
    splitFeePercent: shareColumn(row, 'split_fee_percent'),
    splitFeeAuto: Number(row.split_fee_auto) === 1,
    updatedAt: row.updated_at as string,
  }
}

/** 그 조합의 갈라진 값 한 줄. 없으면 `null` 이고 그때는 파티 관리 설정을 따른다. */
export async function getBossPartyPeriodOverride(
  ocid: string,
  bossKey: string,
  difficulty: string,
  periodKey: string,
): Promise<BossPartyPeriodOverride | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_party_period_overrides
     WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ?`,
    [ocid, bossKey, difficulty, periodKey],
  )

  const row = values?.[0]
  return row === undefined ? null : rowToOverride(row)
}

/** 화면이 한 번에 읽는 길. 미완료 행은 지금 기간에만 서므로 기간 목록은 주간·월간 둘이다. */
export async function getBossPartyPeriodOverrides(
  ocids: string[],
  periodKeys: string[],
): Promise<BossPartyPeriodOverride[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_party_period_overrides
     WHERE ocid IN (${ocids.map(() => '?').join(', ')})
       AND period_key IN (${periodKeys.map(() => '?').join(', ')})`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToOverride)
}
