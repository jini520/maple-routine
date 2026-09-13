import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

/**
 * 앱이 백그라운드에서 포그라운드로 돌아올 때 부르는 훅. 마운트 순간에는 안 부른다.
 *
 * **`inactive` 에서 `active` 로 오는 것은 안 센다.** iOS 에서 알림 센터를 내렸다 올리거나 시스템
 * 팝업이 떴다 닫힐 때 그렇게 바뀌는데, 그때는 앱이 백그라운드로 간 적이 없다.
 *
 * @param onReturn 돌아올 때마다 부를 함수. 참조가 바뀌면 리스너를 다시 단다
 */
export function useReturnToForeground(onReturn: () => void): void {
  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      if (previous === 'background' && next === 'active') onReturn()
      previous = next
    })
    return () => subscription.remove()
  }, [onReturn])
}
