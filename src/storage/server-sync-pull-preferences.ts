/**
 * 동기화의 받기가 받은 줄을 Preferences 기록 키에 넣고 지우는 자리. 저장 함수를 거치지 않고 키에 바로 적는다. 저장 함수는 바뀐 항목을
 * 대기 표에 넣어 받은 값을 서버로 되돌린다.
 *
 * 대기 줄이 있는 항목은 덮지 않는다. 아직 못 올린 기기 값이 다음 올리기로 서버를 덮는다. id 가 없는 항목은 대기 줄 id
 * (`표 이름:유일 기준의 값`)로 견준다. 처음 동기화의 받기는 다르다. id 가 없는 항목은 처음 올리기의 대기 줄이 있어도 서버 값을 적는다.
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
import { isServerSyncQueued, preferenceRecordIdOf, removeServerSync, serverSyncQueuedAt } from './server-sync-queue'
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

/** 처음 동기화의 받기가 추적 목록을 서버에 맞추는 데 쓰는 값. */
interface FirstTrackedAlignment {
  /** 서버에서 오지 않았고 처음 올리기의 대기 줄이 있는 이 기기의 캐릭터 */
  deviceOnly: ReadonlySet<string>
  unpairedRepresentative: boolean
}

/**
 * 추적 목록을 받은 차례로 다시 놓는다. 받지 않은 캐릭터는 지금 자리를 차례로 쓰고, 같은 차례면 지금 목록의 앞쪽이 먼저다. 대표 표시가
 * 참이면 대표로 적고, 거짓인데 지금 대표면 대표를 지운다. 목록에 없는 대표도 지운다.
 *
 * 처음 동기화의 받기는 목록 단위로 서버에 맞춘다. 서버에 없는 기기 캐릭터를 서버 캐릭터 뒤에 둔다. 서버 차례 값과 기기 자리를 같은
 * 칸에 견주면 같은 값이 둘 생겨 기기마다 차례가 갈린다. 서버 대표가 이 기기에 짝이 없으면 그 기기 캐릭터의 대표를 지운다. 남기면
 * 기기 쪽 대표가 올라가, 서버가 넥슨 계정마다 하나인 대표를 그것으로 바꾼다.
 */
