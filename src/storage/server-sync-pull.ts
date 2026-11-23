/**
 * 동기화의 받기가 받은 줄을 SQLite 기록 표에 넣고 지우는 자리. 서버 칸을 기기 칸으로 바꾸는 일은 기능
 * (`features/server-sync/pull-records.ts`)이 한다.
 *
 * 줄 하나를 트랜잭션 하나로 넣는다(`withServerSyncPaused`). 트리거가 받은 줄을 대기 표에 넣지 않고, 넣는 동안 같은 연결의 다른 쓰기도
 * 대기 표에 들어가지 않아 한 번에 길게 잡지 않는다.
 *
 * @see docs/foundation/server-sync.md `받기`
 */
import { nexonIdHashHex } from '../lib/crypto/nexon-id-hash'
import { cashbookItemTypeIdOf } from '../lib/cashbook/entry-ids'
import type { SqliteDbConnection } from './ports'
import { clearServerSyncOwnerPreferences } from './server-sync-pull-preferences'
import { withServerSyncPaused } from './server-sync-queue'
import { DEVICE_TABLES, REFERENCES } from './server-sync-records'
import { getBossProfitDb } from './sqlite/db'
import { NEW_UUID_SQL } from './sqlite/uuid'

type Row = Record<string, unknown>

/** 기록 id 가 있는 SQLite 기록의 서버 표 이름. */
export type PulledSqliteTable =
  | 'characterWorldLeaps'
  | 'inventoryItems'
  | 'cashbookEntries'
  | 'bossProfitEntries'
  | 'bossDrops'
  | 'bossSplitSettings'
  | 'enhancementTotals'
  | 'rememberedLevels'
  | 'mvpGradeHistory'

/** 가계부 기록의 딸린 줄. 칸 이름은 기기 칸이고 id 는 넣을 때 만든다. */
export interface CashbookChildren {
  items: Row[]
  huntInput: Row | null
  transferInput: Row | null
  exchangeInput: Row | null
  fragmentUses: Row[]
}

/** 받은 기록 하나. `row` 는 기기 표의 칸이고, 기기만 쓰는 칸은 빠져 있어 있던 값이 남는다. */
export interface PulledSqliteRecord {
  table: PulledSqliteTable
  id: string
  deleted: boolean
  row: Row
  children?: CashbookChildren
}

/** 받은 굳은 날. 서버의 줄 id 는 기기 조회 기록의 id 와 달라 유일 기준으로 가리킨다. */
export interface PulledSettledDay {
  table: 'enhancementSettledDays'
  deleted: boolean
  nexonAccountId: string
  enhancementType: string
  historyDate: string
}

/** 기기 표의 유일 기준. 같은 값의 다른 id 줄은 서버 줄로 바꾼다. 가계부 기록은 손으로 적는 기록이라 기록 id 로만 가린다. */
const UNIQUE_COLUMNS: Partial<Record<PulledSqliteTable, readonly string[]>> = {
  characterWorldLeaps: ['previous_ocid'],
  inventoryItems: ['account_id', 'world_id', 'item_id'],
  bossProfitEntries: ['ocid', 'boss_difficulty_id', 'period_code'],
  bossDrops: ['profit_entry_id', 'item_id'],
  bossSplitSettings: ['ocid', 'boss_difficulty_id'],
  enhancementTotals: ['ocid', 'history_date', 'category', 'item_name'],
  rememberedLevels: ['ocid', 'type', 'target_id'],
  mvpGradeHistory: ['account_id', 'from_date'],
}

const CASHBOOK_CHILD_TABLES = [
  'cashbook_entry_items',
  'cashbook_entry_hunt_inputs',
  'cashbook_entry_transfer_inputs',
  'cashbook_entry_exchange_inputs',
  'cashbook_entry_fragment_uses',
] as const

async function isQueued(db: SqliteDbConnection, recordId: string): Promise<boolean> {
  return ((await db.query('SELECT 1 FROM server_sync_queue WHERE record_id = ?', [recordId])).values ?? []).length > 0
}

async function exists(db: SqliteDbConnection, table: string, id: string): Promise<boolean> {
  return ((await db.query(`SELECT 1 FROM ${table} WHERE id = ?`, [id])).values ?? []).length > 0
}

