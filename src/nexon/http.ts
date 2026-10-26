import {
  NexonApiError,
  NexonAuthError,
  NexonBadRequestError,
  NexonMaintenanceError,
  NexonNetworkError,
  NexonRateLimitError,
  NexonSignInRequiredError,
  type NexonMaintenanceScope,
} from './errors'
import { markDeveloperKeyDead, nextDeveloperKey } from './developer-keys'
import type { StreamLine, StreamTask } from '../server/friends-stream'
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
 * 넥슨으로 가는 둘은 주소가 같고 **무엇을 싣는가**만 다르다. 로그인 + 프렌즈는 넥슨이 아니라
 * 우리 서버의 스트림으로 가므로 여기 없다(`requestViaStream`).
 *   API 키 자격        `x-nxopen-api-key`  사용자 키
 *   로그인 + 그 밖      `x-nxopen-api-key`  개발자 키
 */
function routeOf(path: string, credential: NexonCredential): Route {
  const url = `${API_BASE_URL}${path}`
  if (credential.type === 'key') {
    return { url, headers: { 'x-nxopen-api-key': credential.value }, developerKey: null }
  }

  // Open ID 가 안 여는 경로다. 로그인 사용자는 자기 키가 없으니 번들에 박은 키로 부른다.
  const developerKey = nextDeveloperKey()
  if (developerKey === null) {
    // 빈 키를 실으면 넥슨이 400 을 주고, 그 400 은 사용자에게 키가 잘못됐다 로 보인다.
    throw new NexonNetworkError(`넥슨 로그인으로는 부를 수 없는 경로입니다: ${bareOf(path)}`)
  }

  return { url, headers: { 'x-nxopen-api-key': developerKey }, developerKey }
}

/** 물음표 앞. 확률 기록이 날짜로, 스케줄러가 ocid 로 걸러 와서 경로만 떼야 프렌즈인지 가려진다. */
function bareOf(path: string): string {
  return path.split('?')[0] ?? path
}

/**
 * 넥슨에 한 번 묻는다. 자격이 로그인이고 프렌즈 경로면 **우리 서버의 스트림을 거친다.**
 *
 * **자격을 문자열이 아니라 객체로 받는 이유가 이것이다.** 전송 경로가 갈리는 자리를 이 파일
 * 하나로 모은다.
 *
 * @param credential `lib/nexon-credential` 의 `credentialOf` 가 고른다
 */
