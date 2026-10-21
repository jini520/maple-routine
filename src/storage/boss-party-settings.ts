import { SPLIT_COLUMN_NAMES, crystalSplitValues, numberOrNull } from './boss-periods'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 결정석 비율과 송금 수수료 칸. 비율이 `null` 이면 파티 인원으로 균등 분배다. 아이템 비율은 이 표에 없다 */
export interface BossPartyShareColumns {
  /** 결정석에서 내가 갖는 비율. `null` 은 균등 */
  crystalMyShare: number | null
  /** 결정석 비율의 합 */
  crystalSharesTotal: number | null
  /** 차액 송금의 경매장 수수료율. 3 또는 5 이고 `null` 은 3 */
  splitFeePercent: number | null
  /** 송금 수수료가 등급을 따라가나. 없으면 손으로 고른 값이다 */
  splitFeeAuto?: boolean
}

export interface BossPartySetting extends BossPartyShareColumns {
  ocid: string
  /** 보스 key. */
  bossKey: string
  difficulty: string
  partySize: number
  updatedAt: string // ISO 8601
}

/**
 * 보스 관리 설정은 조합 행(`boss_parties`)의 분배 칸이다. 처치나 드롭이 먼저 만든 조합 행은 분배 칸이 비어
 * 있고, 그 행은 설정이 없는 것으로 읽는다.
 */
const UPSERT_SQL = `
  INSERT INTO boss_parties (id, ocid, boss_key, difficulty, ${SPLIT_COLUMN_NAMES.join(', ')}, created_at, updated_at)
  VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (ocid, boss_key, difficulty) DO UPDATE SET
    ${SPLIT_COLUMN_NAMES.map((column) => `${column} = excluded.${column}`).join(',\n    ')},
    updated_at = excluded.updated_at
`

/** 설정이 있는 조합 행만 읽는 조건. */
const HAS_SETTING = 'split_mode IS NOT NULL'

/**
 * 파티 인원과 결정석 비율을 한 번에 쓴다.
 *
 * **비율 칸을 안 넘기고 인원만 고치는 길을 두지 않는다.** 둘이 따로 가면 화면이 보고 있는 약속과
 * 저장된 약속이 갈린다. 균등으로 되돌리는 것도 비율 칸을 `null` 로 덮는 이 길 하나다.
 */
export async function setBossPartySetting(setting: BossPartySetting): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [
    setting.ocid,
    setting.bossKey,
    setting.difficulty,
    ...crystalSplitValues(setting),
    setting.updatedAt,
    setting.updatedAt,
  ])
}

function rowToSetting(row: Record<string, unknown>): BossPartySetting {
  return {
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    difficulty: row.difficulty as string,
    partySize: row.party_size as number,
    crystalMyShare: numberOrNull(row.my_share),
    crystalSharesTotal: numberOrNull(row.shares_total),
    splitFeePercent: numberOrNull(row.split_fee_percent),
    splitFeeAuto: Number(row.split_fee_auto) === 1,
    updatedAt: row.updated_at as string,
  }
}

export async function getBossPartySize(
  ocid: string,
  bossKey: string,
  difficulty: string,
): Promise<number | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT party_size FROM boss_parties WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND ${HAS_SETTING}`,
    [ocid, bossKey, difficulty],
  )

  const row = values?.[0]
  return row === undefined ? null : (row.party_size as number)
}

/** 그 조합의 설정 한 줄. 자동 기록이 비율까지 함께 읽어야 해서 인원만 주는 함수와 나란히 산다. */
export async function getBossPartySetting(
  ocid: string,
  bossKey: string,
  difficulty: string,
): Promise<BossPartySetting | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_parties WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND ${HAS_SETTING}`,
    [ocid, bossKey, difficulty],
  )

  const row = values?.[0]
  return row === undefined ? null : rowToSetting(row)
}

/**
 * 옛 캐릭터의 설정을 전부 새 캐릭터로 옮겨 적는다. **새 캐릭터에 이미 있는 설정은 안 덮는다.** 처치나 드롭이
 * 먼저 만든 분배 칸 빈 조합 행은 설정이 없는 것이라 채운다.
 *
 * 월드 리프로 두 ocid 가 이어지는 순간 한 번 부른다. 새 캐릭터에서 사용자가 이미 정한 값이 이긴다.
 */
export async function copyMissingBossPartySettings(
  fromOcid: string,
  toOcid: string,
  updatedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  const columns = SPLIT_COLUMN_NAMES.join(', ')
  await db.run(
    `INSERT INTO boss_parties (id, ocid, boss_key, difficulty, ${columns}, created_at, updated_at)
     SELECT ${NEW_UUID_SQL}, ?, boss_key, difficulty, ${columns}, ?, ? FROM boss_parties WHERE ocid = ? AND ${HAS_SETTING}
     ON CONFLICT (ocid, boss_key, difficulty) DO UPDATE SET
       ${SPLIT_COLUMN_NAMES.map((column) => `${column} = excluded.${column}`).join(', ')},
       updated_at = excluded.updated_at
     WHERE boss_parties.split_mode IS NULL`,
    [toOcid, updatedAt, updatedAt, fromOcid],
  )
}

export async function getBossPartySettings(ocids: string[]): Promise<BossPartySetting[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_parties WHERE ocid IN (${ocidPlaceholders}) AND ${HAS_SETTING}`,
    ocids,
  )

  return (values ?? []).map(rowToSetting)
}
