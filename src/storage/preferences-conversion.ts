/**
 * 1.0.15 기기 변환의 Preferences 단계. Preferences 에 든 기록을 서버 표와 같은 칸 이름 · 줄 id 로 한 번 바꾼다.
 *
 * SQLite 트랜잭션 밖이라 키마다 옛 모양만 바꾸고 새 모양은 그대로 둔다. 도중에 꺼져 처음부터 다시 돌아도 결과가 같다. 다 바꾸면
 * 표식(`preferencesConversion`)을 적는다. 옛 모양을 아는 코드는 이 파일에만 둔다. 저장소는 새 모양만 읽는다.
 */
import { difficultyKeyOfName } from '../constants/domain/boss-difficulty'
import { bossDifficultyIdOf, bossKeyOfApiName } from '../lib/boss/bosses'
import { periodCodeOf } from '../lib/boss/period-code'
import { contentKeyOfApiName, contentSectionOf, findContent } from '../lib/scheduler/contents'
import { findWorld, findWorldById } from '../lib/world/worlds'
import type { BossDifficulty, ManualTrackedItem, SharedProgressEntry } from '../types/scheduler'
import type { StoredCalculatorBoss } from './boss-profit-calculator-records'
import { storedCalculatorBossOf } from './boss-profit-calculator-records'
import { getTrackedCharacterOcids } from './character-selection'
import { STORAGE_KEYS, legacyWorldSharedProgressKey, worldSharedProgressKey } from './keys'
import { manualTrackedTargetIdOf, type StoredManualTrackedItem } from './manual-tracked-content'
import type {
  StoredPartyAppointment,
  StoredPartyAppointmentBoss,
  StoredPartyAppointmentException,
} from './party-appointments'
import type { SqliteDbConnection } from './ports'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import {
  readStoredSharedProgress,
  storedSharedProgressEntryOf,
  type StoredSharedProgressLedger,
} from './shared-progress-cache'

/** 이 판까지 바꾼 기기는 다시 돌지 않는다. */
export const PREFERENCES_CONVERSION_VERSION = 1

