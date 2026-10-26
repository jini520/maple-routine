/**
 * 미완료 보스 행에서 고친 **그 기간만의** 파티 인원과 결정석 비율.
 *
 * 한 줄이 있으면 그 (캐릭터, 보스, 난이도, 기간)은 파티 관리 설정을 안 따라간다. 읽는 자리는 전부
 * `override ?? setting` 차례다.
 *
 * 처치 기록과 같은 기간 행(`boss_party_periods`)의 분배 칸이다. 'open' 행이고, 처치하면 'cleared' 가 되며 처치
 * 값으로 덮인다. 드롭만 있는 'open' 행은 분배 칸이 비어 있어 그 기간 값이 아니다.
 */
import {
  PERIODS_JOIN,
  PERIOD_KEY_WHERE,
  SPLIT_COLUMN_NAMES,
  crystalSplitValues,
  ensurePartyId,
  cycleOfPeriodKey,
  numberOrNull,
  periodKeyValues,
} from './boss-periods'
import type { BossPartyShareColumns } from './boss-party-settings'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'

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

/** 처치한 기간('cleared')은 건드리지 않는다. 처치 기록의 값이 그 기간의 값이다. */
const UPSERT_SQL = `
  INSERT INTO boss_party_periods
    (id, party_id, period_key, cycle, clear_status, ${SPLIT_COLUMN_NAMES.join(', ')}, created_at, updated_at)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (party_id, period_key) DO UPDATE SET
    ${SPLIT_COLUMN_NAMES.map((column) => `${column} = excluded.${column}`).join(',\n    ')},
    updated_at = excluded.updated_at
  WHERE boss_party_periods.clear_status = 'open'
`

/** 그 기간 값인 행만 고르는 조건. */
const HAS_OVERRIDE = `pe.clear_status = 'open' AND pe.split_mode IS NOT NULL`

const OVERRIDE_SELECT = `
  SELECT pa.ocid, pa.boss_key, pa.difficulty, pe.period_key, pe.party_size, pe.my_share, pe.shares_total,
         pe.split_fee_percent, pe.split_fee_auto, pe.updated_at
    FROM ${PERIODS_JOIN}`

/**
 * 그 기간의 파티 인원과 비율을 한 번에 쓴다. 파티 관리 설정은 안 건드린다.
 *
 * 비율 칸을 안 넘기고 인원만 고치는 길을 두지 않는 것은 `setBossPartySetting` 과 같다. 둘이 따로
 * 가면 화면이 보고 있는 약속과 저장된 약속이 갈린다.
 */
export async function setBossPartyPeriodOverride(override: BossPartyPeriodOverride): Promise<void> {
  const db = await getBossProfitDb()
  const partyId = await ensurePartyId(db, override.ocid, override.bossKey, override.difficulty, override.updatedAt)
  await db.run(UPSERT_SQL, [
    partyId,
    override.periodKey,
    cycleOfPeriodKey(override.periodKey),
    ...crystalSplitValues(override),
    override.updatedAt,
    override.updatedAt,
  ])
}

function rowToOverride(row: Record<string, unknown>): BossPartyPeriodOverride {
  return {
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    difficulty: row.difficulty as string,
    periodKey: row.period_key as string,
    partySize: row.party_size as number,
    crystalMyShare: numberOrNull(row.my_share),
    crystalSharesTotal: numberOrNull(row.shares_total),
    splitFeePercent: numberOrNull(row.split_fee_percent),
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
    `${OVERRIDE_SELECT} WHERE ${HAS_OVERRIDE} AND ${PERIOD_KEY_WHERE}`,
    periodKeyValues({ ocid, bossKey, difficulty, periodKey }),
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
    `${OVERRIDE_SELECT}
     WHERE ${HAS_OVERRIDE}
       AND pa.ocid IN (${ocids.map(() => '?').join(', ')})
       AND pe.period_key IN (${periodKeys.map(() => '?').join(', ')})`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToOverride)
}
