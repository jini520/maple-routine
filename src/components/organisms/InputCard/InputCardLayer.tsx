/**
 * 카드를 키보드 바로 위에 앉히는 껍데기.
 *
 * **창 전체를 덮는 오버레이다.** 앱 셸이 `BottomSheetModalProvider` **뒤에** 이것을 세우므로 시트
 * 위에 그려지고, 평범한 터치 트리 안이라 누르개가 살아 있다.
 *
 * RN 의 `Modal` 로 띄우면 안 된다. 트리 안에 인라인으로 서서 **카드 안의 누르개가 터치를 하나도
 * 못 받았다**(실기 확인). 자리와 그림은 멀쩡한데 누르기만 전부 죽고 글자만 들어간다.
 *
 * 키보드 높이는 Reanimated 가 잰다(`keyboard-offset`). 만들 때 방법 셋을 다 구현해 눌러 보고
 * 고른 것이고, 고른 뒤 나머지 둘과 고르개를 걷었다.
 */
import { View } from 'react-native'
import { useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

import { InputCard, type InputCardProps } from './InputCard'
import { useKeyboardHeight } from './keyboard-offset'

export type InputCardLayerProps = InputCardProps

export function InputCardLayer(card: InputCardLayerProps): React.JSX.Element {
  const height = useKeyboardHeight()
  /**
   * 이 카드가 사는 동안 본 **가장 큰** 키보드 높이. 한 번 올라온 뒤로는 안 내려간다(사용자 지정).
   *
   * 키보드는 카드가 열린 동안에도 닫힐 수 있다. 판의 빈 자리를 누르거나 아래로 쓸어내리는
   * 자리가 그렇다. 그때마다 카드가 창 바닥까지 내려갔다 올라오면 치던 자리가 흔들린다.
   *
   * **`0 보다 큰 마지막 값` 이 아니라 `가장 큰 값` 이다.** Reanimated 는 키보드가 닫히는 동안
   * 값이 연속으로 내려온다(291 → 250 → … → 0.5 → 0). 마지막 값을 붙들면 그 작은 값들을 받아들여
   * 카드가 키보드를 따라 같이 내려갔다(사용자가 잡았다).
   *
   * 높이는 그때 올라온 키보드에서 잰 값이라 OS 도 키보드 종류도 알아서 따라간다. 카드는 칸
   * 하나를 받고 닫히므로 사는 동안 키보드 종류가 안 바뀌고, 그래서 가장 큰 값이 곧 그 키보드의
   * 높이다. 카드가 닫히면 이 값도 함께 사라진다.
   */
  const held = useSharedValue(0)
  useAnimatedReaction(
    () => height.get(),
    (measured) => {
      if (measured > held.get()) held.set(measured)
    },
  )

  /*
    키보드 위로 판을 올린다.

    **레이아웃이 아니라 `transform` 으로 옮긴다.** 레이아웃 속성을 Reanimated 로 움직이면 그림만
    옮겨 가고 터치 영역이 제자리에 남을 수 있다.

    **바깥 상자가 아니라 판만 옮긴다.** 바깥에 여백을 주면 스크림이 그 위에서 끊겨 키보드와 카드
    사이에 안 덮인 띠가 남는다(사용자가 실기 화면에서 잡았다).
  */
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -held.get() }] }))

  return (
    <View testID="input-card-layer" className="absolute inset-0">
      <InputCard {...card} panelStyle={panelStyle} />
    </View>
  )
}
