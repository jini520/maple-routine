/**
 * 드롭 판매가를 우리 서버로 보내는 두 창구. 시세 추이의 표본이다(이슈 #610).
 *
 * **여기만 `settlement.ts` · `notices.ts` 와 모양이 다르다.** 그 둘은 `catch` 와 비-200 을 **둘 다
 * `null`** 로 합친다. 조회라서 앱이 둘에 같은 일을 하기 때문인데, 여기서는 그 구분이 **유일한
 * 판정 재료**다.
 *
 * | | 시도로 세나 |
 * |---|---|
 * | `fetch` 가 던졌다 (연결 실패 · 타임아웃) | 안 센다. 다음 회차에 그대로 다시 시도 |
 * | 응답이 왔다 (상태 코드가 무엇이든) | 센다. 서버가 답했으니 요청 자체에 문제가 있을 수 있다 |
 *
 * 세는 쪽이 5회가 되면 그 건을 버린다. 안 세면 비행기 모드로 앱을 다섯 번 켠 사용자가 그동안
 * 쌓인 것을 전부 잃는다.
 */
import type { DropPricePayload } from '../types/drop-price'

const BASE_URL = 'https://mapleroutine.store/v1'

/**
 * 얼마나 기다리나. 조회(4~8초)보다 길다.
 *
 * 사용자를 기다리게 하지 않는다 - 기기 저장이 이미 끝난 뒤에 배경으로 나가는 요청이다. 짧게
 * 끊으면 느린 망에서 멀쩡한 전송이 실패로 적히고, 그 실패가 시도 횟수를 안 쓰더라도 대기 표에
 * 줄을 남긴다.
 */
const TIMEOUT_MS = 10_000

/**
 * 보내 본 결과.
 *
 * `'no-response'` 와 `'rejected'` 를 합치지 않는 것이 이 파일의 요점이다. 합치면 오프라인이
 * 서버 거절과 같아져, 네트워크가 없는 동안 시도 횟수가 다 타 버린다.
 */
export type SendResult =
  | { outcome: 'sent' }
  | { outcome: 'no-response' }
  | { outcome: 'rejected'; status: number }

/** 응답을 못 받았는지 받았는지만 가려 돌려준다. 본문은 안 본다 - 서버가 `{ ok: true }` 만 준다. */
async function call(path: string, init: RequestInit): Promise<SendResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal })
    if (response.ok) return { outcome: 'sent' }
    return { outcome: 'rejected', status: response.status }
  } catch {
    // 연결이 안 됐거나 상한에 걸려 끊겼다. 서버가 답한 적이 없으므로 요청을 탓할 근거가 없다.
    return { outcome: 'no-response' }
  } finally {
    clearTimeout(timer)
  }
}

/** 가격 한 건을 올린다. 같은 값을 다시 보내도 서버에 줄이 안 늘어난다. */
export async function sendDropPrice(
  headers: Record<string, string>,
  one: DropPricePayload,
): Promise<SendResult> {
  return call('/drop-prices', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(one),
  })
}

/**
 * **탈퇴를 알린다.** 연결 해제가 부른다.
 *
 * 메서드가 `DELETE` 지만 서버는 **행을 안 지운다.** 탈퇴 표시를 적고, 세션만 지우고, 시세 표본은
 * 그대로 둔다 - 시세 추이가 사람이 들어왔다 나갔다고 흔들리지 않아야 한다. 같은 키를 다시 넣으면
 * 그 사람이 되살아난다.
 *
 * 가격 한 건을 빼는 `deleteDropPrice` 와 다른 축이다. 저쪽은 그 기록의 가격이고 이쪽은 사람이다.
 */
export async function deleteMeOnServer(headers: Record<string, string>): Promise<SendResult> {
  return call('/me', { method: 'DELETE', headers })
}

/**
 * 그 기록의 가격을 뺀다. 기기에서 사라졌거나 기록 안함으로 바뀐 경우다.
 *
 * 서버는 줄을 안 지우고 `deleted_at` 만 채운다. 다시 적으면 그 칸이 비워져 되살아난다.
 */
export async function deleteDropPrice(
  headers: Record<string, string>,
  dropRecordId: string,
): Promise<SendResult> {
  return call(`/drop-prices/${encodeURIComponent(dropRecordId)}`, {
    method: 'DELETE',
    headers,
  })
}
