import { registerPlugin } from '@capacitor/core'

export interface HuntingTimerState {
  isRunning: boolean
  startedAt: string | null
  soundIntervalMinutes: number | null
}

export interface HuntingTimerPlugin {
  start(options: { soundIntervalMinutes: number }): Promise<void>
  stop(): Promise<void>
  getState(): Promise<HuntingTimerState>
}

const HuntingTimer = registerPlugin<HuntingTimerPlugin>('HuntingTimer', {
  web: () => import('./hunting-timer.web').then((m) => new m.HuntingTimerWeb()),
})

export default HuntingTimer
