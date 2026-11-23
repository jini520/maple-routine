/**
 * 올리기가 기기의 기록을 읽고 고치는 자리. 대기 줄이 가리키는 원본을 읽고, 서버가 돌려준 id 로 기기 줄을 바꾸고, 거절된 기록을 지운다.
 *
 * 원본은 SQLite 기록이면 표의 줄(칸 이름 그대로), Preferences 기록이면 저장된 항목이다. 서버 칸으로 바꾸는 일은 기능
 * (`features/server-sync/push-records.ts`)이 한다.
 *
 * @see docs/foundation/server-sync.md `올리기`
 */
import { getBarOrder } from './bar-order'
import { getCharacterProfiles } from './character-profiles'
import { accountSharedProgressKey, manualTrackedContentKey, representativeCharacterKey, STORAGE_KEYS, trackedCharactersKey, worldSharedProgressKey } from './keys'
import { getMapleIdNames } from './maple-id-names'
import { preferences } from './ports'
import { getQuickLinks } from './quick-links'
import { partsOfPreferenceRecordId, withServerSyncPaused, type ServerSyncTable } from './server-sync-queue'
import { readStoredSharedProgress } from './shared-progress-cache'
import { getBossProfitDb } from './sqlite/db'

/** 대기 줄의 원본. 없으면 `null` 이고 올리기가 지우기를 보낸다. */
export type ServerSyncSource = Record<string, unknown>

/** 서버 표 이름 → 기기 SQLite 표. 여기 없는 표는 Preferences 에 있다. */
export const DEVICE_TABLES: Partial<Record<ServerSyncTable, string>> = {
  characterWorldLeaps: 'character_world_leaps',
  inventoryItems: 'inventory_items',
  cashbookEntries: 'cashbook_entries',
  bossProfitEntries: 'boss_profit_entries',
  bossDrops: 'boss_drops',
  bossSplitSettings: 'boss_split_settings',
  enhancementTotals: 'enhancement_totals',
  enhancementSettledDays: 'enhancement_history_checks',
  rememberedLevels: 'remembered_levels',
  mvpGradeHistory: 'mvp_grade_history',
}

/** 그 표의 id 를 가리키는 칸. id 를 바꾸면 함께 바꾼다. */
export const REFERENCES: Partial<Record<ServerSyncTable, readonly { table: string; column: string }[]>> = {
  bossProfitEntries: [{ table: 'boss_drops', column: 'profit_entry_id' }],
  inventoryItems: [{ table: 'cashbook_entry_items', column: 'inventory_item_id' }],
  cashbookEntries: [
    { table: 'cashbook_entry_items', column: 'entry_id' },
    { table: 'cashbook_entry_hunt_inputs', column: 'entry_id' },
    { table: 'cashbook_entry_transfer_inputs', column: 'entry_id' },
    { table: 'cashbook_entry_exchange_inputs', column: 'entry_id' },
    { table: 'cashbook_entry_fragment_uses', column: 'entry_id' },
  ],
}

/** 서버 `account_settings` 의 칸 이름 → 그 값을 읽는 함수. 기기에서는 Preferences 의 설정 키와 하단바 순서에 있다. */
const SETTING_READERS: Record<string, () => Promise<unknown>> = {
  trackingType: async () => {
    const value = await preferences.get(STORAGE_KEYS.trackingType)
    return value === 'auto' || value === 'manual' ? value : null
  },
  quickLinkRowCount: async () => ((await getQuickLinks()) as { rows?: unknown } | null)?.rows ?? null,
  quickLinkKeys: async () => ((await getQuickLinks()) as { ids?: unknown } | null)?.ids ?? null,
  barGroupKeys: async () => ((await getBarOrder()) as { groups?: unknown } | null)?.groups ?? null,
  statsCumulativeStartDate: async () => preferences.get(STORAGE_KEYS.statsCumulativeStartDate),
  isMvpWeeklyCheckOff: async () => (await preferences.get(STORAGE_KEYS.isMvpWeeklyCheckOff)) === 'true',
  mvpLastCheckedWeekCode: async () => preferences.get(STORAGE_KEYS.mvpLastCheckedWeekCode),
  isMvpBulkApplyAsked: async () => (await preferences.get(STORAGE_KEYS.isMvpBulkApplyAsked)) === 'true',
}

