/**
 * 파티 약속 알림 스위치(설정 > 알림 설정의 `파티 약속 알림`)를 드는 스토어. 기본은 켜짐이다.
 *
 * 알림 체크 상자를 켤 때 이 값이 꺼져 있으면 시트가 `스케줄 알림이 꺼져있어요` 모달을 띄운다.
 */
import { create } from 'zustand'

import { getPartyAlarmEnabled, setPartyAlarmEnabled } from '../../storage/party-appointment-settings'

export interface PartyAlarmSettingsState {
  enabled: boolean
  /** 기기 값을 한 번이라도 읽었는가 */
  loaded: boolean
  load: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
}

export const usePartyAlarmSettingsStore = create<PartyAlarmSettingsState>((set) => ({
  enabled: true,
  loaded: false,
  load: async () => {
    set({ enabled: await getPartyAlarmEnabled(), loaded: true })
  },
  setEnabled: async (enabled) => {
    set({ enabled })
    await setPartyAlarmEnabled(enabled)
  },
}))
