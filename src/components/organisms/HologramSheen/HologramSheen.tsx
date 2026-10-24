import { useEffect, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated'

import { AURORA } from '../../../constants/style/aurora'
import { AnimatedView, LinearGradient } from '../../../lib/nativewind-interop'
import { subscribeTilt } from '../../../native/tilt'
import { useThemeMode } from '../../../theme/context'

/** 세기 둘. 보스 행은 캐릭터 카드보다 한 단계 약하다(세기 60% · 느린 따라옴). */
const VARIANTS = {
  card: { radius: 14, opacity: 0.85, spring: { damping: 18, stiffness: 90 } },
  row: { radius: 10, opacity: 0.85 * 0.6, spring: { damping: 20, stiffness: 40 } },
} as const

/** 다크의 어두운 면에서는 `screen` 으로 빛이 더해지기만 해서, 같은 불투명도면 라이트보다 세 보인다. */
const DARK_STRENGTH = 0.8

/** 반사광 띠의 폭(상자 폭의 배수)과 기울기 1 일 때 옮겨 가는 거리(상자 폭의 배수). */
const GLARE_WIDTH = 2.6
const GLARE_REACH = 0.8

/**
 * 반사광 색. 라이트는 흰 카드 위에서 흰색이 안 보여 청록으로 칠한다.
 */
const GLARE = {
  light: { core: 'rgba(140, 236, 231, 0.6)', edge: 'rgba(167, 159, 225, 0.35)' },
  dark: { core: 'rgba(255, 255, 255, 0.5)', edge: 'rgba(140, 236, 231, 0.35)' },
} as const

const TINT = [`${AURORA.cyan}24`, `${AURORA.lilac}24`, `${AURORA.pink}24`] as const

/** 폰을 세워 들면 앞뒤 값이 늘 −1 가까이라, 천천히 따라가는 기준값과의 차이만 기울기로 쓴다. */
const BASELINE_FOLLOW = 0.02
/** 앞뒤 기울기는 좌우보다 움직이는 폭이 작아 키워서 더한다. */
const PITCH_GAIN = 1.5

/**
 * 고가 드롭 카드 · 보스 행 면의 홀로그램. 옅은 오로라 물들임 위로 사선 반사광 한 줄기가 폰 기울기를 따라 가로지르는 층.
 *
 * 부모의 바탕과 내용 사이에 둔다. 내용 위에 두면 글자까지 물든다. 움직임 줄이기면 반사광이 가운데에 멈춘다.
 *
 * @example
 * <View className="bg-surface rounded-[14px]">
 *   <HologramSheen variant="card" />
 *   <View className="relative">...</View>
 * </View>
 */
export function HologramSheen(props: { variant: keyof typeof VARIANTS; testID?: string }): React.JSX.Element {
  const variant = VARIANTS[props.variant]
  const mode = useThemeMode()
  const isDark = mode === 'dark'
  const glare = GLARE[mode]
  const reduceMotion = useReducedMotion()
  const [width, setWidth] = useState(0)
  const offset = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion || width === 0) return
    let baseline: number | null = null
    return subscribeTilt((tilt) => {
      baseline = baseline === null ? tilt.y : baseline + (tilt.y - baseline) * BASELINE_FOLLOW
      const sway = Math.max(-1, Math.min(1, tilt.x + (tilt.y - baseline) * PITCH_GAIN))
      offset.value = withSpring(sway * width * GLARE_REACH, variant.spring)
    })
  }, [reduceMotion, width, variant, offset])

  const glareStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))

  return (
    <View
      testID={props.testID ?? 'hologram-sheen'}
      pointerEvents="none"
      onLayout={(event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout.width
        setWidth((prev) => (prev === next ? prev : next))
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
      <LinearGradient colors={[...TINT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {width > 0 && (
        <AnimatedView
          style={[
            { position: 'absolute', top: 0, bottom: 0, width: width * GLARE_WIDTH, left: (width - width * GLARE_WIDTH) / 2 },
            glareStyle,
          ]}
        >
          <LinearGradient
            colors={['transparent', glare.edge, glare.core, glare.edge, 'transparent']}
            locations={[0.38, 0.46, 0.5, 0.54, 0.62]}
            start={{ x: 0, y: 0.4 }}
            end={{ x: 1, y: 0.6 }}
            style={StyleSheet.absoluteFill}
          />
        </AnimatedView>
      )}
    </View>
  )
}