async function applyTrackedCharacters(
  records: readonly Pulled<'trackedCharacters'>[],
  first: FirstTrackedAlignment | null,
): Promise<void> {
  const clearsRepresentative = first?.unpairedRepresentative === true
  if (records.length === 0 && !clearsRepresentative) return
  const current = (await readList(trackedCharactersKey())).filter((one): one is string => typeof one === 'string')
  let representative = await preferences.get(representativeCharacterKey())
  if (clearsRepresentative && representative !== null && first.deviceOnly.has(representative)) representative = null
  const orders = new Map(current.map((ocid, index) => [ocid, index]))
  if (first !== null && records.length > 0) for (const ocid of first.deviceOnly) orders.set(ocid, Number.MAX_SAFE_INTEGER)
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

/** 처음 동기화의 받기에서만 준다. */
export interface PulledPreferenceOptions {
  /** 처음 동기화가 넣기를 마친 시각. 이때까지 넣은 대기 줄이 있는 id 없는 항목도 서버 값으로 덮는다 */
  firstQueuedAt?: string
  /** 서버 추적 목록의 대표가 이 기기에 짝이 없는 캐릭터다 */
  unpairedRepresentative?: boolean
}

/** 서버에서 오지 않았고 처음 올리기의 대기 줄이 있는 추적 캐릭터. */
async function deviceOnlyTrackedOf(received: readonly Pulled<'trackedCharacters'>[], firstQueuedAt: string): Promise<Set<string>> {
  const receivedOcids = new Set(received.map((record) => record.ocid))
  const deviceOnly = new Set<string>()
  for (const ocid of (await readList(trackedCharactersKey())).filter((one): one is string => typeof one === 'string')) {
    if (receivedOcids.has(ocid)) continue
    const queuedAt = await serverSyncQueuedAt(preferenceRecordIdOf('trackedCharacters', [ocid]))
    if (queuedAt !== null && queuedAt <= firstQueuedAt) deviceOnly.add(ocid)
  }
  return deviceOnly
}

/**
 * 받은 Preferences 기록을 키마다 모아 한 번씩 적는다. 대기 줄이 있는 항목과 설정 칸은 뺀다. 빈 설정 칸은 아무 기기도 고르지 않은
 * 칸이라 빼고 기기 값을 둔다.
 *
 * 처음 동기화의 받기(`firstQueuedAt`)는 id 가 없는 항목과 설정 칸에서 먼저 올린 기기의 값, 곧 서버 값을 남긴다. 처음 올리기의 대기
 * 줄이 있어도 서버 값을 적고 그 대기 줄을 뺀다. 그 뒤에 들어간 대기 줄은 사용자가 친 값이라 둔다. 약속과 계산기 기록은 기기의 uuid
 * 가 줄 id 라 둘 다 남아 평소 규칙 그대로다.
 */
export async function applyPulledPreferenceRecords(
  records: readonly PulledPreferenceRecord[],
  options: PulledPreferenceOptions = {},
): Promise<void> {
  const kept: PulledPreferenceRecord[] = []
  const settings: Row = {}
  const replaced: string[] = []
  const takes = async (recordId: string, firstWins: boolean): Promise<boolean> => {
    const queuedAt = await serverSyncQueuedAt(recordId)
    if (queuedAt === null) return true
    if (!firstWins || options.firstQueuedAt === undefined || queuedAt > options.firstQueuedAt) return false
    replaced.push(recordId)
    return true
  }
  for (const record of records) {
    if (record.table === 'accountSettings') {
      for (const [column, value] of Object.entries(record.values)) {
        if (value === null || value === undefined) continue
        if (await takes(preferenceRecordIdOf('accountSettings', [column]), true)) settings[column] = value
      }
      continue
    }
    const hasRecordId = record.table === 'partyAppointments' || record.table === 'bossProfitCalculatorRecords'
    if (await takes(recordIdOf(record), !hasRecordId)) kept.push(record)
  }
  const of = <T extends PulledPreferenceRecord['table']>(table: T): Pulled<T>[] =>
    kept.filter((record): record is Pulled<T> => record.table === table)
  const tracked = of('trackedCharacters')
  const firstTracked =
    options.firstQueuedAt === undefined
      ? null
      : {
          deviceOnly: await deviceOnlyTrackedOf(tracked, options.firstQueuedAt),
          unpairedRepresentative: options.unpairedRepresentative === true,
        }

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
  await applyTrackedCharacters(tracked, firstTracked)
  const subPages = of('bottomBarSubPageOrders')
  if (Object.keys(settings).length > 0 || subPages.length > 0) await applySettings(settings, subPages)
  // Preferences 를 먼저 적고 뺀다. 그 사이에 앱이 꺼지면 남은 대기 줄이 서버 값을 그대로 다시 올릴 뿐이다.
  for (const recordId of replaced) await removeServerSync(recordId)
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

/**
 * 주인의 Preferences 기록. `clearServerSyncOwners` 가 SQLite 기록을 비운 뒤 부른다. 대기 줄이 있는 항목은 남긴다. `includeQueued` 면 그
 * 항목도 대기 줄과 함께 지운다.
 */
export async function clearServerSyncOwnerPreferences(owners: {
  mapleIds: readonly string[]
  ocids: readonly string[]
  person: boolean
  includeQueued?: boolean
}): Promise<void> {
  /** 그 기록을 남기나. 대기 중인 기록만 남긴다. */
  const keepsId = async (recordId: string): Promise<boolean> => {
    if (owners.includeQueued !== true) return isServerSyncQueued(recordId)
    await removeServerSync(recordId)
    return false
  }
  const notQueued = async (table: Parameters<typeof preferenceRecordIdOf>[0], parts: readonly string[]): Promise<boolean> =>
    !(await keepsId(preferenceRecordIdOf(table, parts)))

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
      if (isRow(item) && typeof item.id === 'string' && (await keepsId(item.id))) left.push(item)
    }
    await writeJson(key, left)
  }
}
