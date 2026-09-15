import { contentKeyOfApiName, findContent } from '../lib/scheduler/contents'
import { preferences } from './ports'
import type { SharedProgressEntry } from '../types'
import { accountSharedProgressKey, worldSharedProgressKey } from './keys'

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

export async function getWorldSharedProgress(world: string): Promise<SharedProgressMap> {
  return getSharedProgress(worldSharedProgressKey(world))
}

export async function setWorldSharedProgressEntry(
  world: string,
  contentKey: string,
  entry: SharedProgressEntry,
): Promise<void> {
  await setSharedProgressEntry(worldSharedProgressKey(world), contentKey, entry)
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
