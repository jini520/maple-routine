/**
 * 캐릭터의 메이플 ID 소속(`character_accounts`). `(ocid, 이름, ID)` 마다 처음 본 날과 마지막으로 본 날.
 *
 * @see docs/persistence/sqlite.md `character_accounts`
 */
import type { CharacterAccountSighting } from '../lib/mvp/membership'
import type { MapleAccount } from '../types'
import { getBossProfitDb } from './sqlite/db'

const UPSERT_SQL = `
  INSERT INTO character_accounts (ocid, name, account_id, first_seen_on, last_seen_on)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(ocid, name, account_id) DO UPDATE SET
    first_seen_on = MIN(first_seen_on, excluded.first_seen_on),
    last_seen_on = MAX(last_seen_on, excluded.last_seen_on)
`

/**
 * `character/list` 응답의 소속을 적는다.
 *
 * @param seenOn KST `YYYY-MM-DD`
 */
export async function recordCharacterAccounts(accounts: readonly MapleAccount[], seenOn: string): Promise<void> {
  const db = await getBossProfitDb()
  for (const account of accounts) {
    for (const character of account.characters) {
      if (character.name === '') continue
      await db.run(UPSERT_SQL, [character.ocid, character.name, account.accountId, seenOn, seenOn])
    }
  }
}

export async function getCharacterAccountSightings(): Promise<CharacterAccountSighting[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, name, account_id, first_seen_on, last_seen_on FROM character_accounts`,
  )
  return (values ?? []).map((row) => ({
    ocid: row.ocid as string,
    name: row.name as string,
    accountId: row.account_id as string,
    firstSeenOn: row.first_seen_on as string,
    lastSeenOn: row.last_seen_on as string,
  }))
}
