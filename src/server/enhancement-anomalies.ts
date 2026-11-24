/**
 * 강화 합계에서 빠진 줄의 상황을 우리 서버로 보내는 창구. 기록이 아니라 운영자가 예상하지 못한 상황을 보는 값이다.
 */
import type { EnhancementAnomaly } from '../types/server-records'
import { postRecord, type SendResult } from './write'

/**
 * 상황 여럿을 한 번에 보내는 요청. 서버는 상황마다 실은 메이플 ID 가 달린 넥슨 계정의 줄에 적고, 같은 넥슨 계정 · 날 · 종류 ·
 * 이유 · 장비 · 상세의 줄은 받은 수로 덮는다.
 */
export function sendEnhancementAnomalies(
  headers: Record<string, string>,
  items: readonly EnhancementAnomaly[],
): Promise<SendResult> {
  return postRecord(headers, '/enhancement-anomalies', { items })
}
