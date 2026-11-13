/**
 * 캐릭터의 메이플 ID 소속(`character_accounts`). `(ocid, 이름, ID)` 마다 처음 본 날과 마지막으로 본 날.
 *
 * @see docs/persistence/sqlite.md `character_accounts`
 */
import type { OwnerSighting } from '../lib/enhancement/sighted-owner'
import type { CharacterAccountSighting } from '../lib/mvp/membership'
import type { MapleAccount } from '../types'
import { getBossProfitDb } from './sqlite/db'

const UPSERT_SQL = `
  INSERT INTO character_accounts (ocid, name, account_id, nexon_account_id, first_seen_date, last_seen_date, world_key)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(ocid, name, account_id) DO UPDATE SET
    -- 계정을 모르는 자격(저장 전에 검증하는 키)으로 본 것이 아는 계정을 지우면 안 된다.
    nexon_account_id = COALESCE(excluded.nexon_account_id, nexon_account_id),
    world_key = COALESCE(excluded.world_key, world_key),
    first_seen_date = MIN(first_seen_date, excluded.first_seen_date),
    last_seen_date = MAX(last_seen_date, excluded.last_seen_date)
`

/**
 * `character/list` 응답의 소속을 적는다.
 *
 * @param seenOn KST `YYYY-MM-DD`
 * @param nexonAccountId 목록을 받은 자격의 넥슨 계정 id. 저장 전에 검증하는 키는 `null` 이다
 */
export async function recordCharacterAccounts(
  accounts: readonly MapleAccount[],
  seenOn: string,
  nexonAccountId: string | null,
): Promise<void> {
  const db = await getBossProfitDb()
  for (const account of accounts) {
    for (const character of account.characters) {
      if (character.name === '') continue
      await db.run(UPSERT_SQL, [
        character.ocid,
        character.name,
        account.accountId,
        nexonAccountId,
        seenOn,
        seenOn,
        character.worldKey ?? null,
      ])
    }
  }
}

export async function getCharacterAccountSightings(): Promise<CharacterAccountSighting[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, name, account_id, first_seen_date, last_seen_date FROM character_accounts`,
  )
  return (values ?? []).map((row) => ({
    ocid: row.ocid as string,
    name: row.name as string,
    accountId: row.account_id as string,
    firstSeenOn: row.first_seen_date as string,
    lastSeenOn: row.last_seen_date as string,
  }))
}

/**
 * 메이플 ID 들이 속했던 넥슨 계정 id. 못 찾으면 `null`.
 *
 * 메이플 ID 는 넥슨 계정 하나에만 속하므로, 다시 받은 키의 목록에 아는 메이플 ID 가 있으면 그 키는 옛 계정이다.
 *
 * @param accountIds `character/list` 가 준 메이플 ID
 */
export async function findNexonAccountIdOfMapleIds(accountIds: readonly string[]): Promise<string | null> {
  if (accountIds.length === 0) return null
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT nexon_account_id FROM character_accounts
      WHERE account_id IN (${accountIds.map(() => '?').join(', ')})
        AND nexon_account_id IS NOT NULL AND nexon_account_id <> ''
      ORDER BY last_seen_date DESC LIMIT 1`,
    [...accountIds],
  )
  const found = values?.[0]?.nexon_account_id
  return typeof found === 'string' ? found : null
}

/**
 * 캐릭터마다 속한 넥슨 계정 id. 계정을 모르는 캐릭터는 빠진다.
 *
 * 이름을 바꾼 캐릭터는 줄이 여럿이라 마지막으로 본 줄의 계정을 쓴다.
 */
export async function getNexonAccountIdsOfOcids(ocids: readonly string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>()
  if (ocids.length === 0) return found
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, nexon_account_id FROM character_accounts
      WHERE ocid IN (${ocids.map(() => '?').join(', ')})
        AND nexon_account_id IS NOT NULL AND nexon_account_id <> ''
      ORDER BY last_seen_date ASC`,
    [...ocids],
  )
  for (const row of values ?? []) found.set(row.ocid as string, row.nexon_account_id as string)
  return found
}

/** 캐릭터 하나의 주인. 서버로 보내는 기록에 싣는 메이플 ID 와, 그 기록을 보낼 신원의 넥슨 계정이다. */
export interface CharacterOwner {
  mapleId: string
  /** 계정을 모르는 자격(저장 전에 검증하는 키)으로만 본 캐릭터는 `null` */
  nexonAccountId: string | null
}

/**
 * 캐릭터마다 마지막으로 본 줄의 메이플 ID 와 넥슨 계정. 앱이 본 적 없는 캐릭터는 빠진다.
 *
 * 이름을 바꾼 캐릭터는 줄이 여럿이라 마지막으로 본 줄을 쓴다.
 */
export async function getCharacterOwnersOfOcids(ocids: readonly string[]): Promise<Map<string, CharacterOwner>> {
  const found = new Map<string, CharacterOwner>()
  if (ocids.length === 0) return found
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, account_id, nexon_account_id FROM character_accounts
      WHERE ocid IN (${ocids.map(() => '?').join(', ')})
      ORDER BY last_seen_date ASC`,
    [...ocids],
  )
  for (const row of values ?? []) {
    const account = row.nexon_account_id as string | null | undefined
    found.set(row.ocid as string, {
      mapleId: row.account_id as string,
      nexonAccountId: account === undefined || account === null || account === '' ? null : account,
    })
  }
  return found
}

/** 넥슨 계정마다 그 계정의 메이플 ID. 계정을 모르는 줄은 빠진다. 메이플 ID 는 글자 차례다. */
export async function getMapleIdsByNexonAccount(): Promise<Map<string, string[]>> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT DISTINCT nexon_account_id, account_id FROM character_accounts
      WHERE nexon_account_id IS NOT NULL AND nexon_account_id <> ''
      ORDER BY nexon_account_id, account_id`,
  )
  const byAccount = new Map<string, string[]>()
  for (const row of values ?? []) {
    const account = row.nexon_account_id as string
    byAccount.set(account, [...(byAccount.get(account) ?? []), row.account_id as string])
  }
  return byAccount
}

/** 강화 줄을 캐릭터에 붙일 때 쓰는 소속 기록. 어느 넥슨 계정의 목록에서 봤는지와 월드까지 든다. */
export interface EnhancementOwnerSighting extends OwnerSighting {
  worldKey: string | null
}

export async function getOwnerSightings(): Promise<EnhancementOwnerSighting[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT ocid, name, account_id, nexon_account_id, first_seen_date, last_seen_date, world_key FROM character_accounts`,
  )
  return (values ?? []).map((row) => ({
    ocid: row.ocid as string,
    name: row.name as string,
    accountId: row.account_id as string,
    nexonAccountId: (row.nexon_account_id as string | null | undefined) ?? null,
    firstSeenOn: row.first_seen_date as string,
    lastSeenOn: row.last_seen_date as string,
    worldKey: (row.world_key as string | null | undefined) ?? null,
  }))
}
