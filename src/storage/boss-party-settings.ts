import { bossDifficultyOfId } from '../lib/boss/bosses'
import { SPLIT_COLUMN_NAMES, bossDifficultyIdFor, shareOf, splitValues } from './boss-periods'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'

/** 결정석 비율과 송금 수수료 칸. 비율이 `null` 이면 파티 인원으로 균등 분배다. 아이템 비율은 이 표에 없다 */
export interface BossPartyShareColumns {
  /** 결정석에서 내가 갖는 비율. `null` 은 균등 */
  crystalMyShare: number | null
  /** 결정석 비율의 합. 저장된 값을 읽으면 100000 이다 */
  crystalSharesTotal: number | null
  /** 차액 송금의 경매장 수수료율. 등급을 따르는 설정은 `null` 이다 */
  splitFeePercent: number | null
  /** 송금 수수료가 등급을 따라가나. 없으면 손으로 고른 값이다 */
  splitFeeAuto?: boolean
  /** 분배 방식 `제외`. 결정석을 팔지 않는 처치라 내 몫이 0 이고 인원이 없어 솔로로 읽는다 */
  crystalExcluded?: boolean
}

export interface BossPartySetting extends BossPartyShareColumns {
  ocid: string
  /** 보스 key. */
  bossKey: string
  difficulty: string
  partySize: number
  updatedAt: string // ISO 8601
}

/** 보스 관리 설정은 분배를 정한 줄만 있다. 같은 캐릭터 · 보스 난이도는 한 줄이다. */
const UPSERT_SQL = `
  INSERT INTO boss_split_settings (id, ocid, boss_difficulty_id, ${SPLIT_COLUMN_NAMES.join(', ')}, created_at, updated_at)
  VALUES (${NEW_UUID_SQL}, ?, ?, ${SPLIT_COLUMN_NAMES.map(() => '?').join(', ')}, ?, ?)
  ON CONFLICT (ocid, boss_difficulty_id) DO UPDATE SET
    ${SPLIT_COLUMN_NAMES.map((column) => `${column} = excluded.${column}`).join(',\n    ')},
    updated_at = excluded.updated_at
`

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
    bossDifficultyIdFor(setting.bossKey, setting.difficulty),
    ...splitValues(setting, false),
    setting.updatedAt,
    setting.updatedAt,
  ])
}

/** 줄을 설정으로. 게임 데이터에 없는 난이도 줄이면 `null` 이다. */
function rowToSetting(row: Record<string, unknown>): BossPartySetting | null {
  const owner = bossDifficultyOfId(row.boss_difficulty_id as string)
  const share = shareOf(row)
  if (owner === null || share === null) return null
  return { ocid: row.ocid as string, bossKey: owner.bossKey, difficulty: owner.difficulty, ...share, updatedAt: row.updated_at as string }
}

export async function getBossPartySize(
  ocid: string,
  bossKey: string,
  difficulty: string,
): Promise<number | null> {
  return (await getBossPartySetting(ocid, bossKey, difficulty))?.partySize ?? null
}

/** 그 조합의 설정 한 줄. 자동 기록이 비율까지 함께 읽어야 해서 인원만 주는 함수와 나란히 산다. */
export async function getBossPartySetting(
  ocid: string,
  bossKey: string,
  difficulty: string,
): Promise<BossPartySetting | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT * FROM boss_split_settings WHERE ocid = ? AND boss_difficulty_id = ?', [
    ocid,
    bossDifficultyIdFor(bossKey, difficulty),
  ])
  const row = values?.[0]
  return row === undefined ? null : rowToSetting(row)
}

/**
 * 옛 캐릭터의 설정을 새 캐릭터로 옮겨 적는다. **새 캐릭터에 이미 있는 설정은 안 덮는다.**
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
    `INSERT INTO boss_split_settings (id, ocid, boss_difficulty_id, ${columns}, created_at, updated_at)
     SELECT ${NEW_UUID_SQL}, ?, boss_difficulty_id, ${columns}, ?, ? FROM boss_split_settings WHERE ocid = ?
     ON CONFLICT (ocid, boss_difficulty_id) DO NOTHING`,
    [toOcid, updatedAt, updatedAt, fromOcid],
  )
}

export async function getBossPartySettings(ocids: string[]): Promise<BossPartySetting[]> {
  if (ocids.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT * FROM boss_split_settings WHERE ocid IN (${ocids.map(() => '?').join(', ')})`,
    ocids,
  )

  return (values ?? []).flatMap((row) => rowToSetting(row) ?? [])
}
