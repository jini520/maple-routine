import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import { AURORA } from '../../../constants/style/aurora'
import { useThemeMode } from '../../../theme/context'
import type { HoloMotion } from './holo-motion'

/** `Animated.View` 는 NativeWind 등록 탓에 정적 스타일을 버린다. 자리 · 크기까지 애니메이션 스타일로 준다. */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 보스 행은 카드보다 약하다. 같은 재질을 되풀이하되 카드와 행의 위계를 지킨다. */
const VARIANTS = {
  card: { radius: 14, strength: 1 },
  row: { radius: 10, strength: 0.6 },
} as const

/** 금속 띠 한 주기(px)와 그 안의 색 자리. 어두운색 → 중간색 → 밝은색 → 중간색 → 어두운색이다. */
const METAL_PERIOD = 430
const METAL_STOPS = [0, 110, 200, 290, 400, 430]
/** 라이트는 `multiply` 로 합성하므로 금속색을 밝게 둔다. 어두운 금속색이면 흰 카드가 탁해진다. */
const METAL_COLORS = {
  dark: ['#0E152E', '#8FA3A3', '#A3CCCC', '#8FA3A3', '#0E152E', '#0E152E'],
  light: ['#919AAC', '#D2D8DA', '#FFFFFF', '#D2D8DA', '#919AAC', '#919AAC'],
} as const
/** CSS 133° 방향. 금속 띠가 오른쪽 아래로 비스듬히 지나간다. */
const METAL_ANGLE = (133 * Math.PI) / 180

/** 오로라 띠는 한 색에 40px 씩 세로로 반복한다. 처음 색으로 돌아와야 이음매가 안 보인다. */
const AURORA_BAND = 40
const AURORA_LOOP = [
  AURORA.mint,
  AURORA.cyan,
  AURORA.sky,
  AURORA.cobalt,
  AURORA.lilac,
  AURORA.violet,
  AURORA.pink,
  AURORA.mint,
] as const
const AURORA_OFFSETS = AURORA_LOOP.map((_, index) => index * AURORA_BAND)
const AURORA_PERIOD = AURORA_BAND * (AURORA_LOOP.length - 1)

/** 띠가 움직여도 상자 가장자리가 안 보이게 카드보다 사방으로 키우는 폭. 띠가 가장 멀리 가는 거리(180 × 1.7)보다 커야 한다. */
const OVERSCAN = 320
/** 경로 값 1 일 때 두 띠가 미끄러지는 거리(px). 금속은 좌우로, 오로라는 위아래로 주로 움직여 서로 엇갈린다. */
const METAL_SHIFT = { x: 150, y: 30 }
const AURORA_SHIFT = { x: 20, y: 180 }

/** 경로에 따른 세기. 가운데를 지날 때 차분하고 끝으로 갈수록 짙어져야 반사처럼 보인다. */
const OPACITY_FLAT = 0.15
const OPACITY_TILTED = 0.45

/** CSS `repeating-linear-gradient` 를 한 장의 그라디언트로 펼친 색과 자리. `expo-linear-gradient` 에 반복이 없어서다. */
function repeatStops(
  length: number,
  period: number,
  offsets: readonly number[],
  colors: readonly string[],
): { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] } {
  const out = { colors: [] as string[], locations: [] as number[] }
  for (let start = 0; start < length; start += period) {
    offsets.forEach((offset, index) => {
      out.colors.push(colors[index])
      out.locations.push(Math.min(1, (start + offset) / length))
    })
  }
  return out as { colors: [string, string, ...string[]]; locations: [number, number, ...number[]] }
}

/**
 * 고가 드롭 카드 · 보스 행 전면의 오로라 금속빛. 은색 금속 띠와 오로라 색 띠를 겹치고, 두 띠가 엇갈려 흐르는 층.
 *
 * 부모의 바탕과 내용 사이에 둔다. 내용 위에 두면 보스 행 칸 위로 올라온다. 띠 간격이 px 라 카드가 길어져도 위아래가 같은 세기다.
 *
 * @example
 * <View className="bg-surface rounded-[14px]">
 *   <HologramSheen variant="card" motion={motion} />
 *   <View className="relative">...</View>
 * </View>
 */