/** Preferences 단계가 던진 실패. 사용 로그가 SQLite 단계와 가른다. */
export class PreferencesConversionError extends Error {
  constructor(cause: unknown) {
    super(`기기 변환의 Preferences 단계가 실패했다: ${String(cause)}`)
    this.name = 'PreferencesConversionError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 저장된 JSON. 없거나 깨졌으면 `undefined` 이고 그 키는 건드리지 않는다. 읽는 코드가 빈 값으로 읽는다. */
async function readJson(key: string): Promise<unknown> {
  const raw = await preferences.get(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/** 주의 시작(목요일)의 주차 값. 목요일이 아니면 `null` 이다. */
function weekCodeOf(weekStart: string): string | null {
  const code = periodCodeOf(weekStart)
  return code !== null && code.startsWith('W') ? code : null
}

// ---- 수동 추적 항목 ----

/**
 * 옛 항목 하나. 컨텐츠가 일일 · 주간 구분 없이 `kind: 'content'` 로 저장되던 시절, 컨텐츠가 key 대신 `contentName` 에 이름을 들던
 * 시절, 보스가 `contentName` 에 보스 이름 · `difficulty` 에 한글 난이도를 들던 시절의 모양이 섞여 있다.
 */
interface LegacyManualTrackedItem {
  kind: ManualTrackedItem['kind'] | 'content'
  contentName?: string
  contentKey?: string
  bossKey?: string
  difficulty?: string
}

/** 옛 보스 항목의 보스 key 모양. 이름으로 적힌 옛 항목은 이름으로 보스 key 를 찾고 한글 난이도를 key 로 바꾼다. */
function legacyBossItemOf(item: LegacyManualTrackedItem): ManualTrackedItem | null {
  if (item.bossKey !== undefined) {
    return { kind: 'boss', bossKey: item.bossKey, difficulty: item.difficulty as BossDifficulty }
  }
  const bossKey = item.contentName === undefined ? null : bossKeyOfApiName(item.contentName)
  const difficulty = item.difficulty === undefined ? null : difficultyKeyOfName(item.difficulty)
  return bossKey === null || difficulty === null ? null : { kind: 'boss', bossKey, difficulty }
}

/** 옛 컨텐츠 항목의 컨텐츠 key 모양. 이름은 key 로 찾고, `content` 는 그 컨텐츠의 섹션으로 일일 · 주간을 정한다. */
function legacyContentItemOf(item: LegacyManualTrackedItem): ManualTrackedItem | null {
  const contentKey = item.contentKey ?? (item.contentName === undefined ? null : contentKeyOfApiName(item.contentName))
  const kind = item.kind === 'content' ? contentSectionOf(contentKey) : item.kind
  if (contentKey === null || (kind !== 'daily' && kind !== 'weekly')) return null
  return { contentKey, kind }
}

function isStoredManualItem(value: unknown): value is StoredManualTrackedItem {
  return isRecord(value) && typeof value.type === 'string' && typeof value.targetId === 'string'
}

/** 옛 항목을 저장하는 모양으로. 게임 데이터에서 못 찾으면 `null` 이고 그 항목은 빠진다. */
function storedOfLegacyManualItem(value: unknown): StoredManualTrackedItem | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  const legacy = value as unknown as LegacyManualTrackedItem
  const item = legacy.kind === 'boss' ? legacyBossItemOf(legacy) : legacyContentItemOf(legacy)
  const targetId = item === null ? null : manualTrackedTargetIdOf(item)
  return item === null || targetId === null ? null : { type: item.kind, targetId }
}

/** 한 캐릭터에 종류 · 대상이 같은 항목은 앞의 것만 남긴다. 서버의 유일 기준이 캐릭터 · 종류 · 대상이다. */
async function convertManualTrackedContent(): Promise<void> {
  for (const key of await preferences.keys()) {
    if (!key.startsWith('manualTrackedContent:')) continue
    const items = await readJson(key)
    if (!Array.isArray(items) || items.every(isStoredManualItem)) continue
    const seen = new Set<string>()
    const next: StoredManualTrackedItem[] = []
    for (const item of items) {
      const stored = isStoredManualItem(item) ? item : storedOfLegacyManualItem(item)
      if (stored === null || seen.has(`${stored.type}:${stored.targetId}`)) continue
      seen.add(`${stored.type}:${stored.targetId}`)
      next.push(stored)
    }
    await preferences.set(key, JSON.stringify(next))
  }
}

// ---- 공유 진행 ----

function isStoredLedgerEntry(value: unknown): boolean {
  return isRecord(value) && 'isRegistered' in value && 'periodCode' in value
}

/**
 * 옛 원장을 새 모양으로. 열쇠가 컨텐츠 key 이거나 그보다 옛 원장은 컨텐츠 이름이다. 표에서 못 찾은 컨텐츠는 빠지고, 같은 컨텐츠로
 * 모이는 열쇠가 둘이면 뒤의 것이 남는다. 이미 새 모양인 항목은 그대로다.
 */
function convertLedger(ledger: Record<string, unknown>): StoredSharedProgressLedger {
  const next: StoredSharedProgressLedger = {}
  for (const [key, entry] of Object.entries(ledger)) {
    if (isStoredLedgerEntry(entry)) {
      next[key] = entry as StoredSharedProgressLedger[string]
      continue
    }
    if (!isRecord(entry)) continue
    const contentKey = findContent(key) !== null ? key : contentKeyOfApiName(key)
    const stored = contentKey === null ? null : storedSharedProgressEntryOf(contentKey, entry as unknown as SharedProgressEntry)
    if (stored !== null) next[stored.contentId] = stored.stored
  }
  return next
}

/**
 * 원장 하나를 바꿔 `target` 에 적는다. `target` 에 이미 적힌 새 모양 항목이 이긴다. 도중에 꺼져 두 키가 함께 남았을 때다.
 *
 * @param key 옛 원장의 키
 * @param target 새 원장의 키. 월드 key 를 월드 줄 id 로 바꾸면 `key` 와 다르다
 */
async function convertLedgerKey(key: string, target: string): Promise<void> {
  const ledger = await readJson(key)
  if (!isRecord(ledger)) return
  if (key === target && Object.values(ledger).every(isStoredLedgerEntry)) return
  const existing = key === target ? {} : await readStoredSharedProgress(target)
  await preferences.set(target, JSON.stringify({ ...convertLedger(ledger), ...existing }))
  if (key !== target) await preferences.remove(key)
}

/** 키 글자의 월드 key 는 월드 줄 id 로 바꾼다. 월드 표에 없는 월드의 원장은 가리킬 수 없어 지운다. */
async function convertSharedProgress(): Promise<void> {
  const worldPrefix = legacyWorldSharedProgressKey('')
  for (const key of await preferences.keys()) {
    if (key.startsWith('accountSharedProgress:')) {
      await convertLedgerKey(key, key)
      continue
    }
    if (!key.startsWith(worldPrefix)) continue
    const rest = key.slice(worldPrefix.length)
    const at = rest.lastIndexOf(':')
    // 쌍점이 없는 키는 월드로만 묶던 옛 원장이다. 나누기가 다룬다.
    if (at < 0) continue
    const accountId = rest.slice(0, at)
    const world = rest.slice(at + 1)
    if (findWorldById(world) !== null) {
      await convertLedgerKey(key, key)
      continue
    }
    const worldEntry = findWorld(world)
    if (worldEntry === null) await preferences.remove(key)
    else await convertLedgerKey(key, worldSharedProgressKey(accountId, worldEntry.id))
  }
}

/** 월드로만 묶던 옛 원장의 키. 쌍점 없이 월드 key 나, 그보다 옛 원장은 월드 이름이 붙는다. */
function isLegacyWorldLedgerKey(key: string): boolean {
  const prefix = legacyWorldSharedProgressKey('')
  return key.startsWith(prefix) && !key.slice(prefix.length).includes(':')
}

/** 옛 원장. 월드 key 키가 없으면 월드 이름 키를 본다. 옛 이름은 월드 표의 이름이다. */
async function legacyWorldLedgerOf(worldKey: string): Promise<Record<string, unknown> | null> {
  for (const world of [worldKey, findWorld(worldKey)?.name]) {
    if (world === undefined) continue
    const ledger = await readJson(legacyWorldSharedProgressKey(world))
    if (ledger !== undefined) return isRecord(ledger) ? ledger : {}
  }
  return null
}

/** 메이플 ID 와 월드 key. 옛 원장을 베낄 곳이다. */
export interface LedgerOwner {
  accountId: string
  worldKey: string
}

async function splitLegacyWorldLedgers(tracked: readonly LedgerOwner[]): Promise<void> {
  if ((await preferences.get(STORAGE_KEYS.worldSharedProgressSplit)) !== null) return
  for (const { accountId, worldKey } of tracked) {
    const legacy = await legacyWorldLedgerOf(worldKey)
    const world = findWorld(worldKey)
    if (legacy === null || world === null) continue
    const key = worldSharedProgressKey(accountId, world.id)
    await preferences.set(key, JSON.stringify({ ...convertLedger(legacy), ...(await readStoredSharedProgress(key)) }))
  }
  for (const key of await preferences.keys()) {
    if (isLegacyWorldLedgerKey(key)) await preferences.remove(key)
  }
  await preferences.set(STORAGE_KEYS.worldSharedProgressSplit, new Date().toISOString())
}

/**
 * 월드로만 묶던 옛 원장을 그 월드에 추적 캐릭터가 있는 메이플 ID 마다 새 모양으로 베끼고 옛 원장을 지운다. 한 번만 돈다.
 *
 * 같은 월드라도 메이플 ID 가 다르면 따로 센다. 이 원장은 한 번이라도 활성으로 본 적이 있는지를 쌓은 값이라 넥슨에서 다시 받을 수
 * 없어 베낀다. 이미 새 원장에 적힌 항목이 이긴다. 기기 변환이 메이플 ID 를 다 찾지 못한 기기에서 스케줄 회차가 부른다.
 *
 * @param tracked 추적 캐릭터의 메이플 ID 와 월드 key. 빠진 메이플 ID 는 옛 원장을 받지 못하므로 모든 계정의 목록을 받은 회차가 부른다
 */
export async function splitWorldSharedProgress(tracked: readonly LedgerOwner[]): Promise<void> {
  await whenRecordsReleased()
  await splitLegacyWorldLedgers(tracked)
}

/**
 * 추적 캐릭터마다 옛 원장을 베낄 메이플 ID 와 월드. 소속 기록에서 그 캐릭터를 가장 늦게 본 줄을 쓰고, 그 줄에 월드가 없으면
 * 프로필의 월드를 쓴다. 추적 캐릭터가 없거나 하나라도 못 찾으면 `null` 이다. 빠진 메이플 ID 는 옛 원장을 받지 못한다.
 */
async function trackedLedgerOwnersOf(db: SqliteDbConnection): Promise<LedgerOwner[] | null> {
  const ocids = (await getTrackedCharacterOcids()) ?? []
  if (ocids.length === 0) return null
  const placeholders = ocids.map(() => '?').join(', ')
  const { values: accounts } = await db.query(
    `SELECT ocid, account_id, world_key FROM character_accounts WHERE ocid IN (${placeholders})
      ORDER BY last_seen_date DESC, first_seen_date DESC`,
    ocids,
  )
  const { values: profiles } = await db.query(
    `SELECT ocid, world_key FROM character_profiles WHERE ocid IN (${placeholders})`,
    ocids,
  )
  const owners: LedgerOwner[] = []
  for (const ocid of ocids) {
    const account = (accounts ?? []).find((row) => row.ocid === ocid)
    const profile = (profiles ?? []).find((row) => row.ocid === ocid)
    const worldKey = (account?.world_key ?? profile?.world_key ?? null) as string | null
    if (account === undefined || worldKey === null) return null
    owners.push({ accountId: account.account_id as string, worldKey })
  }
  return owners
}

/** 옛 원장이 없으면 표식만 적는다. 메이플 ID 를 다 못 찾으면 옛 원장을 그대로 두고 스케줄 회차에 맡긴다. */
async function splitLegacyWorldLedgersOnConversion(db: SqliteDbConnection): Promise<void> {
  if ((await preferences.get(STORAGE_KEYS.worldSharedProgressSplit)) !== null) return
  if (!(await preferences.keys()).some(isLegacyWorldLedgerKey)) {
    await splitLegacyWorldLedgers([])
    return
  }
  const owners = await trackedLedgerOwnersOf(db)
  if (owners !== null) await splitLegacyWorldLedgers(owners)
}

// ---- 파티 약속 ----

/** 옛 약속의 모양. 1.0.14 까지 읽던 코드의 검사와 같다. */
function isLegacyBoss(value: unknown): value is { bossKey: string; difficulty: string; ocid: string } {
  return isRecord(value) && typeof value.bossKey === 'string' && typeof value.difficulty === 'string' && typeof value.ocid === 'string'
}

function isLegacyBossList(value: unknown): value is { bossKey: string; difficulty: string; ocid: string }[] {
  return Array.isArray(value) && value.length > 0 && value.every(isLegacyBoss)
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function isLead(value: unknown): value is number | null {
  return value === null || typeof value === 'number'
}

function isLegacyMember(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.type === 'text') return typeof value.name === 'string'
  if (value.type === 'character') return typeof value.ocid === 'string'
  return false
}

function isLegacyException(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.type === 'override' &&
    typeof value.dateKey === 'string' &&
    typeof value.timeKst === 'string' &&
    isDuration(value.durationMinutes) &&
    isLegacyBossList(value.bosses) &&
    isLead(value.leadMinutes)
  )
}

function isLegacySchedule(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.type === 'once') return typeof value.dateKey === 'string'
  return (
    value.type === 'weekly' &&
    typeof value.weekday === 'number' &&
    typeof value.fromWeek === 'string' &&
    (value.untilWeek === null || typeof value.untilWeek === 'string')
  )
}

function isLegacyAppointment(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === 'string' &&
    isLegacyBossList(value.bosses) &&
    Array.isArray(value.members) &&
    value.members.every(isLegacyMember) &&
    typeof value.timeKst === 'string' &&
    isDuration(value.durationMinutes) &&
    isLead(value.leadMinutes) &&
    isLegacySchedule(value.schedule) &&
    isRecord(value.exceptions) &&
    Object.values(value.exceptions).every(isLegacyException) &&
    (value.memo === undefined || typeof value.memo === 'string')
  )
}

