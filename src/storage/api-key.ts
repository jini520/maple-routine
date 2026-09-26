/**
 * 기기에 저장된 인증 수단. **넥슨 로그인 0~1개 + 이름 붙은 API 키 0개 이상**이다.
 *
 * PreferencesPort는 평문 저장이며 Keychain/Keystore 수준 암호화를 보장하지 않는다. 강화된 보안
 * 저장 도입은 이후 별도 task로 미룬다.
 */
import { preferences } from './ports'
import type { NexonApiKeyMethod, NexonAuthConfig } from '../types'
import { STORAGE_KEYS } from './keys'

interface StoredShape {
  login: NexonAuthConfig['login']
  apiKeys: NexonApiKeyMethod[]
}

function isApiKeyMethod(value: unknown): value is NexonApiKeyMethod {
  if (typeof value !== 'object' || value === null) return false
  const one = value as Record<string, unknown>
  return one.kind === 'apiKey' && typeof one.value === 'string' && typeof one.label === 'string'
}

/**
 * 저장된 칸을 읽는다. 모양이 아니면 `null` 이라 **옛 칸으로 물러날 수 있다.**
 *
 * 저장이 중간에 끊겼거나 손으로 고쳐졌을 수 있다. 그때 던지면 키를 통째로 잃는다.
 */
function parse(raw: string | null): StoredShape | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const shape = value as Record<string, unknown>
    if (!Array.isArray(shape.apiKeys)) return null
    return {
      login: shape.login === undefined ? null : (shape.login as StoredShape['login']),
      apiKeys: shape.apiKeys.filter(isApiKeyMethod),
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
async function liftLegacy(): Promise<StoredShape | null> {
  const legacy = await preferences.get(STORAGE_KEYS.apiKey)
  if (legacy === null || legacy === '') return null
  // 이름을 짓지 않는다. 우리가 지어낸 것이 사용자가 붙인 것처럼 보이면 안 된다.
  return { login: null, apiKeys: [{ kind: 'apiKey', label: '', value: legacy }] }
}

/** 수단이 하나도 없으면 `null`. 그때 앱은 로그인 화면을 세운다. */
export async function getAuthConfig(): Promise<NexonAuthConfig | null> {
  const stored = parse(await preferences.get(STORAGE_KEYS.authMethods)) ?? (await liftLegacy())
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
 */
export async function setApiKey(apiKey: string, label = ''): Promise<void> {
  const current = (await getAuthConfig()) ?? { login: null, apiKeys: [] }
  const next = current.apiKeys.some((one) => one.value === apiKey)
    ? current.apiKeys.map((one) => (one.value === apiKey ? { ...one, label } : one))
    : [...current.apiKeys, { kind: 'apiKey' as const, label, value: apiKey }]

  await write({ login: current.login, apiKeys: next })
}

/**
 * 넥슨 로그인을 붙인다. **로그인은 0~1개라 있던 것을 갈아끼운다.**
 *
 * 로그인은 앱 사용자를 식별하는 축이고 키는 거기 붙는 자원이다. 둘 이상일 이유가 없다.
 * **API 키는 안 건드린다** - 같은 계정인지 대조해 지우는 일은 따로다(#541).
 */
export async function setNexonLogin(tokens: {
  session: string
  accessToken: string
  accessExpiresAt: string
}): Promise<void> {
  const current = (await getAuthConfig()) ?? { login: null, apiKeys: [] }
  await write({ login: { kind: 'login', ...tokens }, apiKeys: current.apiKeys })
}

/**
 * 액세스 토큰만 갈아끼운다. **세션은 안 건드린다.**
 *
 * 토큰이 30분이라 세션보다 훨씬 자주 바뀐다. 세션까지 다시 쓰면 갈아끼우는 값이 둘이 되고,
 * 한쪽만 써진 순간이 생긴다.
 *
 * 로그인이 없으면 아무 일도 안 한다. 로그아웃과 토큰 받기가 겹치면 여기 오는데, 없는 로그인을
 * 만들어 내면 안 된다.
 */
export async function updateNexonAccessToken(
  accessToken: string,
  accessExpiresAt: string,
): Promise<void> {
  const current = await getAuthConfig()
  if (current?.login == null) return
  await write({
    login: { ...current.login, accessToken, accessExpiresAt },
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
