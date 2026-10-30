/**
 * 기록을 우리 서버로 보내는 쓰기 호출의 공용 부분. 드롭 가격 · 강화 상황 알림 · 탈퇴가 함께 쓴다.
 *
 * | | 시도로 세나 |
 * |---|---|
 * | `fetch` 가 던졌다 (연결 실패 · 타임아웃) | 안 센다. 다음 회차에 그대로 다시 시도 |
 * | 응답이 왔다 (상태 코드가 무엇이든) | 센다. 서버가 답했으니 요청 자체에 문제가 있을 수 있다 |
 *
 * 세는 쪽이 5회가 되면 그 건을 버린다. 안 세면 비행기 모드로 앱을 다섯 번 켠 사용자가 그동안 쌓인 것을 전부 잃는다.
 */
import type { BatchItemResult } from '../types/server-records'

export const BASE_URL = 'https://mapleroutine.store/v1'

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

/** 묶음 전송의 결과. 보냈으면 건마다의 결과가 함께 온다. */
export type BatchSendResult =
  | { outcome: 'sent'; results: BatchItemResult[] }
  | { outcome: 'no-response' }
  | { outcome: 'rejected'; status: number }

async function request(path: string, init: RequestInit): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal })
  } catch {
    // 연결이 안 됐거나 상한에 걸려 끊겼다. 서버가 답한 적이 없으므로 요청을 탓할 근거가 없다.
    return null
  } finally {
    clearTimeout(timer)
  }
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

/** 기기에서 그 기록이 사라졌다고 알린다. 서버는 줄을 남기고 지운 것으로 표시한다. */
export function deleteRecord(headers: Record<string, string>, path: string, recordId: string): Promise<SendResult> {
  return writeCall(`${path}/${encodeURIComponent(recordId)}`, { method: 'DELETE', headers })
}

/**
 * 과거 기록 묶음을 올린다. 서버가 건마다 결과를 돌려준다. 본문이 기대한 모양이 아니면 거절로 본다.
 *
 * @param path `/boss-clears` 같은 종류의 경로. 뒤에 `/batch` 가 붙는다
 */
export async function postBatch(
  headers: Record<string, string>,
  path: string,
  items: readonly unknown[],
): Promise<BatchSendResult> {
  const response = await request(`${path}/batch`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  })
  if (response === null) return { outcome: 'no-response' }
  if (!response.ok) return { outcome: 'rejected', status: response.status }
  try {
    const body = (await response.json()) as { results?: unknown }
    if (!Array.isArray(body.results)) return { outcome: 'rejected', status: response.status }
    return { outcome: 'sent', results: body.results as BatchItemResult[] }
  } catch {
    return { outcome: 'rejected', status: response.status }
  }
}
