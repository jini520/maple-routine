/**
 * 키보드가 떠 있는지 내는 훅. **하단바 전용**이다.
 *
 * 셸의 `useKeyboardVisible` 을 안 쓰는 것은 그쪽이 core 의 키보드 포트를 지나기 때문이다. 바는
 * core 가 아니라 앱 쪽 RN 코드라, 포트를 태우면 이 바를 그리는 모든 테스트가 포트 주입을 요구하게
 * 되고 얻는 것은 없다.
 *
 * iOS 는 `will`, 안드로이드는 `did` 를 구독한다. 양쪽 다 `did` 로 두면 iOS 에서 한 프레임 늦는다.
 */

import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'

export function useKeyboardShown(): boolean {
  const [isShown, setIsShown] = useState(false)

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsShown(true)
      },
    )
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsShown(false)
      },
    )

    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return isShown
}
