/**
 * 얼굴에 붙는 **조회 불가 표식** 하나. 자리는 붙이는 쪽이 정한다.
 *
 * 부품이 따로 있는 것은 놓는 자리가 둘로 갈리기 때문이다. 보통은 `CharacterAvatar` 가 자기 원의
 * 오른쪽 아래에 얹지만, 레일 초상은 그 위에 진행 링 SVG 가 통째로 덮여 있어 표식이 링 아래로
 * 들어간다. 그 자리만 슬롯이 직접 얹는다. 그림은 하나여야 두 자리가 안 갈린다.
 *
 * **링을 그리는 자리는 링을 먼저 그려야 한다.** RN 은 형제 순서가 곧 그리는 순서라 뒤에 선 링이
 * 이 표식을 덮는다. 보스 수익 머리(`compact`)가 그렇게 깔렸었다.
 *
 * 크기를 **받는다**. 얼굴이 자리마다 다르고(레일 40 · 카드 26) 고정값으로 두면 작은 얼굴에서는
 * 표식이 얼굴을 덮는다. 얼마로 할지는 얼굴을 아는 쪽이 정한다(`CharacterAvatar`).
 */
import { View } from 'react-native'

import { AlertTriangleIcon } from '../../atoms'

export function UnavailableFaceMark(props: { size: number }): React.JSX.Element {
  return (
    <View
      testID="portrait-unavailable"
      pointerEvents="none"
      role="img"
      aria-label="조회 불가"
      style={{ width: props.size, height: props.size }}
      className="items-center justify-center rounded-full bg-error-tint"
    >
      <AlertTriangleIcon
        // 아이콘은 표식 원의 6할. 나머지가 테두리 여백이라 원으로 읽힌다.
        style={{ width: props.size * 0.6, height: props.size * 0.6 }}
        className="text-error-ink"
        strokeWidth={3}
        aria-hidden
      />
    </View>
  )
}