export async function requestJson<T>(path: string, credential: NexonCredential): Promise<T> {
  if (credential.type === 'login' && FRIENDS_PATHS.includes(bareOf(path))) {
    return requestViaStream<T>(path, credential.value)
  }
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
 * 하나뿐이다. 개발자 키가 죽었으면 그 키를 빼고 남은 키로 간다. `한 번 더 부르면 되는` 실패라
 * 사용자에게 알릴 것이 없다.
 */
function retryWith(
  _path: string,
  credential: NexonCredential,
  error: unknown,
): Promise<NexonCredential | null> {
  // 개발자 키가 죽었다. 뺀 표시는 남아 있어 다음 요청부터는 처음부터 산 키로 간다.
  const dead = deadDeveloperKeyOf(error)
  if (dead === null) return Promise.resolve(null)
  markDeveloperKeyDead(dead)
  // 남은 키가 없으면 원래 실패를 올린다. `routeOf` 가 다시 던질 뿐이다.
  return Promise.resolve(nextDeveloperKey() === null ? null : credential)
}

/**
 * 우리 서버의 프렌즈 스트림을 부르는 함수. **앱이 부팅 때 꽂는다.**
 *
 * `nexon/` 이 우리 서버를 직접 부르면 계층이 거꾸로 선다. 그래서 방향을 여기서 뒤집는다
 * (`native/ports.ts` 와 같은 태도). 안 꽂혀 있으면 로그인 자격의 프렌즈 조회는 못 닿은 것으로 던진다.
 */
export type FriendsStream = (session: string, tasks: readonly StreamTask[]) => Promise<StreamLine[]>

let friendsStream: FriendsStream | null = null

/** 부팅이 한 번 부른다. */
export function setFriendsStream(stream: FriendsStream | null): void {
  friendsStream = stream
}

/** 테스트가 갈아끼운다. 이름을 가른 것은 부팅 배선과 섞이지 않게 하려는 것이다. */
export const setFriendsStreamForTest = setFriendsStream

/**
 * 점검 응답과 성공 응답을 받아 가는 쪽. **앱이 부팅 때 꽂는다**(`setFriendsStream` 과 같은 이유).
 *
 * 경로는 물음표 앞이다. 메이플스토리 API 점검은 경로마다 막히고 풀리는 것이 달라, 받는 쪽이 막혔던 경로를 기억한다.
 */
export interface MaintenanceReporter {
  maintenance(scope: NexonMaintenanceScope, path: string): void
  succeeded(path: string): void
}

let maintenanceReporter: MaintenanceReporter | null = null

/** 부팅이 한 번 부른다. 테스트는 `null` 로 걷는다. */
export function setMaintenanceReporter(reporter: MaintenanceReporter | null): void {
  maintenanceReporter = reporter
}

/** 이 응답이 점검인가. 상태와 코드가 함께 맞아야 한다. 넥슨 문서의 짝이 그렇다. */
function maintenanceScopeOf(status: number, code: string | null | undefined): NexonMaintenanceScope | null {
  if (status === 400 && code === 'OPENAPI00010') return 'game'
  if (status === 503 && code === 'OPENAPI00011') return 'api'
  return null
}

/** 점검을 알리고 던질 에러를 만든다. 알림을 여기 두어야 직접 부른 것과 스트림이 빠짐없이 같이 알린다. */
function maintenanceErrorOf(scope: NexonMaintenanceScope, path: string): NexonMaintenanceError {
  maintenanceReporter?.maintenance(scope, bareOf(path))
  return new NexonMaintenanceError(
    scope === 'game' ? '메이플스토리 API 점검 중입니다 (OPENAPI00010)' : '넥슨 Open API 점검 중입니다 (OPENAPI00011)',
    scope,
  )
}

/** 경로와 쿼리를 서버 작업으로. 내역은 `date=`, 스케줄러는 `ocid=` 와 있으면 `date=` 를 든다. */
function taskOf(path: string): StreamTask {
  const [bare, query = ''] = path.split('?')
  const params = new URLSearchParams(query)
  const kind = (bare ?? path).slice('/maplestory/v1/'.length).split('/').pop() ?? ''
  if (kind === 'list') return { kind: 'character-list' }
  if (kind === 'character-state') {
    const date = params.get('date')
    return { kind, ocid: params.get('ocid') ?? '', ...(date === null ? {} : { date }) }
  }
  if (kind === 'cube' || kind === 'starforce' || kind === 'potential' || kind === 'soul-potential') {
    return { kind, date: params.get('date') ?? '' }
  }
  throw new NexonNetworkError(`프렌즈 경로가 아닙니다: ${path}`)
}

/** 같은 작업의 줄인가. 서버가 작업 필드를 그대로 되돌려 준다. */
function isOf(line: StreamLine, task: StreamTask): boolean {
  if (line.t === 'end' || line.kind !== task.kind) return false
  const date = 'date' in task ? task.date : undefined
  const ocid = 'ocid' in task ? task.ocid : undefined
  return line.date === date && line.ocid === ocid
}

/**
 * 쪽 여럿을 응답 하나로. 내역의 `*_history` 배열을 잇고 `next_cursor` 는 `null` 이다.
 *
 * 서버가 커서를 따라 끝까지 받아 주므로 앱은 이어받을 일이 없다. 부르는 쪽의 커서 고리는 한 번에 끝난다.
 */
function mergePages(bodies: readonly unknown[]): unknown {
  const first = bodies[0]
  if (bodies.length <= 1 || typeof first !== 'object' || first === null) return first ?? {}
  const merged: Record<string, unknown> = { ...(first as Record<string, unknown>) }
  for (const [key, value] of Object.entries(merged)) {
    if (!Array.isArray(value)) continue
    merged[key] = bodies.flatMap((body) => {
      const rows = (body as Record<string, unknown>)[key]
      return Array.isArray(rows) ? rows : []
    })
  }
  merged.next_cursor = null
  return merged
}

/** `fail` 줄을 넥슨 에러 어휘로. 서버가 status 와 넥슨 코드를 그대로 전해 줘서 직접 부른 것과 같이 가른다. */
function errorOfFail(path: string, status: number, code: string | undefined): NexonApiError {
  const scope = maintenanceScopeOf(status, code)
  if (scope !== null) return maintenanceErrorOf(scope, path)
  if (status === 401 || status === 403) return new NexonSignInRequiredError('넥슨 로그인이 만료되었습니다')
  if (status === 429) return new NexonRateLimitError('Nexon API 호출 한도를 초과했습니다 (OPENAPI00007)')
  if (status === 400) {
    return new NexonBadRequestError(
      `Nexon API가 요청을 거부했습니다 (code: ${code ?? '알 수 없음'})`,
      code ?? null,
    )
  }
  return new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${status})`)
}

/**
 * 로그인 자격의 프렌즈 조회. 작업 하나를 스트림에 보내고 그 작업의 쪽들을 응답 하나로 되돌린다.
 *
 * 서버의 거절은 둘로 가른다. 401 은 세션이 죽은 것이라 재로그인이고, 503 은 상한이라 못 닿은 것과
 * 같이 다음 회차에 다시 온다.
 */
async function requestViaStream<T>(path: string, session: string): Promise<T> {
  if (friendsStream === null) throw new NexonNetworkError('프렌즈 스트림이 배선되지 않았습니다')
  const task = taskOf(path)

  let lines: StreamLine[]
  try {
    lines = await friendsStream(session, [task])
  } catch (error) {
    const status = (error as { status?: unknown }).status
    if (status === 401) throw new NexonSignInRequiredError('넥슨 로그인이 만료되었습니다', { cause: error })
    throw new NexonNetworkError('프렌즈 조회에 실패했습니다', { cause: error })
  }

  const mine = lines.filter((line) => isOf(line, task))
  const fail = mine.find((line) => line.t === 'fail')
  if (fail !== undefined && fail.t === 'fail') throw errorOfFail(path, fail.status, fail.code)

  const pages = mine.filter((line) => line.t === 'page').map((line) => (line.t === 'page' ? line.body : null))
  const done = mine.some((line) => line.t === 'done')
  if (!done) {
    const end = lines.find((line) => line.t === 'end')
    if (end?.t === 'end' && end.reason === 'relogin') {
      throw new NexonSignInRequiredError('넥슨 로그인이 만료되었습니다')
    }
    throw new NexonNetworkError('프렌즈 조회가 끝나기 전에 끊겼습니다')
  }
  maintenanceReporter?.succeeded(bareOf(path))
  return mergePages(pages) as T
}

/**
 * 이 실패가 **개발자 키를 빼야 하는 것**인가. 맞으면 그 키.
 *
 * 무효(401/403 · 400 `OPENAPI00005`)와 한도 초과(429)뿐이다. 다른 400 은 키가 아니라 ocid·날짜
 * 문제라 키를 빼면 멀쩡한 키가 사라진다.
 */
function deadDeveloperKeyOf(error: unknown): string | null {
  if (!(error instanceof NexonApiError)) return null
  if (error.developerKey === undefined) return null
  const 키문제 =
    error instanceof NexonAuthError ||
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
    // 자격의 종류가 처방을 가른다. **액세스 토큰으로 부르다 받은 401** 은 그 토큰이 죽은 것이라
    // 탓할 키가 없고, 사용자가 할 일은 키 재입력이 아니라 재로그인이다. 개발자 키로 부른 회차는
    // **키가 죽은 것**이라 이쪽이 아니다.
    throw 실어서(
      credential.type === 'login' && developerKey === null
        ? new NexonSignInRequiredError('넥슨 로그인이 만료되었습니다')
        : new NexonAuthError('Nexon API 키가 유효하지 않습니다'),
    )
  }
  if (response.status === 429) {
    throw 실어서(new NexonRateLimitError('Nexon API 호출 한도를 초과했습니다 (OPENAPI00007)'))
  }
  if (response.status === 400) {
    const code = await readErrorCode(response)
    const scope = maintenanceScopeOf(400, code)
    if (scope !== null) throw 실어서(maintenanceErrorOf(scope, path))
    throw 실어서(
      new NexonBadRequestError(
        `Nexon API가 요청을 거부했습니다 (code: ${code ?? '알 수 없음'})`,
        code,
      ),
    )
  }
  if (response.status === 503) {
    // 코드가 없는 503 은 아래로 내려가 종전대로 못 닿은 것이 된다.
    const scope = maintenanceScopeOf(503, await readErrorCode(response))
    if (scope !== null) throw 실어서(maintenanceErrorOf(scope, path))
  }
  if (!response.ok) {
    throw 실어서(
      new NexonNetworkError(`Nexon API가 오류 응답을 반환했습니다 (status: ${response.status})`),
    )
  }

  let body: T
  try {
    body = (await response.json()) as T
  } catch (error) {
    throw new NexonNetworkError('Nexon API 응답을 JSON으로 파싱하지 못했습니다', { cause: error })
  }
  maintenanceReporter?.succeeded(bareOf(path))
  return body
}
