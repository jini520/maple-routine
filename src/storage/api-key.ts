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

interface StoredShape {
  login: NexonLoginMethod | null
  apiKeys: NexonApiKeyMethod[]
}

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

function keyOf(value: unknown): { key: NexonApiKeyMethod; outdated: boolean } | null {
  const one = recordOf(value)
  if (one === null || (one.type !== 'key' && one.kind !== 'apiKey')) return null
  if (typeof one.value !== 'string' || typeof one.label !== 'string') return null
  const current = isCurrent(one, 'key')
  return {
    key: { type: 'key', id: current ? (one.id as string) : randomUuid(), label: one.label, value: one.value },
    outdated: !current,
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
    const keys = shape.apiKeys.map(keyOf).filter((one) => one !== null)
    return {
      shape: { login: login.login, apiKeys: keys.map((one) => one.key) },
      outdated: login.outdated || keys.some((one) => one.outdated),
    }
  } catch {
    return null
  }
}

/**
 * 옛 설치본의 키를 이어받는다. 옛 칸은 **안 지운다.**
 *
 * 구버전으로 되돌아가도 키를 잃지 않아야 한다. 치우는 것은 연결 해제 한 자리뿐이다.
 */
async function liftLegacy(): Promise<Parsed | null> {
  const legacy = await preferences.get(STORAGE_KEYS.apiKey)
  if (legacy === null || legacy === '') return null
  // 이름을 짓지 않는다. 우리가 지어낸 것이 사용자가 붙인 것처럼 보이면 안 된다.
  return { shape: { login: null, apiKeys: [{ type: 'key', id: randomUuid(), label: '', value: legacy }] }, outdated: true }
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
 * API 키를 더한다. **같은 값이 이미 있으면 늘리지 않고 이름만 간다.**
 *
 * 키 재입력 경로에서 같은 키를 다시 넣는 일이 흔하다. 늘어나면 목록이 지저분해진다.
 *
 * @param label 목록에서 구분하는 이름. 안 주면 빈 문자열이고 우리가 짓지 않는다
 * @param accountId 다시 받은 키가 이을 옛 넥슨 계정 id. 안 주면 새 계정이다
 */
export async function setApiKey(apiKey: string, label = '', accountId?: string): Promise<void> {
  const current = (await getAuthConfig()) ?? { login: null, apiKeys: [] }
  const next = current.apiKeys.some((one) => one.value === apiKey)
    ? current.apiKeys.map((one) => (one.value === apiKey ? { ...one, label } : one))
    : [...current.apiKeys, { type: 'key' as const, id: accountId ?? randomUuid(), label, value: apiKey }]

  await write({ login: current.login, apiKeys: next })
}

/**
 * 넥슨 로그인을 붙인다. **로그인은 0~1개라 있던 것을 갈아끼운다.**
 *
 * 로그인은 앱 사용자를 식별하는 축이고 키는 거기 붙는 자원이다. 둘 이상일 이유가 없다.
 * **API 키는 안 건드린다** - 같은 계정인지 대조해 지우는 일은 따로다(#541).
 */
export async function setNexonLogin(login: { session: string }): Promise<void> {
  const current = (await getAuthConfig()) ?? { login: null, apiKeys: [] }
  await write({
    login: { type: 'login', id: current.login?.id ?? randomUuid(), session: login.session },
    apiKeys: current.apiKeys,
  })
}

/**
 * 넥슨 로그인을 뗀다. API 키는 남는다.
 *
 * 로그인만 있던 사용자는 이 뒤로 수단이 없어 `getAuthConfig` 가 `null` 이고 로그인 화면이 선다.
 */
export async function clearNexonLogin(): Promise<void> {
  const current = await getAuthConfig()
  if (current === null) return
  await write({ login: null, apiKeys: current.apiKeys })
}

/**
 * 무효화된 키 **하나만** 지운다(400 OPENAPI00005 · 401/403 · 429).
 *
 * 아래 `clearAuthConfig` 로 갈아끼우지 말 것. 그쪽은 연결 해제용이라 목록을 통째로 버리고
 * **다른 넥슨 계정의 키까지 함께 사라진다.** 키 재입력 후의 재개는 남아 있는
 * trackingMode·trackedCharacters 에서 파생된다.
 *
 * @param apiKey 실패한 자격의 값. 실패가 여기까지 실어 나른다
 */
export async function removeApiKey(apiKey: string): Promise<void> {
  const current = await getAuthConfig()
  if (current === null) return

  await write({
    login: current.login,
    apiKeys: current.apiKeys.filter((one) => one.value !== apiKey),
  })
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
  await write({ login: current.login, apiKeys: [] })
}

/**
 * 연결 해제 전용. 저장된 인증 정보를 통째로 버린다(위 `removeApiKey` 와 목적이 다르다).
 *
 * **옛 칸까지 치운다.** 안 치우면 다음 읽기가 그것을 다시 목록으로 올린다.
 *
 * `selectedAccountId` 는 **레거시 키**다(계정 선택이 사라졌다). 아무도 쓰지 않지만 옛 설치본에는
 * 값이 남아 있어, 연결 해제에서 함께 치운다.
 */
export async function clearAuthConfig(): Promise<void> {
  await preferences.remove(STORAGE_KEYS.authMethods)
  await preferences.remove(STORAGE_KEYS.apiKey)
  await preferences.remove(STORAGE_KEYS.legacySelectedAccountId)
}
