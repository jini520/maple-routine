/**
 * 계정 칸이 생기기 전의 행에 메인 넥슨 계정 id 를 채운다. 버전 16 이 그 행의 계정 칸에 빈 글자를 적어 둔다.
 *
 * 계정 id 는 Preferences 의 인증 수단에 있어 SQLite 이관에서는 못 읽는다. 그래서 이관은 표시만 하고 여기서 채운다.
 */
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

/**
 * 빈 글자 계정 칸을 메인 계정 id 로 바꾼다. 몇 번을 불러도 결과가 같다.
 *
 * 채우기 전에 메인 계정으로 같은 날짜를 이미 다시 조회했으면 그 줄이 이긴다. 옛 줄을 옮기면 `UNIQUE` 가 막기 때문이다.
 *
 * @param mainAccountId 지금 넥슨을 부르는 자격의 계정 id. 계정 칸이 생기기 전의 기록은 모두 이 계정으로 받았다
 */
export async function fillLegacyNexonAccountIds(mainAccountId: string): Promise<void> {
  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    await db.run(`UPDATE OR IGNORE enhancement_history_checks SET nexon_account_id = ? WHERE nexon_account_id = ''`, [
      mainAccountId,
    ])
    await db.run(`DELETE FROM enhancement_history_checks WHERE nexon_account_id = ''`)
    await db.run(`UPDATE character_accounts SET nexon_account_id = ? WHERE nexon_account_id = ''`, [mainAccountId])
    await db.run(`UPDATE cashbook_entries SET nexon_account_id = ? WHERE nexon_account_id = ''`, [mainAccountId])
  })
}
