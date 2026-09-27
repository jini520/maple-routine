/**
 * 넥슨을 부르기 직전에 **쓸 수 있는 자격**을 고른다. 필요하면 액세스 토큰을 먼저 받아 온다.
 *
 * `credentialOf` 는 저장된 값을 그대로 읽는 순수 함수라 **토큰이 비었는지 모른다.** 비면
 * `Bearer undefined` 가 나가고, 넥슨은 그것을 401 이 아니라 **400 `OPENAPI00004`** 로 답한다.
 * 그 코드는 앱에서 `이 기간은 조회할 수 없습니다` 가 되어, 날짜 문제가 아닌데 날짜 문제로
 * 보인다(실측 2026-09-27).
 *
 * 그래서 토큰을 챙기는 자리가 부르기 **앞**에 있어야 한다. 401 재시도만으로는 못 잡는다.
 *   - 토큰이 아예 없는 경우(저장 형식을 바꾸기 전에 로그인한 기기)
 *   - 넥슨이 401 이 아닌 코드로 답하는 경우
 *
 * @example const credential = await currentCredential()
 */
import { credentialOf } from '../../lib/nexon-credential'
import { getAuthConfig } from '../../storage/api-key'
import type { NexonAuthConfig, NexonCredential } from '../../types/auth'
import { renewNexonAccessToken } from './renew-access-token'

/**
 * 만료 직전을 미리 받아 오는 여유.
 *
 * 딱 만료 시각에 받으러 가면 넥슨을 부르는 사이에 죽어 401 이 온다. 서버의 갱신 여유와 같은
 * 값이라 두 층이 같은 선을 본다.
 */
const RENEW_MARGIN_MS = 60 * 1000

/** 지금 받아 와야 하나. 값이 없거나 만료 시각을 못 읽어도 받아 온다. */
function needsToken(login: NonNullable<NexonAuthConfig['login']>, now: Date): boolean {
  if (typeof login.accessToken !== 'string' || login.accessToken === '') return true

  const expiresAt = Date.parse(login.accessExpiresAt ?? '')
  if (Number.isNaN(expiresAt)) return true
  return expiresAt - RENEW_MARGIN_MS <= now.getTime()
}

export async function currentCredential(now: Date = new Date()): Promise<NexonCredential | null> {
  // `.catch()` 가 아니라 `try` 인 것은 **마이크로태스크 하나 차이** 때문이다. 체인을 한 칸
  // 늘리면 로스터가 캐시 stub 을 흘린 뒤에야 `character/list` 가 출발해, 첫 그림과 조회 시작
  // 순서가 뒤집힌다(그 순서를 고정한 테스트가 있다).
  let config: NexonAuthConfig | null
  try {
    config = await getAuthConfig()
  } catch {
    config = null
  }
  const login = config?.login
  if (login == null || !needsToken(login, now)) return credentialOf(config)

  const accessToken = await renewNexonAccessToken()
  if (accessToken !== null) return { kind: 'login', value: accessToken }

  // 세션까지 죽었다. **토큰 없는 로그인을 내주지 않는다** - 그것이 `Bearer undefined` 의 출처다.
  // 남은 키가 있으면 그것으로 간다. 재로그인은 화면이 따로 띄운다.
  const key = config?.apiKeys[0]
  return key === undefined ? null : { kind: 'apiKey', value: key.value }
}
