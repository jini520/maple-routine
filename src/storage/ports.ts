/**
 * 저장소 포트. `storage/*` 가 플랫폼 플러그인 대신 이 인터페이스에만 의존한다.
 *
 * 어댑터가 플러그인을 직접 import 하면 어댑터를 프레임워크 없는 패키지로 옮길 수 없다. 여기서
 * 뒤집는 것이 그 방향 하나뿐이고, 밖으로 나가는 `storage/*` 함수 시그니처는 안 바뀐다.
 *
 * 포트 구현은 앱이 부팅 시 주입한다. 주입 전에 저장소를 건드리면 조용히 넘어가지 않고 던진다.
 * no-op 으로 두면 데이터가 없다 와 포트가 없다 가 구분되지 않고 사용자에게는 데이터 손실로
 * 보인다.
 */

/**
 * Key-Value 저장소. 값은 전부 문자열이다. 구조화된 데이터는 호출부가 이미 `JSON.stringify`
 * 해서 넣으므로 이 경계에 타입 변환이 없다.
 */
export interface PreferencesPort {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  /**
   * 저장된 전체 키. **선택 사항이 아니다**. `storage/cache-data.ts` 가 이 목록을 훑어 캐시 삭제
   * 범위와 용량을 계산한다. 빠지면 설정의 캐시 삭제·계정 데이터
   * 삭제가 죽는다.
   */
  keys(): Promise<string[]>
}

/** 열린 DB 커넥션. `storage/boss-*.ts` 와 `sqlite/db.ts` 가 실제로 쓰는 네 연산뿐이다. */
export interface SqliteDbConnection {
  open(): Promise<void>
  execute(statement: string): Promise<unknown>
  query(statement: string, values?: unknown[]): Promise<{ values?: Record<string, unknown>[] }>
  run(statement: string, values?: unknown[]): Promise<unknown>
}

/**
 * SQLite 커넥션 관리. `sqlite/db.ts` 가 부르는 연산만 노출한다. 넓게 잡으면 새 플랫폼에서 구현해야
 * 할 표면이 그대로 늘어난다.
 *
 * 스키마 생성·컬럼 보강·메이린 키 이관·stale 커넥션 복구·
 * 타임아웃은 전부 `db.ts` 에 남는다. 이 포트는 **플러그인 호출 그 자체**만 맡는다.
 */
export interface SqlitePort {
  /** 웹 타깃(jeep-sqlite 폴리필)인가. 네이티브 구현은 항상 false. */
  isWebPlatform(): boolean
  /** `isWebPlatform()` 이 참일 때만 부르는 초기화. */
  initWebStore(): Promise<void>
  /** 이 이름의 커넥션이 이미 열려 있는가(이전 페이지 로드가 남긴 stale 커넥션 감지). */
  isConnection(database: string): Promise<boolean>
  closeConnection(database: string): Promise<void>
  createConnection(
    database: string,
    encryption: string,
    version: number,
  ): Promise<SqliteDbConnection>
}

let preferencesPort: PreferencesPort | null = null
let sqlitePort: SqlitePort | null = null

export function setPreferencesPort(port: PreferencesPort): void {
  preferencesPort = port
}

export function setSqlitePort(port: SqlitePort): void {
  sqlitePort = port
}

export function getPreferencesPort(): PreferencesPort {
  if (preferencesPort === null) {
    throw new Error(
      'PreferencesPort가 주입되지 않았습니다. 저장소를 쓰기 전에 setPreferencesPort()를 부르세요.',
    )
  }
  return preferencesPort
}

export function getSqlitePort(): SqlitePort {
  if (sqlitePort === null) {
    throw new Error(
      'SqlitePort가 주입되지 않았습니다. 저장소를 쓰기 전에 setSqlitePort()를 부르세요.',
    )
  }
  return sqlitePort
}

/**
 * 호출부용 얇은 파사드. 매 호출마다 포트를 다시 찾으므로 주입이 모듈 평가 순서에 묶이지 않는다
 * (부팅 시점에 주입하고, 저장소 함수는 그보다 늦게 불린다).
 */
export const preferences: PreferencesPort = {
  get: (key) => getPreferencesPort().get(key),
  set: (key, value) => getPreferencesPort().set(key, value),
  remove: (key) => getPreferencesPort().remove(key),
  keys: () => getPreferencesPort().keys(),
}

/** 테스트 전용. 주입된 포트를 비운다. */
export function __resetStoragePortsForTest(): void {
  preferencesPort = null
  sqlitePort = null
}
