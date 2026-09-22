import { bossNameOf } from '../lib/boss/bosses'
import { getBossProfitDb } from './sqlite/db'

/** 비율 칸 다섯. 전부 `null` 이면 파티 인원으로 균등 분배다. */
export interface BossPartyShareColumns {
  /** 결정석에서 내가 갖는 비율. `null` 은 균등 */
  crystalMyShare: number | null
  /** 결정석 비율의 합 */
  crystalSharesTotal: number | null
  dropMyShare: number | null
  dropSharesTotal: number | null
  /** 차액 송금의 경매장 수수료율. 3 또는 5 이고 `null` 은 3 */
  splitFeePercent: number | null
}

export interface BossPartySetting extends BossPartyShareColumns {
  ocid: string
  /** 보스 key. */
  bossKey: string
  difficulty: string
  partySize: number
  updatedAt: string // ISO 8601
}

const SHARE_COLUMNS = [
  'crystal_my_share',
  'crystal_shares_total',
  'drop_my_share',
  'drop_shares_total',
  'split_fee_percent',
] as const

const UPSERT_SQL = `
  INSERT INTO boss_party_settings
    (ocid, boss_key, boss, difficulty, party_size, ${SHARE_COLUMNS.join(', ')}, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss_key, difficulty) DO UPDATE SET
    boss = excluded.boss,
    party_size = excluded.party_size,
    ${SHARE_COLUMNS.map((column) => `${column} = excluded.${column}`).join(',\n    ')},
    updated_at = excluded.updated_at
`

/**
 * 파티 인원과 분배 비율을 한 번에 쓴다.
 *
 * **비율 칸을 안 넘기고 인원만 고치는 길을 두지 않는다.** 둘이 따로 가면 화면이 보고 있는 약속과
 * 저장된 약속이 갈린다. 균등으로 되돌리는 것도 비율 칸을 `null` 로 덮는 이 길 하나다.
 */
export async function setBossPartySetting(setting: BossPartySetting): Promise<void> {
  const db = await getBossProfitDb()
  // 이름 칸은 적을 때의 이름이다. 기록 표들과 모양을 맞춘다.
  await db.run(UPSERT_SQL, [
    setting.ocid,
    setting.bossKey,
    bossNameOf(setting.bossKey, setting.bossKey),
    setting.difficulty,
    setting.partySize,
    setting.crystalMyShare,
    setting.crystalSharesTotal,
    setting.dropMyShare,
    setting.dropSharesTotal,
    setting.splitFeePercent,
    setting.updatedAt,
  ])
}

/** 칸이 붙기 전에 쓰인 행에는 그 칸이 없다. `undefined` 를 실어 나르면 균등 판정이 갈린다. */
function shareColumn(row: Record<string, unknown>, column: string): number | null {
  const value = row[column]
  return typeof value === 'number' ? value : null
}

function rowToSetting(row: Record<string, unknown>): BossPartySetting {
  return {
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    difficulty: row.difficulty as string,
    partySize: row.party_size as number,
    crystalMyShare: shareColumn(row, 'crystal_my_share'),
    crystalSharesTotal: shareColumn(row, 'crystal_shares_total'),
    dropMyShare: shareColumn(row, 'drop_my_share'),
    dropSharesTotal: shareColumn(row, 'drop_shares_total'),
    splitFeePercent: shareColumn(row, 'split_fee_percent'),
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
    `SELECT * FROM boss_party_settings WHERE ocid = ? AND boss_key = ? AND difficulty = ?`,
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
    `SELECT * FROM boss_party_settings WHERE ocid = ? AND boss_key = ? AND difficulty = ?`,
    [ocid, bossKey, difficulty],
  )

  const row = values?.[0]
  return row === undefined ? null : rowToSetting(row)
}

/**
 * 옛 캐릭터의 설정을 전부 새 캐릭터로 옮겨 적는다. **새 캐릭터에 이미 있는 설정은 안 덮는다.**
 *
 * 월드 리프로 두 ocid 가 이어지는 순간 한 번 부른다. 새 캐릭터에서 사용자가 이미 정한 값이 이긴다.
 */
export async function copyMissingBossPartySettings(
  fromOcid: string,
  toOcid: string,
  updatedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  const columns = SHARE_COLUMNS.join(', ')
  await db.run(
    `INSERT OR IGNORE INTO boss_party_settings (ocid, boss_key, boss, difficulty, party_size, ${columns}, updated_at)
     SELECT ?, boss_key, boss, difficulty, party_size, ${columns}, ? FROM boss_party_settings WHERE ocid = ?`,
    [toOcid, updatedAt, fromOcid],
  )
}

export async function getBossPartySettings(ocids: string[]): Promise<BossPartySetting[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_party_settings WHERE ocid IN (${ocidPlaceholders})`,
    ocids,
  )

  return (values ?? []).map(rowToSetting)
}
