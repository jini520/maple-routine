import {
  ANDROID_DATABASE_PATH,
  IOS_DOCUMENT_PATH,
  open,
  type DB,
  type Scalar,
} from '@op-engineering/op-sqlite'
import { Platform } from 'react-native'

import type { SqliteDbConnection, SqlitePort } from '@core/storage/ports'

import { toOpenOptions, type SqlitePlatform } from './capacitor-sqlite-open'

/**
 * `SqlitePort` 의 RN 구현([[ADR-128]] 결정 4 — 밖으로 나가는 시그니처는 Capacitor 구현과 같다).
 *
 * **op-sqlite 를 고른 이유는 성능이 아니라 `location` 이다.** 기존 DB 는 Capacitor 플러그인이
 * 정한 자리에 있고(`docs/migration/data.md` 결정 2), 자기 전용 디렉터리에만 파일을 만드는
 * 라이브러리로는 **거기 닿을 수 없다** — 그러면 빈 DB 가 새로 생기고 사용자에게는 보스 수익·드랍
 * 기록이 전부 사라진 것으로 보인다. op-sqlite 는 `open({ location })` 이 절대 경로를 받고
 * (`cpp/OPSqlite.cpp:81` — `/` 로 시작하면 그 경로를 그대로 쓴다) 네이티브 기준 디렉터리를
 * 상수로 내준다(`ANDROID_DATABASE_PATH`·`IOS_DOCUMENT_PATH`).
 *
 * 스키마 생성·컬럼 보강([[ADR-069]] 결정 1)·메이린 키 이관·stale 커넥션 복구([[ADR-050]] 결정 2)·
 * 타임아웃([[ADR-117]] 결정 5)은 전부 `@core/storage/sqlite/db.ts` 에 그대로 있다. 이 파일이 맡는
 * 것은 **플러그인 호출 그 자체**뿐이다.
 */
const platform: SqlitePlatform = Platform.OS === 'ios' ? 'ios' : 'android'

const directories = {
  android: ANDROID_DATABASE_PATH as string,
  ios: IOS_DOCUMENT_PATH as string,
}

/**
 * 지금 열려 있는 DB. `isConnection` 이 여기 있는지로 답한다 — Capacitor 쪽 의미는 "커넥션 매니저에
 * 등록돼 있는가"였고 웹뷰 리로드가 남긴 stale 커넥션을 잡는 장치였는데([[ADR-050]] 결정 2),
 * RN 에는 리로드가 없어 그 상황 자체가 없다. 그래서 흉내 내지 않고 **실제로 열려 있는지**를
 * 그대로 답한다(`db.ts` 는 참이면 닫고 새로 만들 뿐이라 어느 쪽이든 맞물린다).
 */
const openDatabases = new Map<string, DB>()

function createDbConnection(database: string, encryption: string): SqliteDbConnection {
  let db: DB | null = null

  function opened(): DB {
    if (db === null) {
      throw new Error(`SQLite 커넥션이 아직 열리지 않았습니다: ${database}`)
    }
    return db
  }

  // 포트의 `values?: unknown[]` 로 실제로 들어오는 것은 `storage/boss-*.ts` 가 넘기는
  // 문자열·숫자·null 뿐이다(op-sqlite 의 `Scalar`). 포트가 `unknown[]` 인 것은 플러그인 타입을
  // core 로 새어 들어가게 하지 않기 위해서다.
  const params = (values?: unknown[]): Scalar[] | undefined => values as Scalar[] | undefined

  return {
    async open() {
      db = open(toOpenOptions(database, encryption, platform, directories))
      openDatabases.set(database, db)
    },
    async execute(statement) {
      return await opened().execute(statement)
    },
    // 호출부(`db.ts` 의 `ensureColumn`·`storage/boss-*.ts`)가 `result.values` 를 읽는다.
    // op-sqlite 는 같은 것을 `rows` 로 주고 행이 없으면 빈 배열이다(`cpp/utils.cpp:191`).
    // 이 한 줄이 어긋나면 조회가 조용히 빈 결과가 되고, 화면에는 기록이 사라진 것으로 보인다.
    async query(statement, values) {
      const { rows } = await opened().execute(statement, params(values))
      return { values: rows }
    },
    async run(statement, values) {
      return await opened().execute(statement, params(values))
    },
  }
}

export const rnSqlitePort: SqlitePort = {
  // RN 에는 웹 타깃이 없다 — `jeep-sqlite`·`sql.js` 폴백은 이 전환에서 버린다
  // (`docs/migration/README.md` 의존성 대응표).
  isWebPlatform() {
    return false
  },
  // `isWebPlatform()` 이 참일 때만 불리므로 여기까지 오지 않는다. 던지지 않는 이유는 그것이
  // 이 포트의 계약이기 때문이다 — 도달 불가라는 사실을 예외로 표현할 자리가 아니다.
  async initWebStore() {},
  async isConnection(database) {
    return openDatabases.has(database)
  },
  async closeConnection(database) {
    const db = openDatabases.get(database)
    if (db === undefined) {
      return
    }
    openDatabases.delete(database)
    await db.closeAsync()
  },
  // `version` 은 받지 않는다 — op-sqlite 에 스키마 버전 개념이 없고, 이 앱의 스키마 진화는
  // `db.ts` 의 `CREATE TABLE IF NOT EXISTS` + `ensureColumn` 이 전부 맡는다([[ADR-069]] 결정 1).
  async createConnection(database, encryption): Promise<SqliteDbConnection> {
    return createDbConnection(database, encryption)
  },
}
