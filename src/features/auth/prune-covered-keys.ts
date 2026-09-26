/**
 * 로그인을 붙인 뒤 **같은 계정의 키를 거둔다.**
 *
 * 같은 계정을 두 수단으로 들고 있을 이유가 없고, 키는 평문으로 저장돼 있어 지우는 쪽이
 * 안전하다. 다른 넥슨 계정의 키는 **안 건드린다** - 지우면 그 계정의 캐릭터를 잃는다.
 *
 * **실패해도 로그인은 이미 끝났다.** 거두지 못하면 쓸모없는 키가 남을 뿐이고, 다음 로그인에서
 * 다시 해 볼 수 있다. 여기서 던지면 방금 성공한 로그인이 실패로 보인다.
 */
import { apiKeysCoveredByLogin } from '../../lib/covered-keys'
import type { CredentialAccounts } from '../../lib/maple-ids'
import { fetchAndRecordCharacterList } from '../mvp-grade/character-list'
import { getAuthConfig, removeApiKey } from '../../storage/api-key'

/** 수단마다 목록을 받는다. 한 수단이 실패하면 그 수단은 판정에서 빠진다(빈 목록). */
async function accountsOf(credential: CredentialAccounts['credential']): Promise<CredentialAccounts> {
  const accounts = await fetchAndRecordCharacterList(credential).catch(() => [])
  return { credential, accounts }
}

export async function pruneCoveredApiKeys(): Promise<void> {
  const config = await getAuthConfig()
  if (config?.login == null || config.apiKeys.length === 0) return

  const sources = await Promise.all([
    accountsOf({ kind: 'login', value: config.login.session }),
    ...config.apiKeys.map((key) => accountsOf({ kind: 'apiKey', value: key.value })),
  ])

  for (const value of apiKeysCoveredByLogin(sources)) {
    await removeApiKey(value)
  }
}