function parsed(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** id 가 있는 Preferences 목록에서 그 id 의 항목. */
async function listItemOf(key: string, id: string): Promise<ServerSyncSource | null> {
  const list = parsed(await preferences.get(key))
  return Array.isArray(list) ? (list.find((one): one is Record<string, unknown> => isRecord(one) && one.id === id) ?? null) : null
}

async function preferenceSourceOf(table: ServerSyncTable, recordId: string): Promise<ServerSyncSource | null> {
  if (table === 'partyAppointments') return listItemOf(STORAGE_KEYS.partyAppointments, recordId)
  if (table === 'bossProfitCalculatorRecords') return listItemOf(STORAGE_KEYS.bossProfitCalculatorRecords, recordId)
  const parts = partsOfPreferenceRecordId(table, recordId)
  if (parts === null) return null
  switch (table) {
    case 'manualTrackedItems': {
      const [ocid = '', type, targetId] = parts
      const items = parsed(await preferences.get(manualTrackedContentKey(ocid)))
      const found = Array.isArray(items) && items.some((one) => isRecord(one) && one.type === type && one.targetId === targetId)
      return found ? { ocid, type, targetId } : null
    }
    case 'sharedContentProgress': {
      const [mapleId = '', worldId = '', contentId = ''] = parts
      const key = worldId === '' ? accountSharedProgressKey(mapleId) : worldSharedProgressKey(mapleId, worldId)
      const stored = (await readStoredSharedProgress(key))[contentId]
      return stored === undefined ? null : { mapleId, worldId: worldId === '' ? null : worldId, contentId, ...stored }
    }
    case 'mapleIdNames': {
      const [mapleId = ''] = parts
      const name = (await getMapleIdNames())[mapleId]
      return name === undefined ? null : { mapleId, name }
    }
    case 'trackedCharacters': {
      const [ocid = ''] = parts
      const list = parsed(await preferences.get(trackedCharactersKey()))
      const sortOrder = Array.isArray(list) ? list.indexOf(ocid) : -1
      if (sortOrder < 0) return null
      return { ocid, sortOrder, isRepresentative: (await preferences.get(representativeCharacterKey())) === ocid }
    }
    case 'representativeCharacterMotions': {
      const [ocid = ''] = parts
      const motions = parsed(await preferences.get(STORAGE_KEYS.figureMotions))
      const motion = isRecord(motions) ? motions[ocid] : undefined
      return isRecord(motion) ? { ocid, ...motion } : null
    }
    case 'accountSettings': {
      const [column = ''] = parts
      const read = SETTING_READERS[column]
      return read === undefined ? null : { column, value: await read() }
    }
    case 'bottomBarSubPageOrders': {
      const [groupKey = ''] = parts
      const subs = ((await getBarOrder()) as { subs?: unknown } | null)?.subs
      const pages = isRecord(subs) ? subs[groupKey] : undefined
      return Array.isArray(pages) ? { groupKey, subPageKeys: pages } : null
    }
    default:
      return null
  }
}

/** 가계부 기록과 딸린 줄 다섯. 품목과 조각 사용은 넣은 차례(rowid)다. */
async function cashbookSourceOf(id: string): Promise<ServerSyncSource | null> {
  const db = await getBossProfitDb()
  const head = (await db.query('SELECT * FROM cashbook_entries WHERE id = ?', [id])).values?.[0]
  if (head === undefined) return null
  const children = async (table: string): Promise<Record<string, unknown>[]> =>
    (await db.query(`SELECT * FROM ${table} WHERE entry_id = ? ORDER BY rowid`, [id])).values ?? []
  return {
    ...head,
    items: await children('cashbook_entry_items'),
    hunt_input: (await children('cashbook_entry_hunt_inputs'))[0] ?? null,
    transfer_input: (await children('cashbook_entry_transfer_inputs'))[0] ?? null,
    exchange_input: (await children('cashbook_entry_exchange_inputs'))[0] ?? null,
    fragment_uses: await children('cashbook_entry_fragment_uses'),
  }
}

/**
 * 대기 줄이 가리키는 원본의 지금 값. 지운 기록과 굳지 않은 날은 `null` 이다.
 *
 * @param table 대기 줄의 서버 표 이름
 */
export async function readServerSyncSource(table: ServerSyncTable, recordId: string): Promise<ServerSyncSource | null> {
  if (table === 'cashbookEntries') return cashbookSourceOf(recordId)
  const deviceTable = DEVICE_TABLES[table]
  if (deviceTable === undefined) return preferenceSourceOf(table, recordId)
  const db = await getBossProfitDb()
  const settled = table === 'enhancementSettledDays' ? ' AND settled = 1' : ''
  return (await db.query(`SELECT * FROM ${deviceTable} WHERE id = ?${settled}`, [recordId])).values?.[0] ?? null
}

/** 그 캐릭터를 가장 늦게 본 소속의 메이플 ID. 본 적이 없으면 `null` 이다. */
export async function mapleIdOfOcid(ocid: string): Promise<string | null> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT account_id FROM character_accounts WHERE ocid = ? ORDER BY last_seen_date DESC LIMIT 1',
    [ocid],
  )
  const found = values?.[0]?.account_id
  return typeof found === 'string' ? found : null
}