/** 게임 데이터에 없는 보스 · 난이도의 판은 빠진다. */
function storedAppointmentBossesOf(bosses: readonly { bossKey: string; difficulty: string; ocid: string }[]): StoredPartyAppointmentBoss[] {
  return bosses.flatMap((boss) => {
    const bossDifficultyId = bossDifficultyIdOf(boss.bossKey, boss.difficulty)
    return bossDifficultyId === null ? [] : [{ bossDifficultyId, ocid: boss.ocid }]
  })
}

/** 옛 약속을 새 모양으로. 보스가 하나도 안 남거나 주가 목요일이 아니면 `null` 이다. 보스가 다 빠진 예외는 그 예외만 뺀다. */
function storedOfLegacyAppointment(legacy: Record<string, unknown>): StoredPartyAppointment | null {
  const bosses = storedAppointmentBossesOf(legacy.bosses as { bossKey: string; difficulty: string; ocid: string }[])
  const schedule = legacy.schedule as Record<string, unknown>
  let storedSchedule: StoredPartyAppointment['schedule']
  if (schedule.type === 'once') {
    storedSchedule = { type: 'once', date: schedule.dateKey as string }
  } else {
    const fromWeekCode = weekCodeOf(schedule.fromWeek as string)
    const untilWeekCode = schedule.untilWeek === null ? null : weekCodeOf(schedule.untilWeek as string)
    if (fromWeekCode === null || (schedule.untilWeek !== null && untilWeekCode === null)) return null
    storedSchedule = { type: 'weekly', weekday: schedule.weekday as number, fromWeekCode, untilWeekCode }
  }
  if (bosses.length === 0) return null
  const exceptions: Record<string, StoredPartyAppointmentException> = {}
  for (const [weekStart, value] of Object.entries(legacy.exceptions as Record<string, Record<string, unknown>>)) {
    const weekCode = weekCodeOf(weekStart)
    const exceptionBosses = storedAppointmentBossesOf(value.bosses as { bossKey: string; difficulty: string; ocid: string }[])
    if (weekCode === null || exceptionBosses.length === 0) continue
    exceptions[weekCode] = {
      date: value.dateKey as string,
      time: value.timeKst as string,
      durationMinutes: value.durationMinutes as number,
      bosses: exceptionBosses,
      alarmMinutesBefore: value.leadMinutes as number | null,
    }
  }
  return {
    id: legacy.id as string,
    bosses,
    time: legacy.timeKst as string,
    durationMinutes: legacy.durationMinutes as number,
    alarmMinutesBefore: legacy.leadMinutes as number | null,
    schedule: storedSchedule,
    exceptions,
    ...(legacy.memo === undefined ? {} : { memo: legacy.memo as string }),
  }
}

