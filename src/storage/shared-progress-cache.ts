/**
 * 월드 · 메이플 ID 가 함께 진행하는 컨텐츠의 원장. Preferences 의 JSON 한 칸(`worldSharedProgress:{메이플 ID}:{월드 줄 id}` ·
 * `accountSharedProgress:{메이플 ID}`).
 *
 * 저장은 서버 `shared_content_progress` 와 같은 칸이다. 열쇠는 컨텐츠 줄 id 이고, 등록은 `isRegistered`, 기간은 기간 값
 * (`periodCode`)이다. 병합은 컨텐츠 key · 종류 · 기간 key 를 들어서, 그 사이를 여기서 바꾼다.
 */
import { dailyPeriodCodeOf, periodCodeOf, periodKeyOfCode } from '../lib/boss/period-code'
import { contentIdOf, contentKeyOfId, contentSectionOf, findContent } from '../lib/scheduler/contents'
import { findWorld } from '../lib/world/worlds'
import { preferences } from './ports'
import { whenRecordsReleased } from './record-hold'
import type { SharedProgressEntry } from '../types'
import { accountSharedProgressKey, worldSharedProgressKey } from './keys'

/** 컨텐츠 key → 그 컨텐츠의 공유 진행. */
type SharedProgressMap = Record<string, SharedProgressEntry>

/** 저장된 공유 진행 하나. 종류는 컨텐츠 줄의 `type` 에 있어 적지 않는다. */
export interface StoredSharedProgressEntry {
  isRegistered: boolean
  nowCount: number
  maxCount: number
  questState: 0 | 1 | 2 | null
  periodCode: string
}

/** 컨텐츠 줄 id → 그 컨텐츠의 저장된 공유 진행. */
export type StoredSharedProgressLedger = Record<string, StoredSharedProgressEntry>

/** 컨텐츠의 주기로 기간 key 의 기간 값. 일간은 `D`, 주간은 `W` 다. 표에 없는 컨텐츠 · 꼴이 다른 key 는 `null` 이다. */
function periodCodeOfBucket(contentKey: string, bucket: string): string | null {
  const section = contentSectionOf(contentKey)
  if (section === 'daily') return dailyPeriodCodeOf(bucket)
  const code = section === 'weekly' ? periodCodeOf(bucket) : null
  return code !== null && code.startsWith('W') ? code : null
}

/**
 * 화면이 든 진행 하나를 저장하는 모양으로. 표에 없는 컨텐츠 · 꼴이 다른 기간 key 면 `null` 이다.
 *
 * @param contentKey 원장의 열쇠인 컨텐츠 key
 */
export function storedSharedProgressEntryOf(
  contentKey: string,
  entry: Omit<SharedProgressEntry, 'kind'>,
): { contentId: string; stored: StoredSharedProgressEntry } | null {
  const contentId = contentIdOf(contentKey)
  const periodCode = periodCodeOfBucket(contentKey, entry.lastUpdatedBucket)
  if (contentId === null || periodCode === null) return null
  return {
    contentId,
    stored: {
      isRegistered: entry.active,
      nowCount: entry.nowCount,
      maxCount: entry.maxCount,
      questState: entry.questState,
      periodCode,
    },
  }
}

/** 저장된 원장을 화면이 드는 모양으로. 게임 데이터에 없는 컨텐츠 줄 id 와 꼴이 다른 기간 값은 빠진다. */
function toMap(ledger: StoredSharedProgressLedger): SharedProgressMap {
  const map: SharedProgressMap = {}
  for (const [contentId, stored] of Object.entries(ledger)) {
    const contentKey = contentKeyOfId(contentId)
    const content = findContent(contentKey)
    const bucket = typeof stored?.periodCode === 'string' ? periodKeyOfCode(stored.periodCode) : null
    if (contentKey === null || content === null || bucket === null) continue
    map[contentKey] = {
      active: stored.isRegistered,
      kind: content.type,
      nowCount: stored.nowCount,
      maxCount: stored.maxCount,
      questState: stored.questState,
      lastUpdatedBucket: bucket,
    }
  }
  return map
}

/** 저장된 원장 그대로. 없거나 깨졌으면 빈 원장이다. 변환과 나누기가 기다리지 않고 읽는다. */
export async function readStoredSharedProgress(key: string): Promise<StoredSharedProgressLedger> {
  const value = await preferences.get(key)
  if (value === null) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as StoredSharedProgressLedger) : {}
  } catch {
    return {}
  }
}

async function getSharedProgress(key: string): Promise<SharedProgressMap> {
  await whenRecordsReleased()
  return toMap(await readStoredSharedProgress(key))
}

/** 표에 없는 컨텐츠 · 꼴이 다른 기간 key 는 적을 수 없어 던진다. */
async function setSharedProgressEntry(
  key: string,
  contentKey: string,
  entry: SharedProgressEntry,
): Promise<void> {
  await whenRecordsReleased()
  const stored = storedSharedProgressEntryOf(contentKey, entry)
  if (stored === null) throw new Error(`공유 진행을 적을 수 없다: ${contentKey} ${entry.lastUpdatedBucket}`)
  const current = await readStoredSharedProgress(key)
  current[stored.contentId] = stored.stored
  await preferences.set(key, JSON.stringify(current))
}

/** 월드 key 의 원장 키. 표에 없는 월드면 `null` 이다. */
function worldLedgerKeyOf(accountId: string, worldKey: string): string | null {
  const world = findWorld(worldKey)
  return world === null ? null : worldSharedProgressKey(accountId, world.id)
}

/** 메이플 ID 와 월드의 원장. 같은 월드라도 메이플 ID 가 다르면 따로다. 표에 없는 월드는 빈 원장이다. */
export async function getWorldSharedProgress(accountId: string, worldKey: string): Promise<SharedProgressMap> {
  const key = worldLedgerKeyOf(accountId, worldKey)
  if (key === null) {
    await whenRecordsReleased()
    return {}
  }
  return getSharedProgress(key)
}

/** 표에 없는 월드는 원장을 가리킬 수 없어 던진다. */
export async function setWorldSharedProgressEntry(
  accountId: string,
  worldKey: string,
  contentKey: string,
  entry: SharedProgressEntry,
): Promise<void> {
  const key = worldLedgerKeyOf(accountId, worldKey)
  if (key === null) throw new Error(`게임 데이터에 없는 월드다: ${worldKey}`)
  await setSharedProgressEntry(key, contentKey, entry)
}

export async function getAccountSharedProgress(accountId: string): Promise<SharedProgressMap> {
  return getSharedProgress(accountSharedProgressKey(accountId))
}

export async function setAccountSharedProgressEntry(
  accountId: string,
  contentKey: string,
  entry: SharedProgressEntry,
): Promise<void> {
  await setSharedProgressEntry(accountSharedProgressKey(accountId), contentKey, entry)
}
