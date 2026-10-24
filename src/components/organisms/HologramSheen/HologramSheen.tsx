import { useEffect, useId, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'
import { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { AURORA } from '../../../constants/style/aurora'
import { AnimatedView, Svg } from '../../../lib/nativewind-interop'
import { subscribeTilt } from '../../../native/tilt'
import { useThemeMode } from '../../../theme/context'

/**
 * 세기 둘. 보스 행은 캐릭터 카드보다 한 단계 약하다(세기 60% · 작은 빛 · 느린 따라옴).
 *
 * `reach` 는 기울기 1 일 때 빛이 중심에서 가는 거리를 상자 크기에 곱한 몫이다.
 */
const VARIANTS = {
  card: {
    radius: 14,
    blobRatio: 0.9,
    opacity: 0.75,
    reach: { x: 0.45, y: 0.5 },
    spring: { damping: 18, stiffness: 90 },
    stops: [
      { offset: '0%', color: AURORA.cyan, opacity: 0.55 },
      { offset: '38%', color: AURORA.lilac, opacity: 0.42 },
      { offset: '65%', color: AURORA.pink, opacity: 0.25 },
      { offset: '100%', color: AURORA.pink, opacity: 0 },
    ],
  },
  row: {
    radius: 10,
    blobRatio: 0.55,
    opacity: 0.45,
    reach: { x: 0.45, y: 0.4 },
    spring: { damping: 20, stiffness: 40 },
    stops: [
      { offset: '0%', color: AURORA.cyan, opacity: 0.5 },
      { offset: '46%', color: AURORA.lilac, opacity: 0.38 },
      { offset: '100%', color: AURORA.lilac, opacity: 0 },
    ],
  },
} as const

/** 다크의 어두운 면에서는 `screen` 으로 빛이 더해지기만 해서, 같은 불투명도면 라이트보다 세 보인다. */
const DARK_STRENGTH = 0.8

/**
 * 고가 드롭 카드 · 보스 행 면 위를 떠다니는 오로라 빛. 폰 기울기를 따라 미끄러지는 층.
 *
 * 부모의 바탕과 내용 사이에 둔다. 내용 위에 두면 글자까지 물든다. 움직임 줄이기면 가운데에 멈춘다.
 *
 * @example
 * <View className="bg-surface rounded-[14px]">
 *   <HologramSheen variant="card" />
 *   <View className="relative">...</View>
 * </View>
 */
export function HologramSheen(props: { variant: keyof typeof VARIANTS; testID?: string }): React.JSX.Element {
  const variant = VARIANTS[props.variant]
  const isDark = useThemeMode() === 'dark'
  const reduceMotion = useReducedMotion()
  const gradientId = useId()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const offsetX = useSharedValue(0)
  const offsetY = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion || size.width === 0) return
    return subscribeTilt((tilt) => {
      offsetX.value = withSpring(tilt.x * size.width * variant.reach.x, variant.spring)
      offsetY.value = withSpring(-tilt.y * size.height * variant.reach.y, variant.spring)
    })
  }, [reduceMotion, size.width, size.height, variant, offsetX, offsetY])

  const blobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }))

  const diameter = size.width * variant.blobRatio

  return (
    <View
      testID={props.testID ?? 'hologram-sheen'}
      pointerEvents="none"
      onLayout={(event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout
        setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
      }}
      style={[
        StyleSheet.absoluteFill,
        {
          overflow: 'hidden',
          borderRadius: variant.radius,
          opacity: variant.opacity * (isDark ? DARK_STRENGTH : 1),
          mixBlendMode: isDark ? 'screen' : 'normal',
        },
      ]}
    >
      {diameter > 0 && (
        <AnimatedView
          style={[
            {
              position: 'absolute',
              width: diameter,
              height: diameter,
              left: (size.width - diameter) / 2,
              top: (size.height - diameter) / 2,
            },
            blobStyle,
          ]}
        >
          <Svg width={diameter} height={diameter}>
            <Defs>
              <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                {variant.stops.map((stop) => (
                  <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                ))}
              </RadialGradient>
            </Defs>
            <Circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2} fill={`url(#${gradientId})`} />
          </Svg>
        </AnimatedView>
      )}
    </View>
  )
}
