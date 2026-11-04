/**
 * 드롭 가격 기록을 우리 서버로 보내는 창구. 시세 추이의 표본이다. 응답을 못 받은 것과 거절을 가르는 규칙은 `write.ts` 에 있다.
 */
import type { DropPricePayload } from '../types/drop-price'
import { deleteRecord, postRecord, type SendResult } from './write'

export type { SendResult } from './write'

/** 기록 한 건을 올린다. 가격이 없는 기록도 상태를 달아 올린다. 같은 값을 다시 보내도 서버에 줄이 안 늘어난다. */
export async function sendDropPrice(
  headers: Record<string, string>,
  one: DropPricePayload,
): Promise<SendResult> {
  return postRecord(headers, '/drop-prices', one)
}

/**
 * 그 기록이 기기에서 사라졌다고 알린다. 기록 안함은 여기가 아니라 `sendDropPrice` 의 `skipped` 다.
 *
 * 서버는 줄을 안 지우고 `deleted` 로 표시한다. 다시 적으면 상태가 덮여 되살아난다.
 */
export async function deleteDropPrice(
  headers: Record<string, string>,
  dropRecordId: string,
): Promise<SendResult> {
  return deleteRecord(headers, '/drop-prices', dropRecordId)
}
