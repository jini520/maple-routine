import { registerPlugin } from '@capacitor/core'
import type { HuntingTimerPort } from '@core/native/ports'

/**
 * `HuntingTimerPort` 의 Capacitor 구현([[ADR-128]], [[ADR-005]]).
 *
 * 웹 폴백을 그대로 유지한다 — `registerPlugin` 의 `web` 옵션이 네이티브가 없는 환경에서
 * `HuntingTimerWeb`(인메모리 상태)을 대신 물려준다.
 */
export const capacitorHuntingTimerPort: HuntingTimerPort = registerPlugin<HuntingTimerPort>(
  'HuntingTimer',
  {
    web: () =>
      import('@core/native/hunting-timer/hunting-timer.web').then((m) => new m.HuntingTimerWeb()),
  },
)
