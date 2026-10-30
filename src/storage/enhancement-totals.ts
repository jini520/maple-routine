/**
 * 강화 합계(`enhancement_totals`)를 읽고 쓰는 자리.
 *
 * @see docs/persistence/sqlite.md `enhancement_totals`
 */
import type { EnhancementCategory } from '../lib/enhancement/categories'
import type { EnhancementKind } from '../nexon/history/client'
import type { SqliteDbConnection } from './ports'
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

/** 저장된 합계 한 줄. */
export interface EnhancementTotal {
  id: string
  nexonAccountId: string
  historyDate: string
  characterName: string
  enhancementType: EnhancementKind
  enhancementCategory: EnhancementCategory
  itemGroup: string
  itemKey: string | null
  itemName: string
  attempts: number
  attemptCostMeso: number
  destroyDefenceCostMeso: number
  /** 이벤트 월드인가. 판정하지 못했으면 `null` */
  eventWorld: boolean | null
}

/** 쓸 값. id 는 같은 열쇠의 줄이 있으면 그 줄의 것을 지킨다. */
export type EnhancementTotalInput = Omit<EnhancementTotal, 'id' | 'nexonAccountId'>

let revision = 0
const revisionListeners = new Set<() => void>()

/** 쓰기마다 오른다. 이 표를 읽는 쿼리가 판이 오를 때 무효화된다(`features/query/invalidation.ts`). */
export function getEnhancementTotalsRevision(): number {
  return revision
}

/** 판이 오를 때 부를 함수를 건다. 풀 함수를 돌려준다. `storage/boss-profit` 의 같은 이름 함수와 같은 물건이다. */
export function subscribeEnhancementTotalsRevision(listener: () => void): () => void {
  revisionListeners.add(listener)
  return () => {
    revisionListeners.delete(listener)
  }
}

function bumpRevision(): void {
  revision += 1
  notifyAfterBatch(() => {
    for (const listener of revisionListeners) listener()
  })
}

const UPSERT_SQL = `
  INSERT INTO enhancement_totals
    (nexon_account_id, history_date, character_name, enhancement_type, enhancement_category, item_group, item_key,
     item_name, attempts, attempt_cost_meso, destroy_defence_cost_meso, event_world, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (nexon_account_id, history_date, character_name, enhancement_category, item_group) DO UPDATE SET
    enhancement_type = excluded.enhancement_type,
    item_key = excluded.item_key,
    item_name = excluded.item_name,
    attempts = excluded.attempts,
    attempt_cost_meso = excluded.attempt_cost_meso,
    destroy_defence_cost_meso = excluded.destroy_defence_cost_meso,
    event_world = excluded.event_world,
    updated_at = excluded.updated_at
  RETURNING id
`

function eventWorldValue(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0
}

async function replaceIn(
  db: SqliteDbConnection,
  nexonAccountId: string,
  enhancementType: EnhancementKind,
  historyDate: string,
  totals: readonly EnhancementTotalInput[],
  now: string,
): Promise<void> {
  const writtenIds: string[] = []
  for (const total of totals) {
    const { values } = await db.query(UPSERT_SQL, [
      nexonAccountId,
      total.historyDate,
      total.characterName,
      total.enhancementType,
      total.enhancementCategory,
      total.itemGroup,
      total.itemKey,
      total.itemName,
      total.attempts,
      total.attemptCostMeso,
      total.destroyDefenceCostMeso,
      eventWorldValue(total.eventWorld),
      now,
    ])
    const id = (values ?? [])[0]?.id
    if (typeof id === 'string') writtenIds.push(id)
  }
  const placeholders = writtenIds.map(() => '?').join(', ')
  await db.run(
    `DELETE FROM enhancement_totals
      WHERE nexon_account_id = ? AND enhancement_type = ? AND history_date = ?
        ${writtenIds.length > 0 ? `AND id NOT IN (${placeholders})` : ''}`,
    [nexonAccountId, enhancementType, historyDate, ...writtenIds],
  )
}

/**
 * 한 계정 · 한 종류 · 한 날짜의 합계를 갈아 끼운다. 같은 열쇠의 줄은 값을 고쳐 적고, 새 합계에 없는 줄은 지운다.
 *
 * 합계에는 응답 줄의 id 가 없어 같은 줄을 두 번 받았는지 가릴 수 없다. 그래서 그 날을 통째로 다시 받아 갈아 끼운다.
 *
 * @param totals 그 날짜 · 그 종류의 합계 전부. 비면 그 날의 줄을 모두 지운다
 */
export async function replaceEnhancementTotals(
  nexonAccountId: string,
  enhancementType: EnhancementKind,
  historyDate: string,
  totals: readonly EnhancementTotalInput[],
  now: Date,
): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, () =>
    replaceIn(db, nexonAccountId, enhancementType, historyDate, totals, now.toISOString()),
  )
  bumpRevision()
}

function rowToTotal(row: Record<string, unknown>): EnhancementTotal {
  const eventWorld = row.event_world as number | null | undefined
  return {
    id: row.id as string,
    nexonAccountId: row.nexon_account_id as string,
    historyDate: row.history_date as string,
    characterName: row.character_name as string,
    enhancementType: row.enhancement_type as EnhancementKind,
    enhancementCategory: row.enhancement_category as EnhancementCategory,
    itemGroup: row.item_group as string,
    itemKey: (row.item_key as string | null | undefined) ?? null,
    itemName: row.item_name as string,
    attempts: row.attempts as number,
    attemptCostMeso: row.attempt_cost_meso as number,
    destroyDefenceCostMeso: row.destroy_defence_cost_meso as number,
    eventWorld: eventWorld === null || eventWorld === undefined ? null : eventWorld === 1,
  }
}

/** 날짜 범위(두 끝 포함)의 합계. 계정은 가리지 않는다. */
export async function loadEnhancementTotals(fromDate: string, toDate: string): Promise<EnhancementTotal[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT * FROM enhancement_totals WHERE history_date BETWEEN ? AND ? ORDER BY history_date, character_name, id',
    [fromDate, toDate],
  )
  return (values ?? []).map(rowToTotal)
}
