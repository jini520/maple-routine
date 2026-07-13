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

  const { result: alreadyConnected } = await connection.isConnection(DB_NAME, false)
  const db = alreadyConnected
    ? await connection.retrieveConnection(DB_NAME, false)
    : await connection.createConnection(DB_NAME, false, 'no-encryption', 1, false)

  await db.open()
  await db.execute(CREATE_BOSS_PROFIT_RECORDS_TABLE)
  await db.execute(CREATE_BOSS_PARTY_SETTINGS_TABLE)

  return db
}

// 앱 전체에서 커넥션을 하나만 열도록 모듈 스코프에서 캐싱한다 — 동일 이름 커넥션을 중복으로 열면 에러가 난다.
export function getBossProfitDb(): Promise<SQLiteDBConnection> {
  if (dbPromise === null) {
    dbPromise = openBossProfitDb()
  }
  return dbPromise
}
