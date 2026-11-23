/**
 * 기록을 쓰거나 스케줄 회차가 넥슨에서 받으면 동기화를 깨운다. 네트워크가 되면 입력 직후에 올라가고 거절도 곧바로 온다. 회차가 받을
 * 때마다 서버 기록도 받아, 새로고침 한 번에 넥슨 데이터와 다른 기기의 기록이 함께 최신이 된다.
 *
 * 판을 올리는 저장 함수는 판 알림으로, 판이 없는 저장 함수와 Preferences 기록은 `noteRecordsWritten` 으로 알린다. 한 저장이 여러 판을
 * 올려도 같은 작업 안의 알림은 한 번으로 모은다. 도는 중에 깨우면 동기화가 끝난 뒤 한 번 더 돈다(`kick.ts`). 동기화가 화면을 다시
 * 읽으려고 올린 판은 깨우지 않는다(`wake-guard.ts`).
 */
import { subscribeBossDropRecordsRevision } from '../../storage/boss-drops'
import { subscribeBossProfitRecordsRevision } from '../../storage/boss-profit'
import { subscribeEnhancementTotalsRevision } from '../../storage/enhancement-totals'
import { subscribeIncomeRecordsRevision } from '../../storage/income'
import { subscribeInventoryItemsRevision } from '../../storage/inventory'
import { subscribeRecordsWritten } from '../../storage/server-sync-queue'
import { subscribeSpendRecordsRevision } from '../../storage/spend'
import { subscribeScheduleRoundReceived } from '../schedule-sync/schedule-query'
import { kickServerSync } from './kick'
import { isServerSyncWakeSilenced } from './wake-guard'

const SUBSCRIPTIONS: readonly ((listener: () => void) => () => void)[] = [
  subscribeBossProfitRecordsRevision,
  subscribeBossDropRecordsRevision,
  subscribeIncomeRecordsRevision,
  subscribeSpendRecordsRevision,
  subscribeInventoryItemsRevision,
  subscribeEnhancementTotalsRevision,
  subscribeRecordsWritten,
  subscribeScheduleRoundReceived,
]

/**
 * 쓰기 알림과 회차의 받음 알림을 구독한다. 셸이 앱이 준비된 뒤 한 번 부른다. 준비 전의 쓰기는 준비될 때의 동기화가 올린다.
 *
 * @returns 구독을 전부 떼는 함수
 */
export function startServerSyncAfterWrites(): () => void {
  let scheduled = false
  let stopped = false
  const wake = (): void => {
    if (scheduled || isServerSyncWakeSilenced()) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (!stopped) void kickServerSync()
    })
  }
  const stops = SUBSCRIPTIONS.map((subscribe) => subscribe(wake))
  return () => {
    stopped = true
    for (const stop of stops) stop()
  }
}
