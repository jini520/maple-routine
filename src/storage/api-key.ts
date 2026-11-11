/**
 * 기기에 저장된 인증 수단. **넥슨 로그인 0~1개 + 이름 붙은 API 키 0개 이상**이다.
 *
 * PreferencesPort는 평문 저장이며 Keychain/Keystore 수준 암호화를 보장하지 않는다. 강화된 보안
 * 저장 도입은 이후 별도 task로 미룬다.
 */
import { randomUuid } from '../native/uuid'
import { preferences } from './ports'
import type { NexonApiKeyMethod, NexonAuthConfig, NexonLoginMethod } from '../types'
import { STORAGE_KEYS } from './keys'

type StoredShape = NexonAuthConfig

const EMPTY: StoredShape = { login: null, apiKeys: [], mainKeyId: null }

/** 읽은 칸과, 옛 모양이라 다시 적어야 하는지. */
interface Parsed {
  shape: StoredShape
  outdated: boolean
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/** 옛 칸은 `kind` 와 `apiKey` 이고 id 가 없다. 그런 칸은 다시 적어야 한다. */
function isCurrent(one: Record<string, unknown>, type: 'login' | 'key'): boolean {
  return one.type === type && typeof one.id === 'string' && one.id !== ''
}

/** 저장된 로그인 칸. 세션만 든다. 옛 설치본이 적어 둔 액세스 토큰 칸은 읽으면서 버린다. */
function loginOf(value: unknown): { login: NexonLoginMethod | null; outdated: boolean } {
  const one = recordOf(value)
  if (one === null || (one.type !== 'login' && one.kind !== 'login')) return { login: null, outdated: false }
  if (typeof one.session !== 'string' || one.session === '') return { login: null, outdated: false }
  const current = isCurrent(one, 'login')
  return {
    login: { type: 'login', id: current ? (one.id as string) : randomUuid(), session: one.session },
    outdated: !current,
  }
}

/**
 * 저장된 키 칸.
 *
 * @param loginId 등록한 로그인 칸이 없는 옛 키가 받을 값. 그 칸이 생기기 전에는 로그인과 함께 남은 키가 곧 그 로그인의 부계정이었다
 */
function keyOf(value: unknown, loginId: string | null): { key: NexonApiKeyMethod; outdated: boolean } | null {
  const one = recordOf(value)
  if (one === null || (one.type !== 'key' && one.kind !== 'apiKey')) return null
  if (typeof one.value !== 'string' || typeof one.label !== 'string') return null
  const current = isCurrent(one, 'key')
  const hasLoginId = one.loginId === null || (typeof one.loginId === 'string' && one.loginId !== '')
  return {
    key: {
      type: 'key',
      id: current ? (one.id as string) : randomUuid(),
      label: one.label,
      value: one.value,
      loginId: hasLoginId ? (one.loginId as string | null) : loginId,
    },
    outdated: !current || !hasLoginId,
  }
}

/**
 * 저장된 칸을 읽는다. 모양이 아니면 `null` 이라 **옛 칸으로 물러날 수 있다.**
 *
 * 저장이 중간에 끊겼거나 손으로 고쳐졌을 수 있다. 그때 던지면 키를 통째로 잃는다.
 */
function parse(raw: string | null): Parsed | null {
  if (raw === null) return null
  try {
    const shape = recordOf(JSON.parse(raw))
    if (shape === null || !Array.isArray(shape.apiKeys)) return null
    const login = loginOf(shape.login)
    const keys = shape.apiKeys.map((one) => keyOf(one, login.login?.id ?? null)).filter((one) => one !== null)
    const apiKeys = keys.map((one) => one.key)
    // 메인 키 칸이 없는 옛 수단은 로그인이 없으면 첫 키가 메인이었다.
    const hasMainKeyId = shape.mainKeyId === null || typeof shape.mainKeyId === 'string'
    const mainKeyId = hasMainKeyId ? (shape.mainKeyId as string | null) : login.login === null ? (apiKeys[0]?.id ?? null) : null
    return {
      shape: {
        login: login.login,
        apiKeys,
        mainKeyId: login.login === null && apiKeys.some((one) => one.id === mainKeyId) ? mainKeyId : null,
      },
      outdated: login.outdated || keys.some((one) => one.outdated) || !hasMainKeyId,
    }
  } catch {
    return null
  }
}

/**
 * 옛 설치본의 키를 이어받는다. 옛 칸은 **안 지운다.**
 *
 * 구버전으로 되돌아가도 키를 잃지 않아야 한다. 치우는 것은 로그아웃 한 자리뿐이다.
 */
async function liftLegacy(): Promise<Parsed | null> {
  const legacy = await preferences.get(STORAGE_KEYS.apiKey)
  if (legacy === null || legacy === '') return null
  // 이름을 짓지 않는다. 우리가 지어낸 것이 사용자가 붙인 것처럼 보이면 안 된다.
  const id = randomUuid()
  return {
    shape: { login: null, apiKeys: [{ type: 'key', id, label: '', value: legacy, loginId: null }], mainKeyId: id },
    outdated: true,
  }
}

async function readStored(): Promise<Parsed | null> {
  return parse(await preferences.get(STORAGE_KEYS.authMethods)) ?? (await liftLegacy())
}

/** 옛 칸을 옮기는 중인 읽기. 동시에 읽은 둘이 서로 다른 id 를 지어 적으면 계정 id 가 갈린다. */
let upgrading: Promise<StoredShape | null> | null = null

/**
 * 옛 칸이면 id 를 붙이고 `type` 으로 옮겨 한 번 다시 적는다. id 는 넥슨 계정을 가리키므로 읽을 때마다 바뀌면 안 된다.
 */
async function loadShape(): Promise<StoredShape | null> {
  const parsed = await readStored()
  if (parsed === null) return null
  if (!parsed.outdated) return parsed.shape
  upgrading ??= (async () => {
    const again = await readStored()
    if (again === null) return null
    if (again.outdated) await write(again.shape)
    return again.shape
  })().finally(() => {
    upgrading = null
  })
  return upgrading
}

/** 수단이 하나도 없으면 `null`. 그때 앱은 로그인 화면을 세운다. */
export async function getAuthConfig(): Promise<NexonAuthConfig | null> {
  const stored = await loadShape()
  if (stored === null) return null
  if (stored.login === null && stored.apiKeys.length === 0) return null
  return stored
}

async function write(shape: StoredShape): Promise<void> {
  await preferences.set(STORAGE_KEYS.authMethods, JSON.stringify(shape))
}

/**
 * 로그인 화면에서 넣은 키를 메인 키로 둔다. **같은 값이 이미 있으면 늘리지 않는다.**
 *
 * 로그인 화면의 로그인은 새 로그인이라 앞 메인 수단을 버린다. 남은 넥슨 로그인은 떼고, 귀속되지 않은 키는 지운다. 남기면 앞
 * 수단이 계속 메인이라 새 키의 캐릭터를 앞 수단으로 부른다. 넥슨 로그인에 귀속된 부계정 키는 귀속된 채 남는다. 그 키를 넣었으면
 * 귀속을 든 채 메인 키가 되어, 나중에 그 넥슨 ID 로 다시 로그인하면 다시 부계정으로 이어진다.
 *
 * @param label 목록에서 구분하는 이름. 안 주면 빈 문자열이고 우리가 짓지 않는다
 * @param accountId 다시 받은 키가 이을 옛 넥슨 계정 id. 안 주면 새 계정이다
 */
export async function setMainApiKey(apiKey: string, label = '', accountId?: string): Promise<void> {
  const current = (await getAuthConfig()) ?? EMPTY
  const existing = current.apiKeys.find((one) => one.value === apiKey)
  const key: NexonApiKeyMethod = existing === undefined
    ? { type: 'key', id: accountId ?? randomUuid(), label, value: apiKey, loginId: null }
    : { ...existing, label }
  const kept = current.apiKeys.filter((one) => one.value !== apiKey && one.loginId !== null)
  await write({ login: null, apiKeys: [...kept, key], mainKeyId: key.id })
}

export interface SetNexonLoginOptions {
  /**
   * 로그인 화면의 로그인인가. 새 로그인이라 귀속되지 않은 키를 지운다. 아니면(today 의 `넥슨 ID 연동하기`) 메인 키와 귀속되지
   * 않은 키가 이 로그인의 부계정이 된다. 메인 키는 앞 로그인의 부계정 키였어도 지금 쓰는 계정이라 귀속을 옮긴다.
   */
  fresh?: boolean
}

/**
 * 넥슨 로그인을 붙인다. **로그인은 0~1개라 있던 것을 갈아끼운다.**
 *
 * 로그인은 앱 사용자를 식별하는 축이고 키는 거기 붙는 자원이다. 둘 이상일 이유가 없다. 로그인이 메인이라 메인 키는 없어진다.
 *
 * 거둘 키를 넘기면 그 키들을 같은 저장에서 빼고, 로그인은 그중 목록에서 앞선 키의 계정 id 를 이어받는다. 같은 넥슨 계정이라
 * 기기 기록이 이어져야 한다. 나눠 적으면 그 사이에 두 수단이 같은 id 를 갖는다.
 *
 * 다른 로그인에 귀속된 부계정 키는 그대로 둔다. 같은 계정 id 의 로그인이 돌아오면 다시 부계정으로 이어진다.
 *
 * @param takenKeys 메이플 ID 가 같아 서버에서 이은 키의 값. 안 주면 키는 안 거둔다
 * @param accountId 거둔 키가 없을 때 로그인이 이을 옛 넥슨 계정 id. 안 주면 지금 로그인의 id, 그것도 없으면 새 id 다
 */
export async function setNexonLogin(
  login: { session: string },
  takenKeys: readonly string[] = [],
  accountId?: string,
  options?: SetNexonLoginOptions,
): Promise<void> {
  const current = (await getAuthConfig()) ?? EMPTY
  const taken = current.apiKeys.filter((one) => takenKeys.includes(one.value))
  const id = taken[0]?.id ?? accountId ?? current.login?.id ?? randomUuid()
  const kept = current.apiKeys.filter((one) => !takenKeys.includes(one.value))
  await write({
    login: { type: 'login', id, session: login.session },
    apiKeys:
      options?.fresh === true
        ? kept.filter((one) => one.loginId !== null)
        : kept.map((one) => (one.loginId === null || one.id === current.mainKeyId ? { ...one, loginId: id } : one)),
    mainKeyId: null,
  })
}

/**
 * 계정 관리에서 넣은 부계정 키를 더한다. 검증과 서버 등록은 부르는 쪽이 끝냈다.
 *
 * @param loginId 이 키를 등록한 넥슨 로그인의 계정 id
 * @param accountId 이 키의 넥슨 계정 id. 메이플 ID 로 찾은 옛 id 가 있으면 그것이라 기록이 이어진다
 */
export async function addSubApiKey(apiKey: string, loginId: string, accountId: string): Promise<void> {
  const current = (await getAuthConfig()) ?? EMPTY
  const key: NexonApiKeyMethod = { type: 'key', id: accountId, label: '', value: apiKey, loginId }
  await write({ ...current, apiKeys: [...current.apiKeys.filter((one) => one.value !== apiKey), key] })
}

/**
 * 키 하나의 값만 바꾼다. 같은 넥슨 계정의 새 키라 계정 id · 귀속 · 차례는 그대로다. 옛 값은 이 저장에서 빠진다.
 *
 * @param id 바꿀 키의 넥슨 계정 id
 */
export async function replaceApiKeyValue(id: string, apiKey: string): Promise<void> {
  const current = await getAuthConfig()
  if (current === null) return
  await write({ ...current, apiKeys: current.apiKeys.map((one) => (one.id === id ? { ...one, value: apiKey } : one)) })
}

/**
 * 넥슨 로그인을 뗀다. 로그인이 만료되거나 동의를 철회했을 때다. 부계정 키는 귀속된 채 남는다.
 *
 * 메인 수단이 없어 로그인 화면이 선다. 같은 넥슨 ID 로 다시 로그인하면 부계정이 이어진다.
 */
export async function clearNexonLogin(): Promise<void> {
  const current = await getAuthConfig()
  if (current === null) return
  await write({ ...current, login: null })
}

/**
 * 무효화된 키 **하나만** 지운다(400 OPENAPI00005 · 401/403 · 429).
 *
 * 아래 `signOutAuth` 로 갈아끼우지 말 것. 그쪽은 로그아웃용이라 로그인과 메인 키를 함께 뗀다. 키 재입력 후의 재개는 남아 있는
 * trackingMode·trackedCharacters 에서 파생된다.
 *
 * @param apiKey 실패한 자격의 값. 실패가 여기까지 실어 나른다
 */
export async function removeApiKey(apiKey: string): Promise<void> {
  const current = await getAuthConfig()
  if (current === null) return

  const apiKeys = current.apiKeys.filter((one) => one.value !== apiKey)
  await write({ ...current, apiKeys, mainKeyId: apiKeys.some((one) => one.id === current.mainKeyId) ? current.mainKeyId : null })
}

/**
 * API 키를 **전부** 지운다. 어느 키가 죽었는지 못 가렸을 때만 쓴다.
 *
 * 실패가 키를 실어 나르지 못한 경로에서 쓰인다. 키가 여럿이면 다른 넥슨 계정의 키까지 잃지만,
 * 아무것도 안 지우면 그 사용자는 같은 실패를 무한히 다시 만난다. 로그인은 안 건드린다.
 */
export async function removeAllApiKeys(): Promise<void> {
  const current = await getAuthConfig()
  if (current === null) return
  await write({ login: current.login, apiKeys: [], mainKeyId: null })
}

/**
 * 로그아웃. 넥슨 로그인과 메인 키를 지우고, 넥슨 로그인에 귀속된 부계정 키는 남긴다.
 *
 * 같은 넥슨 ID 로 다시 로그인하면 부계정을 이어 쓰게 하려는 것이다. 다른 넥슨 ID 나 API 키로 로그인하면 계정 id 가 달라 이어지지
 * 않는다. 메인 키는 어느 로그인에도 귀속되지 않아 다시 이을 곳이 없다. 앞 로그인의 부계정 키를 메인으로 쓰고 있었으면 메인
 * 표시만 지운다.
 *
 * **옛 칸까지 치운다.** 안 치우면 다음 읽기가 그것을 다시 목록으로 올린다. `selectedAccountId` 는 **레거시 키**다(계정 선택이
 * 사라졌다). 아무도 쓰지 않지만 옛 설치본에는 값이 남아 있어 함께 치운다.
 */
export async function signOutAuth(): Promise<void> {
  const current = await getAuthConfig()
  const apiKeys = (current?.apiKeys ?? []).filter((one) => one.loginId !== null)
  if (apiKeys.length === 0) await preferences.remove(STORAGE_KEYS.authMethods)
  else await write({ login: null, apiKeys, mainKeyId: null })
  await preferences.remove(STORAGE_KEYS.apiKey)
  await preferences.remove(STORAGE_KEYS.legacySelectedAccountId)
}
