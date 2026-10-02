/**
 * 로컬 알림 재조정의 순수한 부분. 계획과 원장의 차집합 · 결정적 id.
 *
 * 계획은 울릴 시각 순으로 자리 수만큼만 잡는다. iOS 는 앱 하나에 가까운 64개만 두고 나머지를 조용히 버리기 때문이다.
 * 넘친 것은 다음 재조정이 채운다.
 */
import type { NotificationLedgerEntry } from '../../storage/notification-ledger'

/** 예약할 알림 하나 */
export interface PlannedNotification extends NotificationLedgerEntry {
  /** 안드로이드 채널. 없으면 옛 채널 */
  channel?: 'party'
}

/** iOS 의 예약 알림 한도. 레지스트리 밖에서 예약하는 알림이 없어 그대로 쓴다 */
export const SCHEDULE_SLOTS = 64

export interface ReconcilePlan {
  schedule: PlannedNotification[]
  cancel: NotificationLedgerEntry[]
  keep: NotificationLedgerEntry[]
}

function sameNotification(a: NotificationLedgerEntry, b: NotificationLedgerEntry): boolean {
  return a.kind === b.kind && a.fireAt === b.fireAt && a.title === b.title && a.body === b.body
}

/**
 * 계획과 원장을 비교해 예약 · 취소 · 그대로 둘 것을 가른다. 몇 번을 돌려도 결과가 같다.
 *
 * 시각이 같아도 문구가 다르면 다시 예약한다. 같은 id 로 예약하면 OS 가 덮어쓴다.
 * 원장에만 있는 것(지운 약속 · 자리를 벗어난 것 · 레지스트리에서 빠진 종류)은 취소한다.
 */
export function planReconcile(
  planned: readonly PlannedNotification[],
  ledger: readonly NotificationLedgerEntry[],
  slots: number = SCHEDULE_SLOTS,
): ReconcilePlan {
  const wanted = [...planned].sort((a, b) => a.fireAt - b.fireAt || a.id - b.id).slice(0, slots)
  const wantedIds = new Set(wanted.map((item) => item.id))
  const ledgerById = new Map(ledger.map((entry) => [entry.id, entry]))
  const schedule: PlannedNotification[] = []
  const keep: NotificationLedgerEntry[] = []
  for (const item of wanted) {
    const existing = ledgerById.get(item.id)
    if (existing !== undefined && sameNotification(existing, item)) keep.push(existing)
    else schedule.push(item)
  }
  const cancel = ledger.filter((entry) => !wantedIds.has(entry.id))
  return { schedule, cancel, keep }
}

/**
 * `(종류, 범위, 회차)` 를 32비트 FNV-1a 해시로 접은 양의 정수 id. 같은 회차는 몇 번을 계획해도 같은 id 다.
 *
 * @example notificationId('party-appointment', appointment.id, occurrence.dateKey)
 */
export function notificationId(kind: string, scope: string, occurrence: string): number {
  let hash = 0x811c9dc5
  for (const char of `${kind}:${scope}:${occurrence}`) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  // id 는 양수로 둔다. 해시가 0 이면 1 이다.
  return (hash >>> 0) || 1
}
