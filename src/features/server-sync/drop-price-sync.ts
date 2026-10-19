/**
 * 드롭 가격 기록을 서버로 보내는 종류 하나. 대기 표의 첫 종류다(이슈 #610).
 *
 * **전송은 사용자가 저장하는 그 자리에서 한 건이다.** 보낼 것을 찾으려고 기록 표를 훑지 않는다.
 * 실패하면 대기 표에 줄이 남고 다음 부팅의 고리가 집어 간다.
 *
 * **기기 저장이 먼저다.** 부르는 쪽이 `replaceBossDropRecords` 를 끝낸 뒤에 이것을 부르므로,
 * 전송이 실패해도 사용자가 적은 가격은 기기에 남는다.
 *
 * **가격이 없는 기록도 올린다.** 미입력은 `pending`, 기록 안함은 `skipped` 다. 지우기(`DELETE`)는
 * 기기에서 기록이 사라진 때만이다.
 */
import { getBossDropRecordById, type BossDropRecord } from '../../storage/boss-drops'
import { enqueueServerSync } from '../../storage/server-sync-queue'
import { deleteDropPrice, sendDropPrice, type SendResult } from '../../server/drop-price'
import type { DropPricePayload, DropRecordStatus } from '../../types/drop-price'
import { serverIdentityHeaders } from '../auth/server-identity'
import type { SyncHandler } from './sweep'

/** 대기 표의 `kind` 칸에 들어가는 값. */
export const DROP_PRICE_KIND = 'drop-price'

/**
 * **이 기간부터 보낸다.** 기능이 나간 뒤 시작된 기간만 보내기로 했다.
 *
 * 기준을 `period_key` 로 잡는 것은 그 값이 불변이기 때문이다(`recorded_at` 은 감사 필드라 그룹을
 * 다시 저장할 때 오늘로 덮인다). 주간 열쇠가 리셋일 `YYYY-MM-DD` 라 이 값도 목요일이다.
 *
 * ⚠️ **나갈 때 그 주의 목요일로 맞출 것.** 지난 날짜를 두면 기능이 서기 전의 기록이 올라가고,
 * 너무 먼 날짜를 두면 한동안 아무것도 안 올라간다.
 */
export const SERVER_PRICE_FROM = '2026-10-15'

/**
 * 이 기록을 서버로 보내는 기간인가.
 *
 * 글자 비교로 되는 것은 주간 열쇠와 월간 열쇠가 둘 다 `YYYY-MM` 으로 시작해서다.
 * `'2026-11' > '2026-10-15'` 이고 `'2026-10' < '2026-10-15'` 인데, 10월은 기준보다 먼저
 * 시작했으니 빠지는 것이 맞다. 기준이 달의 1일이면 그 달이 경계에서 한 칸 밀려 빠지는데,
 * 넣는 쪽이 아니라 빼는 쪽으로 틀리므로 그대로 둔다.
 */
export function sendsToServer(periodKey: string): boolean {
  return periodKey >= SERVER_PRICE_FROM
}

/**
 * 보낼 값. 기기의 가격 상태가 무엇이든 값을 만든다. `null` 이면 **서버에서 지운다.**
 *
 * 미입력은 `pending`, 기록 안함(`'excluded'`)은 `skipped` 다. 둘 다 기록은 있고 가격만 없는 것이라
 * 지우기로 보내면 올라간 적 없는 기록에 지우기가 나간다. 입력 상태인데 가격이 없거나 0 이면
 * 보낼 가격이 없으니 `pending` 이다.
 *
 * **`itemKey` 가 없는 기록만 `null` 이다.** 서버가 그 칸을 분포의 축으로 쓰므로 빈 값을 받을 수
 * 없다. 아이템 표에 없는 아이템이라 이관이 key 를 못 채운 옛 행이고, 기준 기간 뒤에 이 상태가
 * 되면 지우기 요청 하나가 헛나간다(서버는 못 찾고 아무것도 안 한다).
 */
