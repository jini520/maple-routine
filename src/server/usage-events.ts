/**
 * 사용 로그 묶음을 우리 서버로 보내는 창구.
 */
import type { UsageEventBatch } from '../types/usage-event'
import { postRecord, type SendResult } from './write'

export function sendUsageEvents(headers: Record<string, string>, batch: UsageEventBatch): Promise<SendResult> {
  return postRecord(headers, '/usage-events', batch)
}
