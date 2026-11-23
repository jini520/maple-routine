/**
 * 기기의 기록 주인을 바꿀 때의 저장 함수. 다른 사람으로 로그인하거나 부계정을 해제하면 이 기기에서 그 주인의 기록을 비운다. 기기에는
 * 지금 로그인한 사람의 기록만 둔다.
 *
 * 비우는 쓰기는 대기 표에 넣지 않는다. 넣으면 올리기가 서버의 기록까지 지운다. 비운 주인의 번호도 지운다. 남기면 그 주인을 다시 쓸 수
 * 있게 돼도 받기가 번호 뒤의 줄만 받아 비운 기록이 돌아오지 않는다.
 *
 * @see docs/foundation/server-sync.md `로그인과 로그아웃` · `부계정 해제`
 */
import { isUnmatchedNexonId, nexonIdHashHex, unmatchedNexonIdOf } from '../lib/crypto/nexon-id-hash'
import { getTrackedCharacterOcids } from './character-selection'
import { accountSharedProgressKey, STORAGE_KEYS, worldSharedProgressKey } from './keys'
import { preferences } from './ports'
import { getServerSyncCursors, setServerSyncCursors } from './server-sync-cursors'
import { clearServerSyncOwners, type ServerSyncOwners } from './server-sync-pull'
import { applyPulledPreferenceRecords, type PulledPreferenceRecord } from './server-sync-pull-preferences'
import type { StoredSharedProgressEntry } from './shared-progress-cache'
import { partsOfPreferenceRecordId, removeServerSync, SERVER_SYNC_TABLES, type ServerSyncTable } from './server-sync-queue'
import {
  DEVICE_TABLES,
  deleteServerSyncRecord,
  mapleIdOfNexonAccount,
  mapleIdOfOcid,
  mapleIdOfProfitEntry,
  readServerSyncSource,
} from './server-sync-records'
import { getBossProfitDb } from './sqlite/db'

/** 대기 줄의 주인. 메이플 ID 는 기기 칸의 값(원문이나 `#` 를 붙인 해시)이다. 원본이 없거나 캐릭터의 메이플 ID 를 모르면 `unknown` 이다. */
export type ServerSyncRecordOwner = { kind: 'person' } | { kind: 'mapleId'; mapleId: string } | { kind: 'unknown' }

/** 사람의 기록. 서버는 넥슨 계정 줄로 가린다. */
const PERSON_TABLES: ReadonlySet<ServerSyncTable> = new Set([
  'trackedCharacters',
  'accountSettings',
  'bottomBarSubPageOrders',
  'partyAppointments',
  'bossProfitCalculatorRecords',
])