export function dropPricePayloadOf(record: BossDropRecord): DropPricePayload | null {
  if (record.itemKey === null || record.itemKey === '') return null

  const priced = record.priceState === 'entered' && record.priceMeso !== null && record.priceMeso > 0
  const status: DropRecordStatus = priced ? 'completed' : record.priceState === 'excluded' ? 'skipped' : 'pending'

  return {
    dropRecordId: record.dropRecordId,
    itemKey: record.itemKey,
    status,
    priceMeso: priced ? record.priceMeso : null,
    periodKey: record.periodKey,
    worldKey: record.worldKey,
    ringLevel: record.ringLevel,
    boss: record.bossKey,
    difficulty: record.difficulty,
  }
}

/** 고리가 쓰는 함수 둘. 값의 모양은 이 파일이 알고 고리는 그대로 넘긴다. */
export const dropPriceHandler: SyncHandler<DropPricePayload> = {
  read: async (recordId) => {
    const record = await getBossDropRecordById(recordId)
    return record === null ? null : dropPricePayloadOf(record)
  },
  send: async (headers, recordId, value) =>
    value === null
      ? deleteDropPrice(headers, recordId)
      : sendDropPrice(headers, value),
}

/**
 * 가격을 저장하거나 고친 그 자리에서 한 건 보낸다. **실패해도 던지지 않는다.**
 *
 * 사용자가 보는 것은 저장이고 전송은 거기 얹힌 일이다. 실패를 띄우면 고칠 수 있는 것이 없는
 * 사용자에게 고장을 알리는 것이 된다. 실패한 것은 대기 표가 들고 다음 부팅에 다시 나간다.
 *
 * **식별자만 받아 기록을 다시 읽는다.** 부르는 쪽이 들고 있는 것은 `RecordedDrop` 이고 그 타입에
 * 월드도 기간도 없다. 손으로 조립하면 칸 하나가 빠져도 타입 검사를 통과하고 값만 조용히 사라진다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function reportDropPrice(dropRecordId: string, now: Date): Promise<void> {
  const record = await getBossDropRecordById(dropRecordId)

  // 그 사이 기록이 사라졌다. 보낼 기간인지 판단할 재료가 없어 아무것도 안 한다.
  if (record === null) return
  if (!sendsToServer(record.periodKey)) return

  const value = dropPricePayloadOf(record)
  await sendOrQueue(dropRecordId, now, (headers) =>
    value === null ? deleteDropPrice(headers, dropRecordId) : sendDropPrice(headers, value),
  )
}

/**
 * 기기에서 기록이 사라진 자리에서 지우기 한 건을 보낸다. 시트 저장에서 빠진 드롭과 획득 불가로
 * 걷힌 드롭이다. **실패해도 던지지 않는다**(`reportDropPrice` 와 같은 이유).
 *
 * 기록이 이미 없어 다시 읽을 수 없으므로 기간 키를 받는다. 실패하면 대기 표에 적고, 다음 회차는
 * 원본이 없어 그대로 지우기다.
 *
 * @param periodKey 사라진 기록의 기간 키. 기준 기간 앞이면 보내지 않는다
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function reportDropRemoved(dropRecordId: string, periodKey: string, now: Date): Promise<void> {
  if (!sendsToServer(periodKey)) return
  await sendOrQueue(dropRecordId, now, (headers) => deleteDropPrice(headers, dropRecordId))
}

/** 밝힐 수단이 없거나 보냈는데 `sent` 가 아니면 대기 표에 적는다. 두 전송 자리가 같은 꼬리를 쓴다. */
async function sendOrQueue(
  dropRecordId: string,
  now: Date,
  send: (headers: Record<string, string>) => Promise<SendResult>,
): Promise<void> {
  const headers = await serverIdentityHeaders()

  // 밝힐 수단이 없다. 키를 지웠거나 로그인 전이라 지금은 못 보내고, 생기면 고리가 집어 간다.
  if (headers === null) {
    await enqueueServerSync(DROP_PRICE_KIND, dropRecordId, now.toISOString())
    return
  }

  const result = await send(headers)
  if (result.outcome !== 'sent') {
    await enqueueServerSync(DROP_PRICE_KIND, dropRecordId, now.toISOString())
  }
}
