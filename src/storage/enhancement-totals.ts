/**
 * 강화 합계(`enhancement_totals`)를 읽고 쓰는 자리.
 *
 * 표는 월드를 줄 id 로, 장비를 넥슨이 준 이름으로 든다. 읽을 때 월드 key 와 장비 key 로 되돌리고, 스타포스 MVP 할인의 메이플 ID 와
 * 지금 이름을 모를 때 대신 쓰는 이름은 `character_accounts` · `character_dated_names` 에서 찾는다.
 *
 * @see docs/persistence/sqlite.md `enhancement_totals`
 */
import type { EnhancementCategory } from '../lib/enhancement/categories'
import { equipmentItemKeyOfApiName } from '../lib/equipment/equipment-items'
import { findWorld, findWorldById } from '../lib/world/worlds'
import type { EnhancementKind } from '../nexon/history/client'
import type { SqliteDbConnection } from './ports'
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

/** 쓸 값. 같은 열쇠(캐릭터 · 날짜 · 분류 · 장비 이름)의 줄이 있으면 그 줄의 id 를 지키고 값만 고친다. */
export interface EnhancementTotalInput {
  historyDate: string
  /** 그날 그 이름이었던 캐릭터. 리프 전 기간의 줄은 리프 뒤의 ocid 다 */
  ocid: string
  /** 그 줄의 월드 key. 리프 전 기간이라 모르면 `null`. 월드 표에 없는 key 도 비워 적는다 */
  worldKey: string | null
  enhancementCategory: EnhancementCategory
  /** 넥슨이 준 장비 이름 원문. 띄어쓰기만 달라도 다른 줄이다 */
  itemName: string
  attempts: number
  attemptCostMeso: number
  destroyDefenceCostMeso: number
  /** 슈페리얼 장비의 스타포스 비용. 칸이 생기기 전 줄과 슈페리얼이 아닌 줄은 0 */
  superiorCostMeso: number
  /** 스타포스만. 칸이 생기기 전에 받은 줄도 `null` */
  fromStar: number | null
  toStar: number | null
  /** 이벤트 월드인가. 판정하지 못했으면 `null` */
  eventWorld: boolean | null
}

/** 저장된 합계 한 줄. */
export interface EnhancementTotal extends EnhancementTotalInput {
  id: string
  /** 이름으로 장비 표에서 찾은 장비 key. 표에 없는 장비면 `null` */
  itemKey: string | null
  /** 그날의 이름. 받지 않은 날 · 리프 전 날은 아래 메이플 ID 를 찾은 소속 기록의 이름이다. 소속 기록이 없으면 `null` */
  characterName: string | null
  /** 그날 그 캐릭터의 메이플 ID. 그 날을 덮는 소속 기록이 없으면 그 캐릭터를 가장 늦게 본 소속 기록의 ID 다 */
  accountId: string | null
}

/** 받은 API 종류가 정하는 분류. 하루치를 갈아 끼울 때 이 분류의 줄만 지운다. */
const CATEGORIES_OF_KIND: Record<EnhancementKind, readonly EnhancementCategory[]> = {
  cube: ['cube_reset'],
  starforce: ['starforce'],
  potential: ['potential', 'additional_potential'],
  soul_potential: ['soul_potential'],
}

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

/** 구독자를 부르는 함수. `notifyAfterBatch` 가 같은 함수로 알아봐 반복 끝에 한 번만 부르도록 모듈에 하나만 둔다. */
function notifyRevisionListeners(): void {
  for (const listener of revisionListeners) listener()
}

function bumpRevision(): void {
  revision += 1
  notifyAfterBatch(notifyRevisionListeners)
}

