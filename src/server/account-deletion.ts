/**
 * 계정 삭제의 서버 경로. 삭제는 30일 예약이고, 유예 중에 다시 로그인한 앱이 예약을 묻고 취소한다.
 */
import { BASE_URL, writeCall, type SendResult } from './write'

/** 묻는 데 쓰는 시간. 로그인 직후 한 번 묻는 것이라 길게 기다리지 않는다. */
const TIMEOUT_MS = 8_000

/** 계정 삭제를 예약한다. 서버는 세션을 바로 지우고, 사람과 열쇠는 유예가 끝난 밤에 지운다. */
export function deleteMeOnServer(headers: Record<string, string>): Promise<SendResult> {
  return writeCall('/me', { method: 'DELETE', headers })
}

/**
 * 삭제 예약. 예약이 없으면 `null` 이다. **못 받으면 던진다.** 부르는 쪽이 묻지 않고 넘어갈지를 정한다.
 *
 * @returns 지울 때(ISO)
 */
export async function fetchAccountDeletion(headers: Record<string, string>): Promise<{ deletesAt: string } | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${BASE_URL}/me/deletion`, { headers, signal: controller.signal })
    if (response.status !== 200) throw new Error(`삭제 예약을 묻지 못했다: ${response.status}`)
    const body = (await response.json()) as { deletion?: { deletesAt?: unknown } | null }
    const deletesAt = body.deletion?.deletesAt
    return typeof deletesAt === 'string' ? { deletesAt } : null
  } finally {
    clearTimeout(timer)
  }
}

export function cancelAccountDeletion(headers: Record<string, string>): Promise<SendResult> {
  return writeCall('/me/deletion', { method: 'DELETE', headers })
}
