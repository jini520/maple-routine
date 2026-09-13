/**
 * 월드 리프로 갈린 **옛 ocid → 새 ocid** 연결. 옛 ocid 하나당 한 행.
 *
 * 리프한 기간에 같은 처치가 두 ocid 로 한 번씩 기록되면 이 연결로 짝을 찾아 옛 기록을 지운다.
 * 옛 ocid 는 `character/list` 에서 빠져 연결을 되살릴 길이 없어 `RECORD_TABLE_NAMES` 에 든다.
 *
 * @see docs/persistence/sqlite.md `character_world_leaps`
 */
import { getBossProfitDb } from './sqlite/db'

export interface CharacterWorldLeap {
  fromOcid: string
  toOcid: string
  linkedAt: string
}

/**
 * 옛 ocid 를 새 ocid 에 잇는다. **처음 이을 때만 참**이다.
 *
 * 이미 이어진 옛 ocid 는 행을 안 바꾼다. 부르는 쪽이 이 참을 보고 설정 복사를 한 번만 한다.
 */
export async function linkCharacterWorldLeap(
  fromOcid: string,
  toOcid: string,
  linkedAt: string,
): Promise<boolean> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT from_ocid FROM character_world_leaps WHERE from_ocid = ?`, [
    fromOcid,
  ])
  if ((values ?? []).length > 0) {
    return false
  }
  await db.run(`INSERT INTO character_world_leaps (from_ocid, to_ocid, linked_at) VALUES (?, ?, ?)`, [
    fromOcid,
    toOcid,
    linkedAt,
  ])
  return true
}

export async function getCharacterWorldLeaps(): Promise<CharacterWorldLeap[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT from_ocid, to_ocid, linked_at FROM character_world_leaps`)
  return (values ?? []).map((row) => ({
    fromOcid: row.from_ocid as string,
    toOcid: row.to_ocid as string,
    linkedAt: row.linked_at as string,
  }))
}
