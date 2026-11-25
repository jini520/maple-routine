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

/** 넥슨을 부를 수 있는 넥슨 계정 id. 로그인과 그 로그인의 무효 표시 없는 부계정 키, 로그인이 없으면 메인 키다. */
export function usableNexonAccountIdsOf(config: NexonAuthConfig | null): Set<string> {
  if (config === null) return new Set()
  if (config.login === null) return new Set(config.mainKeyId === null ? [] : [config.mainKeyId])
  const loginId = config.login.id
  return new Set([loginId, ...config.apiKeys.filter((key) => key.loginId === loginId && key.invalid === undefined).map((key) => key.id)])
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
  /** 캐릭터 → 그 메이플 ID */
  ocids: ReadonlyMap<string, string>
}

export const EMPTY_KEY_LOST_SCOPE: KeyLostScope = { mapleIds: new Set(), ocids: new Map() }

/**
 * 기록의 주인이 키가 있던 기기의 부계정이면 그 메이플 ID. 아니면 `undefined` 다.
 *
 * @param mapleId 메이플 ID 기록의 메이플 ID. 캐릭터 기록은 `undefined`
 * @param ocid 캐릭터 기록의 캐릭터. 메이플 ID 기록은 `null`
 */
export function keyLostMapleIdOf(scope: KeyLostScope, mapleId: string | undefined, ocid: string | null): string | undefined {
  if (mapleId !== undefined) return scope.mapleIds.has(mapleId) ? mapleId : undefined
  return ocid === null ? undefined : scope.ocids.get(ocid)
}

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
  const ocids = new Map<string, string>()
  for (const ocid of new Set(sightings.map((one) => one.ocid))) {
    const mapleId = accountOfOcid(sightings, ocid)
    if (mapleId !== null && mapleIds.has(mapleId)) ocids.set(ocid, mapleId)
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

/**
 * `API 키 등록` 이 열 계정 상세의 `key`. 그 메이플 ID 를 본 넥슨 계정의 키가 지금 로그인의 부계정 키로 무효 표시와 함께 남아 있으면 그
 * 키의 id 이고, 그 계정 상세가 `API 키 변경` 시트를 연다. 키가 지워졌으면 `null` 이고 목록이 `API 키 추가` 시트를 연다.
 *
 * @param byAccount `getMapleIdsByNexonAccount` 의 값
 */
export function keyRegisterTargetOf(
  config: NexonAuthConfig | null,
  byAccount: ReadonlyMap<string, readonly string[]>,
  mapleId: string,
): string | null {
  if (config?.login == null) return null
  const loginId = config.login.id
  const accounts = new Set([...byAccount].filter(([, mapleIds]) => mapleIds.includes(mapleId)).map(([account]) => account))
  return config.apiKeys.find((key) => key.loginId === loginId && accounts.has(key.id))?.id ?? null
}

export async function loadKeyRegisterTarget(mapleId: string): Promise<string | null> {
  const [config, byAccount] = await Promise.all([getAuthConfig().catch(() => null), getMapleIdsByNexonAccount()])
  return keyRegisterTargetOf(config, byAccount, mapleId)
}

/** 넥슨을 부를 수 있는 넥슨 계정의 메이플 ID 해시. 받기가 지운 메이플 ID 를 다시 받을지 가른다. */
export async function loadUsableMapleIdHashes(): Promise<Set<string>> {
  const [config, byAccount] = await Promise.all([getAuthConfig().catch(() => null), getMapleIdsByNexonAccount()])
  const usable = usableNexonAccountIdsOf(config)
  return new Set([...byAccount].filter(([account]) => usable.has(account)).flatMap(([, mapleIds]) => mapleIds.map(nexonIdHashHex)))
}
