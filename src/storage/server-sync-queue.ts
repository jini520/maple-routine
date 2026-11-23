/**
 * 서버로 올릴 기록을 담는 대기 표(`server_sync_queue`). 기록 표의 트리거와 Preferences 기록의 저장 함수가 넣는다.
 *
 * **값을 담지 않는다.** 서버 표 이름과 기록 id 만 담고 보낼 때 원본의 지금 값을 읽는다. 담으면 그 사이에 또 고친 경우 중간 값이
 * 서버로 간다. **올리기 · 지우기를 적지 않는다.** 원본이 있으면 올리기이고 없으면 지우기다.
 *
 * @see docs/foundation/server-sync.md `대기 표에 넣기`
 */
import { notifyAfterBatch } from './record-revision-batch'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'
import { NEW_UUID_SQL } from './sqlite/uuid'
import type { SqliteDbConnection } from './ports'

/** 몇 번까지 시도하나. 안 버리면 못 보내는 건이 영원히 재시도된다. */
export const MAX_SYNC_ATTEMPTS = 5

/** 동기화의 서버 표 이름. 서버 `SYNC_TABLE_NAMES` 와 같은 글자 · 같은 차례다. 올리기가 이 차례로 묶는다. */
export const SERVER_SYNC_TABLES = [
  'characterWorldLeaps',
  'inventoryItems',
  'cashbookEntries',
  'bossProfitEntries',
  'bossDrops',
  'bossSplitSettings',
  'enhancementTotals',
  'enhancementSettledDays',
  'rememberedLevels',
  'mvpGradeHistory',
  'manualTrackedItems',
  'sharedContentProgress',
  'mapleIdNames',
  'trackedCharacters',
  'representativeCharacterMotions',
  'accountSettings',
  'bottomBarSubPageOrders',
  'partyAppointments',
  'bossProfitCalculatorRecords',
] as const

export type ServerSyncTable = (typeof SERVER_SYNC_TABLES)[number]

/** 보낼 것 하나. */
export interface SyncQueueEntry {
  id: string
  /** 서버 표 이름 */
  recordType: string
  /** 기록 id. id 가 없는 Preferences 항목은 `표 이름:유일 기준의 값` 이다 */
  recordId: string
  /** 응답을 받은 횟수. 네트워크가 없던 회차는 안 센다. */
  attempts: number
  lastError: string | null
  createdAt: string
}

const writeListeners = new Set<() => void>()

/** 구독자를 부르는 함수. `notifyAfterBatch` 가 같은 함수로 알아봐 반복 끝에 한 번만 부르도록 모듈에 하나만 둔다. */
function notifyWriteListeners(): void {
  for (const listener of writeListeners) listener()
}

/**
 * 서버로 올리는 기록을 쓴 저장 함수가 부른다. 반복 쓰기(`batchRecordWrites`) 안이면 반복이 끝날 때 한 번 알린다. 셸이 이 알림으로
 * 회차를 깨워 입력 직후에 올린다. 판을 올리는 저장 함수는 판 알림으로 대신한다.
 */
export function noteRecordsWritten(): void {
  notifyAfterBatch(notifyWriteListeners)
}

/** 기록을 쓸 때 부를 함수를 건다. 풀 함수를 돌려준다. */
export function subscribeRecordsWritten(listener: () => void): () => void {
  writeListeners.add(listener)
  return () => {
    writeListeners.delete(listener)
  }
}

