/**
 * 백그라운드 태스크의 몸통과 등록. OS 가 앱을 깨우면 스케줄 회차를 받고 로컬 알림을 재조정한다.
 *
 * 태스크가 한 번도 안 돌아도 알림은 뜬다. 예약은 늘 서 있고, 여기는 그 예약을 그날 상태로 다시 쓰는 기회일 뿐이다.
 */
import { registerBackgroundRefresh, unregisterBackgroundRefresh } from '../../native/background-task'
import { getScheduleAlertEnabled } from '../../storage/schedule-alert-settings'
import { requestNotificationReconcile } from '../local-notifications/run'
import { whenQueryCacheRestored } from '../query/persist'
import { refreshSchedules } from '../schedule-sync/schedule-query'

/** OS 에 거는 최소 간격. 하한일 뿐이고 OS 가 더 늦게 돌린다. 짧게 잡아도 iOS 는 무시하고 안드로이드는 넥슨 호출만 는다 */
export const BACKGROUND_REFRESH_INTERVAL_MINUTES = 120

/**
 * 태스크 몸통. 저장된 캐시를 다 올린 뒤 회차를 받는다. 복원 전에 읽으면 추적 캐릭터가 없는 것으로 보여 계획이 빈다.
 * 회차가 실패해도 재조정한다. 캐시의 마지막 상태로 다시 쓰는 것이고 이미 서 있는 예약과 같으면 아무것도 안 한다.
 */
export async function runBackgroundRefresh(): Promise<void> {
  await whenQueryCacheRestored()
  await refreshSchedules()
  await requestNotificationReconcile()
}

/** 스위치대로 태스크를 걸거나 푼다. 앱을 켤 때와 스위치를 바꿀 때 부른다 */
export async function syncBackgroundRefreshRegistration(): Promise<void> {
  if (await getScheduleAlertEnabled()) await registerBackgroundRefresh(BACKGROUND_REFRESH_INTERVAL_MINUTES)
  else await unregisterBackgroundRefresh()
}
