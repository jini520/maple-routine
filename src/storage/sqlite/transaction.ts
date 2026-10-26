import type { SqliteDbConnection } from '../ports'

/** 연결마다 마지막으로 줄 선 트랜잭션. 끝나면(성공이든 실패든) 다음 것이 시작한다. */
const tails = new WeakMap<SqliteDbConnection, Promise<unknown>>()

/**
 * 쓰기 여럿을 트랜잭션 하나로 묶는다. 던지면 그 안에서 쓴 것이 전부 되돌아가고 에러는 그대로 올라간다.
 *
 * 같은 연결의 트랜잭션은 차례로 돈다. 겹쳐 열면 SQLite 가 `cannot start a transaction within a transaction` 으로 뒤의
 * 것을 거절한다. 앱을 켤 때 계정 칸 채우기와 강화 합계 옮기기가 실제로 겹쳤다. `work` 안에서 다시 부르면 자기 차례를
 * 기다리며 멈추므로 중첩하지 않는다.
 *
 * @example await inTransaction(db, async () => { for (const u of updates) await db.run(SQL, params(u)) })
 */
export function inTransaction<T>(db: SqliteDbConnection, work: () => Promise<T>): Promise<T> {
  const run = (tails.get(db) ?? Promise.resolve()).then(() => runTransaction(db, work))
  tails.set(
    db,
    run.catch(() => undefined),
  )
  return run
}

async function runTransaction<T>(db: SqliteDbConnection, work: () => Promise<T>): Promise<T> {
  await db.execute('BEGIN')
  try {
    const result = await work()
    await db.execute('COMMIT')
    return result
  } catch (error: unknown) {
    await db.execute('ROLLBACK')
    throw error
  }
}