/** 옛 약속(`timeKst` 가 있다)만 바꾼다. 1.0.14 까지의 코드가 모양이 틀렸다고 버리던 옛 약속은 지운다. */
async function convertPartyAppointments(): Promise<void> {
  const appointments = await readJson(STORAGE_KEYS.partyAppointments)
  if (!Array.isArray(appointments)) return
  const isLegacy = (value: unknown): value is Record<string, unknown> => isRecord(value) && 'timeKst' in value
  if (!appointments.some(isLegacy)) return
  const next = appointments.flatMap((value: unknown) => {
    if (!isLegacy(value)) return [value]
    const stored = isLegacyAppointment(value) ? storedOfLegacyAppointment(value) : null
    return stored === null ? [] : [stored]
  })
  await preferences.set(STORAGE_KEYS.partyAppointments, JSON.stringify(next))
}

// ---- 계산기 기록 ----

function isShareValue(value: unknown): boolean {
  return value === null || typeof value === 'number'
}

/** 옛 계산기 보스의 모양. 1.0.14 까지 읽던 코드의 검사와 같다. */
function isLegacyCalculatorBoss(value: unknown): value is {
  bossKey: string
  difficulty: string
  partySize: number
  shares: { myShare: number | null; sharesTotal: number | null; splitFeePercent: number | null }
} {
  return (
    isRecord(value) &&
    typeof value.bossKey === 'string' &&
    typeof value.difficulty === 'string' &&
    typeof value.partySize === 'number' &&
    Number.isInteger(value.partySize) &&
    value.partySize >= 1 &&
    isRecord(value.shares) &&
    isShareValue(value.shares.myShare) &&
    isShareValue(value.shares.sharesTotal) &&
    isShareValue(value.shares.splitFeePercent)
  )
}

