import { getBossProfitDb } from './sqlite/db'
import type { DropCategory, RecordedDrop } from '../types/drops'

// ADR-038 결정 5: 한 보스/기간의 드롭 집합은 시트에서 통째로 편집되므로 replace-all(DELETE→INSERT)이
// 수정에 가장 단순하다. drop_index 다중 행으로 저장하고 계산된 금액은 넣지 않는다(재평가는 별도 시세
// 소스에서 조인). `storage/boss-profit.ts` 어댑터 패턴을 미러한다.
export interface BossDropRecord {
  ocid: string
  boss: string
  difficulty: string
  periodKey: string
  dropIndex: number
  category: DropCategory
  itemName: string
  slot: string | null
  boxOrigin: string | null
  ringLevel: number | null
  quantity: number
  recordedAt: string // ISO 8601
}

const DELETE_SQL = `
  DELETE FROM boss_drop_records
  WHERE ocid = ? AND boss = ? AND difficulty = ? AND period_key = ?
`

const INSERT_SQL = `
  INSERT INTO boss_drop_records
    (ocid, boss, difficulty, period_key, drop_index, category, item_name, slot, box_origin, ring_level, quantity, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`

// 한 보스/기간의 드롭 집합을 통째로 교체한다(기존 삭제 후 0..n으로 재삽입). 빈 배열이면 삭제만.
export async function replaceBossDropRecords(
  ocid: string,
  boss: string,
  difficulty: string,
  periodKey: string,
  drops: RecordedDrop[],
  recordedAt: string,
): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(DELETE_SQL, [ocid, boss, difficulty, periodKey])
  for (let index = 0; index < drops.length; index++) {
    const drop = drops[index]
    await db.run(INSERT_SQL, [
      ocid,
      boss,
      difficulty,
      periodKey,
      index,
      drop.category,
      drop.itemName,
      drop.slot ?? null,
      drop.boxOrigin ?? null,
      drop.ringLevel ?? null,
      drop.quantity,
      recordedAt,
    ])
  }
}

function rowToRecord(row: Record<string, unknown>): BossDropRecord {
  return {
    ocid: row.ocid as string,
    boss: row.boss as string,
    difficulty: row.difficulty as string,
    periodKey: row.period_key as string,
    dropIndex: row.drop_index as number,
    category: row.category as DropCategory,
    itemName: row.item_name as string,
    slot: (row.slot as string | null) ?? null,
    boxOrigin: (row.box_origin as string | null) ?? null,
    ringLevel: (row.ring_level as number | null) ?? null,
    quantity: row.quantity as number,
    recordedAt: row.recorded_at as string,
  }
}

export async function getBossDropRecords(
  ocids: string[],
  periodKeys: string[],
): Promise<BossDropRecord[]> {
  if (ocids.length === 0 || periodKeys.length === 0) {
    return []
  }

  const db = await getBossProfitDb()
  const ocidPlaceholders = ocids.map(() => '?').join(', ')
  const periodKeyPlaceholders = periodKeys.map(() => '?').join(', ')
  const { values } = await db.query(
    `SELECT * FROM boss_drop_records WHERE ocid IN (${ocidPlaceholders}) AND period_key IN (${periodKeyPlaceholders}) ORDER BY drop_index`,
    [...ocids, ...periodKeys],
  )

  return (values ?? []).map(rowToRecord)
}
