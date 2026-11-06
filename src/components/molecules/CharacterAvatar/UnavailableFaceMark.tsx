/**
 * 조회할 수 없는 캐릭터의 얼굴 원을 통째로 덮는 덮개와 경고 아이콘.
 *
 * 얼굴 원(`CharacterAvatar`)이 자르는 상자 안에 그린다. 크기를 받는 것은 아이콘이 얼굴 지름을 따라
 * 커져야 해서다.
 */
import { View } from 'react-native'

import { AlertTriangleIcon } from '../../atoms'

/** 아이콘 지름을 얼굴 지름에 대는 비율. */
const ICON_RATIO = 0.62

export function UnavailableFaceMark(props: { size: number }): React.JSX.Element {
  const iconSize = props.size * ICON_RATIO
  return (
    <View
      testID="portrait-unavailable"
      pointerEvents="none"
      role="img"
      aria-label="조회 불가"
      className="absolute inset-0 items-center justify-center"
    >
      {/* 덮개만 반투명이다. 아이콘을 이 층 안에 두면 아이콘까지 옅어진다. */}
      <View className="absolute inset-0 bg-error-tint opacity-70" />
      <AlertTriangleIcon
        style={{ width: iconSize, height: iconSize }}
        className="text-error-ink"
        strokeWidth={2.25}
        aria-hidden
      />
    </View>
  )
}