/** 유일 기준이 같고 id 가 다른 기기 줄. 인벤토리는 장비가 아닌 줄만 기준이 있다. 장비는 하나가 한 줄이다. */
async function sameKeyIds(db: SqliteDbConnection, record: PulledSqliteRecord, deviceTable: string): Promise<string[]> {
  const columns = UNIQUE_COLUMNS[record.table]
  if (columns === undefined) return []
  let extra = ''
  const params: unknown[] = columns.map((column) => record.row[column] ?? null)
  if (record.table === 'inventoryItems') {
    const equipment = cashbookItemTypeIdOf('equipment')
    if (record.row.cashbook_item_type_id === equipment) return []
    extra = ' AND cashbook_item_type_id IS NOT ?'
    params.push(equipment)
  }
  const where = columns.map((column) => `${column} = ?`).join(' AND ')
  const { values } = await db.query(`SELECT id FROM ${deviceTable} WHERE ${where} AND id <> ?${extra}`, [
    ...params.slice(0, columns.length),
    record.id,
    ...params.slice(columns.length),
  ])
  return (values ?? []).map((row) => row.id as string)
}

/**
 * 유일 기준이 같은 기기 줄을 서버 줄로 바꾼다. 서버 id 의 줄이 기기에 없으면 그 줄의 id 를 바꾸고, 있으면 그 줄을 지운다. 어느 쪽이든
 * 그 줄을 가리키던 줄은 서버 id 로 옮기고 기기 줄의 대기 줄은 뺀다. 서버의 값이 기기 값을 대신한다.
 */
async function replaceSameKeyRows(db: SqliteDbConnection, record: PulledSqliteRecord, deviceTable: string): Promise<void> {
  let serverRowExists = await exists(db, deviceTable, record.id)
  for (const deviceId of await sameKeyIds(db, record, deviceTable)) {
    if (!serverRowExists) {
      await db.run(`UPDATE ${deviceTable} SET id = ? WHERE id = ?`, [record.id, deviceId])
      for (const reference of REFERENCES[record.table] ?? []) {
        await db.run(`UPDATE ${reference.table} SET ${reference.column} = ? WHERE ${reference.column} = ?`, [record.id, deviceId])
      }
      serverRowExists = true
    } else {
      // 겹치는 줄(같은 수익 건의 같은 아이템 드롭)은 옮기지 않고 지운 줄과 함께 지워진다. 서버의 줄이 같은 받기에 온다.
      for (const reference of REFERENCES[record.table] ?? []) {
        await db.run(`UPDATE OR IGNORE ${reference.table} SET ${reference.column} = ? WHERE ${reference.column} = ?`, [record.id, deviceId])
      }
      await db.run(`DELETE FROM ${deviceTable} WHERE id = ?`, [deviceId])
    }
    await db.run('DELETE FROM server_sync_queue WHERE record_id = ?', [deviceId])
  }
}

