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

/** 글자와 시 열 사이 */
const DAY_COLUMN_GAP = 4
/** 가운데 띠 왼쪽 끝과 글자 사이. 없으면 글자가 띠 모서리에 붙는다 */
const DAY_COLUMN_INSET = 8

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

  const slot = { position: 'absolute' as const, left: DAY_COLUMN_INSET, right: DAY_COLUMN_GAP, top: (props.pickerHeight - h) / 2, height: h }
  const label = (text: string): React.JSX.Element => (
    <Text className="text-right text-11 font-semibold text-text-muted" style={{ lineHeight: h }} numberOfLines={1}>
      {text}
    </Text>
  )
  return (
    // 폭을 박지 않는다. 짧은 요일(`금요일`)을 날짜(`10/2 (금)`)에 맞춘 폭에 두면 왼쪽이 크게 빈다.
    <View testID="day-column" aria-hidden style={{ height: props.pickerHeight, overflow: 'hidden', paddingLeft: DAY_COLUMN_INSET, paddingRight: DAY_COLUMN_GAP }}>
      {/* 자리 잡기 줄. 높이 0 · 안 보이는 두 글자가 열 폭을 둘 중 긴 것에 맞춘다(움직이는 글자는 절대 배치라 폭을 못 낸다). */}
      <View testID="day-column-sizer" style={{ height: 0, opacity: 0 }}>
        {label(props.today)}
        {label(props.next)}
      </View>
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
