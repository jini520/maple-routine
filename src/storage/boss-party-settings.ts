import { getBossProfitDb } from './sqlite/db'

export interface BossPartySetting {
  ocid: string
  boss: string
  difficulty: string
  partySize: number
  updatedAt: string // ISO 8601
}

const UPSERT_SQL = `
  INSERT INTO boss_party_settings
    (ocid, boss, difficulty, party_size, updated_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss, difficulty) DO UPDATE SET
    party_size = excluded.party_size,
    updated_at = excluded.updated_at
`

export async function setBossPartySize(
  ocid: string,
  boss: string,
  difficulty: string,
  partySize: number,
  updatedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(UPSERT_SQL, [ocid, boss, difficulty, partySize, updatedAt])
}

function rowToSetting(row: Record<string, unknown>): BossPartySetting {
  return {
    ocid: row.ocid as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    partySize: row.party_size as number,
    updatedAt: row.updated_at as string,
  }
}

export async function getBossPartySize(
  ocid: string,
  boss: string,
  difficulty: string,
): Promise<number | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_party_settings WHERE ocid = ? AND boss = ? AND difficulty = ?`,
    [ocid, boss, difficulty],
  )

  const row = values?.[0]
  return row === undefined ? null : (row.party_size as number)
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
