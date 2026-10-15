/**
 * 넥슨을 부르기 직전에 **쓸 수 있는 자격**을 고른다.
 *
 * 로그인이면 값은 서버 세션이다. 액세스 토큰은 서버만 들고 프렌즈 조회는 서버가 대신 부르므로,
 * 앱이 토큰을 미리 받아 둘 일이 없다. 세션이 죽었는지는 서버가 401 로 답하고 화면이 재로그인을 띄운다.
 *
 * @example const credential = await currentCredential()
 */
import { credentialOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import type { NexonAuthConfig, NexonCredential } from '../../types/auth'

export async function currentCredential(): Promise<NexonCredential | null> {
  // `.catch()` 가 아니라 `try` 인 것은 **마이크로태스크 하나 차이** 때문이다. 체인을 한 칸
  // 늘리면 로스터가 캐시 stub 을 흘린 뒤에야 `character/list` 가 출발해, 첫 그림과 조회 시작
  // 순서가 뒤집힌다(그 순서를 고정한 테스트가 있다).
  let config: NexonAuthConfig | null
  try {
    config = await getAuthConfig()
  } catch {
    config = null
  }
  return credentialOf(config)
}