function isLegacyCalculatorRecord(value: unknown): value is {
  id: string
  savedAt: string
  characters: { ocid: string; bosses: unknown[] }[]
} {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.savedAt === 'string' &&
    Array.isArray(value.characters) &&
    value.characters.every(
      (character: unknown) =>
        isRecord(character) &&
        typeof character.ocid === 'string' &&
        Array.isArray(character.bosses) &&
        character.bosses.every(isLegacyCalculatorBoss),
    )
  )
}

/**
 * 옛 기록의 보스만 바꾼다. 보스가 없는 기록은 두 모양이 같다. 못 찾은 보스는 빠지고, 그래서 보스가 하나도 안 남은 기록은 지운다.
 * 보스가 없는 캐릭터 항목은 남긴다. 계산기는 보스를 고르지 않은 캐릭터도 함께 저장한다.
 */
async function convertCalculatorRecords(): Promise<void> {
  const records = await readJson(STORAGE_KEYS.bossProfitCalculatorRecords)
  if (!Array.isArray(records)) return
  const hasLegacyBoss = (record: unknown): boolean =>
    isLegacyCalculatorRecord(record) && record.characters.some((character) => character.bosses.length > 0)
  if (!records.some(hasLegacyBoss)) return
  const next = records.flatMap((record: unknown) => {
    if (!hasLegacyBoss(record) || !isLegacyCalculatorRecord(record)) return [record]
    const characters = record.characters.map((character) => ({
      ocid: character.ocid,
      bosses: (character.bosses as Parameters<typeof storedCalculatorBossOf>[0][]).flatMap((boss): StoredCalculatorBoss[] =>
        bossDifficultyIdOf(boss.bossKey, boss.difficulty) === null ? [] : [storedCalculatorBossOf(boss)],
      ),
    }))
    if (characters.every((character) => character.bosses.length === 0)) return []
    return [{ id: record.id, savedAt: record.savedAt, characters }]
  })
  await preferences.set(STORAGE_KEYS.bossProfitCalculatorRecords, JSON.stringify(next))
}

