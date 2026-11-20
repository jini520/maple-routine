/**
 * TanStack Query 의 포커스를 RN 의 `AppState` 에 잇는 함수. RN 에는 `visibilitychange` 가 없어 이것을 안 하면
 * 앱이 돌아와도 어느 쿼리도 다시 받지 않는다.
 *
 * `inactive` 에서 `active` 로 오는 것은 세지 않는다. iOS 에서 알림 센터를 내렸다 올리거나 시스템 팝업이 떴다 닫힐 때
 * 그렇게 바뀌는데, 그때는 앱이 배경에 간 적이 없다. 배경에 갈 때 꺼서, 돌아올 때 켜지는 변화가 생기게 한다.
 *
 * 앱의 복귀 신호는 이것 하나다. 쿼리 밖의 일은 `hooks/useReturnToForeground` 로 같은 신호를 받고, 배경에 간 시각은
 * `backgroundedAt()` 으로 읽는다.
 */
import { AppState, type AppStateStatus } from 'react-native'
import { focusManager } from '@tanstack/react-query'

/** JS 가 살아 있음을 적는 간격. 늦게 받은 배경 신호의 시각 오차가 이만큼이다 */
const ALIVE_TICK_MS = 10_000
/** 마지막 기록에서 이만큼 지났으면 JS 가 멈춰 있었다고 본다. 바쁜 JS 가 타이머를 조금 늦게 부른 것은 멈춤이 아니다 */
const STALL_MS = 30_000

let leftAt: number | null = null

/**
 * 마지막으로 배경에 간 시각(ms). iOS 는 JS 가 배경 신호를 처리하기 전에 앱을 멈추기도 해서, 그 신호를 돌아온 뒤에 받았으면
 * JS 가 마지막으로 살아 있던 시각이다.
 *
 * @returns 이번 실행에서 배경에 간 적이 없으면 null
 */
export function backgroundedAt(): number | null {
  return leftAt
}

/** @returns 리스너를 떼는 함수 */
export function installAppStateFocus(): () => void {
  let aliveAt = Date.now()
  const timer = setInterval(() => {
    aliveAt = Date.now()
  }, ALIVE_TICK_MS)
  focusManager.setEventListener((onFocus) => {
    let previous: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        const now = Date.now()
        leftAt = now - aliveAt > STALL_MS ? aliveAt : now
        onFocus(false)
      } else if (previous === 'background' && next === 'active') onFocus(true)
      previous = next
    })
    return () => subscription.remove()
  })
  return () => {
    clearInterval(timer)
    leftAt = null
    focusManager.setEventListener(() => undefined)
  }
}
