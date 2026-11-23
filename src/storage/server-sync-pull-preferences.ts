/**
 * 동기화의 받기가 받은 줄을 Preferences 기록 키에 넣고 지우는 자리. 저장 함수를 거치지 않고 키에 바로 적는다. 저장 함수는 바뀐 항목을
 * 대기 표에 넣어 받은 값을 서버로 되돌린다.
 *
 * 대기 줄이 있는 항목은 덮지 않는다. 아직 못 올린 기기 값이 다음 올리기로 서버를 덮는다. id 가 없는 항목은 대기 줄 id
 * (`표 이름:유일 기준의 값`)로 견준다.
 *
 * @see docs/foundation/server-sync.md `받기`
 */
import { getBarOrder } from './bar-order'
import {
  accountSharedProgressKey,
  manualTrackedContentKey,
  representativeCharacterKey,
  STORAGE_KEYS,
  trackedCharactersKey,
  worldSharedProgressKey,
} from './keys'
import type { StoredCalculatorRecord } from './boss-profit-calculator-records'
import type { StoredPartyAppointment } from './party-appointments'
import { preferences } from './ports'
import { isServerSyncQueued, preferenceRecordIdOf } from './server-sync-queue'
import { readStoredSharedProgress, type StoredSharedProgressEntry } from './shared-progress-cache'

/** 받은 Preferences 기록 하나. 칸 이름은 그 키에 저장하는 꼴이다. */
export type PulledPreferenceRecord =
  | { table: 'partyAppointments'; id: string; deleted: boolean; item: StoredPartyAppointment }
  | { table: 'bossProfitCalculatorRecords'; id: string; deleted: boolean; item: StoredCalculatorRecord }
  | { table: 'manualTrackedItems'; deleted: boolean; ocid: string; type: string; targetId: string }
  | {
      table: 'sharedContentProgress'
      deleted: boolean
      mapleId: string
      worldId: string | null
      contentId: string
      entry: StoredSharedProgressEntry
    }
  | { table: 'mapleIdNames'; deleted: boolean; mapleId: string; name: string }
  | { table: 'trackedCharacters'; deleted: boolean; ocid: string; sortOrder: number; isRepresentative: boolean }
  | { table: 'representativeCharacterMotions'; deleted: boolean; ocid: string; motion: Record<string, unknown> }
  | { table: 'accountSettings'; values: Record<string, unknown> }
  | { table: 'bottomBarSubPageOrders'; groupKey: string; subPageKeys: string[] }

