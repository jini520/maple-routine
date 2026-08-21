import { getHuntingTimerPort, type HuntingTimerPort, type HuntingTimerState } from '../ports'

export type { HuntingTimerState }

/** 웹 폴백(`HuntingTimerWeb`)이 구현하는 표면. 포트와 같은 모양이다. */
export type HuntingTimerPlugin = HuntingTimerPort

const HuntingTimer: HuntingTimerPlugin = {
  start: (options) => getHuntingTimerPort().start(options),
  stop: () => getHuntingTimerPort().stop(),
  getState: () => getHuntingTimerPort().getState(),
}

export default HuntingTimer
