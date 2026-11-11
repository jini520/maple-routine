/**
 * 서버가 마지막으로 준 한 로그인의 부계정 목록. Preferences 의 JSON 한 칸이다.
 *
 * 서버에 묻지 못할 때 쓴다. 네트워크가 끊길 때마다 부계정이 사라졌다 나타나면 안 된다. 깨진 값은 없는 것으로 읽는다.
 */
import { serverSubAccountsOf, type ServerSubAccountList } from '../lib/sub-account-keys'
import { STORAGE_KEYS } from './keys'
import { preferences } from './ports'

export async function getServerSubAccounts(): Promise<ServerSubAccountList | null> {
  const raw = await preferences.get(STORAGE_KEYS.serverSubAccounts)
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as { loginId?: unknown; subAccounts?: unknown }
    const subAccounts = serverSubAccountsOf(parsed.subAccounts)
    if (typeof parsed.loginId !== 'string' || subAccounts === null) return null
    return { loginId: parsed.loginId, subAccounts }
  } catch {
    return null
  }
}

export async function setServerSubAccounts(list: ServerSubAccountList): Promise<void> {
  await preferences.set(STORAGE_KEYS.serverSubAccounts, JSON.stringify(list))
}
