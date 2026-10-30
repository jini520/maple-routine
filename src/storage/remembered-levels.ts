/**
 * 캐릭터의 강화 레벨 기억 어댑터. 심볼 강화 · 헥사 스킬 폼의 강화 전 칸이 이 값으로 선다.
 *
 * 사용자가 친 값을 믿는다. 그래서 넥슨 레벨로는 빈 자리만 채우고(`fill`), 기록을 저장 · 고치기 · 지우기 할 때만
 * 덮는다(`overwrite`).
 */
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'
import { NEW_UUID_SQL } from './sqlite/uuid'

export type RememberedLevelKind = 'symbol' | 'hexa'

/** 대상(심볼 key · 코어 이름)별 기억한 레벨. 없는 대상은 키가 없다. */
export async function getRememberedLevels(ocid: string, kind: RememberedLevelKind): Promise<Record<string, number>> {
  const db = await getBossProfitDb()
  const result = await db.query(`SELECT item_key, level FROM remembered_levels WHERE ocid = ? AND kind = ?`, [ocid, kind])
  return Object.fromEntries((result.values ?? []).map((row) => [row.item_key as string, row.level as number]))
}

/**
 * 레벨을 적는다. `fill` 은 기억이 없는 대상만 넣고 이미 있는 값은 그대로 둔다. `overwrite` 는 갈아 끼운다.
 */
export async function rememberLevels(
  ocid: string,
  kind: RememberedLevelKind,
  levels: Readonly<Record<string, number>>,
  mode: 'fill' | 'overwrite',
): Promise<void> {
  const entries = Object.entries(levels)
  if (entries.length === 0) return
  const db = await getBossProfitDb()
  const now = new Date().toISOString()
  const conflict = mode === 'fill' ? 'DO NOTHING' : 'DO UPDATE SET level = excluded.level, updated_at = excluded.updated_at'
  await inTransaction(db, async () => {
    for (const [itemKey, level] of entries) {
      await db.run(
        `INSERT INTO remembered_levels (id, ocid, kind, item_key, level, updated_at)
          VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?)
          ON CONFLICT (ocid, kind, item_key) ${conflict}`,
        [ocid, kind, itemKey, level, now],
      )
    }
  })
}

/** 그 캐릭터의 기억이 하나라도 있나. 추적을 다시 시작할 때 넥슨에서 다시 받을지 가른다. */
export async function hasRememberedLevels(ocid: string): Promise<boolean> {
  const db = await getBossProfitDb()
  const result = await db.query(`SELECT 1 FROM remembered_levels WHERE ocid = ? LIMIT 1`, [ocid])
  return (result.values ?? []).length > 0
}
