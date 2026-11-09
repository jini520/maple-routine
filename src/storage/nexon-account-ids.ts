/**
 * 기기 기록의 넥슨 계정 칸을 다른 id 로 바꾸는 일 둘. 계정 칸이 생기기 전의 행에 메인 계정 id 를 채우는 부팅 단계와,
 * 로그인이 메이플 ID 가 같은 키의 id 를 이어받을 때 옛 id 의 줄을 옮기는 일이다.
 *
 * 계정 id 는 Preferences 의 인증 수단에 있어 SQLite 이관에서는 못 읽는다. 그래서 이관은 표시만 하고 여기서 채운다.
 */
import { notifyEnhancementTotalsChanged } from './enhancement-totals'
import { getBossProfitDb } from './sqlite/db'
import { inTransaction } from './sqlite/transaction'

/** 계정 칸이 `UNIQUE` 에 든 표. `at` 은 줄이 적힌 때이고, 겹치면 이 칸이 늦은 줄이 남는다. */
const ACCOUNT_KEYED_TABLES = [
  { table: 'enhancement_history_checks', at: 'checked_at', keys: ['enhancement_type', 'history_date'] },
  {
    table: 'enhancement_totals',
    at: 'updated_at',
    keys: ['history_date', 'character_name', 'enhancement_category', 'item_group'],
  },
  { table: 'enhancement_recomputes', at: 'updated_at', keys: ['request_key'] },
  { table: 'event_world_characters', at: 'updated_at', keys: ['character_name', 'world_key'] },
] as const

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

/**
 * 옛 넥슨 계정 id 들의 줄을 `toId` 로 옮긴다. 로그인이 메이플 ID 가 같은 키의 id 를 이어받을 때 쓴다.
 *
 * 옛 id 에 줄이 남으면 강화 수집기가 새 id 로 같은 날을 다시 받고, 계정을 가리지 않고 더하는 강화 합계가 두 번 세어진다.
 * 계정 칸이 `UNIQUE` 에 든 표에서 같은 줄이 겹치면 나중에 적힌 줄이 남는다. 같은 넥슨 계정의 같은 날을 두 번 받은 것이라
 * 나중 줄이 그 날을 더 많이 담는다.
 */
export async function moveNexonAccountRows(fromIds: readonly string[], toId: string): Promise<void> {
  const from = fromIds.filter((id) => id !== toId)
  if (from.length === 0) return

  const db = await getBossProfitDb()
  await inTransaction(db, async () => {
    for (const fromId of from) {
      for (const { table, at, keys } of ACCOUNT_KEYED_TABLES) {
        const same = keys.map((key) => `o.${key} = ${table}.${key}`).join(' AND ')
        await db.run(
          `DELETE FROM ${table} WHERE nexon_account_id = ? AND EXISTS (
             SELECT 1 FROM ${table} o WHERE o.nexon_account_id = ? AND ${same} AND o.${at} >= ${table}.${at})`,
          [fromId, toId],
        )
        await db.run(
          `DELETE FROM ${table} WHERE nexon_account_id = ? AND EXISTS (
             SELECT 1 FROM ${table} o WHERE o.nexon_account_id = ? AND ${same})`,
          [toId, fromId],
        )
        await db.run(`UPDATE ${table} SET nexon_account_id = ? WHERE nexon_account_id = ?`, [toId, fromId])
      }
      await db.run(`UPDATE character_accounts SET nexon_account_id = ? WHERE nexon_account_id = ?`, [toId, fromId])
      await db.run(`UPDATE cashbook_entries SET nexon_account_id = ? WHERE nexon_account_id = ?`, [toId, fromId])
    }
  })
  notifyEnhancementTotalsChanged()
}
