/**
 * 키보드가 떠 있는가 — **바 전용**이다([[ADR-132]] 대가 «커스텀 바라 잃는 것»).
 *
 * ## 왜 셸의 `useKeyboardVisible` 을 안 쓰는가
 *
 * 그쪽은 core 의 키보드 **포트**를 지난다(`src/native/keyboard`). 포트가 있는 이유는 core 코드가
 * 네이티브를 물어야 하기 때문인데, 바는 core 가 아니라 앱 쪽 RN 코드다. 포트를 태우면 이 바를
 * 그리는 **모든 테스트가 포트 주입을 요구하게 되고**(실측 — 내비게이션 테스트 다섯이 한꺼번에
 * 죽었다), 얻는 것은 없다.
 *
 * ## 그리고 이 형태가 예전 동작에 더 가깝다
 *
 * 옛 탭바는 `tabBarHideOnKeyboard` 로 같은 일을 했고, 라이브러리는 **iOS 는 `will`, 안드로이드는
 * `did`** 이벤트를 구독한다(`useIsKeyboardShown.tsx`). core 어댑터는 양쪽 다 `did` 라 iOS 에서 한
 * 프레임 늦는데, 여기서 직접 구독하면 그 어긋남까지 없어진다 — 옛 `TabNavigator` 주석이 *"하나로
 * 합치려면 셸의 값을 프롭으로 꿰어야 해서 대가가 더 크다"* 로 남겨 둔 자리다.
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
