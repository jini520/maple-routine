import { bossNameOf } from '../lib/boss/bosses'
import { getBossProfitDb } from './sqlite/db'

export interface BossPartySetting {
  ocid: string
  /** 보스 key. */
  bossKey: string
  difficulty: string
  partySize: number
  updatedAt: string // ISO 8601
}

const UPSERT_SQL = `
  INSERT INTO boss_party_settings
    (ocid, boss_key, boss, difficulty, party_size, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, boss_key, difficulty) DO UPDATE SET
    boss = excluded.boss,
    party_size = excluded.party_size,
    updated_at = excluded.updated_at
`

export async function setBossPartySize(
  ocid: string,
  bossKey: string,
  difficulty: string,
  partySize: number,
  updatedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  // 이름 칸은 적을 때의 이름이다. 기록 표들과 모양을 맞춘다.
  await db.run(UPSERT_SQL, [ocid, bossKey, bossNameOf(bossKey, bossKey), difficulty, partySize, updatedAt])
}

function rowToSetting(row: Record<string, unknown>): BossPartySetting {
  return {
    ocid: row.ocid as string,
    bossKey: row.boss_key as string,
    difficulty: row.difficulty as string,
    partySize: row.party_size as number,
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
  await db.run(
    `INSERT OR IGNORE INTO boss_party_settings (ocid, boss_key, boss, difficulty, party_size, updated_at)
     SELECT ?, boss_key, boss, difficulty, party_size, ? FROM boss_party_settings WHERE ocid = ?`,
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
