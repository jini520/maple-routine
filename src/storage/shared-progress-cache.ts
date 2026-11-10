import { contentKeyOfApiName, findContent } from '../lib/scheduler/contents'
import { findWorld } from '../lib/world/worlds'
import { preferences } from './ports'
import type { SharedProgressEntry } from '../types'
import { STORAGE_KEYS, accountSharedProgressKey, legacyWorldSharedProgressKey, worldSharedProgressKey } from './keys'

/** 컨텐츠 key → 그 컨텐츠의 공유 진행. */
type SharedProgressMap = Record<string, SharedProgressEntry>

/**
 * 열쇠를 컨텐츠 key 로. 컨텐츠 이름을 열쇠로 들던 옛 원장은 읽을 때 이름으로 key 를 찾아 옮긴다. 이미 key 인
 * 열쇠는 그대로이고, 둘 다 아닌 열쇠(표에서 빠진 컨텐츠)는 버린다.
 *
 * 이 원장은 한 번이라도 활성으로 본 적이 있는지를 쌓은 값이라 API 에서 다시 받을 수 없어 옮긴다. 다음 저장이
 * 새 모양으로 덮어쓴다.
 */
function withContentKeys(map: SharedProgressMap): SharedProgressMap {
  const migrated: SharedProgressMap = {}
  for (const [key, entry] of Object.entries(map)) {
    const contentKey = findContent(key) !== null ? key : contentKeyOfApiName(key)
    if (contentKey !== null) migrated[contentKey] = entry
  }
  return migrated
}

async function getSharedProgress(key: string): Promise<SharedProgressMap> {
  const value = await preferences.get(key)
  if (value === null) {
    return {}
  }

  try {
    return withContentKeys(JSON.parse(value) as SharedProgressMap)
  } catch {
    return {}
  }
}

async function setSharedProgressEntry(
  key: string,
  contentKey: string,
  entry: SharedProgressEntry,
): Promise<void> {
  const current = await getSharedProgress(key)
  current[contentKey] = entry
  await preferences.set(key, JSON.stringify(current))
}

/** 옛 원장을 읽는다. 월드 key 키가 없으면 월드 이름 키를 본다. 옛 이름은 월드 표의 이름이다. 표 이름이 곧 API 표기다. */
async function legacyWorldLedgerOf(worldKey: string): Promise<SharedProgressMap | null> {
  for (const world of [worldKey, findWorld(worldKey)?.name]) {
    if (world === undefined) continue
    if ((await preferences.get(legacyWorldSharedProgressKey(world))) !== null) {
      return getSharedProgress(legacyWorldSharedProgressKey(world))
    }
  }
  return null
}

/**
 * 월드로만 묶던 옛 원장을 그 월드에 추적 캐릭터가 있는 메이플 ID 마다 베끼고 옛 원장을 지운다. 한 번만 돈다.
 *
 * 같은 월드라도 메이플 ID 가 다르면 따로 센다. 이 원장은 한 번이라도 활성으로 본 적이 있는지를 쌓은 값이라 넥슨에서 다시 받을 수
 * 없어 베낀다. 이미 새 원장에 적힌 항목이 있으면 그 항목이 이긴다.
 *
 * @param tracked 추적 캐릭터의 메이플 ID 와 월드 key. 빠진 메이플 ID 는 옛 원장을 받지 못하므로 모든 계정의 목록을 받은 회차가 부른다
 */
export async function splitWorldSharedProgress(tracked: readonly { accountId: string; worldKey: string }[]): Promise<void> {
  if ((await preferences.get(STORAGE_KEYS.worldSharedProgressSplit)) !== null) return
  for (const { accountId, worldKey } of tracked) {
    const legacy = await legacyWorldLedgerOf(worldKey)
    if (legacy === null) continue
    const key = worldSharedProgressKey(accountId, worldKey)
    await preferences.set(key, JSON.stringify({ ...legacy, ...(await getSharedProgress(key)) }))
  }
  for (const key of await preferences.keys()) {
    // 옛 키는 접두사 뒤에 쌍점이 없다. 새 키는 메이플 ID 와 월드 key 를 쌍점으로 잇는다.
    if (key.startsWith(legacyWorldSharedProgressKey('')) && !key.slice(legacyWorldSharedProgressKey('').length).includes(':')) {
      await preferences.remove(key)
    }
  }
  await preferences.set(STORAGE_KEYS.worldSharedProgressSplit, new Date().toISOString())
}

/** 메이플 ID 와 월드의 원장. 같은 월드라도 메이플 ID 가 다르면 따로다. */
export async function getWorldSharedProgress(accountId: string, worldKey: string): Promise<SharedProgressMap> {
  return getSharedProgress(worldSharedProgressKey(accountId, worldKey))
}

export async function setWorldSharedProgressEntry(
  accountId: string,
  worldKey: string,
  contentKey: string,
  entry: SharedProgressEntry,
): Promise<void> {
  await setSharedProgressEntry(worldSharedProgressKey(accountId, worldKey), contentKey, entry)
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
