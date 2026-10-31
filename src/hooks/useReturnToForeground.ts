import { useEffect } from 'react'
import { focusManager } from '@tanstack/react-query'

/**
 * 앱이 백그라운드에서 포그라운드로 돌아올 때 부르는 훅. 마운트 순간에는 안 부른다.
 *
 * 신호는 `features/query/app-focus.ts` 가 `AppState` 에서 만드는 포커스 하나다. 쿼리의 복귀 재조회와 같은 신호라 규칙이
 * 갈리지 않는다. iOS 에서 알림 센터를 내렸다 올린 `inactive` → `active` 는 그쪽에서 걸러진다.
 *
 * @param onReturn 돌아올 때마다 부를 함수. 참조가 바뀌면 구독을 다시 단다
 */
export function useReturnToForeground(onReturn: () => void): void {
  useEffect(
    () =>
      focusManager.subscribe((focused) => {
        if (focused) onReturn()
      }),
    [onReturn],
  )
}
