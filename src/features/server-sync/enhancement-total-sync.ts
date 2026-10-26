/**
 * 강화 합계를 서버로 보내는 종류. 지출로 세는 줄(이벤트 월드 아님)만 보내고, 비용은 MVP 할인 전 두 몫이다.
 */
import { getEnhancementTotalById, type EnhancementTotal } from '../../storage/enhancement-totals'
import { enqueueServerSync } from '../../storage/server-sync-queue'
import { deleteEnhancementTotal, sendEnhancementTotal } from '../../server/records'
import type { EnhancementTotalPayload } from '../../types/server-records'
import type { SyncHandler } from './sweep'

/** 대기 표의 `record_type` 칸에 들어가는 값. */
export const ENHANCEMENT_TOTAL_RECORD_TYPE = 'enhancement-total'

/** 합계 줄에서 서버로 보낼 값. 이벤트 월드거나 판정하지 못한 줄은 `null` 이고 서버에서 지운다. */
export function enhancementTotalPayloadOf(total: EnhancementTotal): EnhancementTotalPayload | null {
  if (total.eventWorld !== false) return null
  return {
    totalRecordId: total.id,
    accountRecordId: total.nexonAccountId === '' ? null : total.nexonAccountId,
    characterName: total.characterName,
    historyDate: total.historyDate,
    enhancementCategory: total.enhancementCategory,
    itemKey: total.itemKey,
    itemName: total.itemName,
    attempts: total.attempts,
    attemptCostMeso: total.attemptCostMeso,
    destroyDefenceCostMeso: total.destroyDefenceCostMeso,
  }
}

/** 고리가 쓰는 함수 둘. 사라졌거나 보내지 않는 줄은 서버에서 지운다. */
export const enhancementTotalHandler: SyncHandler<EnhancementTotalPayload> = {
  read: async (id) => {
    const total = await getEnhancementTotalById(id)
    return total === null ? null : enhancementTotalPayloadOf(total)
  },
  send: (headers, id, value) => (value === null ? deleteEnhancementTotal(headers, id) : sendEnhancementTotal(headers, value)),
}

/**
 * 바뀐 합계 줄을 대기 표에 넣는다. **던지지 않는다.** 전송을 깨우는 것은 `report.ts` 다.
 *
 * @param now 대기 표에 적는 시각. 테스트가 고정한다
 */
export async function enqueueEnhancementTotals(ids: readonly string[], now: Date): Promise<void> {
  try {
    for (const id of ids) await enqueueServerSync(ENHANCEMENT_TOTAL_RECORD_TYPE, id, now.toISOString())
  } catch {
    // 대기 표를 못 열었다. 합계는 저장됐고, 오늘 날짜면 다음 수집이 다시 넣는다.
  }
}
