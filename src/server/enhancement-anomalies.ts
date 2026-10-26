/**
 * 강화 합계에서 빠진 줄의 상황을 우리 서버로 보내는 창구. 기록이 아니라 운영자가 예상하지 못한 상황을 보는 값이다.
 */
import type { EnhancementAnomaly } from '../types/server-records'
import { postRecord, type SendResult } from './write'

/** 상황 여럿을 한 번에 보낸다. 서버는 같은 날 · 종류 · 이유 · 장비의 줄을 덮는다. */
export function sendEnhancementAnomalies(
  headers: Record<string, string>,
  items: readonly EnhancementAnomaly[],
): Promise<SendResult> {
  return postRecord(headers, '/enhancement-anomalies', { items })
}
