/**
 * 알림을 눌러 열 today 의 남은 스케줄 주기. 앱 위에서 받은 탭을 들고 있다가 남은 스케줄 타일이 세그먼트를 맞추면 비운다.
 */
import { create } from 'zustand'

import type { NotificationData } from '../../native/notifications'
import { SCHEDULE_ALERT_KIND } from './notification'
import type { AlertCycle } from './notification-text'

export interface ScheduleAlertOpenRequest {
  cycle: AlertCycle
  /** 알림의 날짜 키. 같은 탭이 두 길로 와도 한 번만 열기 위한 열쇠 */
  dateKey: string
}

function isAlertCycle(value: string | undefined): value is AlertCycle {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

/** 미완료 스케줄 알림의 `data` 면 열 주기. 아니면 `null` */
export function parseScheduleAlertData(data: NotificationData): ScheduleAlertOpenRequest | null {
  const { kind, cycle, dateKey } = data
  if (kind !== SCHEDULE_ALERT_KIND || dateKey === undefined || !isAlertCycle(cycle)) return null
  return { cycle, dateKey }
}

interface ScheduleAlertOpenState {
  cycle: AlertCycle | null
  open: (cycle: AlertCycle) => void
  clear: () => void
}

export const useScheduleAlertOpenStore = create<ScheduleAlertOpenState>((set) => ({
  cycle: null,
  open: (cycle) => set({ cycle }),
  clear: () => set({ cycle: null }),
}))
