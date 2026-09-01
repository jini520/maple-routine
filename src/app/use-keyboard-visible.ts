import { useEffect, useState } from 'react'

import { addKeyboardVisibilityListener } from '../native/keyboard'

/**
 * 키보드가 떠 있는가 — 웹 `AppShell` 의 `isKeyboardVisible` state 자리.
 *
 * **RN 의 `Keyboard` 를 직접 듣지 않고 포트를 거친다.** 그 판정은 1단계가 만든 `rn-keyboard.ts` 에서만 하는
 * 자리이고(iOS 의 `will` 계열을 안 쓰는 이유·안드로이드에서 이벤트가 아예 안 올 수 있다는
 * 사실이 거기 적혀 있다), 화면 코드가 직접 들으면 그 판단이 두 벌이 된다([[ADR-005]] 어댑터 경계).
 *
 * ## 탭바를 숨기는 것은 이 훅이 아니다
 *
 * 웹은 이 값으로 `<BottomTabBar />` 를 **언마운트**했다. RN 에서는 `tabBarHideOnKeyboard`
 * (`TabNavigator`)가 같은 일을 하고, 그쪽은 라이브러리가 자기 `Keyboard` 구독으로 판정한다.
 * 두 관측자가 생기지만 **같은 OS 이벤트**를 보고, iOS 에서만 한 프레임 어긋난다(라이브러리는
 * `keyboardWillShow`, 우리 어댑터는 `keyboardDidShow`). 하나로 합치려면 이 값을 내비게이터까지
 * 프롭으로 꿰거나 라이브러리 옵션을 포기해야 하는데, 그 대가가 어긋남보다 크다.
 *
 * 그래서 이 훅이 남는 이유는 하나다 — **토스트가 탭바 위에 서야 하는지**(`ToastStack.hasTabBar`).
 */
export function useKeyboardVisible(): boolean {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelled = false

    void addKeyboardVisibilityListener(setIsVisible).then((remove) => {
      // 구독이 붙기 전에 언마운트됐으면 곧바로 뗀다 — 아니면 죽은 컴포넌트의 setState 가 남는다.
      if (cancelled) {
        remove()
        return
      }
      unsubscribe = remove
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return isVisible
}
