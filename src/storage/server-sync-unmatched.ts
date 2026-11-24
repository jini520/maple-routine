/**
 * 받기가 짝을 못 찾아 `#` 를 붙여 적은 해시를, `character_accounts` 에 짝이 생긴 뒤 원문으로 바꾸는 자리. 부계정 키를 등록하거나
 * 넥슨 목록이 늘면 짝이 생긴다.
 *
 * 서버는 같은 해시를 이미 들고 있어 바꾸는 쓰기는 대기 표에 넣지 않는다. SQLite 는 `withServerSyncPaused` 안에서 바꾸고, Preferences 는
 * 저장 함수를 거치지 않고 키에 바로 적는다.
 *
 * @see docs/foundation/server-sync.md `짝이 생긴 # 바꾸기`
 */
import { isUnmatchedNexonId } from '../lib/crypto/nexon-id-hash'
import { accountSharedProgressKey, manualTrackedContentKey, STORAGE_KEYS, worldSharedProgressKey } from './keys'
import { preferences } from './ports'
import type { NexonIdLookup } from './server-sync-pull'
import { withServerSyncPaused, type ServerSyncTable } from './server-sync-queue'
import { writeSharedProgressLedgers } from './shared-progress-cache'
import { getBossProfitDb } from './sqlite/db'

type Row = Record<string, unknown>

/** `#` 가 적힐 수 있는 SQLite 칸. 받기가 원문 칸에 적는 자리와 같다. */
const MARKED_COLUMNS: readonly { table: string; column: string; kind: 'ocid' | 'mapleId'; serverTable: ServerSyncTable }[] = [
  { table: 'boss_split_settings', column: 'ocid', kind: 'ocid', serverTable: 'bossSplitSettings' },
  { table: 'boss_profit_entries', column: 'ocid', kind: 'ocid', serverTable: 'bossProfitEntries' },
  { table: 'enhancement_totals', column: 'ocid', kind: 'ocid', serverTable: 'enhancementTotals' },
  { table: 'remembered_levels', column: 'ocid', kind: 'ocid', serverTable: 'rememberedLevels' },
  { table: 'character_world_leaps', column: 'previous_ocid', kind: 'ocid', serverTable: 'characterWorldLeaps' },
  { table: 'character_world_leaps', column: 'ocid', kind: 'ocid', serverTable: 'characterWorldLeaps' },
  { table: 'cashbook_entries', column: 'ocid', kind: 'ocid', serverTable: 'cashbookEntries' },
  { table: 'cashbook_entries', column: 'account_id', kind: 'mapleId', serverTable: 'cashbookEntries' },
  { table: 'cashbook_entry_transfer_inputs', column: 'receiver_ocid', kind: 'ocid', serverTable: 'cashbookEntries' },
  { table: 'cashbook_entry_fragment_uses', column: 'ocid', kind: 'ocid', serverTable: 'cashbookEntries' },
  { table: 'inventory_items', column: 'account_id', kind: 'mapleId', serverTable: 'inventoryItems' },
  { table: 'mvp_grade_history', column: 'account_id', kind: 'mapleId', serverTable: 'mvpGradeHistory' },
]

function originalOf(lookup: NexonIdLookup, kind: 'ocid' | 'mapleId', value: unknown): string | null {
  if (typeof value !== 'string' || !isUnmatchedNexonId(value)) return null
  return (kind === 'ocid' ? lookup.ocids : lookup.mapleIds).get(value.slice(1)) ?? null
}

/** SQLite 기록 표의 `#` 값을 바꾼다. 유일 기준이 겹치는 줄은 두고, 같은 받기가 서버 줄을 넣을 때 겹친 기기 줄을 서버 줄로 바꾼다. */
async function replaceInSqlite(lookup: NexonIdLookup, changed: Set<ServerSyncTable>): Promise<void> {
  const db = await getBossProfitDb()
  const updates: { table: string; column: string; from: string; to: string; serverTable: ServerSyncTable }[] = []
  for (const spec of MARKED_COLUMNS) {
    const { values } = await db.query(`SELECT DISTINCT ${spec.column} AS value FROM ${spec.table} WHERE ${spec.column} LIKE '#%'`)
    for (const row of values ?? []) {
      const to = originalOf(lookup, spec.kind, row.value)
      if (to !== null) updates.push({ ...spec, from: row.value as string, to })
    }
  }
  if (updates.length === 0) return
  await withServerSyncPaused(async (paused) => {
    for (const one of updates) {
      await paused.run(`UPDATE OR IGNORE ${one.table} SET ${one.column} = ? WHERE ${one.column} = ?`, [one.to, one.from])
      changed.add(one.serverTable)
    }
  })
}