type Row = Record<string, unknown>

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(key: string): Promise<unknown> {
  const raw = await preferences.get(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

async function readList(key: string): Promise<unknown[]> {
  const value = await readJson(key)
  return Array.isArray(value) ? value : []
}

async function readObject(key: string): Promise<Row> {
  const value = await readJson(key)
  return isRow(value) ? value : {}
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await preferences.set(key, JSON.stringify(value))
}

/** id 가 있는 목록에서 받은 항목을 고치거나 더하고, 지운 항목을 뺀다. 고친 항목은 제 자리에 둔다. */
async function applyListItems(key: string, records: readonly { id: string; deleted: boolean; item: unknown }[]): Promise<void> {
  if (records.length === 0) return
  let list = await readList(key)
  for (const record of records) {
    const at = list.findIndex((one) => isRow(one) && one.id === record.id)
    if (record.deleted) list = list.filter((_, index) => index !== at)
    else if (at >= 0) list[at] = record.item
    else list.push(record.item)
  }
  await writeJson(key, list)
}

type Pulled<T extends PulledPreferenceRecord['table']> = Extract<PulledPreferenceRecord, { table: T }>

async function applyManualTrackedItems(records: readonly Pulled<'manualTrackedItems'>[]): Promise<void> {
  for (const ocid of new Set(records.map((record) => record.ocid))) {
    const key = manualTrackedContentKey(ocid)
    let items = (await readList(key)).filter(isRow)
    for (const record of records.filter((one) => one.ocid === ocid)) {
      items = items.filter((one) => !(one.type === record.type && one.targetId === record.targetId))
      if (!record.deleted) items.push({ type: record.type, targetId: record.targetId })
    }
    await writeJson(key, items)
  }
}

function sharedProgressKeyOf(record: Pulled<'sharedContentProgress'>): string {
  return record.worldId === null ? accountSharedProgressKey(record.mapleId) : worldSharedProgressKey(record.mapleId, record.worldId)
}

async function applySharedProgress(records: readonly Pulled<'sharedContentProgress'>[]): Promise<void> {
  for (const key of new Set(records.map(sharedProgressKeyOf))) {
    const ledger: Row = { ...(await readStoredSharedProgress(key)) }
    for (const record of records.filter((one) => sharedProgressKeyOf(one) === key)) {
      if (record.deleted) delete ledger[record.contentId]
      else ledger[record.contentId] = record.entry
    }
    await writeJson(key, ledger)
  }
}

/** 열쇠마다 값 하나인 객체(메이플 ID 이름 · 대표 캐릭터 동작). */
async function applyKeyedObject(key: string, records: readonly { key: string; deleted: boolean; value: unknown }[]): Promise<void> {
  if (records.length === 0) return
  const object = await readObject(key)
  for (const record of records) {
    if (record.deleted) delete object[record.key]
    else object[record.key] = record.value
  }
  await writeJson(key, object)
}

/**
 * 추적 목록을 받은 차례로 다시 놓는다. 받지 않은 캐릭터는 지금 자리를 차례로 쓰고, 같은 차례면 지금 목록의 앞쪽이 먼저다. 대표 표시가
 * 참이면 대표로 적고, 거짓인데 지금 대표면 대표를 지운다. 목록에 없는 대표도 지운다.
 */
async function applyTrackedCharacters(records: readonly Pulled<'trackedCharacters'>[]): Promise<void> {
  if (records.length === 0) return
  const current = (await readList(trackedCharactersKey())).filter((one): one is string => typeof one === 'string')
  let representative = await preferences.get(representativeCharacterKey())
  const orders = new Map(current.map((ocid, index) => [ocid, index]))
  for (const record of records) {
    if (record.deleted) {
      orders.delete(record.ocid)
      if (representative === record.ocid) representative = null
      continue
    }
    orders.set(record.ocid, record.sortOrder)
    if (record.isRepresentative) representative = record.ocid
    else if (representative === record.ocid) representative = null
  }
  const position = (ocid: string): number => {
    const index = current.indexOf(ocid)
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }
  const next = [...orders.keys()].sort((a, b) => orders.get(a)! - orders.get(b)! || position(a) - position(b))
  await writeJson(trackedCharactersKey(), next)
  if (representative !== null && next.includes(representative)) await preferences.set(representativeCharacterKey(), representative)
  else await preferences.remove(representativeCharacterKey())
}

/** 참이면 `'true'`, 거짓이면 키를 지운다. 저장 함수와 같은 꼴이다. */
async function writeFlag(key: string, on: unknown): Promise<void> {
  if (on === true) await preferences.set(key, 'true')
  else await preferences.remove(key)
}

/**
 * 설정 칸을 기기 키에 적는다. 빈 칸은 아무 기기도 고르지 않은 칸이라 기기 값을 둔다. 기기는 설정을 비우는 쓰기가 없다.
 *
 * @param values 대기 줄이 있는 칸을 뺀 칸
 */
async function applySettings(values: Row, subPages: readonly Pulled<'bottomBarSubPageOrders'>[]): Promise<void> {
  const given = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null && value !== undefined))
  if (given.trackingType === 'auto' || given.trackingType === 'manual') await preferences.set(STORAGE_KEYS.trackingType, given.trackingType)
  if (typeof given.statsCumulativeStartDate === 'string') {
    await preferences.set(STORAGE_KEYS.statsCumulativeStartDate, given.statsCumulativeStartDate)
  }
  if (typeof given.mvpLastCheckedWeekCode === 'string') await preferences.set(STORAGE_KEYS.mvpLastCheckedWeekCode, given.mvpLastCheckedWeekCode)
  if ('isMvpWeeklyCheckOff' in given) await writeFlag(STORAGE_KEYS.isMvpWeeklyCheckOff, given.isMvpWeeklyCheckOff)
  if ('isMvpBulkApplyAsked' in given) await writeFlag(STORAGE_KEYS.isMvpBulkApplyAsked, given.isMvpBulkApplyAsked)
  if ('quickLinkRowCount' in given || 'quickLinkKeys' in given) {
    const stored = await readObject(STORAGE_KEYS.quickLinks)
    await writeJson(STORAGE_KEYS.quickLinks, {
      rowCount: given.quickLinkRowCount ?? stored.rowCount,
      keys: given.quickLinkKeys ?? stored.keys,
    })
  }
  if ('barGroupKeys' in given || subPages.length > 0) {
    // 하단바 순서는 셸이 변환보다 먼저 읽어 옛 이름(`{ groups, subs }`)일 수 있다. 읽는 함수가 두 이름을 다 읽는다.
    const order = await getBarOrder()
    const current = isRow(order) ? order : {}
    const subs: Row = { ...(isRow(current.subs) ? current.subs : {}) }
    for (const record of subPages) subs[record.groupKey] = record.subPageKeys
    await writeJson(STORAGE_KEYS.barOrder, { groupKeys: given.barGroupKeys ?? current.groups, subPageKeys: subs })
  }
}

