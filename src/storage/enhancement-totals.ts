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
  /** 응답이 준 그날의 이름. 묶고 찾는 것은 `ocid` 다 */
  characterName: string
  /** 그날 그 이름이었던 캐릭터. 리프 전 기간의 줄은 리프 뒤의 ocid 다 */
  ocid: string
  /** 그 캐릭터의 메이플 ID */
  accountId: string
  /** 그 줄의 월드 key. 리프 전 기간이라 모르면 `null` */
  worldKey: string | null
  enhancementType: EnhancementKind
  enhancementCategory: EnhancementCategory
  itemGroup: string
  itemKey: string | null
  itemName: string
  attempts: number
  attemptCostMeso: number
  destroyDefenceCostMeso: number
  /** 스타포스만. 칸이 생기기 전에 받은 줄도 `null` */
  fromStar: number | null
  toStar: number | null
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

/** 다른 저장소 함수가 이 표의 줄을 바꿨을 때 화면에 알린다. 계정 id 를 옮길 때 겹친 줄이 지워진다. */
export function notifyEnhancementTotalsChanged(): void {
  bumpRevision()
}

function bumpRevision(): void {
  revision += 1
  notifyAfterBatch(() => {
    for (const listener of revisionListeners) listener()
  })
}

const UPSERT_SQL = `
  INSERT INTO enhancement_totals
    (nexon_account_id, history_date, character_name, ocid, account_id, world_key, enhancement_type, enhancement_category,
     item_group, item_key, item_name, attempts, attempt_cost_meso, destroy_defence_cost_meso, from_star, to_star, event_world,
     updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (ocid, history_date, enhancement_category, item_group) DO UPDATE SET
    nexon_account_id = excluded.nexon_account_id,
    character_name = excluded.character_name,
    account_id = excluded.account_id,
    world_key = excluded.world_key,
    enhancement_type = excluded.enhancement_type,
    item_key = excluded.item_key,
    item_name = excluded.item_name,
    attempts = excluded.attempts,
    attempt_cost_meso = excluded.attempt_cost_meso,
    destroy_defence_cost_meso = excluded.destroy_defence_cost_meso,
    from_star = excluded.from_star,
    to_star = excluded.to_star,
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
  accountOcids: readonly string[],
  now: string,
): Promise<void> {
  const writtenIds: string[] = []
  for (const total of totals) {
    const { values } = await db.query(UPSERT_SQL, [
      nexonAccountId,
      total.historyDate,
      total.characterName,
      total.ocid,
      total.accountId,
      total.worldKey,
      total.enhancementType,
      total.enhancementCategory,
      total.itemGroup,
      total.itemKey,
      total.itemName,
      total.attempts,
      total.attemptCostMeso,
      total.destroyDefenceCostMeso,
      total.fromStar,
      total.toStar,
      eventWorldValue(total.eventWorld),
      now,
    ])
    const id = (values ?? [])[0]?.id
    if (typeof id === 'string') writtenIds.push(id)
  }
  // 한 번 받으면 그 넥슨 계정의 그날 줄이 모두 온다. 그래서 그 계정 id 로 적힌 줄과 그 계정 캐릭터의 줄 가운데 새 합계에 없는
  // 줄을 지운다. 계정 id 만 보면 옛 번호로 적힌 같은 캐릭터의 줄이 남는다.
  const ocids = [...new Set([...accountOcids, ...totals.map((total) => total.ocid)])]
  await db.run(
    `DELETE FROM enhancement_totals
      WHERE enhancement_type = ? AND history_date = ?
        AND (nexon_account_id = ?${ocids.length > 0 ? ` OR ocid IN (${ocids.map(() => '?').join(', ')})` : ''})
        ${writtenIds.length > 0 ? `AND id NOT IN (${writtenIds.map(() => '?').join(', ')})` : ''}`,
    [enhancementType, historyDate, nexonAccountId, ...ocids, ...writtenIds],
  )
}

/**
 * 한 계정 · 한 종류 · 한 날짜의 합계를 갈아 끼운다. 같은 열쇠의 줄은 값을 고쳐 적고, 새 합계에 없는 줄은 지운다.
 *
 * 합계에는 응답 줄의 id 가 없어 같은 줄을 두 번 받았는지 가릴 수 없다. 그래서 그 날을 통째로 다시 받아 갈아 끼운다.
 *
 * @param totals 그 날짜 · 그 종류의 합계 전부. 비면 그 날의 줄을 모두 지운다
 * @param accountOcids 그 넥슨 계정의 캐릭터. 그 캐릭터들의 그날 줄도 지우는 범위에 든다
 */
export async function replaceEnhancementTotals(
  nexonAccountId: string,
  enhancementType: EnhancementKind,
  historyDate: string,
  totals: readonly EnhancementTotalInput[],
  now: Date,
  accountOcids: readonly string[] = [],
): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, () =>
    replaceIn(db, nexonAccountId, enhancementType, historyDate, totals, accountOcids, now.toISOString()),
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
    ocid: row.ocid as string,
    accountId: row.account_id as string,
    worldKey: (row.world_key as string | null | undefined) ?? null,
    enhancementType: row.enhancement_type as EnhancementKind,
    enhancementCategory: row.enhancement_category as EnhancementCategory,
    itemGroup: row.item_group as string,
    itemKey: (row.item_key as string | null | undefined) ?? null,
    itemName: row.item_name as string,
    attempts: row.attempts as number,
    attemptCostMeso: row.attempt_cost_meso as number,
    destroyDefenceCostMeso: row.destroy_defence_cost_meso as number,
    fromStar: (row.from_star as number | null | undefined) ?? null,
    toStar: (row.to_star as number | null | undefined) ?? null,
    eventWorld: eventWorld === null || eventWorld === undefined ? null : eventWorld === 1,
  }
}

/** 날짜 범위(두 끝 포함)의 합계. 계정은 가리지 않는다. */
export async function loadEnhancementTotals(fromDate: string, toDate: string): Promise<EnhancementTotal[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT * FROM enhancement_totals WHERE history_date BETWEEN ? AND ? ORDER BY history_date, ocid, id',
    [fromDate, toDate],
  )
  return (values ?? []).map(rowToTotal)
}

/**
 * 리프 전 기간에 적힌 그 캐릭터의 스타포스 줄의 월드. 같은 기간의 큐브 · 잠재 · 소울 줄에 같은 월드를 적는다. 날짜가 가까운 줄이
 * 먼저다. 없으면 `null`.
 *
 * @param leapDate 그 ocid 에 처음 값이 온 날. 이 날 앞이 리프 전 기간이다
 */
export async function findPreLeapWorldKey(ocid: string, leapDate: string, aroundDate: string): Promise<string | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT world_key FROM enhancement_totals
      WHERE ocid = ? AND enhancement_type = 'starforce' AND world_key IS NOT NULL AND history_date < ?
      ORDER BY abs(julianday(history_date) - julianday(?)) LIMIT 1`,
    [ocid, leapDate, aroundDate],
  )
  const found = values?.[0]?.world_key
  return typeof found === 'string' ? found : null
}
