/**
 * 우리 서버로 보내는 쓰기 호출의 공용 부분. 강화 상황 알림 · 사용 로그 · 계정 삭제 · 계정 알리기가 함께 쓴다.
 *
 * | | 시도로 세나 |
 * |---|---|
 * | `fetch` 가 던졌다 (연결 실패 · 타임아웃) | 안 센다. 다음 회차에 그대로 다시 시도 |
 * | 응답이 왔다 (상태 코드가 무엇이든) | 센다. 서버가 답했으니 요청 자체에 문제가 있을 수 있다 |
 *
 * 세는 쪽이 5회가 되면 그 건을 버린다. 안 세면 비행기 모드로 앱을 다섯 번 켠 사용자가 그동안 쌓인 것을 전부 잃는다.
 */
import { API_BASE_URL } from './base-url'

/**
 * 얼마나 기다리나. 조회(4~8초)보다 길다. 기기 저장이 끝난 뒤 배경으로 나가는 요청이라 사용자를 기다리게 하지 않는다.
 * 짧게 끊으면 느린 망에서 멀쩡한 전송이 실패로 적힌다.
 */
const TIMEOUT_MS = 10_000

/**
 * 보내 본 결과. `'no-response'` 와 `'rejected'` 를 합치지 않는다. 합치면 오프라인이 서버 거절과 같아져 네트워크가 없는
 * 동안 시도 횟수가 다 타 버린다.
 */
export type SendResult =
  | { outcome: 'sent' }
  | { outcome: 'no-response' }
  | { outcome: 'rejected'; status: number }

async function request(path: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal })
  } catch {
    // 연결이 안 됐거나 상한에 걸려 끊겼다. 서버가 답한 적이 없으므로 요청을 탓할 근거가 없다.
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** 본문까지 읽은 응답. 본문이 JSON 이 아니면 `body` 가 `null` 이다. */
export type JsonCallResult =
  | { outcome: 'no-response' }
  | { outcome: 'answered'; ok: boolean; status: number; body: unknown }

/** 답의 본문이 필요한 호출. 응답을 못 받은 것과 받은 것을 가르고, 받았으면 본문을 JSON 으로 읽는다. */
export async function jsonCall(path: string, init: RequestInit): Promise<JsonCallResult> {
  const response = await request(path, init)
  if (response === null) return { outcome: 'no-response' }
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // 빈 본문(204)이거나 JSON 이 아니다. 상태 코드로만 가린다.
  }
  return { outcome: 'answered', ok: response.ok, status: response.status, body }
}

/** 응답을 못 받았는지 받았는지만 가려 돌려준다. 본문은 안 본다. */
export async function writeCall(path: string, init: RequestInit): Promise<SendResult> {
  const response = await request(path, init)
  if (response === null) return { outcome: 'no-response' }
  if (response.ok) return { outcome: 'sent' }
  return { outcome: 'rejected', status: response.status }
}

/** 한 건을 JSON 으로 올린다. */
export function postRecord(headers: Record<string, string>, path: string, body: unknown): Promise<SendResult> {
  return writeCall(path, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}