function isServerSyncTable(table: string): table is ServerSyncTable {
  return (SERVER_SYNC_TABLES as readonly string[]).includes(table)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function ownerOf(mapleId: string | null): ServerSyncRecordOwner {
  return mapleId === null ? { kind: 'unknown' } : { kind: 'mapleId', mapleId }
}

async function ownerOfOcid(ocid: string | null): Promise<ServerSyncRecordOwner> {
  return ownerOf(ocid === null ? null : await mapleIdOfOcid(ocid))
}

/** 원본이 있는 SQLite 기록의 주인. 메이플 ID 칸이 있으면 그 값이고, 캐릭터 기록은 그 캐릭터를 가장 늦게 본 소속의 메이플 ID 다. */
async function ownerOfRow(table: ServerSyncTable, row: Record<string, unknown>): Promise<ServerSyncRecordOwner> {
  switch (table) {
    case 'bossDrops':
      return ownerOf(await mapleIdOfProfitEntry(String(row.profit_entry_id)))
    case 'enhancementSettledDays':
      return ownerOf(await mapleIdOfNexonAccount(String(row.nexon_account_id ?? '')))
    case 'characterWorldLeaps': {
      const owner = await ownerOfOcid(text(row.ocid))
      return owner.kind === 'unknown' ? ownerOfOcid(text(row.previous_ocid)) : owner
    }
    default: {
      const mapleId = text(row.account_id)
      return mapleId !== null ? { kind: 'mapleId', mapleId } : ownerOfOcid(text(row.ocid))
    }
  }
}

/**
 * 대기 줄이 가리키는 기록의 주인. 다른 사람으로 로그인할 때 앞 사람의 줄을 가린다.
 *
 * @param table 대기 줄의 서버 표 이름
 */
export async function ownerOfServerSyncRecord(table: string, recordId: string): Promise<ServerSyncRecordOwner> {
  if (!isServerSyncTable(table)) return { kind: 'unknown' }
  if (PERSON_TABLES.has(table)) return { kind: 'person' }
  if (DEVICE_TABLES[table] !== undefined) {
    const row = await readServerSyncSource(table, recordId)
    return row === null ? { kind: 'unknown' } : ownerOfRow(table, row)
  }
  const [first = ''] = partsOfPreferenceRecordId(table, recordId) ?? []
  // 공유 진행과 메이플 ID 이름은 메이플 ID 로, 수동 추적 항목과 대표 캐릭터 동작은 캐릭터로 가린다.
  if (table === 'sharedContentProgress' || table === 'mapleIdNames') return ownerOf(text(first))
  return ownerOfOcid(text(first))
}

/** id 가 없는 Preferences 기록을 지우는 받은 줄. 받기의 넣기로 지운다. 설정과 하위 페이지 차례는 지우지 않아 `null` 이다. */
function deletedPreferenceRecordOf(table: ServerSyncTable, recordId: string): PulledPreferenceRecord | null {
  const parts = partsOfPreferenceRecordId(table, recordId)
  if (parts === null) return null
  const [first = '', second = '', third = ''] = parts
  switch (table) {
    case 'manualTrackedItems':
      return { table, deleted: true, ocid: first, type: second, targetId: third }
    case 'sharedContentProgress':
      // 지우는 줄이라 값은 읽지 않는다.
      return { table, deleted: true, mapleId: first, worldId: second === '' ? null : second, contentId: third, entry: {} as StoredSharedProgressEntry }
    case 'mapleIdNames':
      return { table, deleted: true, mapleId: first, name: '' }
    case 'trackedCharacters':
      return { table, deleted: true, ocid: first, sortOrder: 0, isRepresentative: false }
    case 'representativeCharacterMotions':
      return { table, deleted: true, ocid: first, motion: {} }
    default:
      return null
  }
}

/**
 * 버린 대기 줄과 그 기록을 지운다. 다른 사람으로 로그인할 때 앞 사람의 올리지 못한 기록을 버린다. 지우는 쓰기는 대기 표에 넣지 않는다.
 *
 * 설정과 하위 페이지 차례는 대기 줄만 지우고 기기의 값은 둔다. 화면의 모양을 정하는 값이라 지우면 새 사람의 화면이 기본값으로 돌아간다.
 */
export async function discardServerSyncRecords(entries: readonly { recordType: string; recordId: string }[]): Promise<void> {
  const preferenceRecords: PulledPreferenceRecord[] = []
  for (const { recordType, recordId } of entries) {
    if (!isServerSyncTable(recordType)) {
      await removeServerSync(recordId)
      continue
    }
    // SQLite 기록 · 약속 · 계산기 기록은 거절된 기록처럼 지운다. 딸린 줄과 수익 건의 드롭은 외래키를 따라 함께 지워진다.
    await deleteServerSyncRecord(recordType, recordId)
    const deleted = deletedPreferenceRecordOf(recordType, recordId)
    if (deleted !== null) preferenceRecords.push(deleted)
  }
  // 대기 줄을 먼저 지웠다. 받기의 넣기는 대기 줄이 있는 항목을 건너뛴다.
  if (preferenceRecords.length > 0) await applyPulledPreferenceRecords(preferenceRecords)
}

/** 이 메이플 ID 가 키 이름에 든 Preferences 기록의 키. 공유 진행과 메이플 ID 이름이다. */
async function preferenceMapleIds(): Promise<string[]> {
  const found: string[] = []
  const accountPrefix = accountSharedProgressKey('')
  const worldPrefix = worldSharedProgressKey('', '').slice(0, -1)
  for (const key of await preferences.keys()) {
    if (key.startsWith(accountPrefix)) found.push(key.slice(accountPrefix.length))
    else if (key.startsWith(worldPrefix)) {
      const rest = key.slice(worldPrefix.length)
      const at = rest.indexOf(':')
      if (at > 0) found.push(rest.slice(0, at))
    }
  }
  const raw = await preferences.get(STORAGE_KEYS.mapleIdNames)
  try {
    const names = raw === null ? null : (JSON.parse(raw) as unknown)
    if (typeof names === 'object' && names !== null && !Array.isArray(names)) found.push(...Object.keys(names))
  } catch {
    // 깨진 이름은 이 기기의 메이플 ID 를 알려 주지 않는다.
  }
  return found
}

/**
 * 이 기기에 기록이 있을 수 있는 메이플 ID. `character_accounts` 의 메이플 ID 와 기록 · Preferences 키에 적힌 메이플 ID(`#` 값 포함)다.
 * 다른 사람으로 로그인할 때 새 계정에 없는 것을 비운다.
 */
export async function listServerSyncMapleIds(): Promise<string[]> {
  const db = await getBossProfitDb()
  const { values } = await db.query(
    `SELECT account_id FROM character_accounts
     UNION SELECT account_id FROM cashbook_entries WHERE account_id IS NOT NULL
     UNION SELECT account_id FROM inventory_items
     UNION SELECT account_id FROM mvp_grade_history`,
  )
  const found = new Set((values ?? []).map((row) => row.account_id as string).filter((one) => one !== ''))
  for (const mapleId of await preferenceMapleIds()) if (mapleId !== '') found.add(mapleId)
  return [...found]
}

/**
 * 앞 계정의 메이플 ID 해시. 번호의 메이플 ID 열쇠와 지금 추적 캐릭터의 메이플 ID 다. 번호는 마지막 받기에서 서버가 그 신원이 쓸 수 있다고
 * 답한 목록이고, 추적 캐릭터는 받은 적이 없는 기기에도 있다. 로그인을 저장하기 전에 부른다. 저장하면 추적 목록이 비워진다.
 */
export async function previousOwnerMapleIdHashes(): Promise<string[]> {
  const hashes = new Set(Object.keys((await getServerSyncCursors()).mapleIds))
  for (const ocid of (await getTrackedCharacterOcids()) ?? []) {
    const mapleId = await mapleIdOfOcid(ocid)
    if (mapleId !== null) hashes.add(nexonIdHashHex(mapleId))
  }
  return [...hashes]
}

/** 기기 칸의 메이플 ID 를 서버의 메이플 ID 해시로. `#` 로 시작하는 값은 이미 해시라 `#` 만 뗀다. */
function hashOfMapleId(mapleId: string): string {
  return isUnmatchedNexonId(mapleId) ? mapleId.slice(1) : nexonIdHashHex(mapleId)
}

/**
 * 주인의 기록을 비우고 그 주인의 번호를 지운다. 비운 주인이 새 신원의 것이면 받기가 0 부터 다시 받는다.
 *
 * @example await forgetServerSyncOwners({ mapleIds: ['maple-old'], person: true })
 */
export async function forgetServerSyncOwners(owners: ServerSyncOwners): Promise<void> {
  await clearServerSyncOwners(owners)
  const cleared = new Set(owners.mapleIds.map(hashOfMapleId))
  const cursors = await getServerSyncCursors()
  await setServerSyncCursors({
    nexonAccount: owners.person ? null : cursors.nexonAccount,
    mapleIds: Object.fromEntries(Object.entries(cursors.mapleIds).filter(([hash]) => !cleared.has(hash))),
  })
}

/**
 * 해제한 부계정의 메이플 ID 의 기록을 이 기기에서 비운다. 서버가 그 기록을 받지 않아 대기 중인 기록과 그 대기 줄까지 지운다. 원문과
 * `#` 를 붙인 해시 둘 다로 비운다. `#` 로 적은 캐릭터의 기록은 어느 메이플 ID 의 것인지 몰라 남는다.
 *
 * @param mapleIdHashes 해제한 메이플 ID 해시
 */
export async function forgetServerSyncMapleIds(mapleIdHashes: readonly string[]): Promise<void> {
  if (mapleIdHashes.length === 0) return
  const wanted = new Set(mapleIdHashes)
  const db = await getBossProfitDb()
  const { values } = await db.query('SELECT DISTINCT account_id FROM character_accounts')
  const originals = (values ?? []).map((row) => row.account_id as string).filter((mapleId) => wanted.has(nexonIdHashHex(mapleId)))
  await forgetServerSyncOwners({
    mapleIds: [...originals, ...mapleIdHashes.map(unmatchedNexonIdOf)],
    person: false,
    includeQueued: true,
  })
}