/** 그 넥슨 계정에서 본 메이플 ID 가운데 글자 차례로 맨 앞의 것. 계정 칸이 빈 옛 줄은 어느 계정인지 몰라 `null` 이다. */
export async function mapleIdOfNexonAccount(nexonAccountId: string): Promise<string | null> {
  if (nexonAccountId === '') return null
  const db = await getBossProfitDb()
  const { values } = await db.query(
    'SELECT account_id FROM character_accounts WHERE nexon_account_id = ? ORDER BY account_id LIMIT 1',
    [nexonAccountId],
  )
  const found = values?.[0]?.account_id
  return typeof found === 'string' ? found : null
}

/** 캐릭터의 이름. 프로필이 없으면 `null` 이다. */
export async function characterNameOf(ocid: string): Promise<string | null> {
  return (await getCharacterProfiles([ocid])).get(ocid)?.name ?? null
}

/**
 * 기기 줄의 id 를 서버가 돌려준 id 로 바꾼다. 그 줄을 가리키는 줄과 대기 줄도 바꾼다. 서버가 이미 아는 값이라 대기 표에 넣지 않는다.
 *
 * 외래키가 켜져 있어 부모의 id 를 먼저 바꾸면 자식이 걸린다. 그래서 트랜잭션이 끝날 때까지 외래키 검사를 미룬다.
 */
export async function replaceServerSyncRecordId(table: ServerSyncTable, fromId: string, toId: string): Promise<void> {
  const deviceTable = DEVICE_TABLES[table]
  if (deviceTable === undefined) return
  await withServerSyncPaused(async (db) => {
    await db.execute('PRAGMA defer_foreign_keys = ON')
    await db.run(`UPDATE ${deviceTable} SET id = ? WHERE id = ?`, [toId, fromId])
    for (const reference of REFERENCES[table] ?? []) {
      await db.run(`UPDATE ${reference.table} SET ${reference.column} = ? WHERE ${reference.column} = ?`, [toId, fromId])
    }
    await db.run(
      `UPDATE server_sync_queue SET record_id = ?
        WHERE record_id = ? AND NOT EXISTS (SELECT 1 FROM server_sync_queue WHERE record_id = ?)`,
      [toId, fromId, toId],
    )
    await db.run('DELETE FROM server_sync_queue WHERE record_id = ?', [fromId])
  })
}

/** Preferences 목록에서 그 id 의 항목을 뺀다. 저장 함수를 거치지 않아 대기 표에 넣지 않는다. */
async function removeListItem(key: string, id: string): Promise<void> {
  const list = parsed(await preferences.get(key))
  if (!Array.isArray(list)) return
  const next = list.filter((one) => !(isRecord(one) && one.id === id))
  if (next.length !== list.length) await preferences.set(key, JSON.stringify(next))
}

/**
 * 서버가 거절한 기록을 기기에서 지우고 대기 줄을 뺀다. 서버가 지웠거나 다른 줄이 이미 있는 기록이라 지우기를 대기 표에 넣지 않는다.
 * 딸린 줄과 수익 건의 드롭은 외래키를 따라 함께 지워진다.
 */
export async function deleteServerSyncRecord(table: ServerSyncTable, recordId: string): Promise<void> {
  if (table === 'partyAppointments') await removeListItem(STORAGE_KEYS.partyAppointments, recordId)
  if (table === 'bossProfitCalculatorRecords') await removeListItem(STORAGE_KEYS.bossProfitCalculatorRecords, recordId)
  const deviceTable = DEVICE_TABLES[table]
  await withServerSyncPaused(async (db) => {
    if (deviceTable !== undefined) await db.run(`DELETE FROM ${deviceTable} WHERE id = ?`, [recordId])
    await db.run('DELETE FROM server_sync_queue WHERE record_id = ?', [recordId])
  })
}
