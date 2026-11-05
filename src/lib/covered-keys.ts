/**
 * 키를 쓰던 사용자가 넥슨 로그인을 붙였을 때 **서버에서 잇고 지울 키**를 가린다.
 *
 * 같은 넥슨 계정을 두 수단으로 들고 있을 이유가 없고, 키는 평문으로 저장돼 있어 지우는 쪽이
 * 안전하다. 다만 **다른 넥슨 계정의 키를 지우면 그 계정의 캐릭터를 통째로 잃으므로**, 로그인과
 * 메이플 ID 집합이 같은 키만 고른다. 캐릭터가 아니라 메이플 ID 로 견준다.
 *
 * 대조는 이미 받은 응답으로 한다. **추가 호출이 없다.**
 */
import type { CredentialAccounts } from './maple-ids'

function mapleIdsOf(source: CredentialAccounts): Set<string> {
  return new Set(source.accounts.map((account) => account.accountId))
}

/**
 * 로그인과 메이플 ID 집합이 같은 API 키의 값들.
 *
 * **판정을 못 하면 고르지 않는다.** 로그인이 없거나, 어느 한쪽이 메이플 ID 를 하나도 안 줬으면 빈
 * 목록이다. 조회가 실패한 회차에 빈 집합끼리 같다고 읽으면 멀쩡한 키가 사라진다.
 */
export function apiKeysCoveredByLogin(sources: readonly CredentialAccounts[]): string[] {
  const login = sources.find((one) => one.credential.type === 'login')
  if (login === undefined) return []

  const loginIds = mapleIdsOf(login)
  if (loginIds.size === 0) return []

  return sources
    .filter((one) => one.credential.type === 'key')
    .filter((one) => {
      const keyIds = mapleIdsOf(one)
      return keyIds.size === loginIds.size && [...keyIds].every((id) => loginIds.has(id))
    })
    .map((one) => one.credential.value)
}
