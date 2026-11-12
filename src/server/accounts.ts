/**
 * 넥슨 계정을 우리 서버에 알리는 두 경로. 메이플 ID 알리기와 부계정 등록이다. 값은 모두 해시다.
 */
import { jsonCall } from './write'

export type ReportMapleIdsResult =
  | { outcome: 'sent'; mapleIds: string[] }
  | { outcome: 'no-response' }
  | { outcome: 'rejected'; status: number }

/**
 * 신원의 넥슨 계정에 메이플 ID 를 알린다. 답은 그 계정이 서버에 가진 메이플 ID 해시 전부다.
 *
 * @param mapleIds 메이플 ID 해시(`nexonIdHashHex`)
 */
export async function reportMapleIdsToServer(
  headers: Record<string, string>,
  mapleIds: readonly string[],
): Promise<ReportMapleIdsResult> {
  const result = await jsonCall('/me/maple-ids', {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ mapleIds }),
  })
  if (result.outcome === 'no-response') return result
  const ids = (result.body as { mapleIds?: unknown } | null)?.mapleIds
  if (!result.ok || !Array.isArray(ids)) return { outcome: 'rejected', status: result.status }
  return { outcome: 'sent', mapleIds: ids.filter((one): one is string => typeof one === 'string') }
}

/** 등록의 결과. `failed` 는 응답이 없거나 그 밖의 거절이라 다음 회차에 다시 본다. */
export type RegisterSubAccountResult = 'registered' | 'same_account' | 'limit' | 'failed'

/**
 * 키의 넥슨 계정을 세션의 로그인에 부계정으로 등록한다. 같은 키를 다시 등록해도 서버는 그대로다.
 *
 * @param apiKeyHash 부계정 키의 SHA-256(`apiKeyHashHex`)
 * @param mapleIds 그 키의 메이플 ID 해시. 서버가 같은 넥슨 ID 인지 가르는 값이라 비울 수 없다
 */
export async function registerSubAccountOnServer(
  sessionHeaders: Record<string, string>,
  apiKeyHash: string,
  mapleIds: readonly string[],
): Promise<RegisterSubAccountResult> {
  const result = await jsonCall('/me/sub-accounts', {
    method: 'POST',
    headers: { ...sessionHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ apiKeyHash, mapleIds }),
  })
  if (result.outcome === 'no-response') return 'failed'
  if (result.ok) return 'registered'
  const code = (result.body as { code?: unknown } | null)?.code
  if (result.status === 409 && code === 'same_account') return 'same_account'
  if (result.status === 409 && code === 'sub_account_limit') return 'limit'
  return 'failed'
}
