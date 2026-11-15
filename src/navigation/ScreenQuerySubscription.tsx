/**
 * 화면 하나의 포커스를 `QuerySubscribedContext` 로 내리는 감싸개. 내비게이터의 `screenLayout` 이 화면마다 둔다.
 * 안쪽 내비게이터의 화면은 부모가 안 보이면 자기도 안 보인 것으로 친다(`isFocused` 가 부모를 본다).
 */
import { useCallback, useSyncExternalStore, type ReactNode } from 'react'

import { QuerySubscribedContext } from '../features/query/subscription'

/** 포커스를 묻고 듣는 화면. `screenLayout` 이 받는 `navigation` 이다. */
interface FocusSource {
  isFocused: () => boolean
  addListener: (type: 'focus' | 'blur', callback: () => void) => () => void
}

export function ScreenQuerySubscription(props: { navigation: FocusSource; children: ReactNode }): React.JSX.Element {
  const { navigation } = props
  const subscribe = useCallback(
    (onChange: () => void) => {
      const stopFocus = navigation.addListener('focus', onChange)
      const stopBlur = navigation.addListener('blur', onChange)
      return () => {
        stopFocus()
        stopBlur()
      }
    },
    [navigation],
  )
  const focused = useSyncExternalStore(subscribe, () => navigation.isFocused())
  return <QuerySubscribedContext.Provider value={focused}>{props.children}</QuerySubscribedContext.Provider>
}
