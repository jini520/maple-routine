/**
 * 조회 중 자리를 잡는 회색 상자.
 *
 * 결과가 들어올 자리와 **같은 치수**로 서는 것이 이 부품의 전부다. 그래서 크기는 호출부가
 * `className`·`style` 로 주고 여기서는 칠과 펄스만 정한다. 회색을 자리마다 고르면 갈리고, 갈린
 * 회색은 다른 뜻으로 읽힌다.
 *
 * 카드 하나가 들어올 자리에는 쓰지 않는다. 그쪽은 `molecules/LoadingState` 의 셸 승계 카드다.
 *
 * **상자가 셋인 이유.** `nativewind-interop` 에 등록된 `Animated.View` 는 `style` 을 주는 순간
 * `className` 을 통째로 버린다(실측 - 크기도 색도 안 남는다). 그래서 자리를 잡는 바깥은 평범한
 * `View` 가 맡고(그쪽은 둘이 제대로 합쳐진다), 펄스는 등록되지 않은 상자가 덮고, 칠은 그 안쪽
 * `View` 가 한다. `NoticeBannerRail` 의 막과 같은 구조다.
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

/** 펄스가 내려가는 바닥. 모션 줄이기를 켜면 여기서 멈춰 선다. */
const DIM = 0.45

/** 한 방향에 걸리는 시간(ms). 왕복이라 한 주기는 이것의 두 배다. */
const PULSE_MS = 900

const PulseBox = Animated.createAnimatedComponent(View)

export interface SkeletonProps {
  /** 크기·모서리를 정하는 유틸리티. 치수를 아는 쪽은 언제나 호출부다 */
  className?: string
  /** 계산해서 낸 치수. 배너처럼 높이가 폭에서 파생되는 자리가 쓴다 */
  style?: { height?: number; aspectRatio?: number }
  /** 칠의 모서리. 배너처럼 각진 자리가 `rounded-none` 을 준다 */
  fillClassName?: string
  testID?: string
}

export function Skeleton(props: SkeletonProps): React.JSX.Element {
  const opacity = useSharedValue(1)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = DIM
      return
    }
    opacity.value = withRepeat(withTiming(DIM, { duration: PULSE_MS }), -1, true)
  }, [reduceMotion, opacity])

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <View
      testID={props.testID}
      aria-hidden
      // 조회 중임을 말하는 것은 감싸는 쪽의 `role="status"` 다. 막대 하나하나는 장식이다.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={props.className}
      style={props.style}
    >
      <PulseBox style={[StyleSheet.absoluteFill, pulse]}>
        <View className={`flex-1 rounded-[4px] bg-surface-2 ${props.fillClassName ?? ''}`} />
      </PulseBox>
    </View>
  )
}
