/**
 * 서버의 부계정 목록과 기기의 부계정 키를 맞추는 순수 함수. 앱은 서버가 지금 로그인에 준 부계정만 보이고 부른다.
 *
 * 서버는 키 값을 보관하지 않아 목록의 키는 해시다. 기기의 키로 같은 해시를 만들어 맞춘다.
 */
import { apiKeyHashHex } from './crypto/api-key-hash'
import type { NexonApiKeyMethod, NexonAuthConfig } from '../types/auth'

/** 서버 목록의 부계정 한 줄. 키를 다시 받은 계정은 키 해시가 여럿이다 */
export interface ServerSubAccount {
  /** 서버가 저장한 키 해시(`storedApiKeyHashHex`) */
  apiKeyHashes: readonly string[]
  /** 메이플 ID 해시(`nexonIdHashHex`) */
  mapleIds: readonly string[]
}

/** 서버가 마지막으로 준 한 로그인의 부계정 목록 */
export interface ServerSubAccountList {
  loginId: string
  subAccounts: readonly ServerSubAccount[]
}

function stringsOf(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((one) => typeof one === 'string') ? value : null
}

/** 서버 답이나 저장된 값에서 부계정 줄을 읽는다. 배열이 아니면 `null`, 모양이 다른 줄은 건너뛴다. */
export function serverSubAccountsOf(value: unknown): ServerSubAccount[] | null {
  if (!Array.isArray(value)) return null
  const rows: ServerSubAccount[] = []
  for (const row of value as ({ apiKeyHashes?: unknown; mapleIds?: unknown } | null)[]) {
    const apiKeyHashes = stringsOf(row?.apiKeyHashes)
    const mapleIds = stringsOf(row?.mapleIds)
    if (apiKeyHashes !== null && mapleIds !== null) rows.push({ apiKeyHashes, mapleIds })
  }
  return rows
}

/** 서버가 저장하는 키 해시. 서버는 앱이 보낸 해시(`apiKeyHashHex`)를 한 번 더 해시해 둔다. */
export function storedApiKeyHashHex(value: string): string {
  return apiKeyHashHex(apiKeyHashHex(value))
}

/** 서버 목록에서 이 키의 줄. 없으면 `undefined`. */
export function serverSubAccountOfKey(
  key: NexonApiKeyMethod,
  subAccounts: readonly ServerSubAccount[],
): ServerSubAccount | undefined {
  const stored = storedApiKeyHashHex(key.value)
  return subAccounts.find((one) => one.apiKeyHashes.includes(stored))
}

/** 이 로그인으로 서버에 등록했다고 적은 키인가. 등록 표는 `로그인 계정 id:키 해시` 다(`serverAccounts.registered`). */
export function isRegisteredSubAccountKey(key: NexonApiKeyMethod, loginId: string, registered: readonly string[]): boolean {
  return registered.includes(`${loginId}:${apiKeyHashHex(key.value)}`)
}

/**
 * 지금 로그인의 부계정 키 가운데 서버 목록에 없는 것을 뺀 설정.
 *
 * 아직 등록하지 못한 키는 남긴다. 등록은 다음 서버 전송 회차가 다시 하고, 그 사이에는 기기의 키로 부른다. 등록한 적이 있는데 목록에
 * 없으면 다른 기기에서 지운 부계정이라 뺀다. 목록을 받은 적 없는 로그인이면 그대로 둔다.
 *
 * @param registered 서버에 등록한 키(`serverAccounts.registered`)
 */
export function listedSubAccountConfig(
  config: NexonAuthConfig | null,
  list: ServerSubAccountList | null,
  registered: readonly string[],
): NexonAuthConfig | null {
  const login = config?.login
  if (config == null || login == null || list === null || list.loginId !== login.id) return config
  const apiKeys = config.apiKeys.filter(
    (key) =>
      key.loginId !== login.id ||
      serverSubAccountOfKey(key, list.subAccounts) !== undefined ||
      !isRegisteredSubAccountKey(key, login.id, registered),
  )
  return apiKeys.length === config.apiKeys.length ? config : { ...config, apiKeys }
}
