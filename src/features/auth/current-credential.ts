/**
 * 넥슨을 부르기 직전에 **쓸 수 있는 자격**을 고른다.
 *
 * 로그인이면 값은 서버 세션이다. 액세스 토큰은 서버만 들고 프렌즈 조회는 서버가 대신 부르므로,
 * 앱이 토큰을 미리 받아 둘 일이 없다. 세션이 죽었는지는 서버가 401 로 답하고 화면이 재로그인을 띄운다.
 *
 * @example const credential = await currentCredential()
 */
import { credentialOf, credentialOfOwner, usableCredentialsOf } from '../../lib/nexon-credential'
import { listedSubAccountConfig } from '../../lib/sub-account-keys'
import { getAuthConfig } from '../../storage/api-key'
import { getNexonAccountIdsOfOcids } from '../../storage/character-accounts'
import { getServerAccounts } from '../../storage/server-accounts'
import { getServerSubAccounts } from '../../storage/server-sub-accounts'
import type { NexonAuthConfig, NexonCredential } from '../../types/auth'

export async function currentCredential(): Promise<NexonCredential | null> {
  return credentialOf(await readConfig())
}

async function readConfig(): Promise<NexonAuthConfig | null> {
  // `.catch()` 가 아니라 `try` 인 것은 **마이크로태스크 하나 차이** 때문이다. 체인을 한 칸
  // 늘리면 로스터가 캐시 stub 을 흘린 뒤에야 `character/list` 가 출발해, 첫 그림과 조회 시작
  // 순서가 뒤집힌다(그 순서를 고정한 테스트가 있다).
  try {
    return await getAuthConfig()
  } catch {
    return null
  }
}

/**
 * 부계정을 고를 설정. 서버가 지금 로그인에 준 목록에서 빠진 부계정 키를 뺀다. 목록을 못 읽으면 기기의 키를 모두 쓴다.
 *
 * 메인 계정 하나만 고르는 `currentCredential` 은 이것을 거치지 않는다. 부계정 키는 메인이 되지 않아 목록과 상관없다.
 */
async function readListedConfig(): Promise<NexonAuthConfig | null> {
  const [config, list, registered] = await Promise.all([
    readConfig(),
    getServerSubAccounts().catch(() => null),
    getServerAccounts().then(
      (state) => state.registered,
      () => [],
    ),
  ])
  return listedSubAccountConfig(config, list, registered)
}

/** 지금 부를 수 있는 넥슨 계정마다의 자격. 메인 계정이 맨 앞이다. 계정마다 따로 받는 `character/list` · 강화 내역이 쓴다. */
export async function currentCredentials(): Promise<NexonCredential[]> {
  return usableCredentialsOf(await readListedConfig())
}

/**
 * 캐릭터마다 부를 자격. 그 캐릭터가 속한 넥슨 계정의 자격이고, 부를 수 없으면 `null` 이다.
 *
 * 어느 계정인지는 `character_accounts` 에서 찾는다. 모르는 캐릭터와 소속을 못 읽은 경우는 메인 계정의 자격이다. 계정 칸이
 * 생기기 전의 기록은 모두 메인 계정의 것이었다.
 */
export async function credentialsOfOcids(ocids: readonly string[]): Promise<Map<string, NexonCredential | null>> {
  const [config, owners] = await Promise.all([readListedConfig(), readOwners(ocids)])
  return new Map(ocids.map((ocid) => [ocid, credentialOfOwner(config, owners.get(ocid) ?? null)]))
}

async function readOwners(ocids: readonly string[]): Promise<Map<string, string>> {
  try {
    return await getNexonAccountIdsOfOcids(ocids)
  } catch {
    return new Map()
  }
}

/** 캐릭터 하나를 부를 자격. `credentialsOfOcids` 와 같은 규칙이다. */
export async function credentialOfOcid(ocid: string): Promise<NexonCredential | null> {
  return (await credentialsOfOcids([ocid])).get(ocid) ?? null
}
