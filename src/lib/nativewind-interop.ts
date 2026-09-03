/**
 * 써드파티 컴포넌트의 NativeWind 등록. 등록해야 그 컴포넌트에 준 `className` 이 스타일로
 * 풀린다.
 *
 * SVG·그라디언트·애니메이션 상자는 **여기서 가져올 것.** 원본 모듈에서 직접 가져오면 등록이 안 된
 * 채로 쓰게 되고, 그때 에러 없이 색과 크기만 없다. lucide 아이콘은 `components/atoms/Icon/lucide.ts` 를 거친다.
 */

import { LinearGradient } from 'expo-linear-gradient'
import type { LucideIcon } from 'lucide-react-native'
import { cssInterop } from 'nativewind'
import Animated from 'react-native-reanimated'
import { Svg } from 'react-native-svg'

/**
 * 색과 크기를 프롭으로 받는 `Svg`. `text-*` 는 `color` 프롭이 되어 자식 도형의 `currentColor`
 * 를 채우고, `h-*`·`w-*` 는 SVG 상자 크기가 되어 `size` 프롭의 기본값을 덮는다.
 */
cssInterop(Svg, {
  className: {
    target: 'style',
    nativeStyleToProp: { width: true, height: true, color: true },
  },
})

/** `LinearGradient` 는 크기·여백·모서리를 전부 `style` 로 받아 옮길 프롭이 없다. */
cssInterop(LinearGradient, { className: 'style' })

/**
 * 애니메이션이 붙는 상자. 평범한 `View` 로는 Reanimated 의 CSS 애니메이션
 * (`animationName`·`transitionProperty`)이 안 붙는다.
 */
cssInterop(Animated.View, { className: 'style' })

const AnimatedView = Animated.View

/**
 * lucide 아이콘 하나를 `className` 을 받도록 만드는 등록. `components/atoms/Icon/lucide.ts` 가 아이콘마다 부른다.
 *
 * `text-*` 는 `stroke` 색, `h-*`·`w-*` 는 상자 크기, 나머지 유틸리티는 `style` 로 간다. 새 아이콘은
 * `components/atoms/Icon/lucide.ts` 에 더할 것. `testID` 는 lucide 가 `data-testid` 로 바꾸므로 통하지 않는다. 테스트에서
 * 지목해야 하면 감싸는 `View` 에 준다.
 */
function withIconInterop<T extends LucideIcon>(Icon: T): T {
  // `Icon as LucideIcon` 로 좁히는 이유. `cssInterop` 의 매핑 타입은 컴포넌트 프롭에서 파생되는데,
  // 제네릭 `T` 로는 TS 가 그 조건부 타입을 못 풀어 `target: 'style'` 을 거부한다.
  cssInterop(Icon as LucideIcon, {
    className: {
      target: 'style',
      nativeStyleToProp: { width: true, height: true, color: true },
    },
  })
  return Icon
}

export { AnimatedView, LinearGradient, Svg, withIconInterop }