/** 받은 Preferences 기록을 키마다 모아 한 번씩 적는다. 대기 줄이 있는 항목과 설정 칸은 뺀다. */
export async function applyPulledPreferenceRecords(records: readonly PulledPreferenceRecord[]): Promise<void> {
  const kept: PulledPreferenceRecord[] = []
  const settings: Row = {}
  for (const record of records) {
    if (record.table === 'accountSettings') {
      for (const [column, value] of Object.entries(record.values)) {
        if (!(await isServerSyncQueued(preferenceRecordIdOf('accountSettings', [column])))) settings[column] = value
      }
      continue
    }
    if (!(await isServerSyncQueued(recordIdOf(record)))) kept.push(record)
  }
  const of = <T extends PulledPreferenceRecord['table']>(table: T): Pulled<T>[] =>
    kept.filter((record): record is Pulled<T> => record.table === table)

  await applyListItems(STORAGE_KEYS.partyAppointments, of('partyAppointments'))
  await applyListItems(STORAGE_KEYS.bossProfitCalculatorRecords, of('bossProfitCalculatorRecords'))
  await applyManualTrackedItems(of('manualTrackedItems'))
  await applySharedProgress(of('sharedContentProgress'))
  await applyKeyedObject(
    STORAGE_KEYS.mapleIdNames,
    of('mapleIdNames').map((record) => ({ key: record.mapleId, deleted: record.deleted, value: record.name })),
  )
  await applyKeyedObject(
    STORAGE_KEYS.figureMotions,
    of('representativeCharacterMotions').map((record) => ({ key: record.ocid, deleted: record.deleted, value: record.motion })),
  )
  await applyTrackedCharacters(of('trackedCharacters'))
  const subPages = of('bottomBarSubPageOrders')
  if (Object.keys(settings).length > 0 || subPages.length > 0) await applySettings(settings, subPages)
}

