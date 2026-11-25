/**
 * 이 기기에 쓸 수 있는 키가 없는 부계정을 가르는 계산. 새 기기의 것(메이플 ID 를 모름)은 받기가 넣지 않고, 키가 있던 기기의 것(메이플 ID 는
 * 알지만 키가 무효이거나 지워짐)은 화면이 흐리게 두고 합계에서 뺀다.
 *
 * @see docs/foundation/server-sync.md `키 없는 부계정의 기록`
 */
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { accountOfOcid, type CharacterAccountSighting } from '../../lib/mvp/membership'
import type { NexonAuthConfig } from '../../types/auth'
import { getAuthConfig } from '../../storage/api-key'
import { getCharacterAccountSightings, getMapleIdsByNexonAccount } from '../../storage/character-accounts'
import { getServerSyncCursors } from '../../storage/server-sync-cursors'

/** 넥슨을 부를 수 있는 넥슨 계정 id. 로그인과 그 로그인의 무효 표시 없는 부계정 키, 로그인이 없으면 메인 키다. */
export function usableNexonAccountIdsOf(config: NexonAuthConfig | null): Set<string> {
  if (config === null) return new Set()
  if (config.login === null) return new Set(config.mainKeyId === null ? [] : [config.mainKeyId])
  const loginId = config.login.id
  return new Set([loginId, ...config.apiKeys.filter((key) => key.loginId === loginId && key.invalid === undefined).map((key) => key.id)])
}

/** 계정 관리 목록에 서는 넥슨 계정 id. 로그인과 그 로그인의 부계정 키 전부다. 무효 표시가 붙은 키도 그 행에 표시가 있어 든다. */
function listedNexonAccountIdsOf(config: NexonAuthConfig | null): Set<string> {
  if (config?.login == null) return usableNexonAccountIdsOf(config)
  const loginId = config.login.id
  return new Set([loginId, ...config.apiKeys.filter((key) => key.loginId === loginId).map((key) => key.id)])
}

/** 메이플 ID 마다 본 넥슨 계정 id. */
function accountsByMapleId(byAccount: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
  const byMapleId = new Map<string, string[]>()
  for (const [account, mapleIds] of byAccount) {
    for (const mapleId of mapleIds) byMapleId.set(mapleId, [...(byMapleId.get(mapleId) ?? []), account])
  }
  return byMapleId
}

/** 쓸 수 있는 키가 없는 부계정의 메이플 ID 와 그 캐릭터. 흐리게 두고 합계에서 뺀다. */
export interface KeyLostScope {
  mapleIds: ReadonlySet<string>
  ocids: ReadonlySet<string>
}

export const EMPTY_KEY_LOST_SCOPE: KeyLostScope = { mapleIds: new Set(), ocids: new Set() }

/**
 * 키가 있던 기기의 메이플 ID. `character_accounts` 에서 본 메이플 ID 가운데 본 넥슨 계정이 모두 쓸 수 없는 것이다. 넥슨 계정을 모르고 본
 * 메이플 ID 는 들지 않는다.
 *
 * @param byAccount `getMapleIdsByNexonAccount` 의 값
 */
export function keyLostScopeOf(
  config: NexonAuthConfig | null,
  byAccount: ReadonlyMap<string, readonly string[]>,
  sightings: readonly CharacterAccountSighting[],
): KeyLostScope {
  if (config === null) return EMPTY_KEY_LOST_SCOPE
  const usable = usableNexonAccountIdsOf(config)
  const mapleIds = new Set<string>()
  for (const [mapleId, accounts] of accountsByMapleId(byAccount)) {
    if (!accounts.some((account) => usable.has(account))) mapleIds.add(mapleId)
  }
  if (mapleIds.size === 0) return EMPTY_KEY_LOST_SCOPE
  const ocids = new Set<string>()
  for (const ocid of new Set(sightings.map((one) => one.ocid))) {
    const mapleId = accountOfOcid(sightings, ocid)
    if (mapleId !== null && mapleIds.has(mapleId)) ocids.add(ocid)
  }
  return { mapleIds, ocids }
}

export async function loadKeyLostScope(): Promise<KeyLostScope> {
  const [config, byAccount, sightings] = await Promise.all([
    getAuthConfig().catch(() => null),
    getMapleIdsByNexonAccount(),
    getCharacterAccountSightings(),
  ])
  return keyLostScopeOf(config, byAccount, sightings)
}

/** 넥슨을 부를 수 있는 넥슨 계정의 메이플 ID 해시. 받기가 지운 메이플 ID 를 다시 받을지 가른다. */
export async function loadUsableMapleIdHashes(): Promise<Set<string>> {
  const [config, byAccount] = await Promise.all([getAuthConfig().catch(() => null), getMapleIdsByNexonAccount()])
  const usable = usableNexonAccountIdsOf(config)
  return new Set([...byAccount].filter(([account]) => usable.has(account)).flatMap(([, mapleIds]) => mapleIds.map(nexonIdHashHex)))
}

/**
 * 이 기기에 키가 없는 부계정이 있나. 서버가 이 로그인이 쓸 수 있다고 답한 메이플 ID(번호의 열쇠) 가운데 계정 관리 목록의 어느 계정에도
 * 없는 것이 있으면 참이다. 부계정은 넥슨 로그인에만 있어 로그인이 없으면 거짓이다.
 *
 * @param cursorMapleIdHashes 번호의 메이플 ID 열쇠
 */
export function hasKeylessSubAccountOf(
  config: NexonAuthConfig | null,
  byAccount: ReadonlyMap<string, readonly string[]>,
  cursorMapleIdHashes: readonly string[],
): boolean {
  if (config?.login == null) return false
  const listed = listedNexonAccountIdsOf(config)
  const known = new Set([...byAccount].filter(([account]) => listed.has(account)).flatMap(([, mapleIds]) => mapleIds.map(nexonIdHashHex)))
  return cursorMapleIdHashes.some((hash) => !known.has(hash))
}

export async function loadHasKeylessSubAccount(): Promise<boolean> {
  const [config, byAccount, cursors] = await Promise.all([
    getAuthConfig().catch(() => null),
    getMapleIdsByNexonAccount(),
    getServerSyncCursors(),
  ])
  return hasKeylessSubAccountOf(config, byAccount, Object.keys(cursors.mapleIds))
}
