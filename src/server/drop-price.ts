/**
 * 드롭 가격 기록을 우리 서버로 보내는 창구. 시세 추이의 표본이다. 응답을 못 받은 것과 거절을 가르는 규칙은 `write.ts` 에 있다.
 */
import type { DropPricePayload } from '../types/drop-price'
import { deleteRecord, postRecord, writeCall, type SendResult } from './write'

export type { SendResult } from './write'

/** 기록 한 건을 올린다. 가격이 없는 기록도 상태를 달아 올린다. 같은 값을 다시 보내도 서버에 줄이 안 늘어난다. */
export async function sendDropPrice(
  headers: Record<string, string>,
  one: DropPricePayload,
): Promise<SendResult> {
  return postRecord(headers, '/drop-prices', one)
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
  return writeCall('/me', { method: 'DELETE', headers })
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
