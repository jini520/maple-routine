/**
 * 종류마다의 함수 둘을 모은 표. 고리(`sweep.ts`)는 이 표에서만 종류를 안다.
 *
 * **종류를 여기 안 더하면 그 종류는 조용히 안 나간다.** 대기 표에 줄은 쌓이고 읽기 함수가 없어
 * 처리되지 않는다. 그래서 고리가 모르는 `record_type` 를 만나면 줄을 버리고, 아래 테스트가 **만드는
 * 쪽과 이 표가 같은 집합**인지 본다. `app/today/widgets/registry.ts` 와 같은 함정이다.
 *
 * 새 종류를 더할 때 손댈 곳은 세 줄이다 - `SyncRecordType` 에 이름, 이 표에 한 줄, 그리고 그 종류의
 * 파일에 함수 둘.
 */
import { BOSS_CLEAR_RECORD_TYPE, bossClearHandler } from './boss-clear-sync'
import { CASHBOOK_ENTRY_RECORD_TYPE, cashbookEntryHandler } from './cashbook-entry-sync'
import { DROP_PRICE_RECORD_TYPE, dropPriceHandler } from './drop-price-sync'
import { ENHANCEMENT_TOTAL_RECORD_TYPE, enhancementTotalHandler } from './enhancement-total-sync'
import type { SyncHandler } from './sweep'

/** 지금 보내는 종류. 이 이름이 대기 표의 `record_type` 칸에 그대로 들어간다. */
export type SyncRecordType =
  | typeof DROP_PRICE_RECORD_TYPE
  | typeof BOSS_CLEAR_RECORD_TYPE
  | typeof CASHBOOK_ENTRY_RECORD_TYPE
  | typeof ENHANCEMENT_TOTAL_RECORD_TYPE

/**
 * 종류마다 값의 모양이 달라 이 표는 그 모양을 잊는다.
 *
 * 잊는 자리를 함수 하나로 모아 단언이 한 군데만 있게 한다. 고리는 `read` 가 준 것을 같은
 * 핸들러의 `send` 에만 넘기므로 짝이 어긋날 길이 없는데, 타입으로는 그것을 말할 수 없다.
 */
function anyValue<Value>(handler: SyncHandler<Value>): SyncHandler<unknown> {
  return handler as SyncHandler<unknown>
}

export const SYNC_HANDLERS: Readonly<Record<SyncRecordType, SyncHandler<unknown>>> = {
  [DROP_PRICE_RECORD_TYPE]: anyValue(dropPriceHandler),
  [BOSS_CLEAR_RECORD_TYPE]: anyValue(bossClearHandler),
  [CASHBOOK_ENTRY_RECORD_TYPE]: anyValue(cashbookEntryHandler),
  [ENHANCEMENT_TOTAL_RECORD_TYPE]: anyValue(enhancementTotalHandler),
}
