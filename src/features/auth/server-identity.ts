/**
 * **우리 서버**에 자기를 밝히는 헤더를 만든다. 넥슨을 부르는 자격(`current-credential.ts`)과
 * 다른 축이다.
 *
 * | 헤더 | 값 |
 * |---|---|
 * | `Authorization: Bearer <세션>` | 서버가 발급한 세션. 로그인한 사용자 |
 * | `x-api-key-hash` | API 키의 SHA-256. 키만 쓰는 사용자와 부계정 |
 *
 * **세션이 있으면 키 해시를 안 싣는다.** 둘을 다 보내도 서버가 세션을 고르지만, 세션이 죽었을 때
 * 서버가 키 쪽으로 넘어가지 않고 재로그인을 요구한다 - 넘어가면 같은 사람의 기록이 두 열쇠로
 * 갈라진다. 앱도 같은 선을 보여 한쪽만 싣는다.
 *
 * **세션이 없으면 메인 키로 밝힌다.** 부계정 키로는 밝히지 않는다. 부계정은 로그인 사용자만 등록하므로 그 사용자는
 * 세션으로 밝혀지고, 로그인이 만료돼 부계정 키만 남으면 밝힐 수단이 없다.
 *
 * 기록은 그 캐릭터가 속한 넥슨 계정의 신원으로 보낸다(`serverIdentityOfAccount`). 서버는 기록의 메이플 ID 가 보낸 신원의
 * 넥슨 계정에 있어야 적는다.
 */
import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { credentialOf, mainApiKeyOf, usableCredentialsOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import type { NexonAuthConfig, NexonCredential } from '../../types/auth'

export type ServerIdentity = Record<string, string>

/** 자격 하나의 헤더. 세션이나 키가 비었으면 밝힐 수 없어 `null` 이다. */
function identityOfCredential(credential: NexonCredential): ServerIdentity | null {
  if (credential.value === '') return null
  return credential.type === 'login'
    ? { Authorization: `Bearer ${credential.value}` }
    : { 'x-api-key-hash': apiKeyHashHex(credential.value) }
}

/** 메인 계정의 신원. 밝힐 수단이 없으면 `null`. */
function mainIdentityOf(config: NexonAuthConfig | null): ServerIdentity | null {
  const login = config?.login
  if (login != null && login.session !== '') return { Authorization: `Bearer ${login.session}` }

  const key = mainApiKeyOf(config)
  if (key !== null && key.value !== '') return { 'x-api-key-hash': apiKeyHashHex(key.value) }

  return null
}

/**
 * 넥슨 계정 하나의 신원. 지금 부를 수 없는 계정(다른 로그인의 부계정 · 모르는 계정)이면 `null` 이다.
 *
 * @param accountId 기록의 캐릭터가 속한 넥슨 계정 id. 모르면 `null` 이고 메인 계정의 신원을 준다. 계정 칸이 생기기 전의 기록은 모두 메인 계정의 것이었다
 */
export function serverIdentityOfAccount(config: NexonAuthConfig | null, accountId: string | null): ServerIdentity | null {
  if (accountId === null) return mainIdentityOf(config)
  const credential = usableCredentialsOf(config).find((one) => one.accountId === accountId)
  return credential === undefined ? null : identityOfCredential(credential)
}

/** 지금 쓸 수 있는 신원 전부. 메인 계정이 맨 앞이다. 어느 계정의 것인지 모르는 지우기가 쓴다. */
export function serverIdentitiesOf(config: NexonAuthConfig | null): ServerIdentity[] {
  const credentials = config?.login == null ? [credentialOf(config)] : usableCredentialsOf(config)
  return credentials.flatMap((one) => {
    const identity = one === null ? null : identityOfCredential(one)
    return identity === null ? [] : [identity]
  })
}

/** 메인 계정의 신원. 밝힐 수단이 없으면 `null`. 그때는 서버에 아무것도 안 보낸다. */
export async function serverIdentityHeaders(): Promise<ServerIdentity | null> {
  try {
    return mainIdentityOf(await getAuthConfig())
  } catch {
    return null
  }
}
