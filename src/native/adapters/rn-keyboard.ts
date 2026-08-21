import { Keyboard } from 'react-native'

import type { KeyboardPort } from '../ports'

/**
 * `KeyboardPort` 의 RN 구현([[ADR-128]] 결정 4 — 밖으로 나가는 시그니처는 Capacitor 구현과 한 글자도
 * 다르지 않다).
 *
 * 쓰임은 그대로다 — 키보드가 뜨면 화면 하단에 고정된 탭바가 키보드 바로 위에 얹혀 어색하므로 그동안
 * 숨긴다.
 *
 * **`did` 계열을 쓴다.** Capacitor 는 `keyboardWillShow`/`keyboardWillHide` 였지만 RN 에서 그 둘은
 * **iOS 에서만** 온다 — 안드로이드에서 안 오는 이벤트에 매달리면 그 플랫폼에서 탭바가 키보드 위에
 * 그대로 남는다. 대가는 반응이 애니메이션 **시작**이 아니라 **완료** 시점이라는 것이고, 둘 다 듣는
 * 것은 답이 아니다(iOS 에서 will → did 로 두 번 불린다).
 *
 * 그마저도 안드로이드는 `android:windowSoftInputMode` 에 따라 안 올 수 있다(API 30 미만은
 * `adjustResize`/`adjustPan` 일 때의 레이아웃 변화 관측에 기댄다 — `Keyboard.js:141-143`). 그때는
 * **아무것도 부르지 않는다** — 타이머나 포커스 추적으로 거짓 신호를 만들면 키보드가 없는데 탭바가
 * 사라지고, 그 오작동은 "가끔 탭바가 없다"로만 보여 원인을 못 짚는다.
 *
 * 플랫폼 가드가 없는 것은 app-rn 이 빌드하는 타깃이 iOS·Android 둘뿐이기 때문이다(Capacitor 구현이
 * `web` 을 걸러낸 것은 브라우저에 키보드 개념이 없어서였고, 그 타깃이 없다).
 */
export const rnKeyboardPort: KeyboardPort = {
  // RN 쪽 `addListener` 는 동기지만 포트는 Promise 다 — 그 차이는 `async` 하나로 흡수한다.
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
