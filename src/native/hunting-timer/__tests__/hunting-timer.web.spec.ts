import { describe, expect, it } from 'vitest'
import { HuntingTimerWeb } from '../hunting-timer.web'

describe('HuntingTimerWeb', () => {
  it('start() 이후 getState()가 isRunning: true와 요청한 soundIntervalMinutes를 반환한다', async () => {
    const timer = new HuntingTimerWeb()

    await timer.start({ soundIntervalMinutes: 2 })
    const state = await timer.getState()

    expect(state.isRunning).toBe(true)
    expect(state.soundIntervalMinutes).toBe(2)
    expect(state.startedAt).not.toBeNull()
  })

  it('stop() 이후 getState()가 isRunning: false를 반환한다', async () => {
    const timer = new HuntingTimerWeb()

    await timer.start({ soundIntervalMinutes: 1 })
    await timer.stop()
    const state = await timer.getState()

    expect(state.isRunning).toBe(false)
  })

  it('시작 전 초기 상태는 isRunning: false다', async () => {
    const timer = new HuntingTimerWeb()

    const state = await timer.getState()

    expect(state).toEqual({ isRunning: false, startedAt: null, soundIntervalMinutes: null })
  })
})
