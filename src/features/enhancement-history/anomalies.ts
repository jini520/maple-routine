/**
 * 강화 합계에서 빼거나 이벤트 월드를 판정하지 못한 줄을 세어 서버에 알린다. 응답 원본은 저장하지 않으므로, 이 값이 운영자가
 * 원인을 볼 유일한 단서다.
 *
 * @see docs/foundation/server-sync.md 강화 합계에서 빠진 줄
 */
import type { EventWorldJudgment } from '../../lib/enhancement/world'
import { sendEnhancementAnomalies } from '../../server/enhancement-anomalies'
import { mapleIdOfNexonAccount } from '../../storage/server-sync-records'
import type { EnhancementAnomaly } from '../../types/server-records'
import { serverIdentityHeaders } from '../auth/server-identity'
import { nexonIdHashOf } from '../server-sync/push-records'
import {
  starOf,
  unpricedReasonOf,
  usesSpecialCurrency,
  type EnhancementSource,
  type UnpricedReason,
} from './spending'

/** 한 번에 보내는 상황 수. 옛 원본을 옮길 때는 날짜가 수백이라 나눠 보낸다. */
const SEND_CHUNK = 500

/** 상세 글자의 길이 상한. 서버 칸의 상한과 같다. */
const DETAIL_MAX = 200

/** 장비 표에 없는 장비의 스타포스를 세는 시도 뒤 최소 성수. 운영자는 이 성수 이상으로 올린 장비만 본다. */
const NO_LEVEL_STARFORCE_MIN_STAR = 10

/** 줄들에서 센 상황. 어느 계정에서 받았는지는 부르는 쪽이 붙인다. */
type AnomalyCount = Omit<EnhancementAnomaly, 'mapleId'>

/** 넥슨 계정 하나에서 받은 상황. 보낼 때 계정 id 를 그 계정의 메이플 ID 해시로 바꾼다. */
export interface AccountAnomaly extends AnomalyCount {
  /** 강화 내역을 받은 기기의 넥슨 계정 id */
  nexonAccountId: string
}

/** 장비 표에 없는 장비의 스타포스인데 시도 뒤 성수가 기준에 못 미치거나 없는 줄. */
function isUnwatchedNoLevel(entry: EnhancementSource, reason: UnpricedReason): boolean {
  if (reason !== 'no_level' || entry.kind !== 'starforce') return false
  const after = starOf(entry, 'after_starforce_count')
  return after === null || after < NO_LEVEL_STARFORCE_MIN_STAR
}

/**
 * 줄들의 상황을 날짜 · 종류 · 이유 · 장비마다 센다. 전용 재화 줄은 빼는 것이 정상이라 세지 않고, 장비 표에 없는 장비의
 * 스타포스는 시도 뒤 10성 이상인 줄만 센다. 판정하지 못한 줄은 까닭(`detail`, 표에 없는 월드 이름)마다 따로 센다.
 *
 * @param judgmentOf 줄의 이벤트 월드 판정. 캐릭터에 붙이지 못한 줄은 `null` 이고 판정을 세지 않는다
 */
export function enhancementAnomaliesOf(
  entries: readonly EnhancementSource[],
  judgmentOf: (entry: EnhancementSource) => EventWorldJudgment | null,
): AnomalyCount[] {
  const counted = new Map<string, AnomalyCount>()
  const count = (entry: EnhancementSource, reason: AnomalyCount['reason'], itemName: string, detail: string | null) => {
    const key = [entry.dateKey, entry.kind, reason, itemName, detail ?? ''].join('|')
    const existing = counted.get(key)
    if (existing !== undefined) {
      existing.rowCount += 1
      return
    }
    counted.set(key, {
      historyDate: entry.dateKey,
      apiType: entry.kind,
      reason,
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
      count(entry, reason, entry.targetItem, null)
      continue
    }
    const judgment = judgmentOf(entry)
    if (judgment !== null && judgment.eventWorld === null) count(entry, 'event_world_unknown', '', judgment.unknownWorld)
  }
  return [...counted.values()]
}

/**
 * 상황을 서버로 보낸다. **던지지 않고, 실패하면 버린다.** 운영자가 양과 모양을 보는 값이라 몇 건을 놓쳐도 된다. 신원이 없으면
 * 보내지 않는다.
 *
 * 요청은 메인 신원 하나로 가고, 상황마다 받은 계정의 메이플 ID 해시를 싣는다. 서버가 그 메이플 ID 의 넥슨 계정 줄에 적어야
 * 부계정의 상황이 메인의 같은 상황을 덮지 않는다. 메이플 ID 를 모르는 계정의 상황은 보내지 않는다.
 */
export async function reportEnhancementAnomalies(items: readonly AccountAnomaly[]): Promise<void> {
  if (items.length === 0) return
  try {
    const headers = await serverIdentityHeaders()
    if (headers === null) return
    const sending = await withMapleIds(items)
    for (let start = 0; start < sending.length; start += SEND_CHUNK) {
      await sendEnhancementAnomalies(headers, sending.slice(start, start + SEND_CHUNK))
    }
  } catch {
    // 진단 값이라 다시 보내지 않는다.
  }
}

/** 계정 id 를 그 계정의 메이플 ID 해시로 바꾼 상황들. 강화 내역을 다 받은 날을 올릴 때와 같은 메이플 ID 다. */
async function withMapleIds(items: readonly AccountAnomaly[]): Promise<EnhancementAnomaly[]> {
  const mapleIds = new Map<string, string | null>()
  for (const nexonAccountId of new Set(items.map((item) => item.nexonAccountId))) {
    const mapleId = await mapleIdOfNexonAccount(nexonAccountId)
    mapleIds.set(nexonAccountId, mapleId === null ? null : nexonIdHashOf(mapleId))
  }
  return items.flatMap(({ nexonAccountId, ...item }) => {
    const mapleId = mapleIds.get(nexonAccountId) ?? null
    return mapleId === null ? [] : [{ ...item, mapleId }]
  })
}