const UPSERT_SQL = `
  INSERT INTO enhancement_totals
    (ocid, history_date, category, item_name, attempt_count, attempt_cost_meso, destroy_defence_cost_meso, world_id,
     superior_cost_meso, from_star, to_star, is_event_world, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (ocid, history_date, category, item_name) DO UPDATE SET
    attempt_count = excluded.attempt_count,
    attempt_cost_meso = excluded.attempt_cost_meso,
    destroy_defence_cost_meso = excluded.destroy_defence_cost_meso,
    world_id = excluded.world_id,
    superior_cost_meso = excluded.superior_cost_meso,
    from_star = excluded.from_star,
    to_star = excluded.to_star,
    is_event_world = excluded.is_event_world,
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
      total.ocid,
      total.historyDate,
      total.enhancementCategory,
      total.itemName,
      total.attempts,
      total.attemptCostMeso,
      total.destroyDefenceCostMeso,
      findWorld(total.worldKey)?.id ?? null,
      total.superiorCostMeso,
      total.fromStar,
      total.toStar,
      eventWorldValue(total.eventWorld),
      now,
    ])
    const id = (values ?? [])[0]?.id
    if (typeof id === 'string') writtenIds.push(id)
  }
  // 한 번 받으면 그 넥슨 계정의 그날 줄이 모두 온다. 그래서 그 계정으로 본 캐릭터의 줄 가운데 새 합계에 없는 줄을 지운다. 소속
  // 기록은 목록에서 사라진 캐릭터와 리프 전 ocid 도 지우지 않고 둬서 그 ocid 의 줄도 범위에 든다.
  const categories = CATEGORIES_OF_KIND[enhancementType]
  const ocids = [...new Set([...accountOcids, ...totals.map((total) => total.ocid)])]
  await db.run(
    `DELETE FROM enhancement_totals
      WHERE history_date = ? AND category IN (${categories.map(() => '?').join(', ')})
        AND (ocid IN (SELECT ocid FROM character_accounts WHERE nexon_account_id = ?)${ocids.length > 0 ? ` OR ocid IN (${ocids.map(() => '?').join(', ')})` : ''})
        ${writtenIds.length > 0 ? `AND id NOT IN (${writtenIds.map(() => '?').join(', ')})` : ''}`,
    [historyDate, ...categories, nexonAccountId, ...ocids, ...writtenIds],
  )
}

/**
 * 한 계정 · 한 종류 · 한 날짜의 합계를 갈아 끼운다. 같은 열쇠의 줄은 값을 고쳐 적고, 새 합계에 없는 줄은 지운다.
 *
 * 합계에는 응답 줄의 id 가 없어 같은 줄을 두 번 받았는지 가릴 수 없다. 그래서 그 날을 통째로 다시 받아 갈아 끼운다.
 *
 * @param totals 그 날짜 · 그 종류의 합계 전부. 비면 그 날의 줄을 모두 지운다
 * @param accountOcids 그 넥슨 계정의 캐릭터. 소속 기록에 아직 없는 캐릭터의 그날 줄도 지우는 범위에 든다
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

/** 소속 기록 한 줄. `character_accounts` 의 줄이다. */
interface Sighting {
  name: string
  accountId: string
  firstSeenDate: string
  lastSeenDate: string
}

/**
 * 그 날짜를 덮는 소속 기록, 없으면 가장 늦게 본 소속 기록. 수집기는 앱이 그 캐릭터를 처음 보기 전의 날도 받아서, 날짜로만 찾으면
 * 그런 줄이 메이플 ID 를 잃는다.
 */
function sightingAt(sightings: readonly Sighting[], dateKey: string): Sighting | null {
  let covering: Sighting | null = null
  let latest: Sighting | null = null
  for (const sighting of sightings) {
    const covers = sighting.firstSeenDate <= dateKey && dateKey <= sighting.lastSeenDate
    if (covers && (covering === null || sighting.lastSeenDate > covering.lastSeenDate)) covering = sighting
    if (latest === null || sighting.lastSeenDate > latest.lastSeenDate) latest = sighting
  }
  return covering ?? latest
}

/** 날짜 범위(두 끝 포함)의 합계. 계정은 가리지 않는다. */
export async function loadEnhancementTotals(fromDate: string, toDate: string): Promise<EnhancementTotal[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT * FROM enhancement_totals WHERE history_date BETWEEN ? AND ? ORDER BY history_date, ocid, id',
    [fromDate, toDate],
  )
  const rows = values ?? []
  const ocids = [...new Set(rows.map((row) => row.ocid as string))]
  if (ocids.length === 0) return []
  const marks = ocids.map(() => '?').join(', ')
  const sightingRows = await db.query(
    `SELECT ocid, name, account_id, first_seen_date, last_seen_date FROM character_accounts WHERE ocid IN (${marks})`,
    ocids,
  )
  const datedRows = await db.query(
    `SELECT ocid, history_date, name FROM character_dated_names
      WHERE ocid IN (${marks}) AND history_date BETWEEN ? AND ? AND name IS NOT NULL`,
    [...ocids, fromDate, toDate],
  )
  const sightingsOf = new Map<string, Sighting[]>()
  for (const row of sightingRows.values ?? []) {
    const ocid = row.ocid as string
    sightingsOf.set(ocid, [
      ...(sightingsOf.get(ocid) ?? []),
      {
        name: row.name as string,
        accountId: row.account_id as string,
        firstSeenDate: row.first_seen_date as string,
        lastSeenDate: row.last_seen_date as string,
      },
    ])
  }
  const datedName = new Map(
    (datedRows.values ?? []).map((row) => [`${row.ocid as string}|${row.history_date as string}`, row.name as string]),
  )

  return rows.map((row) => {
    const ocid = row.ocid as string
    const historyDate = row.history_date as string
    const itemName = row.item_name as string
    const sighting = sightingAt(sightingsOf.get(ocid) ?? [], historyDate)
    const eventWorld = row.is_event_world as number | null | undefined
    return {
      id: row.id as string,
      historyDate,
      ocid,
      worldKey: findWorldById(row.world_id as string | null | undefined)?.key ?? null,
      enhancementCategory: row.category as EnhancementCategory,
      itemName,
      itemKey: equipmentItemKeyOfApiName(itemName),
      attempts: row.attempt_count as number,
      attemptCostMeso: row.attempt_cost_meso as number,
      destroyDefenceCostMeso: row.destroy_defence_cost_meso as number,
      superiorCostMeso: row.superior_cost_meso as number,
      fromStar: (row.from_star as number | null | undefined) ?? null,
      toStar: (row.to_star as number | null | undefined) ?? null,
      eventWorld: eventWorld === null || eventWorld === undefined ? null : eventWorld === 1,
      characterName: datedName.get(`${ocid}|${historyDate}`) ?? sighting?.name ?? null,
      accountId: sighting?.accountId ?? null,
    }
  })
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
    `SELECT world_id FROM enhancement_totals
      WHERE ocid = ? AND category = 'starforce' AND world_id IS NOT NULL AND history_date < ?
      ORDER BY abs(julianday(history_date) - julianday(?)) LIMIT 1`,
    [ocid, leapDate, aroundDate],
  )
  return findWorldById(values?.[0]?.world_id as string | null | undefined)?.key ?? null
}
