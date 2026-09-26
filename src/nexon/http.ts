import { NexonAuthError, NexonBadRequestError, NexonNetworkError, NexonRateLimitError } from './errors'
import type { NexonCredential } from '../types/auth'

interface NexonErrorBody {
  error?: { name?: string; message?: string }
}

/**
 * 비-2xx 응답 본문에서 꺼낸 넥슨 에러 코드(`error.name`).
 * `message` 는 영문 원문이라 화면에 새면 안 되므로(error-resilience 원칙 4) 여기서 버린다.
 * 본문이 JSON이 아니거나 형태가 다르면 null. 호출 측이 "알 수 없는 실패"로 다룬다.
 */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as NexonErrorBody
    return body?.error?.name ?? null
  } catch {
    return null
  }
}

const API_BASE_URL = 'https://open.api.nexon.com'


const REQUEST_TIMEOUT_MS = 10_000

/**
 * 넥슨 로그인으로 열리는 경로. **서버의 `FRIENDS_PATHS` 와 글자까지 같아야 한다.**
 *
 * 한쪽만 늘리면 그 경로만 404 가 오고 원인이 앱에서는 안 보인다. 늘릴 때는 넥슨 등록의 활용
 * 데이터 항목도 함께 켜야 한다.
 */
const FRIENDS_PATHS: readonly string[] = [
  '/maplestory/v1/character/list',
  '/maplestory/v1/history/cube',
  '/maplestory/v1/history/starforce',
  '/maplestory/v1/history/potential',
  '/maplestory/v1/history/soul-potential',
  '/maplestory/v1/scheduler/character-state',
]

/**
 * 어디로 보내고 무엇을 실을까. **전송이 갈리는 자리는 여기 하나다.**
 *
 * client 파일들은 이것을 모른다. 갈림이 그쪽으로 흩어지면 새는 자리를 못 센다.
 */
function routeOf(path: string, credential: NexonCredential): { url: string; headers: Record<string, string> } {
  if (credential.kind === 'apiKey') {
    return { url: `${API_BASE_URL}${path}`, headers: { 'x-nxopen-api-key': credential.value } }
  }

  // 물음표 뒤는 경로가 아니다. 확률 기록이 날짜로, 스케줄러가 ocid 로 걸러 온다.
  const bare = path.split('?')[0] ?? path
  if (!FRIENDS_PATHS.includes(bare)) {
    // Open ID 로 안 열리는 경로라 이 토큰으로는 보낼 곳이 없다. 조용히 보내면 401 이 오고,
    // 그 401 은 앱에 `로그인이 만료됐다` 로 보여 원인이 묻힌다. 답은 개발자 키로 부르는
    // 것이다(미배선 - 그 키로 남의 ocid 를 볼 수 있는지 아직 안 쟀다).
    throw new NexonNetworkError(`넥슨 로그인으로는 부를 수 없는 경로입니다: ${bare}`)
  }

  return { url: `${API_BASE_URL}${path}`, headers: { Authorization: `Bearer ${credential.value}` } }
}

/**
 * 넥슨에 한 번 묻는다. 자격이 로그인이면 **우리 서버를 거친다.**
 *
 * **자격을 문자열이 아니라 객체로 받는 이유가 이것이다.** 전송 경로가 갈리는 자리를 이 파일
 * 하나로 모은다.
 *
 * @param credential `lib/nexon-credential` 의 `credentialOf` 가 고른다
 */
export async function requestJson<T>(path: string, credential: NexonCredential): Promise<T> {
  const { url, headers } = routeOf(path, credential)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
  } catch (error) {
    throw new NexonNetworkError('Nexon API 요청에 실패했습니다', { cause: error })
  } finally {
    clearTimeout(timeoutId)
  }

  if (response.status === 401 || response.status === 403) {
    throw new NexonAuthError('Nexon API 키가 유효하지 않습니다')
  }
  if (response.status === 429) {
    throw new NexonRateLimitError('Nexon API 호출 한도를 초과했습니다 (OPENAPI00007)')
  }
  if (response.status === 400) {
    const code = await readErrorCode(response)
    throw new NexonBadRequestError(
      `Nexon API가 요청을 거부했습니다 (code: ${code ?? '알 수 없음'})`,
      code,
    )
  }
  if (!response.ok) {
    throw new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${response.status})`)
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new NexonNetworkError('Nexon API 응답을 JSON으로 파싱하지 못했습니다', { cause: error })
  }
}
