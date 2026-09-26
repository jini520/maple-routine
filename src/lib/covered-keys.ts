/**
 * 키를 쓰던 사용자가 넥슨 로그인을 붙였을 때 **어느 키를 지워도 되는지** 가린다.
 *
 * 같은 계정을 두 수단으로 들고 있을 이유가 없고, 키는 평문으로 저장돼 있어 지우는 쪽이
 * 안전하다. 다만 **다른 넥슨 계정의 키를 지우면 그 계정의 캐릭터를 통째로 잃으므로**, 로그인이
 * 다 덮는다고 확인된 키만 고른다.
 *
 * **실제로는 같거나 아예 다르다**(사용자 확인 2026-09-26). 같은 넥슨 계정이면 키로 조회하든
 * 로그인으로 조회하든 `character/list` 가 같은 결과를 준다. 그래서 부분만 겹치는 경우가 안 생기고,
 * 아래 **다 덮는가** 판정은 그 사실 위에 두는 안전망이다.
 *
 * 대조는 이미 받은 응답으로 한다. **추가 호출이 없다.**
 */
import type { CredentialAccounts } from './maple-ids'

function ocidsOf(source: CredentialAccounts): Set<string> {
  return new Set(source.accounts.flatMap((account) => account.characters.map((one) => one.ocid)))
}

/**
 * 로그인이 다 덮는 API 키의 값들. 그 키들은 지워도 잃는 것이 없다.
 *
 * **판정을 못 하면 안 지운다.** 로그인이 없거나, 어느 한쪽이 캐릭터를 하나도 안 줬으면 빈
 * 목록이다. 빈 집합을 **전부 덮는다** 로 읽으면 조회가 실패한 회차에 멀쩡한 키가 사라진다.
 */
export function apiKeysCoveredByLogin(sources: readonly CredentialAccounts[]): string[] {
  const login = sources.find((one) => one.credential.kind === 'login')
  if (login === undefined) return []

  const loginOcids = ocidsOf(login)
  if (loginOcids.size === 0) return []

  return sources
    .filter((one) => one.credential.kind === 'apiKey')
    .filter((one) => {
      const keyOcids = ocidsOf(one)
      if (keyOcids.size === 0) return false
      return [...keyOcids].every((ocid) => loginOcids.has(ocid))
    })
    .map((one) => one.credential.value)
}
