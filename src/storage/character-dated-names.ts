/**
 * 캐릭터의 그날 이름과 월드(`character_dated_names`). 강화 줄의 이름을 ocid 에 붙일 때 `character/basic` 에 날짜를 넣어 받은
 * 값이다. 지난 날의 값은 바뀌지 않아 같은 ocid · 날짜를 다시 부르지 않는다.
 *
 * @see docs/persistence/sqlite.md `character_dated_names`
 */
import { getBossProfitDb } from './sqlite/db'

/** 그날의 값. `name` 이 `null` 이면 그날 그 ocid 에 값이 없었다. 리프 전 기간이 그렇다 */
export interface DatedName {
  name: string | null
  /** 월드 이름 원문. 판정할 때 지금 월드 표에서 찾는다 */
  worldName: string | null
}

function keyOf(ocid: string, dateKey: string): string {
  return `${ocid}|${dateKey}`
}

/** 적어 둔 그날 값. 열쇠는 `ocid|날짜` 이고, 아직 받지 않은 날은 빠진다. */
export async function getDatedNames(ocids: readonly string[], dateKeys: readonly string[]): Promise<Map<string, DatedName>> {
  const found = new Map<string, DatedName>()
  if (ocids.length === 0 || dateKeys.length === 0) return found
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, history_date, name, world_name FROM character_dated_names
      WHERE ocid IN (${ocids.map(() => '?').join(', ')}) AND history_date IN (${dateKeys.map(() => '?').join(', ')})`,
    [...ocids, ...dateKeys],
  )
  for (const row of values ?? []) {
    found.set(keyOf(row.ocid as string, row.history_date as string), {
      name: (row.name as string | null | undefined) ?? null,
      worldName: (row.world_name as string | null | undefined) ?? null,
    })
  }
  return found
}

export async function saveDatedName(ocid: string, dateKey: string, value: DatedName, now: Date): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(
    `INSERT INTO character_dated_names (ocid, history_date, name, world_name, checked_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (ocid, history_date) DO UPDATE SET name = excluded.name, world_name = excluded.world_name,
       checked_at = excluded.checked_at`,
    [ocid, dateKey, value.name, value.worldName, now.toISOString()],
  )
}

/** 적어 둔 그날 이름에 그 이름이 있는 ocid. 이름을 바꾼 캐릭터의 옛 이름 줄을 그 캐릭터부터 물을 때 쓴다. */
export async function getOcidsNamed(name: string): Promise<string[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT DISTINCT ocid FROM character_dated_names WHERE name = ?`, [name])
  return (values ?? []).map((row) => row.ocid as string)
}

/**
 * ocid 마다 값이 없던 것을 아는 가장 늦은 날. 캐릭터 값은 처음 값이 온 날부터 이어져서 그 앞 날짜에도 값이 없을 것이다. 적어 둔
 * 값이 없는 ocid 는 빠진다.
 */
export async function getNoValueThroughDates(ocids: readonly string[]): Promise<Map<string, string>> {
  const through = new Map<string, string>()
  if (ocids.length === 0) return through
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, MAX(history_date) AS through FROM character_dated_names
      WHERE name IS NULL AND ocid IN (${ocids.map(() => '?').join(', ')}) GROUP BY ocid`,
    [...ocids],
  )
  for (const row of values ?? []) through.set(row.ocid as string, row.through as string)
  return through
}

/** `getDatedNames` 의 열쇠. */
export function datedNameKey(ocid: string, dateKey: string): string {
  return keyOf(ocid, dateKey)
}
