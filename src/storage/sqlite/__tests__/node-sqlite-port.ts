/// <reference types="node" />
/**
 * **진짜 SQLite 위에서 `db.ts` 를 돌리는 포트**([[ADR-176]] 결정 7).
 *
 * 이 저장소의 SQLite 테스트는 전부 목이었다 — `db.spec.ts` 는 가짜 포트를, `rn-sqlite.test.ts` 는
 * op-sqlite 의 «모양» 을 흉내 낸다. 그 둘이 지키는 것은 «어떤 문장이 어떤 차례로 나가는가» 이고,
 * **제약은 그 목록에 없다**: 목은 자기가 흉내 내라고 배운 것만 흉내 낸다. 그래서
 * `income_records.meso_amount` 가 `NOT NULL` 인 채 «메포·캐시 「기타」» 에 `null` 을 받아 INSERT 가
 * 던지는 것을 **한 스위트도 못 봤다**(이슈 #265).
 *
 * `node:sqlite` 는 노드 내장이라 **새 의존성이 0** 이고, 우리가 쓰는 표면(`exec`·`prepare().all()`
 * ·`prepare().run()`·`PRAGMA`)은 op-sqlite 와 같은 SQLite 다. 흉내 내는 것은 이제 **엔진이 아니라
 * 파일 자리**뿐이다.
 *
 * 파일로 여는 이유는 **닫았다 다시 여는 것을 봐야 하기 때문**이다(«두 번째 부팅에서는 재작성이 한
 * 문장도 안 나간다»). `:memory:` 는 닫는 순간 사라져 그 케이스가 성립하지 않는다.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SqliteDbConnection, SqlitePort } from '../../ports'

export interface RealSqlite {
  /** `setSqlitePort()` 에 넣는다. */
  port: SqlitePort
  /** `db.ts` 가 낸 문장 전부(차례대로) — «무엇이 안 나갔는가» 를 볼 때 쓴다. */
  statements: string[]
  /** 파일을 따로 열어 만진다 — 옛 스키마를 심고, 결과를 되짚는다. */
  inspect<T>(read: (db: DatabaseSync) => T): T
  /** 임시 디렉터리째 지운다. */
  dispose(): void
}

/** 포트가 받는 값은 `storage/*` 가 넘기는 문자열·숫자·`null` 뿐이다(op-sqlite 의 `Scalar` 와 같다). */
type Bindable = string | number | bigint | null | Uint8Array

const bind = (values?: unknown[]): Bindable[] => (values ?? []) as Bindable[]

export function createRealSqlite(): RealSqlite {
  const directory = mkdtempSync(join(tmpdir(), 'maple-sqlite-'))
  const file = join(directory, 'boss_profit.db')
  const statements: string[] = []
  const open = new Map<string, DatabaseSync>()

  function connection(database: string): SqliteDbConnection {
    let db: DatabaseSync | null = null

    function opened(): DatabaseSync {
      if (db === null) throw new Error(`아직 열리지 않았습니다: ${database}`)
      return db
    }

    return {
      async open() {
        db = new DatabaseSync(file)
        open.set(database, db)
      },
      async execute(statement) {
        statements.push(statement)
        opened().exec(statement)
        return {}
      },
      // op-sqlite 어댑터가 `rows` 를 `values` 로 감싸는 그 자리다(`rn-sqlite.ts`) — 호출부
      // (`ensureColumn`·`storage/income.ts`)가 읽는 이름으로 맞춘다.
      async query(statement, values) {
        statements.push(statement)
        const rows = opened().prepare(statement).all(...bind(values))
        return { values: rows as Record<string, unknown>[] }
      },
      async run(statement, values) {
        statements.push(statement)
        return opened().prepare(statement).run(...bind(values))
      },
    }
  }

  return {
    statements,
    port: {
      isWebPlatform: () => false,
      async initWebStore() {},
      async isConnection(database) {
        return open.has(database)
      },
      async closeConnection(database) {
        const db = open.get(database)
        if (db === undefined) return
        open.delete(database)
        db.close()
      },
      async createConnection(database) {
        return connection(database)
      },
    },
    inspect(read) {
      const db = new DatabaseSync(file)
      try {
        return read(db)
      } finally {
        db.close()
      }
    },
    dispose() {
      for (const db of open.values()) db.close()
      open.clear()
      rmSync(directory, { recursive: true, force: true })
    },
  }
}