/** 대기 줄 id. 올리기가 넣는 것과 같은 값이다. */
function recordIdOf(record: Exclude<PulledPreferenceRecord, { table: 'accountSettings' }>): string {
  switch (record.table) {
    case 'partyAppointments':
    case 'bossProfitCalculatorRecords':
      return record.id
    case 'manualTrackedItems':
      return preferenceRecordIdOf(record.table, [record.ocid, record.type, record.targetId])
    case 'sharedContentProgress':
      return preferenceRecordIdOf(record.table, [record.mapleId, record.worldId ?? '', record.contentId])
    case 'mapleIdNames':
      return preferenceRecordIdOf(record.table, [record.mapleId])
    case 'trackedCharacters':
    case 'representativeCharacterMotions':
      return preferenceRecordIdOf(record.table, [record.ocid])
    case 'bottomBarSubPageOrders':
      return preferenceRecordIdOf(record.table, [record.groupKey])
  }
}

async function notQueued(table: Parameters<typeof preferenceRecordIdOf>[0], parts: readonly string[]): Promise<boolean> {
  return !(await isServerSyncQueued(preferenceRecordIdOf(table, parts)))
}

/** 주인의 Preferences 기록. `clearServerSyncOwners` 가 SQLite 기록을 비운 뒤 부른다. 대기 줄이 있는 항목은 남긴다. */
export async function clearServerSyncOwnerPreferences(owners: {
  mapleIds: readonly string[]
  ocids: readonly string[]
  person: boolean
}): Promise<void> {
  for (const ocid of owners.ocids) {
    const key = manualTrackedContentKey(ocid)
    const items = (await readList(key)).filter(isRow)
    const left: Row[] = []
    for (const item of items) {
      if (!(await notQueued('manualTrackedItems', [ocid, String(item.type), String(item.targetId)]))) left.push(item)
    }
    if (left.length === 0) await preferences.remove(key)
    else await writeJson(key, left)
  }

  const keys = await preferences.keys()
  for (const mapleId of owners.mapleIds) {
    const ledgers = [
      { key: accountSharedProgressKey(mapleId), worldId: '' },
      ...keys
        .filter((key) => key.startsWith(worldSharedProgressKey(mapleId, '')))
        .map((key) => ({ key, worldId: key.slice(worldSharedProgressKey(mapleId, '').length) })),
    ]
    for (const ledger of ledgers) {
      const stored = await readStoredSharedProgress(ledger.key)
      const left: Row = {}
      for (const [contentId, entry] of Object.entries(stored)) {
        if (!(await notQueued('sharedContentProgress', [mapleId, ledger.worldId, contentId]))) left[contentId] = entry
      }
      if (Object.keys(left).length === 0) await preferences.remove(ledger.key)
      else await writeJson(ledger.key, left)
    }
  }

  const names = await readObject(STORAGE_KEYS.mapleIdNames)
  for (const mapleId of owners.mapleIds) if (await notQueued('mapleIdNames', [mapleId])) delete names[mapleId]
  if (owners.mapleIds.length > 0) await writeJson(STORAGE_KEYS.mapleIdNames, names)

  const motions = await readObject(STORAGE_KEYS.figureMotions)
  for (const ocid of owners.ocids) if (await notQueued('representativeCharacterMotions', [ocid])) delete motions[ocid]
  if (owners.ocids.length > 0) await writeJson(STORAGE_KEYS.figureMotions, motions)

  if (!owners.person) return
  const tracked: string[] = []
  for (const ocid of (await readList(trackedCharactersKey())).filter((one): one is string => typeof one === 'string')) {
    if (!(await notQueued('trackedCharacters', [ocid]))) tracked.push(ocid)
  }
  await writeJson(trackedCharactersKey(), tracked)
  const representative = await preferences.get(representativeCharacterKey())
  if (representative !== null && !tracked.includes(representative)) await preferences.remove(representativeCharacterKey())
  for (const key of [STORAGE_KEYS.partyAppointments, STORAGE_KEYS.bossProfitCalculatorRecords]) {
    const left: unknown[] = []
    for (const item of await readList(key)) {
      if (isRow(item) && typeof item.id === 'string' && (await isServerSyncQueued(item.id))) left.push(item)
    }
    await writeJson(key, left)
  }
}