async function upsert(db: SqliteDbConnection, table: string, row: Row): Promise<void> {
  const columns = Object.keys(row)
  const updates = columns.filter((column) => column !== 'id').map((column) => `${column} = excluded.${column}`)
  await db.run(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`,
    columns.map((column) => row[column] ?? null),
  )
}

async function insertChild(db: SqliteDbConnection, table: string, entryId: string, row: Row): Promise<void> {
  const columns = Object.keys(row)
  await db.run(
    `INSERT INTO ${table} (id, entry_id, ${columns.join(', ')}) VALUES (${NEW_UUID_SQL}, ?, ${columns.map(() => '?').join(', ')})`,
    [entryId, ...columns.map((column) => row[column] ?? null)],
  )
}

/** 딸린 줄을 지우고 받은 것으로 다시 넣는다. 서버가 받을 때마다 갈아 끼우는 줄이라 기기도 같다. */
async function replaceCashbookChildren(db: SqliteDbConnection, entryId: string, children: CashbookChildren): Promise<void> {
  for (const table of CASHBOOK_CHILD_TABLES) await db.run(`DELETE FROM ${table} WHERE entry_id = ?`, [entryId])
  for (const item of children.items) {
    const inventoryId = item.inventory_item_id
    // 기기에서 지운 인벤토리 줄이다. 서버도 그 줄을 지우면 품목의 칸을 비운다.
    const keep = typeof inventoryId === 'string' && (await exists(db, 'inventory_items', inventoryId))
    await insertChild(db, 'cashbook_entry_items', entryId, { ...item, inventory_item_id: keep ? inventoryId : null })
  }
  if (children.huntInput !== null) await insertChild(db, 'cashbook_entry_hunt_inputs', entryId, children.huntInput)
  if (children.transferInput !== null) await insertChild(db, 'cashbook_entry_transfer_inputs', entryId, children.transferInput)
  if (children.exchangeInput !== null) await insertChild(db, 'cashbook_entry_exchange_inputs', entryId, children.exchangeInput)
  for (const use of children.fragmentUses) await insertChild(db, 'cashbook_entry_fragment_uses', entryId, use)
}

/**
 * 받은 기록 하나를 넣거나 지운다. 넣지 않고 건너뛰면 거짓이다. 대기 표에 같은 기록이 있거나, 드롭이 가리키는 수익 건이 기기에 없는
 * 경우다. 기기 표의 CHECK 에 걸리면 던지고 그 줄의 쓰기는 모두 되돌아간다.
 */
export async function applyPulledSqliteRecord(record: PulledSqliteRecord): Promise<boolean> {
  const deviceTable = DEVICE_TABLES[record.table]
  if (deviceTable === undefined) return false
  return withServerSyncPaused(async (db) => {
    // 아직 못 올린 기기 값이 다음 올리기로 서버를 덮는다.
    if (await isQueued(db, record.id)) return false
    if (record.deleted) {
      await db.run(`DELETE FROM ${deviceTable} WHERE id = ?`, [record.id])
      return true
    }
    // 기기에서 지운 수익 건이라 그 지우기가 대기 표에 있다.
    if (record.table === 'bossDrops' && !(await exists(db, 'boss_profit_entries', String(record.row.profit_entry_id)))) return false
    // id 를 바꾸는 동안 가리키는 줄이 걸리지 않게 외래키 검사를 트랜잭션 끝으로 미룬다.
    await db.execute('PRAGMA defer_foreign_keys = ON')
    await replaceSameKeyRows(db, record, deviceTable)
    await upsert(db, deviceTable, record.row)
    if (record.children !== undefined) await replaceCashbookChildren(db, record.id, record.children)
    return true
  })
}

/**
 * 받은 굳은 날을 조회 기록에 적는다. 지운 굳은 날은 조회 기록 줄을 지운다. 굳은 표시만 내리면 커서가 같아 넥슨을 다시 불러도 합계를
 * 다시 적지 않는다. 그 날의 기기 줄이 대기 표에 있으면 건너뛴다.
 */
export async function applyPulledSettledDay(record: PulledSettledDay): Promise<boolean> {
  const key = [record.nexonAccountId, record.enhancementType, record.historyDate]
  return withServerSyncPaused(async (db) => {
    const { values } = await db.query(
      'SELECT id FROM enhancement_history_checks WHERE nexon_account_id = ? AND enhancement_type = ? AND history_date = ?',
      key,
    )
    const deviceId = values?.[0]?.id
    if (typeof deviceId === 'string' && (await isQueued(db, deviceId))) return false
    if (record.deleted) {
      await db.run('DELETE FROM enhancement_history_checks WHERE nexon_account_id = ? AND enhancement_type = ? AND history_date = ?', key)
      return true
    }
    await db.run(
      `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, settled, checked_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(nexon_account_id, enhancement_type, history_date) DO UPDATE SET settled = 1`,
      [...key, new Date().toISOString()],
    )
    return true
  })
}

/** 해시와 원문의 짝. 이 기기가 넥슨 목록에서 본 캐릭터와 메이플 ID 다. */
export interface NexonIdLookup {
  /** ocid 해시 → ocid */
  ocids: Map<string, string>
  /** 메이플 ID 해시 → 메이플 ID */
  mapleIds: Map<string, string>
  /** 메이플 ID → 그 메이플 ID 를 가장 늦게 본 넥슨 계정 id */
  nexonAccountIds: Map<string, string>
}

/** 받기가 해시를 원문으로 바꾸는 짝. `character_accounts` 를 한 번 읽어 해시한다. */
export async function loadNexonIdLookup(): Promise<NexonIdLookup> {
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT ocid, account_id, nexon_account_id FROM character_accounts ORDER BY last_seen_date')
  const lookup: NexonIdLookup = { ocids: new Map(), mapleIds: new Map(), nexonAccountIds: new Map() }
  const hashed = new Map<string, string>()
  const hashOf = (id: string): string => {
    let hash = hashed.get(id)
    if (hash === undefined) {
      hash = nexonIdHashHex(id)
      hashed.set(id, hash)
    }
    return hash
  }
  for (const row of values ?? []) {
    const ocid = row.ocid as string
    const mapleId = row.account_id as string
    lookup.ocids.set(hashOf(ocid), ocid)
    lookup.mapleIds.set(hashOf(mapleId), mapleId)
    if (typeof row.nexon_account_id === 'string' && row.nexon_account_id !== '') lookup.nexonAccountIds.set(mapleId, row.nexon_account_id)
  }
  return lookup
}

/** 비울 주인. 메이플 ID 는 기기 칸의 값(원문이나 `#` 를 붙인 해시)이다. */
export interface ServerSyncOwners {
  mapleIds: readonly string[]
  /** 참이면 사람의 기록(추적 목록과 대표 · 약속 · 계산기 기록)도 비운다 */
  person: boolean
}

const NOT_QUEUED = 'id NOT IN (SELECT record_id FROM server_sync_queue)'

function placeholders(values: readonly unknown[]): string {
  return values.map(() => '?').join(', ')
}

/** 한 메이플 ID 의 SQLite 기록을 비운다. 대기 중인 기록은 남기고, 대기 중인 드롭이 가리키는 수익 건도 남긴다. */
async function clearMapleIdRecords(db: SqliteDbConnection, mapleId: string, ocids: readonly string[], nexonAccountIds: readonly string[]): Promise<void> {
  if (ocids.length > 0) {
    const inOcids = `ocid IN (${placeholders(ocids)})`
    await db.run(
      `DELETE FROM boss_drops WHERE ${NOT_QUEUED} AND profit_entry_id IN (SELECT id FROM boss_profit_entries WHERE ${inOcids})`,
      [...ocids],
    )
    await db.run(`DELETE FROM boss_profit_entries WHERE ${inOcids} AND ${NOT_QUEUED} AND id NOT IN (SELECT profit_entry_id FROM boss_drops)`, [
      ...ocids,
    ])
    for (const table of ['boss_split_settings', 'enhancement_totals', 'remembered_levels', 'character_world_leaps']) {
      await db.run(`DELETE FROM ${table} WHERE ${inOcids} AND ${NOT_QUEUED}`, [...ocids])
    }
    await db.run(`DELETE FROM cashbook_entries WHERE ${inOcids} AND ${NOT_QUEUED}`, [...ocids])
  }
  await db.run(`DELETE FROM cashbook_entries WHERE account_id = ? AND ${NOT_QUEUED}`, [mapleId])
  await db.run(`DELETE FROM inventory_items WHERE account_id = ? AND ${NOT_QUEUED}`, [mapleId])
  await db.run(`DELETE FROM mvp_grade_history WHERE account_id = ? AND ${NOT_QUEUED}`, [mapleId])
  if (nexonAccountIds.length > 0) {
    // 굳지 않은 조회 기록은 서버에 없는 기기의 커서라 남긴다.
    await db.run(
      `DELETE FROM enhancement_history_checks WHERE settled = 1 AND nexon_account_id IN (${placeholders(nexonAccountIds)}) AND ${NOT_QUEUED}`,
      [...nexonAccountIds],
    )
  }
}

/**
 * 주인의 기록을 비운다. 받은 지 오래되어 서버가 지운 표식을 놓친 주인을 0 부터 다시 받기 전에 부른다. 대기 표에 남은 기록은 아직 서버에
 * 없는 값이라 남긴다. 지우기는 대기 표에 넣지 않는다.
 */
export async function clearServerSyncOwners(owners: ServerSyncOwners): Promise<void> {
  const db = await getBossProfitDb()
  const ocids: string[] = []
  for (const mapleId of owners.mapleIds) {
    const { values } = await db.query('SELECT DISTINCT ocid, nexon_account_id FROM character_accounts WHERE account_id = ?', [mapleId])
    const mine = [...new Set((values ?? []).map((row) => row.ocid as string))]
    const accounts = [
      ...new Set(
        (values ?? []).flatMap((row) => (typeof row.nexon_account_id === 'string' && row.nexon_account_id !== '' ? [row.nexon_account_id] : [])),
      ),
    ]
    ocids.push(...mine)
    await withServerSyncPaused((paused) => clearMapleIdRecords(paused, mapleId, mine, accounts))
  }
  await clearServerSyncOwnerPreferences({ mapleIds: owners.mapleIds, ocids, person: owners.person })
}
