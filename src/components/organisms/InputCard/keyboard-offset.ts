/**
 * 카드를 키보드 위에 붙일 때 쓰는 키보드 높이.
 *
 * **Reanimated 가 잰다.** 값이 UI 스레드에서 갱신돼 JS 왕복 없이 프레임 단위로 따라간다. 카드가
 * 키보드와 같이 움직이는 느낌이 여기서 나온다.
 *
 * 만들 때 방법 셋(RN `Keyboard` 이벤트 · 이것 · `react-native-keyboard-controller`)을 다 구현해
 * 시뮬레이터에서 눌러 보고 골랐다(2026-09-20). 고른 근거는 느낌과 **배포 경로**다. 이 기능은
 * OTA 로 먼저 나가는데 keyboard-controller 는 네이티브 모듈이라 그 길로 못 간다.
 *
 * **이 훅은 deprecated 다.** 타입 선언이 대체제로 `react-native-keyboard-controller` 를 이름으로
 * 지정한다. 그래서 이 선택은 OTA 경로를 **임시로** 지키는 것이고, 다음 스토어 빌드에서 그쪽으로
 * 옮긴다.
 */
import { useAnimatedKeyboard, type SharedValue } from 'react-native-reanimated'

/** 읽기만 하는 키보드 높이. */
export type KeyboardHeight = Readonly<SharedValue<number>>

export function useKeyboardHeight(): KeyboardHeight {
  return useAnimatedKeyboard().height
}
