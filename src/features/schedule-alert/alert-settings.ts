/**
 * 미완료 스케줄 알림 스위치(설정 > 알림 설정의 `미완료 스케줄 알림`)를 드는 스토어. 기본은 켜짐이다.
 */
import { create } from 'zustand'

import { getScheduleAlertEnabled, setScheduleAlertEnabled } from '../../storage/schedule-alert-settings'
import { requestNotificationReconcile } from '../local-notifications/run'
import { syncBackgroundRefreshRegistration } from './background-refresh'

export interface ScheduleAlertSettingsState {
  enabled: boolean
  /** 기기 값을 한 번이라도 읽었는가 */
  loaded: boolean
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

export const useScheduleAlertSettingsStore = create<ScheduleAlertSettingsState>((set) => ({
  enabled: true,
  loaded: false,
  load: async () => {
    set({ enabled: await getScheduleAlertEnabled(), loaded: true })
  },
  setEnabled: async (enabled) => {
    set({ enabled })
    await setScheduleAlertEnabled(enabled)
    // 끄면 계획이 비어 예약을 취소하고 태스크를 푼다. 켜면 다시 잡고 다시 건다.
    void requestNotificationReconcile()
    await syncBackgroundRefreshRegistration().catch(() => undefined)
  },
}))
