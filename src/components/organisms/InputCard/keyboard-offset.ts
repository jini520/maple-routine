/**
 * 카드를 키보드 위에 붙일 때 쓰는 키보드 높이.
 *
 * `react-native-keyboard-controller` 가 잰다. 값이 UI 스레드에서 갱신돼 JS 왕복 없이 프레임 단위로
 * 따라간다. 앱 셸의 `KeyboardProvider` 아래에서만 값이 온다.
 *
 * 라이브러리의 `height` 는 `translateY` 에 바로 꽂으라고 만든 음수라 부호를 뒤집어 돌려준다.
 */
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import { useDerivedValue, type SharedValue } from 'react-native-reanimated'

/** 읽기만 하는 키보드 높이. */
export type KeyboardHeight = Readonly<SharedValue<number>>

export function useKeyboardHeight(): KeyboardHeight {
  const { height } = useReanimatedKeyboardAnimation()
  return useDerivedValue(() => -height.get())
}
