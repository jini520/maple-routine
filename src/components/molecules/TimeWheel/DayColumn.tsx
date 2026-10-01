/**
 * 시 휠 왼쪽의 날짜 열. 날짜는 날마다 한 번만, 고정 머리처럼 가운데 띠에 붙는다.
 *
 * 당일 날짜는 같은 날 시각을 고르는 동안 띠에 머문다. 다음 날 날짜는 `00` 줄 옆에서 흐리게 먼저 보이다가,
 * `00` 이 띠에 닿으면 당일 날짜를 밀어 올리고 띠에 머문다.
 */
import { useScrollContentOffset } from '@quidone/react-native-wheel-picker'
import { useEffect, useMemo } from 'react'
import { Animated, View } from 'react-native'

import { Text } from '../../atoms'

/** 날짜 열 폭 */
export const DAY_COLUMN_WIDTH = 64

/** 휠 바깥에서 시 휠의 스크롤 값을 받아 오는 다리. 그 값은 휠 안에서만 읽힌다 */
export function ScrollOffsetBridge(props: { onOffset: (offset: Animated.Value) => void }): null {
  const offset = useScrollContentOffset()
  const { onOffset } = props
  useEffect(() => {
    onOffset(offset)
  }, [offset, onOffset])
  return null
}

export interface DayColumnProps {
  /** 시 휠의 스크롤 값(px). 아직 못 받았으면 `null` */
  offset: Animated.Value | null
  /** 시 열에서 `00` 이 선 차례. 0 이면 다음 날 칸이 없다 */
  boundary: number
  today: string
  next: string
  itemHeight: number
  /** 3D 휠이 실제로 차지하는 높이 */
  pickerHeight: number
  /** 가운데에서 한 칸 · 두 칸 떨어진 줄이 화면에서 놓이는 거리. 원통이라 칸 높이의 배수가 아니다 */
  nearY: number
  farY: number
}

export function DayColumn(props: DayColumnProps): React.JSX.Element {
  const { offset, boundary, itemHeight: h, nearY, farY } = props
  const motion = useMemo(() => {
    if (offset === null || boundary <= 0) return null
    const range = (from: number) => [(boundary + from) * h, (boundary + from + 1) * h, (boundary + from + 2) * h]
    return {
      nextY: offset.interpolate({ inputRange: range(-2), outputRange: [farY, nearY, 0], extrapolate: 'clamp' }),
      nextOpacity: offset.interpolate({ inputRange: range(-2), outputRange: [0, 0.45, 1], extrapolate: 'clamp' }),
      todayY: offset.interpolate({ inputRange: range(-1), outputRange: [0, -nearY, -farY], extrapolate: 'clamp' }),
      todayOpacity: offset.interpolate({ inputRange: range(-1), outputRange: [1, 0.45, 0], extrapolate: 'clamp' }),
    }
  }, [offset, boundary, h, nearY, farY])

  const slot = { position: 'absolute' as const, left: 0, right: 0, top: (props.pickerHeight - h) / 2, height: h }
  const label = (text: string): React.JSX.Element => (
    <Text className="text-right text-11 font-semibold text-text-muted" style={{ lineHeight: h }} numberOfLines={1}>
      {text}
    </Text>
  )
  return (
    <View aria-hidden style={{ width: DAY_COLUMN_WIDTH, height: props.pickerHeight, overflow: 'hidden' }}>
      <View style={slot}>
        <Animated.View style={motion === null ? undefined : { transform: [{ translateY: motion.todayY }], opacity: motion.todayOpacity }}>
          {label(props.today)}
        </Animated.View>
      </View>
      {motion !== null && (
        <View style={slot}>
          <Animated.View style={{ transform: [{ translateY: motion.nextY }], opacity: motion.nextOpacity }}>
            {label(props.next)}
          </Animated.View>
        </View>
      )}
    </View>
  )
}
