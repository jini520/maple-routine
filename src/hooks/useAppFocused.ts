import { useSyncExternalStore } from 'react'
import { focusManager } from '@tanstack/react-query'

function subscribe(onChange: () => void): () => void {
  return focusManager.subscribe(onChange)
}

function isFocused(): boolean {
  return focusManager.isFocused()
}

/**
 * 앱이 앞에 떠 있는지 내는 훅.
 *
 * 신호는 `features/query/app-focus.ts` 가 `AppState` 에서 만드는 포커스 하나다. `useReturnToForeground` 와
 * 같은 신호라 규칙이 갈리지 않는다.
 *
 * @returns 앱이 앞에 떠 있으면 참
 */
export function useAppFocused(): boolean {
  return useSyncExternalStore(subscribe, isFocused)
}
