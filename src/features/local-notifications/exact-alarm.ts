/**
 * 안드로이드 정확한 알람 권한(`알람 및 리마인더`)을 알림 설정 화면에 잇는 스토어.
 *
 * 권한이 꺼져 있으면 파티 · 미완료 스케줄 알림이 정한 시각에서 최대 1시간 늦을 수 있다. 화면은 그것을 카드로 알린다.
 */
import { create } from 'zustand'

import { getExactAlarmSetting, openExactAlarmSettings, type ExactAlarmSetting } from '../../native/notifications'

interface ExactAlarmState {
  /** 아직 못 읽었으면 `null`. 그때 카드를 띄우면 권한이 있는 기기를 없다고 잘못 알린다 */
  setting: ExactAlarmSetting | null
  /**
   * 권한을 읽어 `setting` 에 적는 함수. 실패하면 마지막 값을 그대로 둔다.
   *
   * @example useFocusEffect(useCallback(() => void refresh(), [refresh]))
   */
  refresh: () => Promise<void>
}

export const useExactAlarmStore = create<ExactAlarmState>()((set) => ({
  setting: null,
  refresh: async () => {
    try {
      set({ setting: await getExactAlarmSetting() })
    } catch {
      // 다음에 화면에 들어올 때 다시 읽는다.
    }
  },
}))

export { openExactAlarmSettings }
