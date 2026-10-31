/**
 * TanStack Query 의 포커스를 RN 의 `AppState` 에 잇는 함수. RN 에는 `visibilitychange` 가 없어 이것을 안 하면
 * 앱이 돌아와도 어느 쿼리도 다시 받지 않는다.
 *
 * `inactive` 에서 `active` 로 오는 것은 세지 않는다. iOS 에서 알림 센터를 내렸다 올리거나 시스템 팝업이 떴다 닫힐 때
 * 그렇게 바뀌는데, 그때는 앱이 배경에 간 적이 없다. 배경에 갈 때 꺼서, 돌아올 때 켜지는 변화가 생기게 한다.
 *
 * 앱의 복귀 신호는 이것 하나다. 쿼리 밖의 일은 `hooks/useReturnToForeground` 로 같은 신호를 받는다.
 */
import { AppState, type AppStateStatus } from 'react-native'
import { focusManager } from '@tanstack/react-query'

/** @returns 리스너를 떼는 함수 */
export function installAppStateFocus(): () => void {
  focusManager.setEventListener((onFocus) => {
    let previous: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') onFocus(false)
      else if (previous === 'background' && next === 'active') onFocus(true)
      previous = next
    })
    return () => subscription.remove()
  })
  return () => {
    focusManager.setEventListener(() => undefined)
  }
}
