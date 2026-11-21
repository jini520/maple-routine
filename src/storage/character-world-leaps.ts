/**
 * 월드 리프로 갈린 **옛 ocid → 그 캐릭터의 지금 ocid** 연결. 옛 ocid 하나당 한 행.
 *
 * 리프한 기간에 같은 처치가 두 ocid 로 한 번씩 기록되면 이 연결로 짝을 찾아 옛 기록을 지운다.
 * 옛 ocid 는 `character/list` 에서 빠져 연결을 되살릴 길이 없어 데이터 삭제가 지우지 않는다.
 *
 * @see docs/persistence/sqlite.md `character_world_leaps`
 */
import { getBossProfitDb } from './sqlite/db'

export interface CharacterWorldLeap {
  /** 리프 전의 옛 ocid. 표의 `previous_ocid` */
  fromOcid: string
  /** 그 캐릭터의 지금 ocid. 표의 `ocid` */
  toOcid: string
}

/**
 * 옛 ocid 를 새 ocid 에 잇는다. **처음 이을 때만 참**이다.
 *
 * 이미 이어진 옛 ocid 는 행을 안 바꾼다. 부르는 쪽이 이 참을 보고 설정 복사를 한 번만 한다.
 */
export async function linkCharacterWorldLeap(fromOcid: string, toOcid: string): Promise<boolean> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT previous_ocid FROM character_world_leaps WHERE previous_ocid = ?`, [fromOcid])
  if ((values ?? []).length > 0) {
    return false
  }
  await db.run(`INSERT INTO character_world_leaps (previous_ocid, ocid) VALUES (?, ?)`, [fromOcid, toOcid])
  return true
}

export async function getCharacterWorldLeaps(): Promise<CharacterWorldLeap[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT previous_ocid, ocid FROM character_world_leaps`)
  return (values ?? []).map((row) => ({ fromOcid: row.previous_ocid as string, toOcid: row.ocid as string }))
}

/**
 * 다시 리프한 캐릭터의 앞 연결을 지금 ocid 로 옮긴다. A→B 뒤에 B→C 가 이어지면 A→B 를 A→C 로 고친다. 한 캐릭터의 연결이 모두 그
 * 캐릭터의 지금 ocid 를 가리켜야 서버 표(캐릭터 줄을 가리킨다)와 같은 모양이다. 옛 ocid 가 `toOcid` 인 줄은 자기 자신을 가리키게
 * 되어 옮기지 않는다.
 */
export async function moveWorldLeapsToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`UPDATE character_world_leaps SET ocid = ? WHERE ocid = ? AND previous_ocid <> ?`, [toOcid, fromOcid, toOcid])
}
