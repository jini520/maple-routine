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
import { getDropPeriodId } from '../../storage/server-sync-sources'
import { enqueueServerSync } from '../../storage/server-sync-queue'
import { deleteDropPrice, sendDropPrice, type SendResult } from '../../server/drop-price'
import type { DropPricePayload, DropRecordStatus } from '../../types/drop-price'
import { serverIdentityHeaders } from '../auth/server-identity'
import type { SyncHandler } from './sweep'

/** 대기 표의 `record_type` 칸에 들어가는 값. */
export const DROP_PRICE_RECORD_TYPE = 'drop-price'

/**
 * 보낼 값. 기기의 가격 상태가 무엇이든 값을 만든다. `null` 이면 **서버에서 지운다.**
 *
 * 상태는 저장된 `record_status` 그대로다. 화면의 말(`priceState`)로 읽었으니 이름만 되돌린다. 미입력과 기록
 * 안함도 기록은 있고 가격만 없는 것이라, 지우기로 보내면 올라간 적 없는 기록에 지우기가 나간다.
 *
 * **`itemKey` 가 없는 기록만 `null` 이다.** 서버가 그 칸을 분포의 축으로 쓰므로 빈 값을 받을 수
 * 없다. 아이템 표에 없는 아이템이라 이관이 key 를 못 채운 옛 행이고, 이 상태가 되면 지우기 요청 하나가
 * 헛나간다(서버는 못 찾고 아무것도 안 한다).
 */
export function dropPricePayloadOf(record: BossDropRecord, periodRecordId: string | null): DropPricePayload | null {
  if (record.itemKey === null || record.itemKey === '') return null

  const status: DropRecordStatus =
    record.priceState === 'entered' ? 'completed' : record.priceState === 'excluded' ? 'skipped' : 'pending'

  return {
    dropRecordId: record.dropRecordId,
    itemKey: record.itemKey,
    status,
    priceMeso: status === 'completed' ? record.priceMeso : null,
    periodKey: record.periodKey,
    worldKey: record.worldKey,
    ringLevel: record.ringLevel,
    boss: record.bossKey,
    difficulty: record.difficulty,
    periodRecordId,
  }
}

/** 고리가 쓰는 함수 둘. 값의 모양은 이 파일이 알고 고리는 그대로 넘긴다. */
export const dropPriceHandler: SyncHandler<DropPricePayload> = {
  read: async (recordId) => {
    const record = await getBossDropRecordById(recordId)
    return record === null ? null : dropPricePayloadOf(record, await getDropPeriodId(recordId))
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
  try {
    const record = await getBossDropRecordById(dropRecordId)

    // 그 사이 기록이 사라졌다. 사라진 기록은 지운 자리가 따로 알린다.
    if (record === null) return

    const value = dropPricePayloadOf(record, await getDropPeriodId(dropRecordId))
    await sendOrQueue(dropRecordId, now, (headers) =>
      value === null ? deleteDropPrice(headers, dropRecordId) : sendDropPrice(headers, value),
    )
  } catch {
    // 저장소를 못 읽었다. 기기 저장은 끝났고 과거 올리기가 남은 기록을 다시 집는다.
  }
}

/**
 * 기기에서 기록이 사라진 자리에서 지우기 한 건을 보낸다. 시트 저장에서 빠진 드롭과 획득 불가로
 * 걷힌 드롭이다. **실패해도 던지지 않는다**(`reportDropPrice` 와 같은 이유).
 *
 * 실패하면 대기 표에 적고, 다음 회차는 원본이 없어 그대로 지우기다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function reportDropRemoved(dropRecordId: string, now: Date): Promise<void> {
  try {
    await sendOrQueue(dropRecordId, now, (headers) => deleteDropPrice(headers, dropRecordId))
  } catch {
    // 대기 표를 못 열었다. 기기 저장은 끝났다.
  }
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
    await enqueueServerSync(DROP_PRICE_RECORD_TYPE, dropRecordId, now.toISOString())
    return
  }

  const result = await send(headers)
  if (result.outcome !== 'sent') {
    await enqueueServerSync(DROP_PRICE_RECORD_TYPE, dropRecordId, now.toISOString())
  }
}

/**
 * 과거 올리기에서 서버가 받지 못한 드롭을 대기 표에 넣는다. 한 건씩 5 회 다시 보내고 그래도 안 되면 버린다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function enqueueDropPrices(dropRecordIds: readonly string[], now: Date): Promise<void> {
  for (const id of dropRecordIds) await enqueueServerSync(DROP_PRICE_RECORD_TYPE, id, now.toISOString())
}
