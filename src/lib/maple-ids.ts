/**
 * 여러 인증 수단에서 받은 `character/list` 를 **하나의 메이플 ID 목록**으로 합친다.
 *
 * 응답을 준 수단이 그 ID 들의 주인이고, **어느 메이플 ID 를 어느 수단으로 부를지는 이 표가
 * 정한다.** 캐릭터마다 다시 판정하지 않는다.
 *
 * 순수 함수라 `lib/` 에 있다. 받아 오는 일은 부르는 쪽이 한다.
 */
import type { MapleAccount, MapleCharacter } from '../types/character'
import type { NexonCredential } from '../types/auth'

/** 한 수단이 준 응답 한 벌. */
export interface CredentialAccounts {
  credential: NexonCredential
  accounts: readonly MapleAccount[]
}

/** 메이플 ID 하나와 그것을 부를 수단. */
export interface MapleIdEntry {
  accountId: string
  credential: NexonCredential
  characters: readonly MapleCharacter[]
}

/**
 * 합친다. **같은 메이플 ID 가 둘 이상에서 오면 로그인이 주인이다.**
 *
 * 토큰이 만료돼도 키가 남아 있으면 그 ID 는 계속 조회되므로, 주인을 로그인으로 두는 것이 잃는
 * 것 없이 더 나은 경로를 고르는 일이다. 주인이 바뀌면 캐릭터도 그쪽 응답을 쓴다. 두 응답을
 * 섞으면 어느 쪽이 최신인지 모른다.
 *
 * 로그인끼리는 겹칠 수 없다. 로그인은 0~1개다. 키끼리 겹치면 먼저 온 것이 남는다. 같은 계정의
 * 키를 여럿 둘 이유가 없어 정상적으로는 안 생기고, 생겼을 때 목록이 두 번 서지만 않으면 된다.
 */
export function mergeMapleIds(sources: readonly CredentialAccounts[]): MapleIdEntry[] {
  const byId = new Map<string, MapleIdEntry>()

  for (const { credential, accounts } of sources) {
    for (const account of accounts) {
      const seen = byId.get(account.accountId)
      // 로그인이 이긴다. 순서에 기대지 않는다.
      if (seen !== undefined && !(credential.kind === 'login' && seen.credential.kind !== 'login')) {
        continue
      }
      byId.set(account.accountId, {
        accountId: account.accountId,
        credential,
        characters: account.characters,
      })
    }
  }

  return [...byId.values()]
}
