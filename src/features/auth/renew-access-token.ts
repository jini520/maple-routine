/**
 * 새 액세스 토큰을 받아 저장한다. **`nexon/http.ts` 가 401 을 받았을 때 부른다.**
 *
 * 토큰이 30분이라 강화 내역처럼 긴 회차는 중간에 만료된다. 그때 여기서 받아 오면 부르던 쪽이
 * 그 자리에서 한 번 더 시도한다.
 *
 * **갱신 자체는 서버가 한다.** 넥슨 갱신이 `client_secret` 을 요구해 앱은 못 한다. 앱이 하는
 * 일은 세션을 내밀고 받은 값을 적는 것뿐이다.
 *
 * 세션까지 죽었으면 서버가 401 을 주고 이 함수는 `null` 을 돌려준다. 부르는 쪽은 그때 원래
 * 401 을 올리고, 화면이 그것을 재로그인 알림으로 바꾼다.
 */
import { fetchNexonAccessToken } from '../../server/nexon-auth'
import { getAuthConfig, updateNexonAccessToken } from '../../storage/api-key'

export async function renewNexonAccessToken(): Promise<string | null> {
  const session = (await getAuthConfig().catch(() => null))?.login?.session
  if (session === undefined) return null

  const tokens = await fetchNexonAccessToken(session)
  if (tokens === null) return null

  // 못 적어도 이번 회차는 새 토큰으로 돈다. 다음 부팅에 한 번 더 받을 뿐이다.
  await updateNexonAccessToken(tokens.accessToken, tokens.accessExpiresAt).catch(() => undefined)
  return tokens.accessToken
}
