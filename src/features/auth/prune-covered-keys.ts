/**
 * 넥슨 로그인이 **메이플 ID 가 같은 키를 거둔다.** 로그인은 거둔 키의 넥슨 계정 id 를 이어받는다.
 *
 * 같은 넥슨 계정을 두 수단으로 들고 있을 이유가 없고, 키는 평문으로 저장돼 있어 지우는 쪽이
 * 안전하다. 메이플 ID 가 다른 키는 **안 건드린다**. 지우면 그 계정의 캐릭터를 잃는다.
 *
 * **서버는 부르지 않는다.** 키 사용자는 서버에 메이플 ID 해시로 밝혀져, 로그인 세션으로 메이플 ID 를 알리면 서버가 같은
 * 메이플 ID 의 넥슨 계정 줄을 로그인 줄로 합친다. 목록을 받지 못해 견주지 못한 키는 남기고, 로그인한 채 앱을 켤 때 다시 한다.
 *
 * **로그인은 키의 계정 id 를 이어받는다.** 새 id 로 저장되면 강화 수집기가 그 id 로 키 시절 날짜를 다시 받고,
 * 계정을 가리지 않고 더하는 강화 합계가 두 번 세어진다. 거둔 키가 없어도 그 로그인의 메이플 ID 가 속했던 옛 계정 id 를
 * 잇는다. 같은 넥슨 ID 로 다시 로그인하는 것이라 같은 일이 생긴다.
 */
import { apiKeysCoveredByLogin } from '../../lib/covered-keys'
import type { CredentialAccounts } from '../../lib/maple-ids'
import { fetchAndRecordCharacterList, fetchUnsavedCharacterList } from '../mvp-grade/character-list'
import { getAuthConfig, setNexonLogin, type SetNexonLoginOptions } from '../../storage/api-key'
import { moveNexonAccountRows } from '../../storage/nexon-account-ids'
import type { MapleAccount } from '../../types'
import type { NexonApiKeyMethod } from '../../types/auth'
import { reusableNexonAccountId } from './reentry-account-id'

/** 수단마다 목록을 받는다. 한 수단이 실패하면 그 수단은 판정에서 빠진다(빈 목록). */
async function accountsOf(credential: CredentialAccounts['credential']): Promise<CredentialAccounts> {
  const accounts = await fetchAndRecordCharacterList(credential).catch(() => [])
  return { credential, accounts }
}

/**
 * 로그인의 목록. 소속은 적지 않는다. 로그인의 계정 id 가 아직 정해지지 않았고, 먼저 적으면 옛 계정 id 를 찾기 전에 덮는다.
 * 실패하면 빈 목록이다.
 */
function loginAccountsOf(session: string, loginAccountId: string | null): Promise<MapleAccount[]> {
  return fetchUnsavedCharacterList({ type: 'login', value: session, accountId: loginAccountId }).catch(() => [])
}

/** 메이플 ID 집합이 로그인과 같은 키의 값. 목록을 받지 못한 키는 빈 목록이라 고르지 않는다. */
async function sameMapleIdKeys(
  session: string,
  loginAccountId: string | null,
  loginAccounts: readonly MapleAccount[],
  apiKeys: readonly NexonApiKeyMethod[],
): Promise<string[]> {
  const sources = [
    { credential: { type: 'login' as const, value: session, accountId: loginAccountId }, accounts: [...loginAccounts] },
    ...(await Promise.all(apiKeys.map((key) => accountsOf({ type: 'key', value: key.value, accountId: key.id })))),
  ]
  return apiKeysCoveredByLogin(sources)
}

/**
 * 로그인을 저장하면서 고른 키를 거둔다. 로그인은 그중 목록에서 앞선 키의 계정 id 를 이어받는다.
 *
 * 그 id 와 다른 id(로그인의 옛 id · 둘째 이후 키의 id)로 적힌 기기 기록을 먼저 옮긴다. 옮기지 못하면 키를 거두지 않는다.
 * 거두면 기록이 주인 없는 id 에 남는다.
 *
 * @param reusedId 거둔 키가 없을 때 이을 옛 계정 id. 로그인의 메이플 ID 가 속했던 id 다
 */
async function saveLoginTakingKeys(
  session: string,
  coveredKeys: readonly string[],
  reusedId?: string,
  options?: SetNexonLoginOptions,
): Promise<void> {
  const config = await getAuthConfig()
  const taken = (config?.apiKeys ?? []).filter((one) => coveredKeys.includes(one.value))
  const heir = taken[0]
  if (heir === undefined) {
    await setNexonLogin({ session }, [], reusedId, options)
    return
  }

  const oldIds = [config?.login?.id, ...taken.slice(1).map((one) => one.id)].filter(
    (id): id is string => id !== undefined && id !== heir.id,
  )
  try {
    await moveNexonAccountRows(oldIds, heir.id)
  } catch {
    await setNexonLogin({ session }, [], reusedId, options)
    return
  }
  await setNexonLogin({ session }, coveredKeys, undefined, options)
}

/**
 * 로그인 직후, 세션을 저장하기 전에 부른다. **키를 고르지 못해도 로그인은 저장한다**. 남은 키는 앱을 켤 때 다시 다룬다.
 * 저장이 실패하면 던진다. 다시 켤 때 로그인 상태가 아니므로 성공이라고 말하면 안 된다.
 */
export async function saveNexonLogin(session: string, options?: SetNexonLoginOptions): Promise<void> {
  const config = await getAuthConfig().catch(() => null)
  const loginAccountId = config?.login?.id ?? null
  const loginAccounts = await loginAccountsOf(session, loginAccountId)
  const covered =
    config === null || config.apiKeys.length === 0
      ? []
      : await sameMapleIdKeys(session, loginAccountId, loginAccounts, config.apiKeys).catch(() => [])
  const reusedId = (await reusableNexonAccountId(loginAccounts)) ?? undefined
  await saveLoginTakingKeys(session, covered, reusedId, options)
}

/** 로그인한 채 앱을 켤 때 부른다. 로그인 직후 목록을 받지 못해 남은 키를 다시 다룬다. */
export async function pruneCoveredApiKeys(): Promise<void> {
  const config = await getAuthConfig()
  // 이 로그인의 부계정 키만 본다. 다른 로그인에 귀속된 키는 부르지 않는 키다.
  const login = config?.login
  const apiKeys = login == null ? [] : (config?.apiKeys ?? []).filter((one) => one.loginId === login.id)
  if (login == null || apiKeys.length === 0) return

  const loginAccounts = await loginAccountsOf(login.session, login.id)
  const covered = await sameMapleIdKeys(login.session, login.id, loginAccounts, apiKeys)
  if (covered.length === 0) return
  await saveLoginTakingKeys(login.session, covered)
}
