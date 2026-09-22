import type { SqliteDbConnection } from '../ports'

/**
 * 쓰기 여럿을 트랜잭션 하나로 묶는다. 던지면 그 안에서 쓴 것이 전부 되돌아가고 에러는 그대로 올라간다.
 *
 * @example await inTransaction(db, async () => { for (const u of updates) await db.run(SQL, params(u)) })
 */
export async function inTransaction<T>(db: SqliteDbConnection, work: () => Promise<T>): Promise<T> {
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
