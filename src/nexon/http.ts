import {
  NexonApiError,
  NexonAuthError,
  NexonBadRequestError,
  NexonNetworkError,
  NexonRateLimitError,
} from './errors'
import { markDeveloperKeyDead, nextDeveloperKey } from './developer-keys'
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

/** 어디로 보내고 무엇을 실을지 정해진 한 벌. `developerKey` 는 그 키로 실패했을 때 뺄 값이다. */
interface Route {
  url: string
  headers: Record<string, string>
  /** 개발자 키로 부르는 회차면 그 키. 아니면 `null`. */
  developerKey: string | null
}

/**
 * 어디로 보내고 무엇을 실을까. **전송이 갈리는 자리는 여기 하나다.**
 *
 * client 파일들은 이것을 모른다. 갈림이 그쪽으로 흩어지면 새는 자리를 못 센다.
 *
 * 넥슨 주소는 셋 다 같다. 갈리는 것은 **무엇을 싣는가**뿐이다.
 *   API 키 자격        `x-nxopen-api-key`  사용자 키
 *   로그인 + 프렌즈     `Authorization`     액세스 토큰
 *   로그인 + 그 밖      `x-nxopen-api-key`  개발자 키
 */
function routeOf(path: string, credential: NexonCredential): Route {
  const url = `${API_BASE_URL}${path}`
  if (credential.kind === 'apiKey') {
    return { url, headers: { 'x-nxopen-api-key': credential.value }, developerKey: null }
  }

  // 물음표 뒤는 경로가 아니다. 확률 기록이 날짜로, 스케줄러가 ocid 로 걸러 온다.
  const bare = path.split('?')[0] ?? path
  if (FRIENDS_PATHS.includes(bare)) {
    return { url, headers: { Authorization: `Bearer ${credential.value}` }, developerKey: null }
  }

  // Open ID 가 안 여는 경로다. 로그인 사용자는 자기 키가 없으니 번들에 박은 키로 부른다.
  const developerKey = nextDeveloperKey()
  if (developerKey === null) {
    // 빈 키를 실으면 넥슨이 400 을 주고, 그 400 은 사용자에게 키가 잘못됐다 로 보인다.
    throw new NexonNetworkError(`넥슨 로그인으로는 부를 수 없는 경로입니다: ${bare}`)
  }

  return { url, headers: { 'x-nxopen-api-key': developerKey }, developerKey }
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
  try {
    return await requestOnce<T>(path, credential)
  } catch (error) {
    // 재시도는 **한 번뿐**이다. 두 번째도 같은 실패면 올린다. 그래야 안 도는 것이 보장된다.
    const 다시 = await retryWith(path, credential, error)
    if (다시 === null) throw error
    return (await requestOnce<T>(path, 다시)) as T
  }
}

/**
 * 이 실패를 **다시 해 볼 수 있나.** 할 수 있으면 그때 쓸 자격, 없으면 `null`.
 *
 * 둘뿐이다. 개발자 키가 죽었거나(그 키를 빼고 남은 키로) 액세스 토큰이 만료됐거나(새로 받아서).
 * 둘 다 `한 번 더 부르면 되는` 실패라, 사용자에게 알릴 것이 없다.
 */
async function retryWith(
  path: string,
  credential: NexonCredential,
  error: unknown,
): Promise<NexonCredential | null> {
  // 개발자 키가 죽었다. 뺀 표시는 남아 있어 다음 요청부터는 처음부터 산 키로 간다.
  const dead = deadDeveloperKeyOf(error)
  if (dead !== null) {
    markDeveloperKeyDead(dead)
    // 남은 키가 없으면 원래 실패를 올린다. `routeOf` 가 다시 던질 뿐이다.
    return nextDeveloperKey() === null ? null : credential
  }

  // 액세스 토큰이 30분을 넘겼다. **키 자격은 여기 안 온다** - 키가 죽은 것이라 받아 올 토큰이
  // 없다. 세션까지 죽었으면 갱신이 `null` 을 주고, 부르는 쪽이 그 401 을 보고 재로그인을 띄운다.
  if (!(error instanceof NexonAuthError) || credential.kind !== 'login') return null
  const renewed = await renewAccessToken?.()
  return renewed == null ? null : { kind: 'login', value: renewed }
}

/**
 * 새 액세스 토큰을 받아 오는 함수. **앱이 부팅 때 꽂는다.**
 *
 * `nexon/` 이 저장소와 우리 서버를 직접 부르면 계층이 거꾸로 선다. 그래서 방향을 여기서
 * 뒤집는다(`native/ports.ts` 와 같은 태도). 안 꽂혀 있으면 재시도하지 않고 401 을 그대로 올린다.
 */
let renewAccessToken: (() => Promise<string | null>) | null = null

/** 부팅이 한 번 부른다. */
export function setAccessTokenRenewer(renew: (() => Promise<string | null>) | null): void {
  renewAccessToken = renew
}

/** 테스트가 갈아끼운다. 이름을 가른 것은 부팅 배선과 섞이지 않게 하려는 것이다. */
export const setAccessTokenRenewerForTest = setAccessTokenRenewer

/**
 * 이 실패가 **개발자 키를 빼야 하는 것**인가. 맞으면 그 키.
 *
 * 무효(400 `OPENAPI00005`)와 한도 초과(429) 둘뿐이다. 다른 400 은 키가 아니라 ocid·날짜
 * 문제라 키를 빼면 멀쩡한 키가 사라진다.
 */
function deadDeveloperKeyOf(error: unknown): string | null {
  if (!(error instanceof NexonApiError)) return null
  if (error.developerKey === undefined) return null
  const 키문제 =
    error instanceof NexonRateLimitError ||
    (error instanceof NexonBadRequestError && error.code === 'OPENAPI00005')
  return 키문제 ? error.developerKey : null
}

async function requestOnce<T>(path: string, credential: NexonCredential): Promise<T> {
  const { url, headers, developerKey } = routeOf(path, credential)
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

  // 어느 개발자 키로 난 실패인지 실어 보낸다. 부르는 쪽이 그 키를 뺄지 정한다.
  const 실어서 = <E extends NexonApiError>(error: E): E => {
    if (developerKey !== null) error.developerKey = developerKey
    return error
  }

  if (response.status === 401 || response.status === 403) {
    throw 실어서(new NexonAuthError('Nexon API 키가 유효하지 않습니다'))
  }
  if (response.status === 429) {
    throw 실어서(new NexonRateLimitError('Nexon API 호출 한도를 초과했습니다 (OPENAPI00007)'))
  }
  if (response.status === 400) {
    const code = await readErrorCode(response)
    throw 실어서(
      new NexonBadRequestError(
        `Nexon API가 요청을 거부했습니다 (code: ${code ?? '알 수 없음'})`,
        code,
      ),
    )
  }
  if (!response.ok) {
    throw 실어서(
      new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${response.status})`),
    )
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new NexonNetworkError('Nexon API 응답을 JSON으로 파싱하지 못했습니다', { cause: error })
  }
}
