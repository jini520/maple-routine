/**
 * 캐릭터마다 만든 날과 처음 값이 온 날(`character_first_days`). 리프한 캐릭터는 만든 날과 처음 값이 온 날 사이가 리프 전
 * 기간이다. 캐릭터마다 한 번 찾아 둔다.
 *
 * @see docs/persistence/sqlite.md `character_first_days`
 */
import { getBossProfitDb } from './sqlite/db'

export interface CharacterFirstDay {
  /** `character_date_create` 의 KST 날짜. 리프 뒤에도 처음 만든 날 그대로다 */
  createdDate: string
  /** 날짜를 넣어 불렀을 때 처음 값이 온 날 */
  firstDate: string
  /** 그날의 이름 */
  firstName: string
}

export async function getCharacterFirstDays(ocids: readonly string[]): Promise<Map<string, CharacterFirstDay>> {
  const found = new Map<string, CharacterFirstDay>()
  if (ocids.length === 0) return found
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, created_date, first_date, first_name FROM character_first_days
      WHERE ocid IN (${ocids.map(() => '?').join(', ')})`,
    [...ocids],
  )
  for (const row of values ?? []) {
    found.set(row.ocid as string, {
      createdDate: row.created_date as string,
      firstDate: row.first_date as string,
      firstName: row.first_name as string,
    })
  }
  return found
}

export async function saveCharacterFirstDay(ocid: string, value: CharacterFirstDay, now: Date): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `INSERT INTO character_first_days (ocid, created_date, first_date, first_name, checked_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (ocid) DO UPDATE SET created_date = excluded.created_date, first_date = excluded.first_date,
       first_name = excluded.first_name, checked_at = excluded.checked_at`,
    [ocid, value.createdDate, value.firstDate, value.firstName, now.toISOString()],
  )
}
