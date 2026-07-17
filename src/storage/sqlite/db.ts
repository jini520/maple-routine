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
    dbPromise = openBossProfitDb().catch((error: unknown) => {
      // 실패한 시도를 캐시하면 이후 모든 SQLite 접근이 재시도 없이 같은 실패를 영구히 돌려받는다
      // (보스 수익·파티 설정·디버그 초기화 전부). 다음 호출이 처음부터 다시 열도록 캐시를 비운다.
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

// OTA 적용(CapacitorUpdater.set)처럼 JS 컨텍스트를 파괴하는 리로드 직전에 호출한다. 이 커넥션이
// 아직 살아있는(멀쩡한) 시점에 정상 종료해두지 않으면, 리로드로 dbPromise만 초기화되고 네이티브
// 쪽 커넥션은 그대로 남는다 — 그 상태에서 새 JS 컨텍스트의 openBossProfitDb가 이 stale 커넥션을
// "닫고 새로 생성"으로 복구하려 시도하지만, 이마저 실기기에서 실패해 첫 쿼리가 응답 없이 멈추는
// 사례가 있었다(앱 업데이트 직후 과거 수익 데이터가 안 불러와지는 증상으로 사용자 보고, 2026-07-17).
// 아직 멀쩡할 때 미리 닫아두면 네이티브 쪽에 아무 것도 안 남으므로 이 문제 자체가 생기지 않는다.
// 실패해도(네트워크·타임아웃 등) 곧 리로드될 것이므로 조용히 무시한다 — openBossProfitDb의 기존
// stale 감지 로직이 최후의 폴백으로 남아있다.
export async function closeBossProfitDb(): Promise<void> {
  if (dbPromise === null) {
    return
  }
  // 닫는 도중에도 dbPromise를 계속 살려둔다 — 먼저 null로 비우면, 그 사이 다른 곳에서
  // getBossProfitDb()를 동시에 호출했을 때 "아직 안 닫힌" 커넥션을 못 보고 새로 openBossProfitDb를
  // 시작해버린다. 그 경쟁 상태에서 이 함수의 closeConnection과 그 호출의 createConnection이
  // 뒤엉키면 네이티브에서 "Connection boss_profit already exists"가 날 수 있다(안드로이드
  // CapacitorSQLite.createConnection이 dbDict에 이미 등록돼 있으면 던지는 에러). 닫기가 끝난
  // 뒤(성공이든 실패든)에만 dbPromise를 비워, 그 전까지는 동시 호출도 이 커넥션을 그대로 재사용하게 한다.
  try {
    await dbPromise
    await getSqliteConnection().closeConnection(DB_NAME, false)
  } catch {
    // best-effort
  } finally {
    dbPromise = null
  }
}