// ---- 칸 이름만 바뀌는 키 ----

/**
 * 객체 칸의 이름을 바꾼다. 옛 이름이 하나도 없으면 건드리지 않는다.
 *
 * @param renames 옛 칸 이름 → 새 칸 이름
 */
async function renameFields(key: string, renames: Readonly<Record<string, string>>): Promise<void> {
  const value = await readJson(key)
  if (!isRecord(value) || !Object.keys(renames).some((name) => name in value)) return
  const next: Record<string, unknown> = {}
  for (const [name, field] of Object.entries(value)) next[renames[name] ?? name] = field
  await preferences.set(key, JSON.stringify(next))
}

/** 캐릭터마다의 `rest` 를 `restsBetweenActions` 로. */
async function convertFigureMotions(): Promise<void> {
  const motions = await readJson(STORAGE_KEYS.figureMotions)
  if (!isRecord(motions) || !Object.values(motions).some((motion) => isRecord(motion) && 'rest' in motion)) return
  const next = Object.fromEntries(
    Object.entries(motions).map(([ocid, motion]) => {
      if (!isRecord(motion) || !('rest' in motion)) return [ocid, motion]
      const { rest, ...others } = motion
      return [ocid, { ...others, restsBetweenActions: rest }]
    }),
  )
  await preferences.set(STORAGE_KEYS.figureMotions, JSON.stringify(next))
}

