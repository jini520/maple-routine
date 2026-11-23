/**
 * 캐릭터의 강화 레벨 기억 어댑터. 심볼 강화 · 헥사 스킬 폼의 강화 전 칸이 이 값으로 선다.
 *
 * 사용자가 친 값을 믿는다. 그래서 넥슨 레벨로는 빈 자리만 채우고(`fill`), 기록을 저장 · 고치기 · 지우기 할 때만
 * 덮는다(`overwrite`).
 *
 * 표는 대상을 게임 데이터의 줄 id 로 적고, 화면은 심볼 key · 코어 이름을 든다. 헥사 코어는 이름이 같아도 직업마다 다른 줄이라
 * 그 캐릭터 직업의 줄을 적는다.
 */
import { itemTargetIdOf, itemTargetKeyOf, type CashbookItemTargetType } from '../lib/cashbook/entry-ids'
import { getBossProfitDb } from './sqlite/db'
import { noteRecordsWritten } from './server-sync-queue'
import { inTransaction } from './sqlite/transaction'
import { NEW_UUID_SQL } from './sqlite/uuid'

export type RememberedLevelKind = 'symbol' | 'hexa'

/** 종류마다 대상이 든 표. */
const TARGET_TYPE: Record<RememberedLevelKind, CashbookItemTargetType> = { symbol: 'symbol', hexa: 'hexa_core' }

/** 대상(심볼 key · 코어 이름)별 기억한 레벨. 없는 대상은 키가 없다. 표에서 못 찾는 줄은 화면에 세울 대상이 없어 뺀다. */
export async function getRememberedLevels(ocid: string, kind: RememberedLevelKind): Promise<Record<string, number>> {
  const db = await getBossProfitDb()
  const result = await db.query(`SELECT target_id, level FROM remembered_levels WHERE ocid = ? AND type = ?`, [ocid, kind])
  return Object.fromEntries(
    (result.values ?? []).flatMap((row) => {
      const target = itemTargetKeyOf(TARGET_TYPE[kind], row.target_id as string)
      return target === null ? [] : [[target.key, row.level as number]]
    }),
  )
}

/**
 * 레벨을 적는다. `fill` 은 기억이 없는 대상만 넣고 이미 있는 값은 그대로 둔다. `overwrite` 는 갈아 끼운다.
 *
 * 표에 없는 심볼 · 코어는 적지 않는다. 대상 칸을 비울 수 없고, 폼은 표에 있는 대상만 보인다. 넥슨이 표보다 먼저 새 코어를 주면
 * 그 레벨만 빠진다.
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
  const { values } = await db.query('SELECT job_class FROM character_profiles WHERE ocid = ?', [ocid])
  const job = (values?.[0]?.job_class as string | null | undefined) ?? null
  await inTransaction(db, async () => {
    for (const [key, level] of entries) {
      const targetId = itemTargetIdOf(TARGET_TYPE[kind], key, { job })
      if (targetId === null) continue
      await db.run(
        `INSERT INTO remembered_levels (id, ocid, type, target_id, level, updated_at)
          VALUES (${NEW_UUID_SQL}, ?, ?, ?, ?, ?)
          ON CONFLICT (ocid, type, target_id) ${conflict}`,
        [ocid, kind, targetId, level, now],
      )
    }
  })
  noteRecordsWritten()
}

/** 그 캐릭터의 기억이 하나라도 있나. 추적을 다시 시작할 때 넥슨에서 다시 받을지 가른다. */
export async function hasRememberedLevels(ocid: string): Promise<boolean> {
  const db = await getBossProfitDb()
  const result = await db.query(`SELECT 1 FROM remembered_levels WHERE ocid = ? LIMIT 1`, [ocid])
  return (result.values ?? []).length > 0
}

/** 월드 리프한 캐릭터의 기억을 새 ocid 로 옮긴다. 새 캐릭터에 같은 대상의 기억이 있으면 리프 뒤의 그 값을 둔다. */
export async function moveRememberedLevelsToOcid(fromOcid: string, toOcid: string): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    await db.run(
      `UPDATE remembered_levels SET ocid = ?
        WHERE ocid = ? AND NOT EXISTS (
          SELECT 1 FROM remembered_levels mine
           WHERE mine.ocid = ? AND mine.type = remembered_levels.type AND mine.target_id = remembered_levels.target_id)`,
      [toOcid, fromOcid, toOcid],
    )
    await db.run(`DELETE FROM remembered_levels WHERE ocid = ?`, [fromOcid])
  })
  noteRecordsWritten()
}