/** 표에 든 것 전부. 넣은 차례(rowid)다. 한 밀리초 안에 여러 줄이 들어가 시각으로는 차례를 가를 수 없다. */
export async function listServerSyncQueue(): Promise<SyncQueueEntry[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT id, record_type, record_id, attempts, last_error, created_at FROM server_sync_queue ORDER BY rowid`,
  )

  return (values ?? []).map((row) => ({
    id: row.id as string,
    recordType: row.record_type as string,
    recordId: row.record_id as string,
    attempts: Number(row.attempts),
    lastError: (row.last_error as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

/**
 * 응답을 받았고 거절이었다. 횟수를 하나 올린다.
 *
 * **응답을 받은 뒤에 적는 것이 계약이다.** 미리 적어 두고 성공하면 되돌리는 모양으로 짜면, 훑는 중에 앱이 꺼졌을 때 그 되돌리기가
 * 못 돌아 한 번 켰다 끈 것이 시도로 남는다.
 */
export async function countServerSyncAttempt(recordId: string, lastError: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`UPDATE server_sync_queue SET attempts = attempts + 1, last_error = ? WHERE record_id = ?`, [lastError, recordId])
}

/**
 * 표를 통째로 비운다. **로그아웃이 부른다.**
 *
 * 남겨 두면 다음에 다른 키를 넣은 사람이 **앞사람의 기록을 자기 이름으로** 올린다. 대기 줄에는 누가 만든 것인지가 안 적혀 있다.
 */
export async function clearServerSyncQueue(): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`DELETE FROM server_sync_queue`)
}

/** 그 기록의 대기 줄이 있나. 받기가 아직 못 올린 기기 값을 덮지 않으려고 본다. */
export async function isServerSyncQueued(recordId: string): Promise<boolean> {
  const db = await getBossProfitDb()
  const { values } = await db.query(`SELECT 1 FROM server_sync_queue WHERE record_id = ?`, [recordId])
  return (values ?? []).length > 0
}

/** 보냈거나 포기했다. 줄을 지우는 자리는 여기 하나다. */
export async function removeServerSync(recordId: string): Promise<void> {
  const db = await getBossProfitDb()
  await db.run(`DELETE FROM server_sync_queue WHERE record_id = ?`, [recordId])
}

/**
 * 트리거와 Preferences 넣기가 대기 표에 넣지 않는 동안 도는 일. 받은 줄을 넣거나 올리기의 결과로 기기 줄을 고칠 때 쓴다.
 *
 * 한 트랜잭션 안에서 `server_sync_pause` 에 줄을 넣고 끝나면 뺀다. 앱이 그 사이에 꺼지면 줄도 함께 되돌아간다. 같은 연결의 다른
 * 쓰기도 그동안은 넣지 않으므로 짧은 일에만 쓴다.
 *
 * @example await withServerSyncPaused((db) => db.run('UPDATE boss_drops SET profit_entry_id = ? WHERE profit_entry_id = ?', [to, from]))
 */
export async function withServerSyncPaused<T>(work: (db: SqliteDbConnection) => Promise<T>): Promise<T> {
  const db = await getBossProfitDb()
  return inTransaction(db, async () => {
    await db.run(`INSERT INTO server_sync_pause (started_at) VALUES (?)`, [new Date().toISOString()])
    const result = await work(db)
    await db.run(`DELETE FROM server_sync_pause`)
    return result
  })
}

/**
 * id 가 없는 Preferences 항목의 대기 줄 id. 유일 기준의 값을 `/` 로 잇는다. 기록 id 는 uuid 라 이 글자와 겹치지 않는다.
 *
 * @example preferenceRecordIdOf('manualTrackedItems', [ocid, 'weekly', contentId])
 */
export function preferenceRecordIdOf(table: ServerSyncTable, parts: readonly string[]): string {
  return `${table}:${parts.join('/')}`
}

/** 대기 줄 id 에서 유일 기준의 값. 그 표의 글자가 아니면 `null` 이다. */
export function partsOfPreferenceRecordId(table: ServerSyncTable, recordId: string): string[] | null {
  const prefix = `${table}:`
  return recordId.startsWith(prefix) ? recordId.slice(prefix.length).split('/') : null
}

const ENQUEUE_SQL = `
  INSERT INTO server_sync_queue (id, record_type, record_id, created_at)
  SELECT ${NEW_UUID_SQL}, ?, ?, ?
   WHERE NOT EXISTS (SELECT 1 FROM server_sync_pause)
     AND NOT EXISTS (SELECT 1 FROM server_sync_queue WHERE record_id = ?)
`

/**
 * Preferences 에 든 기록을 바꾼 저장이 부른다. 앞 값과 새 값에서 달라진 항목을 넣는다. 열쇠는 대기 줄 id 이고 값은 견주기만 한다.
 *
 * 대기 표에 넣지 못해도 던지지 않는다. 기록은 이미 Preferences 에 적혀서, 던지면 화면이 저장하지 못했다고 알린다.
 *
 * @param before 저장 전의 항목. 없던 항목은 빠진다
 * @param after 저장한 항목. 지운 항목은 빠진다
 */
export async function enqueueChangedPreferenceRecords(
  table: ServerSyncTable,
  before: ReadonlyMap<string, unknown>,
  after: ReadonlyMap<string, unknown>,
): Promise<void> {
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(
    (recordId) => JSON.stringify(before.get(recordId)) !== JSON.stringify(after.get(recordId)),
  )
  if (changed.length === 0) return
  try {
    const db = await getBossProfitDb()
    const now = new Date().toISOString()
    for (const recordId of changed) await db.run(ENQUEUE_SQL, [table, recordId, now, recordId])
    noteRecordsWritten()
  } catch {
    // 기록은 이미 저장됐다.
  }
}

/**
 * 설정 칸 하나를 바꾼 저장이 부른다. 서버가 실은 칸만 고쳐서 칸마다 넣는다.
 *
 * @param column 서버 `account_settings` 의 칸 이름(낙타 표기)
 */
export function enqueueChangedSetting(column: string, before: unknown, after: unknown): Promise<void> {
  const recordId = preferenceRecordIdOf('accountSettings', [column])
  return enqueueChangedPreferenceRecords('accountSettings', new Map([[recordId, before]]), new Map([[recordId, after]]))
}
