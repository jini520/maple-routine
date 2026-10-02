/**
 * 알림 체크 상자를 켤 때와 저장할 때의 확인 차례. 기기 알림 권한 → 파티 약속 알림 스위치이고, 걸리는 첫 하나만 낸다.
 *
 * 시트가 결과마다 모달을 고른다.
 */
import { hasNotificationPermission, requestNotificationPermission } from '../../native/notifications'
import { getNotificationPermissionAsked, setNotificationPermissionAsked } from '../../storage/notice-settings'

export type AlarmGateResult = { kind: 'ok' } | { kind: 'permission' } | { kind: 'switch' }

export interface AlarmGateDeps {
  /** 권한이 있으면 참. 한 번도 안 물었으면 여기서 OS 팝업을 띄운다 */
  ensurePermission: () => Promise<boolean>
  /** 설정의 `파티 약속 알림` 스위치 */
  switchEnabled: boolean
}

export async function checkAlarmGate(deps: AlarmGateDeps): Promise<AlarmGateResult> {
  if (!(await deps.ensurePermission())) return { kind: 'permission' }
  if (!deps.switchEnabled) return { kind: 'switch' }
  return { kind: 'ok' }
}

/**
 * 알림 권한이 있으면 참. 없고 한 번도 묻지 않았으면 OS 팝업을 띄워 답을 낸다. 물었는데 없으면 거짓이다.
 *
 * 묻기 전에 물었다고 적는다. OS 팝업은 뜨는 순간 소모되어, 뒤에 적으면 그 사이 앱이 죽었을 때 다시 물으려다 아무것도 안 뜬다.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (await hasNotificationPermission().catch(() => false)) return true
  if (await getNotificationPermissionAsked()) return false
  await setNotificationPermissionAsked()
  return requestNotificationPermission().catch(() => false)
}
