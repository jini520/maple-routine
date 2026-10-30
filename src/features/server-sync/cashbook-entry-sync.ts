/**
 * 가계부 기록을 서버로 보내는 종류. 메모 칸은 없고 사냥 계산기 입력은 안 싣는다.
 */
import { enqueueServerSync } from '../../storage/server-sync-queue'
import { getCashbookEntrySource, type CashbookEntrySource } from '../../storage/server-sync-sources'
import { deleteCashbookEntry, sendCashbookEntry } from '../../server/records'
import type { CashbookEntryPayload } from '../../types/server-records'
import type { SyncHandler } from './sweep'

/** 대기 표의 `record_type` 칸에 들어가는 값. */
export const CASHBOOK_ENTRY_RECORD_TYPE = 'cashbook-entry'

/**
 * 기록에서 서버로 보낼 값. 캐릭터 없는 기록만 넥슨 계정 id 를 싣는다.
 *
 * 0 메소 헥사 기록은 `null` 이고 서버에서 지운다. 교환 불가 조각이 더 많아 돈이 안 든 기록이라 서버 지출 통계에 넣지 않는다.
 */
export function cashbookEntryPayloadOf({ entry, nexonAccountId }: CashbookEntrySource): CashbookEntryPayload | null {
  const { head } = entry
  if (head.categoryKey === 'hexa_matrix' && entry.items.every((item) => (item.amountMeso ?? 0) === 0)) return null
  return {
    entryRecordId: head.id,
    ocid: head.ocid,
    accountRecordId: head.ocid === null ? nexonAccountId : null,
    entryType: head.entryType,
    categoryKey: head.categoryKey,
    entryDate: head.entryDate,
    items: entry.items.map((item) => ({
      itemKey: item.itemKey,
      itemName: item.itemName,
      formKey: item.formKey,
      itemKindKey: item.itemKindKey,
      quantity: item.quantity,
      fromLevel: item.fromLevel,
      toLevel: item.toLevel,
      amountMeso: item.amountMeso,
      tariffMeso: item.tariffMeso,
      saleFeePercent: item.saleFeePercent,
      saleFeeMeso: item.saleFeeMeso,
      amountPoint: item.amountPoint,
      pointPer100mMeso: item.pointPer100mMeso,
      amountCash: item.amountCash,
      fragmentCount: item.fragmentCount,
      untradableFragmentCount: item.untradableFragmentCount,
      fragmentPriceMeso: item.fragmentPriceMeso,
      hexaActivation: item.hexaActivation,
    })),
  }
}

/** 고리가 쓰는 함수 둘. 사라졌거나 보내지 않는 기록은 `null` 이고 서버에서 지운다. */
export const cashbookEntryHandler: SyncHandler<CashbookEntryPayload> = {
  read: async (entryId) => {
    const source = await getCashbookEntrySource(entryId)
    return source === null ? null : cashbookEntryPayloadOf(source)
  },
  send: (headers, entryId, value) =>
    value === null ? deleteCashbookEntry(headers, entryId) : sendCashbookEntry(headers, value),
}

/**
 * 바뀐 기록을 대기 표에 넣는다. **던지지 않는다.** 전송을 깨우는 것은 `report.ts` 다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function enqueueCashbookEntries(entryIds: readonly string[], now: Date): Promise<void> {
  try {
    for (const id of entryIds) await enqueueServerSync(CASHBOOK_ENTRY_RECORD_TYPE, id, now.toISOString())
  } catch {
    // 대기 표를 못 열었다. 기기 저장은 끝났고 다음 저장 때 다시 들어간다.
  }
}
