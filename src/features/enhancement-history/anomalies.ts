/**
 * 강화 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 세어 서버에 알린다. 응답 원본은 저장하지 않으므로, 이 값이 운영자가
 * 원인을 볼 유일한 단서다.
 *
 * @see docs/foundation/server-sync.md 강화 합계에서 빠진 줄
 */
import { sendEnhancementAnomalies } from '../../server/enhancement-anomalies'
import type { EnhancementAnomaly } from '../../types/server-records'
import { serverIdentityHeaders } from '../auth/server-identity'
import { eventWorldOf, unpricedReasonOf, usesSpecialCurrency, type EnhancementSource } from './spending'

/** 한 번에 보내는 상황 수. 옛 원본을 옮길 때는 날짜가 수백이라 나눠 보낸다. */
const SEND_CHUNK = 500

/** 실패 이유 글자의 길이 상한. 서버 칸의 상한과 같다. */
const DETAIL_MAX = 200

/**
 * 줄들의 상황을 날짜 · 종류 · 이유 · 장비마다 센다. 전용 재화 줄은 빼는 것이 정상이라 세지 않는다.
 *
 * @param eventNames 스페셜 캐릭터 이름. 목록을 못 받았으면 `null` 이고, 그때 월드를 모르는 줄을 판정하지 못한 줄로 센다
 * @param listError 캐릭터 목록 요청의 실패 이유. 판정하지 못한 줄에 싣는다
 */
export function enhancementAnomaliesOf(
  entries: readonly EnhancementSource[],
  eventNames: ReadonlySet<string> | null,
  listError: string | null,
): EnhancementAnomaly[] {
  const counted = new Map<string, EnhancementAnomaly>()
  const count = (entry: EnhancementSource, anomalyType: EnhancementAnomaly['anomalyType'], itemKey: string | null, itemName: string) => {
    const key = [entry.dateKey, entry.kind, anomalyType, itemName].join('|')
    const existing = counted.get(key)
    if (existing !== undefined) {
      existing.rowCount += 1
      return
    }
    counted.set(key, {
      historyDate: entry.dateKey,
      enhancementType: entry.kind,
      anomalyType,
      itemKey,
      itemName,
      rowCount: 1,
      detail: anomalyType === 'event_world_unknown' ? (listError?.slice(0, DETAIL_MAX) ?? null) : null,
    })
  }
  for (const entry of entries) {
    if (usesSpecialCurrency(entry)) continue
    const reason = unpricedReasonOf(entry)
    if (reason !== null) count(entry, reason, entry.itemKey, entry.targetItem)
    else if (eventWorldOf(entry, eventNames) === null) count(entry, 'event_world_unknown', null, '')
  }
  return [...counted.values()]
}

/**
 * 상황을 서버로 보낸다. **던지지 않고, 실패하면 버린다.** 운영자가 양과 모양을 보는 값이라 몇 건을 놓쳐도 된다. 신원이 없으면
 * 보내지 않는다.
 */
export async function reportEnhancementAnomalies(items: readonly EnhancementAnomaly[]): Promise<void> {
  if (items.length === 0) return
  try {
    const headers = await serverIdentityHeaders()
    if (headers === null) return
    for (let start = 0; start < items.length; start += SEND_CHUNK) {
      await sendEnhancementAnomalies(headers, items.slice(start, start + SEND_CHUNK))
    }
  } catch {
    // 진단 값이라 다시 보내지 않는다.
  }
}
