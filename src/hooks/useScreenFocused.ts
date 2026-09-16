import { useCallback, useContext, useSyncExternalStore } from 'react'
import { NavigationContext } from '@react-navigation/native'

/**
 * 이 컴포넌트가 선 화면이 지금 보이는지 내는 훅.
 *
 * `useIsFocused` 를 못 쓴다. 그 훅은 내비게이터 밖에서 던지는데 이 저장소의 컴포넌트 테스트는
 * 내비게이터 없이 렌더한다. 컨텍스트를 옵션으로 읽고 없으면 보이는 것으로 둔다.
 *
 * @returns 초점 여부. 내비게이터가 없으면 항상 `true`
 */
export function useScreenFocused(): boolean {
  const navigation = useContext(NavigationContext)

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (navigation === undefined) return () => {}

      const unsubscribeFocus = navigation.addListener('focus', onChange)
      const unsubscribeBlur = navigation.addListener('blur', onChange)

      return () => {
        unsubscribeFocus()
        unsubscribeBlur()
      }
    },
    [navigation],
  )

  return useSyncExternalStore(subscribe, () => navigation?.isFocused() ?? true)
}
