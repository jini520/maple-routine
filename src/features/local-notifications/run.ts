/**
 * 로컬 알림 재조정을 저장소 · 네이티브 포트에 잇는 곳.
 *
 * 앱을 켤 때 · 포그라운드로 돌아올 때 · 약속을 저장할 때 · 알림 스위치를 바꿀 때 부른다.
 * iOS 는 로컬 알림이 울려도 앱을 깨우지 않아, 넘친 알림은 이 때들에 채운다.
 */
import {
  cancelLocalNotification,
  hasNotificationPermission,
  scheduleLocalNotification,
} from '../../native/notifications'
import {
  getNotificationLedger,
  setNotificationLedger,
  type NotificationLedgerEntry,
} from '../../storage/notification-ledger'
import { planReconcile } from './reconcile'
import { NOTIFICATION_KINDS } from './registry'

/**
 * 한 번 맞춘다. 권한이 없으면 계획은 빈 목록이라 원장에 있는 것을 모두 취소한다.
 *
 * 원장은 예약 · 취소가 끝난 뒤 쓴다. 중간에 죽으면 다음 재조정이 같은 id 로 한 번 더 하고, 그것은 덮어쓰기라 안전하다.
 * 실패한 예약은 원장에 안 적고, 실패한 취소는 원장에 남겨 다음에 다시 한다.
 */
export async function reconcileLocalNotifications(now: Date): Promise<void> {
  const granted = await hasNotificationPermission().catch(() => false)
  const planned = granted ? (await Promise.all(NOTIFICATION_KINDS.map((kind) => kind.plan(now)))).flat() : []
  const ledger = await getNotificationLedger()
  const { schedule, cancel, keep } = planReconcile(planned, ledger)
  const next: NotificationLedgerEntry[] = [...keep]

  for (const entry of cancel) {
    try {
      await cancelLocalNotification(entry.id)
    } catch {
      next.push(entry)
    }
  }
  for (const { channel, ...entry } of schedule) {
    try {
      await scheduleLocalNotification({
        id: entry.id,
        title: entry.title,
        body: entry.body,
        scheduleAt: new Date(entry.fireAt),
        channel,
      })
      next.push(entry)
    } catch {
      // 덮어쓰려던 옛 예약이 OS 에 남아 있을 수 있다. 원장의 옛 줄을 지켜 나중에 지목할 수 있게 한다.
      const previous = ledger.find((old) => old.id === entry.id)
      if (previous !== undefined) next.push(previous)
    }
  }
  await setNotificationLedger(next)
}

let running: Promise<void> | null = null
let again = false

/**
 * 재조정을 요청한다. 돌고 있으면 끝난 뒤 한 번 더 돈다. 둘이 겹쳐 돌면 원장을 서로 덮어 예약을 잃는다.
 *
 * @example void requestNotificationReconcile()
 */
export function requestNotificationReconcile(): Promise<void> {
  if (running !== null) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      // 실패는 삼킨다. 다음 재조정이 같은 계획으로 다시 한다.
      await reconcileLocalNotifications(new Date()).catch(() => undefined)
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}
