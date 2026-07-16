import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import type { SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'boss_profit'

const CREATE_BOSS_PROFIT_RECORDS_TABLE = `
  CREATE TABLE IF NOT EXISTS boss_profit_records (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    price_meso INTEGER NOT NULL,
    payout_meso INTEGER NOT NULL,
    recorded_at TEXT NOT NULL,
    PRIMARY KEY (ocid, boss, difficulty, period_key)
  )
`

const CREATE_BOSS_PARTY_SETTINGS_TABLE = `
  CREATE TABLE IF NOT EXISTS boss_party_settings (
    ocid TEXT NOT NULL,
    boss TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    party_size INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (ocid, boss, difficulty)
  )
`

const CREATE_BOSS_PROFIT_PERIOD_CHECKS_TABLE = `
  CREATE TABLE IF NOT EXISTS boss_profit_period_checks (
    ocid TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    PRIMARY KEY (ocid, cycle, period_key)
  )
`

let sqliteConnection: SQLiteConnection | null = null
let dbPromise: Promise<SQLiteDBConnection> | null = null

function getSqliteConnection(): SQLiteConnection {
  if (sqliteConnection === null) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }
  return sqliteConnection
}

async function openBossProfitDb(): Promise<SQLiteDBConnection> {
  const connection = getSqliteConnection()

  if (Capacitor.getPlatform() === 'web') {
    await connection.initWebStore()
  }

  // 웹뷰가 리로드되면(OTA 적용: applyDownloadedLiveUpdate → CapacitorUpdater.set이 JS 컨텍스트를
  // 파괴하고 재로드, ADR-027) 이전 로드의 네이티브 SQLite 연결이 남는다. dbPromise는 로드마다
  // 초기화되므로 isConnection이 true라는 건 그 stale 연결이라는 뜻 — 그대로 retrieve+open하면 첫
  // 쿼리가 막히므로, 닫고 새로 만든다.
  const { result: alreadyConnected } = await connection.isConnection(DB_NAME, false)
  if (alreadyConnected) {
    await connection.closeConnection(DB_NAME, false)
  }
  const db = await connection.createConnection(DB_NAME, false, 'no-encryption', 1, false)

  await db.open()
  await db.execute(CREATE_BOSS_PROFIT_RECORDS_TABLE)
  await db.execute(CREATE_BOSS_PARTY_SETTINGS_TABLE)
  await db.execute(CREATE_BOSS_PROFIT_PERIOD_CHECKS_TABLE)

  return db
}

// 앱 전체에서 커넥션을 하나만 열도록 모듈 스코프에서 캐싱한다 — 동일 이름 커넥션을 중복으로 열면 에러가 난다.
export function getBossProfitDb(): Promise<SQLiteDBConnection> {
  if (dbPromise === null) {
    dbPromise = openBossProfitDb()
  }
  return dbPromise
}
