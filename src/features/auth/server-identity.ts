/**
 * **우리 서버**에 자기를 밝히는 헤더를 만든다. 넥슨을 부르는 자격(`current-credential.ts`)과
 * 다른 축이다.
 *
 * | 헤더 | 값 |
 * |---|---|
 * | `Authorization: Bearer <세션>` | 서버가 발급한 세션. 로그인한 사용자 |
 * | `x-api-key-hash` | API 키의 SHA-256. 키만 쓰는 사용자 |
 * | `x-nexon-account-id` | 메인 넥슨 계정 id. 서버가 그 신원의 계정 줄에 적는다 |
 *
 * **세션이 있으면 키 해시를 안 싣는다.** 둘을 다 보내도 서버가 세션을 고르지만, 세션이 죽었을 때
 * 서버가 키 쪽으로 넘어가지 않고 재로그인을 요구한다 - 넘어가면 같은 사람의 기록이 두 열쇠로
 * 갈라진다. 앱도 같은 선을 보여 한쪽만 싣는다.
 *
 * **키를 여럿 둔 사용자는 첫 키로 밝힌다.** 키를 더하는 기능이 로그인 사용자에게만 열리므로,
 * 키가 여럿인 사용자는 세션이 있어 이 갈림에 안 온다.
 */
import { apiKeyHashHex } from '../../lib/crypto/api-key-hash'
import { getAuthConfig } from '../../storage/api-key'

/** 밝힐 수단이 없으면 `null`. 그때는 서버에 아무것도 안 보낸다. */
export async function serverIdentityHeaders(): Promise<Record<string, string> | null> {
  let config
  try {
    config = await getAuthConfig()
  } catch {
    return null
  }

  const login = config?.login
  if (login != null && login.session !== '') {
    return { Authorization: `Bearer ${login.session}`, 'x-nexon-account-id': login.id }
  }

  const key = config?.apiKeys[0]
  if (key !== undefined && key.value !== '') {
    return { 'x-api-key-hash': apiKeyHashHex(key.value), 'x-nexon-account-id': key.id }
  }

  return null
}
