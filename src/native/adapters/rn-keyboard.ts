import { Keyboard } from 'react-native'

import type { KeyboardPort } from '../ports'

/**
 * `KeyboardPort` 의 RN 구현.
 *
 * 키보드가 뜨면 화면 하단에 고정된 탭바가 키보드 바로 위에 얹혀 어색하므로 그동안 숨긴다.
 *
 * `did` 계열을 쓴다. `keyboardWillShow`/`keyboardWillHide` 는 iOS 에서만 온다. 안드로이드에서
 * 안 오는 이벤트에 매달리면 그 플랫폼에서 탭바가 키보드 위에 그대로 남는다. 대가는 반응이
 * 애니메이션 시작이 아니라 완료 시점이라는 것이고, 둘 다 듣는 것은 답이 아니다. iOS 에서
 * will → did 로 두 번 불린다.
 *
 * 그마저도 안드로이드는 `android:windowSoftInputMode` 에 따라 안 올 수 있다. 그때는 아무것도
 * 부르지 않는다. 타이머나 포커스 추적으로 거짓 신호를 만들면 키보드가 없는데 탭바가 사라지고,
 * 그 오작동은 가끔 탭바가 없다 로만 보여 원인을 못 짚는다.
 *
 * 플랫폼 가드가 없는 것은 이 앱이 빌드하는 타깃이 iOS·Android 둘뿐이기 때문이다.
 */
export const rnKeyboardPort: KeyboardPort = {
  // RN 쪽 `addListener` 는 동기지만 포트는 Promise 다. 그 차이는 `async` 하나로 흡수한다.
  async addVisibilityListener(onChange) {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      onChange(true)
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      onChange(false)
    })

    // 해제는 **두 구독을 다** 뗀다. 하나라도 남으면 화면 전환마다 리스너가 쌓이고, 언마운트된
    // 화면의 `onChange` 가 계속 불린다.
    return () => {
      show.remove()
      hide.remove()
    }
  },
}