export function HologramSheen(props: {
  variant: keyof typeof VARIANTS
  motion: HoloMotion
  testID?: string
}): React.JSX.Element {
  const variant = VARIANTS[props.variant]
  const isDark = useThemeMode() === 'dark'
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { x, y } = props.motion

  const boxW = size.width + OVERSCAN * 2
  const boxH = size.height + OVERSCAN * 2
  // CSS 각도 그라디언트의 선 길이. 상자 네 모서리가 모두 선 위의 0~1 사이에 들어간다.
  const metalLength = Math.abs(boxW * Math.sin(METAL_ANGLE)) + Math.abs(boxH * Math.cos(METAL_ANGLE))
  const metal = repeatStops(metalLength, METAL_PERIOD, METAL_STOPS, METAL_COLORS[isDark ? 'dark' : 'light'])
  const metalHalf = {
    x: (Math.sin(METAL_ANGLE) * metalLength) / 2 / boxW,
    y: (-Math.cos(METAL_ANGLE) * metalLength) / 2 / boxH,
  }
  const aurora = repeatStops(boxH, AURORA_PERIOD, AURORA_OFFSETS, AURORA_LOOP)

  const fadeStyle = useAnimatedStyle(() => {
    const magnitude = Math.min(1, (Math.abs(x.value) + Math.abs(y.value)) / 2)
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      opacity: variant.strength * (OPACITY_FLAT + (OPACITY_TILTED - OPACITY_FLAT) * magnitude),
    }
  })
  const metalStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: -OVERSCAN,
    top: -OVERSCAN,
    width: boxW,
    height: boxH,
    transform: [{ translateX: x.value * METAL_SHIFT.x }, { translateY: y.value * METAL_SHIFT.y }],
  }))
  const auroraStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: -OVERSCAN,
    top: -OVERSCAN,
    width: boxW,
    height: boxH,
    // 금속 띠의 밝기 위에 오로라의 색조와 채도를 그대로 얹는다. `hue` 는 채도를 거의 회색인 금속에서 가져와 오로라가 회색이 된다.
    mixBlendMode: 'color',
    transform: [{ translateX: x.value * AURORA_SHIFT.x }, { translateY: y.value * AURORA_SHIFT.y }],
  }))

  return (
    <View
      testID={props.testID ?? 'hologram-sheen'}
      pointerEvents="none"
      onLayout={(event: LayoutChangeEvent) => {
        const next = event.nativeEvent.layout
        setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : { width: next.width, height: next.height }))
      }}
      style={[
        StyleSheet.absoluteFill,
        // `color-dodge` 는 카드 바탕색을 키워 붉은 바탕 테마에서 붉어진다. 검정에 가까운 카드 위의 `screen` 은 효과 층의 색을 따른다.
        { overflow: 'hidden', borderRadius: variant.radius, mixBlendMode: isDark ? 'screen' : 'multiply' },
      ]}
    >
      {size.width > 0 && (
        <AnimatedBox style={fadeStyle}>
          <View style={[StyleSheet.absoluteFill, { isolation: 'isolate' }]}>
            <AnimatedBox style={metalStyle}>
              <LinearGradient
                colors={metal.colors}
                locations={metal.locations}
                start={{ x: 0.5 - metalHalf.x, y: 0.5 - metalHalf.y }}
                end={{ x: 0.5 + metalHalf.x, y: 0.5 + metalHalf.y }}
                style={StyleSheet.absoluteFill}
              />
            </AnimatedBox>
            <AnimatedBox style={auroraStyle}>
              <LinearGradient
                colors={aurora.colors}
                locations={aurora.locations}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </AnimatedBox>
          </View>
        </AnimatedBox>
      )}
    </View>
  )
}