/**
 * 이름이 바뀐 설정 키. 옛 키의 값을 새 키에 적고 옛 키를 지운다. 값을 바꿀 수 없으면 옮기지 않고 지운다.
 *
 * 옛 키 이름은 이 변환만 안다. 새 앱 코드는 새 키만 읽는다.
 */
const RENAMED_SETTING_KEYS: readonly { from: string; to: string; value?: (value: string) => string | null }[] = [
  { from: 'trackingMode', to: STORAGE_KEYS.trackingType },
  { from: 'statsCumulativeStart', to: STORAGE_KEYS.statsCumulativeStartDate },
  { from: 'mvpLastCheckedWeek', to: STORAGE_KEYS.mvpLastCheckedWeekCode, value: weekCodeOf },
  { from: 'mvpWeeklyCheckOff', to: STORAGE_KEYS.isMvpWeeklyCheckOff },
  { from: 'mvpBulkApplyAsked', to: STORAGE_KEYS.isMvpBulkApplyAsked },
]

/**
 * 옛 앱이 과거 드롭을 서버로 어디까지 올렸는지 적던 키. 1.0.15 에는 그 경로도 읽는 코드도 없다. 키 이름은 이 변환만 안다.
 */
const LEGACY_SERVER_BACKFILL_KEY = 'serverBackfill'

async function convertSettingKeys(): Promise<void> {
  for (const { from, to, value } of RENAMED_SETTING_KEYS) {
    const stored = await preferences.get(from)
    if (stored === null) continue
    const converted = value === undefined ? stored : value(stored)
    if (converted !== null) await preferences.set(to, converted)
    await preferences.remove(from)
  }
}

/** 표식이 이 판인가. */
export async function isPreferencesConversionDone(): Promise<boolean> {
  return Number(await preferences.get(STORAGE_KEYS.preferencesConversion)) >= PREFERENCES_CONVERSION_VERSION
}

/**
 * Preferences 의 기록을 새 모양으로 바꾸고 표식을 적는다. 표식이 이 판이면 돌지 않는다. 던지면 `PreferencesConversionError` 다.
 *
 * 옛 월드 원장 나누기는 공유 진행 키를 바꾼 뒤에 돈다. 먼저 돌면 키 바꾸기가 나누기가 적은 원장을 덮는다.
 *
 * @param db 기다리지 않는 연결. 옛 원장을 베낄 메이플 ID 와 월드를 소속 기록 · 프로필에서 찾는다
 */
export async function runPreferencesConversion(db: SqliteDbConnection): Promise<void> {
  if (await isPreferencesConversionDone()) return
  try {
    await convertManualTrackedContent()
    await convertSharedProgress()
    await splitLegacyWorldLedgersOnConversion(db)
    await convertPartyAppointments()
    await convertCalculatorRecords()
    await renameFields(STORAGE_KEYS.quickLinks, { rows: 'rowCount', ids: 'keys' })
    await renameFields(STORAGE_KEYS.barOrder, { groups: 'groupKeys', subs: 'subPageKeys' })
    await convertFigureMotions()
    await convertSettingKeys()
    await preferences.remove(LEGACY_SERVER_BACKFILL_KEY)
    await preferences.set(STORAGE_KEYS.preferencesConversion, String(PREFERENCES_CONVERSION_VERSION))
  } catch (error: unknown) {
    throw new PreferencesConversionError(error)
  }
}
