import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'
import type { SqliteDbConnection, SqlitePort } from '@core/storage/ports'

/**
 * `SqlitePort` 의 Capacitor 구현([[ADR-128]]).
 *
 * 여기 남는 것은 플러그인 호출 규약뿐이다 — 커넥션 매니저 인스턴스, `readonly` 플래그(항상 false),
 * 웹 플랫폼 판정. 스키마·마이그레이션·복구·타임아웃은 전부 `storage/sqlite/db.ts` 가 갖고 있다.
 *
 * `'no-encryption'` 은 이 파일이 아니라 `db.ts` 가 넘긴다 — 기존 사용자의 DB 가 평문이라 그 값이
 * 곧 "옛 파일을 그대로 연다"는 계약이다(`docs/migration/data.md` 결정 2).
 */
// 동일 이름 커넥션을 중복으로 열면 네이티브가 에러를 던지므로 매니저는 하나만 만든다.
let sqliteConnection: SQLiteConnection | null = null

function getSqliteConnection(): SQLiteConnection {
  if (sqliteConnection === null) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }
  return sqliteConnection
}

export const capacitorSqlitePort: SqlitePort = {
  isWebPlatform() {
    return Capacitor.getPlatform() === 'web'
  },
  async initWebStore() {
    await getSqliteConnection().initWebStore()
  },
  async isConnection(database) {
    const { result } = await getSqliteConnection().isConnection(database, false)
    return result === true
  },
  async closeConnection(database) {
    await getSqliteConnection().closeConnection(database, false)
  },
  async createConnection(database, encryption, version): Promise<SqliteDbConnection> {
    return getSqliteConnection().createConnection(database, false, encryption, version, false)
  },
}
