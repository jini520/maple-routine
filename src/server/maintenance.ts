/**
 * 우리 서버가 점검 중인지 묻는 조회. 서버가 아니라 nginx 가 앱 박스의 파일 하나로 답한다.
 *
 * 답은 셋이다. 모름을 따로 두는 것은 응답이 없는 것만으로는 점검과 장애를 가릴 수 없어서다. 모름을 점검 중으로 읽으면
 * 오프라인에서 앱이 잠기고, 점검 아님으로 읽으면 점검 중에 네트워크가 끊긴 기기가 열린다.
 */
import { API_BASE_URL } from './base-url'

/** 얼마나 기다리나. 부팅과 복귀마다 묻는 값이라 결산 조회와 같이 짧게 둔다. */
const TIMEOUT_MS = 4_000

export type ServerMaintenance =
  /** `until` 은 종료 예정 시각(ms). 운영자가 적지 않았으면 `null`. */
  | { state: 'on'; until: number | null }
  | { state: 'off' }
  | { state: 'unknown' }

/** 종료 예정 시각을 못 읽어도 점검 중인 것은 버리지 않는다. */
function toUntil(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** 던지지 않는다. 응답이 없거나 계약을 어기면 `unknown`. */
export async function fetchServerMaintenance(): Promise<ServerMaintenance> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${API_BASE_URL}/maintenance`, {
      headers: { 'cache-control': 'no-cache' },
      signal: controller.signal,
    })
    // 404 는 nginx 설정을 넣기 전의 답이다. 그때는 이 경로가 서버로 넘어가고 서버는 이 경로를 모른다.
    if (response.status === 204 || response.status === 404) return { state: 'off' }
    // nginx 는 속도 제한에 걸린 요청에도 503 을 낸다. 상태 코드로는 점검을 가리지 못한다.
    if (response.status !== 200) return { state: 'unknown' }

    const body = (await response.json()) as unknown
    // 공용 와이파이의 로그인 페이지는 어느 주소에나 200 을 준다. 표시가 있어야 점검이다.
    if (typeof body !== 'object' || body === null || (body as Record<string, unknown>).maintenance !== true) {
      return { state: 'unknown' }
    }
    return { state: 'on', until: toUntil((body as Record<string, unknown>).until) }
  } catch {
    return { state: 'unknown' }
  } finally {
    clearTimeout(timer)
  }
}
