/**
 * 강화 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 세어 서버에 알린다. 응답 원본은 저장하지 않으므로, 이 값이 운영자가
 * 원인을 볼 유일한 단서다.
 *
 * @see docs/foundation/server-sync.md 강화 합계에서 빠진 줄
 */
import type { EventWorldEvidence } from '../../lib/enhancement/world'
import { sendEnhancementAnomalies } from '../../server/enhancement-anomalies'
import type { EnhancementAnomaly } from '../../types/server-records'
import { serverIdentityHeaders } from '../auth/server-identity'
import {
  eventWorldOf,
  starOf,
  unpricedReasonOf,
  usesSpecialCurrency,
  type EnhancementSource,
  type UnpricedReason,
} from './spending'

/** 한 번에 보내는 상황 수. 옛 원본을 옮길 때는 날짜가 수백이라 나눠 보낸다. */
const SEND_CHUNK = 500

/** 실패 이유 글자의 길이 상한. 서버 칸의 상한과 같다. */
const DETAIL_MAX = 200

/** 장비 표에 없는 장비의 스타포스를 세는 시도 뒤 최소 성수. 운영자는 이 성수 이상으로 올린 장비만 본다. */
const NO_LEVEL_STARFORCE_MIN_STAR = 10

/** 장비 표에 없는 장비의 스타포스인데 시도 뒤 성수가 기준에 못 미치거나 없는 줄. */
function isUnwatchedNoLevel(entry: EnhancementSource, reason: UnpricedReason): boolean {
  if (reason !== 'no_level' || entry.kind !== 'starforce') return false
  const after = starOf(entry, 'after_starforce_count')
  return after === null || after < NO_LEVEL_STARFORCE_MIN_STAR
}

/**
 * 줄들의 상황을 날짜 · 종류 · 이유 · 장비마다 센다. 전용 재화 줄은 빼는 것이 정상이라 세지 않고, 장비 표에 없는 장비의
 * 스타포스는 시도 뒤 10성 이상인 줄만 센다. 판정하지 못한 줄은 까닭(`detail`)마다 따로 센다.
 *
 * @param listError 캐릭터 목록 요청의 실패 이유. 목록 없이 판정하지 못한 줄에 싣는다. 표에 없는 월드의 줄은 그 월드 이름을 싣는다
 */
export function enhancementAnomaliesOf(
  entries: readonly EnhancementSource[],
  evidence: EventWorldEvidence,
  listError: string | null,
): EnhancementAnomaly[] {
  const counted = new Map<string, EnhancementAnomaly>()
  const count = (
    entry: EnhancementSource,
    anomalyType: EnhancementAnomaly['anomalyType'],
    itemKey: string | null,
    itemName: string,
    detail: string | null,
  ) => {
    const key = [entry.dateKey, entry.kind, anomalyType, itemName, detail ?? ''].join('|')
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
      detail: detail?.slice(0, DETAIL_MAX) ?? null,
    })
  }
  for (const entry of entries) {
    if (usesSpecialCurrency(entry)) continue
    const reason = unpricedReasonOf(entry)
    if (reason !== null && isUnwatchedNoLevel(entry, reason)) continue
    if (reason !== null) {
      count(entry, reason, entry.itemKey, entry.targetItem, null)
      continue
    }
    const judgment = eventWorldOf(entry, evidence)
    if (judgment.eventWorld === null) count(entry, 'event_world_unknown', null, '', judgment.unknownWorld ?? listError)
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