function parse(raw: string | null): unknown {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 키 이름 안의 `#` 값을 바꾼다. 원문 쪽 키가 있으면 원문 쪽 항목을 두고 없는 항목만 옮긴다. 이 기기에서 고른 값이다. */
async function moveMarkedKeys(
  keys: readonly string[],
  keyOf: (key: string) => { marked: string; to: (original: string) => string } | null,
  kind: 'ocid' | 'mapleId',
  lookup: NexonIdLookup,
  merge: (target: unknown, moved: unknown) => unknown,
): Promise<boolean> {
  let moved = false
  for (const key of keys) {
    const parts = keyOf(key)
    const original = parts === null ? null : originalOf(lookup, kind, parts.marked)
    if (parts === null || original === null) continue
    const target = parts.to(original)
    await preferences.set(target, JSON.stringify(merge(parse(await preferences.get(target)), parse(await preferences.get(key)))))
    await preferences.remove(key)
    moved = true
  }
  return moved
}

function mergeLists(target: unknown, moved: unknown): unknown[] {
  const kept = Array.isArray(target) ? target.filter(isRow) : []
  const same = (a: Row, b: Row): boolean => a.type === b.type && a.targetId === b.targetId
  const added = (Array.isArray(moved) ? moved.filter(isRow) : []).filter((one) => !kept.some((other) => same(one, other)))
  return [...kept, ...added]
}

function mergeObjects(target: unknown, moved: unknown): Row {
  return { ...(isRow(moved) ? moved : {}), ...(isRow(target) ? target : {}) }
}

/** 열쇠가 `#` 값인 객체(메이플 ID 이름 · 대표 캐릭터 동작). 원문 쪽 열쇠가 있으면 원문 쪽 값을 둔다. */
async function renameMarkedFields(key: string, kind: 'ocid' | 'mapleId', lookup: NexonIdLookup): Promise<boolean> {
  const object = parse(await preferences.get(key))
  if (!isRow(object)) return false
  let renamed = false
  for (const field of Object.keys(object)) {
    const original = originalOf(lookup, kind, field)
    if (original === null) continue
    if (!(original in object)) object[original] = object[field]
    delete object[field]
    renamed = true
  }
  if (renamed) await preferences.set(key, JSON.stringify(object))
  return renamed
}

/** 목록 항목 안의 `ocid` 칸을 바꾼다. 약속의 보스 · 주별 예외의 보스, 계산기 기록의 캐릭터다. */
async function replaceOcidFields(key: string, lookup: NexonIdLookup, listsOf: (item: Row) => unknown[]): Promise<boolean> {
  const list = parse(await preferences.get(key))
  if (!Array.isArray(list)) return false
  let replaced = false
  for (const item of list.filter(isRow)) {
    for (const entries of listsOf(item)) {
      for (const entry of Array.isArray(entries) ? entries.filter(isRow) : []) {
        const original = originalOf(lookup, 'ocid', entry.ocid)
        if (original === null) continue
        entry.ocid = original
        replaced = true
      }
    }
  }
  if (replaced) await preferences.set(key, JSON.stringify(list))
  return replaced
}

async function replaceInPreferences(lookup: NexonIdLookup, changed: Set<ServerSyncTable>): Promise<void> {
  const keys = await preferences.keys()
  const manualPrefix = manualTrackedContentKey('')
  if (
    await moveMarkedKeys(
      keys,
      (key) => (key.startsWith(manualPrefix) ? { marked: key.slice(manualPrefix.length), to: manualTrackedContentKey } : null),
      'ocid',
      lookup,
      mergeLists,
    )
  ) {
    changed.add('manualTrackedItems')
  }

  const accountPrefix = accountSharedProgressKey('')
  const worldPrefix = worldSharedProgressKey('', '').slice(0, -1)
  const movedLedgers = await writeSharedProgressLedgers(async () => {
    const movedAccount = await moveMarkedKeys(
      keys,
      (key) => (key.startsWith(accountPrefix) ? { marked: key.slice(accountPrefix.length), to: accountSharedProgressKey } : null),
      'mapleId',
      lookup,
      mergeObjects,
    )
    const movedWorld = await moveMarkedKeys(
      keys,
      (key) => {
        if (!key.startsWith(worldPrefix)) return null
        const rest = key.slice(worldPrefix.length)
        const at = rest.indexOf(':')
        if (at < 0) return null
        const worldId = rest.slice(at + 1)
        return { marked: rest.slice(0, at), to: (mapleId) => worldSharedProgressKey(mapleId, worldId) }
      },
      'mapleId',
      lookup,
      mergeObjects,
    )
    return movedAccount || movedWorld
  })
  if (movedLedgers) changed.add('sharedContentProgress')

  if (await renameMarkedFields(STORAGE_KEYS.mapleIdNames, 'mapleId', lookup)) changed.add('mapleIdNames')
  if (await renameMarkedFields(STORAGE_KEYS.figureMotions, 'ocid', lookup)) changed.add('representativeCharacterMotions')
  const appointmentLists = (item: Row): unknown[] => [
    item.bosses,
    ...Object.values(isRow(item.exceptions) ? item.exceptions : {}).map((exception) => (isRow(exception) ? exception.bosses : [])),
  ]
  if (await replaceOcidFields(STORAGE_KEYS.partyAppointments, lookup, appointmentLists)) changed.add('partyAppointments')
  if (await replaceOcidFields(STORAGE_KEYS.bossProfitCalculatorRecords, lookup, (item) => [item.characters])) {
    changed.add('bossProfitCalculatorRecords')
  }
}

/**
 * 짝이 생긴 `#` 값을 원문으로 바꾼다. 받기를 시작할 때마다 부른다. 짝이 없는 값은 둔다.
 *
 * @returns 바꾼 값이 있는 서버 표 이름. 그 표의 화면을 다시 읽게 한다
 */
export async function replaceMatchedNexonIds(lookup: NexonIdLookup): Promise<Set<ServerSyncTable>> {
  const changed = new Set<ServerSyncTable>()
  await replaceInSqlite(lookup, changed)
  await replaceInPreferences(lookup, changed)
  return changed
}
