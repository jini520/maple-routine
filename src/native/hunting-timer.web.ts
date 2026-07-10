// 실제 Android Foreground Service / iOS Live Activity 네이티브 구현은 별도 task([[ADR-005]])
import type { HuntingTimerPlugin, HuntingTimerState } from './hunting-timer'

export class HuntingTimerWeb implements HuntingTimerPlugin {
  private state: HuntingTimerState = {
    isRunning: false,
    startedAt: null,
    soundIntervalMinutes: null,
  }

  async start(options: { soundIntervalMinutes: number }): Promise<void> {
    this.state = {
      isRunning: true,
      startedAt: new Date().toISOString(),
      soundIntervalMinutes: options.soundIntervalMinutes,
    }
  }

  async stop(): Promise<void> {
    this.state = {
      isRunning: false,
      startedAt: null,
      soundIntervalMinutes: null,
    }
  }

  async getState(): Promise<HuntingTimerState> {
    return this.state
  }
}
