/**
 * 옛 표를 다 지운 뒤 한 번 도는 공간 회수. 가계부 이관 전에 떠 둔 사본 파일을 지우고 `VACUUM` 으로 DB 파일을 줄인다.
 *
 * SQLite 는 표를 지워도 그 공간을 파일 안에 빈 칸으로 남겨, 다시 써야 파일이 줄어든다.
 */
import { STORAGE_KEYS } from './keys'
import { getSqlitePort, preferences } from './ports'
import { getBossProfitDb } from './sqlite/db'
import { cashbookBackupPathOf } from './sqlite/migrations'
import { outsideTransaction } from './sqlite/transaction'

/**
 * 표식이 없을 때 한 번 도는 회수. 실패하면 표식을 두지 않고 던지지 않아 다음 실행이 다시 돈다.
 *
 * @example await reclaimLegacySpaceOnce()
 */
export async function reclaimLegacySpaceOnce(): Promise<void> {
  try {
    if ((await preferences.get(STORAGE_KEYS.legacySpaceReclaimed)) !== null) return
    const db = await getBossProfitDb()
    const { values } = await db.query('PRAGMA database_list')
    const file = (values ?? []).find((row) => row.name === 'main')?.file
    if (typeof file === 'string' && file !== '') await getSqlitePort().removeFile(cashbookBackupPathOf(file))
    await outsideTransaction(db, () => db.execute('VACUUM'))
    await preferences.set(STORAGE_KEYS.legacySpaceReclaimed, '1')
  } catch {
    // 다음 실행이 다시 돈다.
  }
}
