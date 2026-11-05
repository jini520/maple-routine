/**
 * 키 사용자가 넥슨 로그인을 붙였을 때, 기기에서 지울 키의 해시를 보내 서버에서 로그인한 사람과 잇는 호출.
 */
import { postRecord, type SendResult } from './write'

/**
 * @param session 로그인 세션. 서버는 세션의 사람에 합친다
 * @param apiKeyHash 지울 키의 SHA-256(`apiKeyHashHex`)
 */
export function linkApiKeyOnServer(session: string, apiKeyHash: string): Promise<SendResult> {
  return postRecord({ Authorization: `Bearer ${session}` }, '/me/api-key-links', { apiKeyHash })
}
