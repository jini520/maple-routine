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
import { nexonIdHashHex } from '../../lib/crypto/nexon-id-hash'
import { getAuthConfig } from '../../storage/api-key'
import { getBossDropRecordById, type BossDropRecord } from '../../storage/boss-drops'
import { getCharacterOwnersOfOcids, type CharacterOwner } from '../../storage/character-accounts'
import { getDropPeriodId } from '../../storage/server-sync-sources'
import { enqueueServerSync } from '../../storage/server-sync-queue'
import { deleteDropPrice, sendDropPrice, type SendResult } from '../../server/drop-price'
import type { DropPricePayload, DropRecordStatus } from '../../types/drop-price'
import { serverIdentitiesOf, serverIdentityOfAccount } from '../auth/server-identity'
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
 *
 * @param owner 캐릭터의 주인. 앱이 그 캐릭터를 목록에서 본 적이 없으면 `null` 이고, 메이플 ID · ocid 없이 옛 모양으로 보낸다
 */
export function dropPricePayloadOf(
  record: BossDropRecord,
  periodRecordId: string | null,
  owner: CharacterOwner | null,
): DropPricePayload | null {
  if (record.itemKey === null || record.itemKey === '') return null

  const status: DropRecordStatus =
    record.priceState === 'entered' ? 'completed' : record.priceState === 'excluded' ? 'skipped' : 'pending'

  return {
    ...(owner === null ? {} : { mapleId: nexonIdHashHex(owner.mapleId), ocid: nexonIdHashHex(record.ocid) }),
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
    pricedAt: status === 'completed' ? record.pricedAt : null,
    boxOriginKey: record.boxOriginKey,
  }
}

/** 드롭 한 건을 보내는 데 필요한 것. 값과, 그 값을 보낼 신원의 넥슨 계정이다. */
export interface DropPriceSend {
  payload: DropPricePayload
  /** 캐릭터가 속한 넥슨 계정 id. 모르면 `null` 이고 메인 계정의 신원으로 보낸다 */
  accountId: string | null
}

/** 기록이 있으면 보낼 것을 만든다. 보낼 값이 없는 기록(아이템 key 가 빈 옛 행)은 `payload` 가 없어 지우기로 보낸다. */
async function dropSendOf(record: BossDropRecord): Promise<DropPriceSend | null> {
  const owner = (await getCharacterOwnersOfOcids([record.ocid])).get(record.ocid) ?? null
  const payload = dropPricePayloadOf(record, await getDropPeriodId(record.dropRecordId), owner)
  return payload === null ? null : { payload, accountId: owner?.nexonAccountId ?? null }
}

/**
 * 그 드롭의 캐릭터가 속한 계정의 신원으로 보낸다. 서버는 기록의 메이플 ID 가 보낸 신원의 계정에 있어야 적는다.
 *
 * 밝힐 수 없는 계정(다른 로그인의 부계정)이면 보내지 않고 `no-response` 로 답한다. 요청의 잘못이 아니라 횟수를 세지 않고,
 * 그 로그인이 돌아오면 나간다.
 */
async function sendAsOwner(send: DropPriceSend): Promise<SendResult> {
  const headers = serverIdentityOfAccount(await getAuthConfig(), send.accountId)
  if (headers === null) return { outcome: 'no-response' }
  return sendDropPrice(headers, send.payload)
}

/**
 * 지금 쓸 수 있는 신원 모두로 지우기를 보낸다. 기록이 사라진 뒤라 어느 계정의 드롭이었는지 모른다. 서버는 신원의 메이플 ID 줄만
 * 지우고 없으면 아무 일도 하지 않는다. 신원 모두가 받아야 `sent` 다.
 */
async function deleteEverywhere(dropRecordId: string): Promise<SendResult> {
  const identities = serverIdentitiesOf(await getAuthConfig())
  if (identities.length === 0) return { outcome: 'no-response' }
  let result: SendResult = { outcome: 'sent' }
  for (const headers of identities) {
    const one = await deleteDropPrice(headers, dropRecordId)
    if (one.outcome === 'no-response') return one
    if (one.outcome === 'rejected') result = one
  }
  return result
}

/** 고리가 쓰는 함수 둘. 값의 모양은 이 파일이 알고 고리는 그대로 넘긴다. */
export const dropPriceHandler: SyncHandler<DropPriceSend> = {
  read: async (recordId) => {
    const record = await getBossDropRecordById(recordId)
    return record === null ? null : dropSendOf(record)
  },
  send: async (recordId, value) => (value === null ? deleteEverywhere(recordId) : sendAsOwner(value)),
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

    const send = await dropSendOf(record)
    await sendOrQueue(dropRecordId, now, () => (send === null ? deleteEverywhere(dropRecordId) : sendAsOwner(send)))
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
    await sendOrQueue(dropRecordId, now, () => deleteEverywhere(dropRecordId))
  } catch {
    // 대기 표를 못 열었다. 기기 저장은 끝났다.
  }
}

/**
 * 보냈는데 `sent` 가 아니면 대기 표에 적는다. 두 전송 자리가 같은 꼬리를 쓴다. 밝힐 수단이 없는 것(키를 지웠거나 로그인 전)도
 * `sent` 가 아니라 여기 쌓이고, 수단이 생기면 고리가 집어 간다.
 */
async function sendOrQueue(dropRecordId: string, now: Date, send: () => Promise<SendResult>): Promise<void> {
  const result = await send()
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
