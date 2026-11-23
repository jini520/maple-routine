/**
 * 넥슨 계정을 우리 서버에 알리는 경로. 메이플 ID 알리기와 부계정 등록 · 해제다. 값은 모두 메이플 ID 해시이고 키 해시는 보내지 않는다.
 */
import { ERROR_CODES, type SubAccountRejection } from './error-codes'
import { jsonCall, writeCall, type SendResult } from './write'

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

/** 등록의 결과. 거절은 409 의 `code` 그대로이고, `failed` 는 응답이 없거나 그 밖의 거절이라 다음 회차에 다시 본다. */
export type RegisterSubAccountResult = 'registered' | SubAccountRejection | 'failed'

const SUB_ACCOUNT_REJECTIONS: readonly string[] = [
  ERROR_CODES.sameAccount,
  ERROR_CODES.registeredElsewhere,
  ERROR_CODES.hasSubAccounts,
  ERROR_CODES.loginIsSubAccount,
]

function isSubAccountRejection(code: unknown): code is SubAccountRejection {
  return typeof code === 'string' && SUB_ACCOUNT_REJECTIONS.includes(code)
}

/**
 * 메이플 ID 의 넥슨 계정을 세션의 로그인에 부계정으로 등록한다. 같은 로그인이 다시 등록해도 서버는 그대로다.
 *
 * @param mapleIds 그 키의 메이플 ID 해시. 서버가 넥슨 계정을 찾는 값이라 비울 수 없다
 */
export async function registerSubAccountOnServer(
  sessionHeaders: Record<string, string>,
  mapleIds: readonly string[],
): Promise<RegisterSubAccountResult> {
  const result = await jsonCall('/me/sub-accounts', {
    method: 'POST',
    headers: { ...sessionHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ mapleIds }),
  })
  if (result.outcome === 'no-response') return 'failed'
  if (result.ok) return 'registered'
  const code = (result.body as { code?: unknown } | null)?.code
  return result.status === 409 && isSubAccountRejection(code) ? code : 'failed'
}

/**
 * 메이플 ID 의 넥슨 계정과 세션의 로그인을 잇는 등록을 지운다. 등록이 없어도 서버는 받았다고 답한다.
 *
 * @param mapleIds 그 부계정의 메이플 ID 해시. 비울 수 없다
 */
export function unregisterSubAccountOnServer(
  sessionHeaders: Record<string, string>,
  mapleIds: readonly string[],
): Promise<SendResult> {
  return writeCall('/me/sub-accounts', {
    method: 'DELETE',
    headers: { ...sessionHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ mapleIds }),
  })
}
