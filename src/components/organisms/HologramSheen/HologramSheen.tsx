import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'

import { AURORA } from '../../../constants/style/aurora'
import { useThemeMode } from '../../../theme/context'
import { HOLO_REACH, type HoloMotion } from './holo-motion'

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
/** CSS 133° 방향. 금속 띠가 오른쪽 아래로 비스듬히 지나간다. 가로 그라디언트를 이만큼 돌린다. */
const METAL_ROTATE_DEG = 133 - 90

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

/** 경로 값 1 일 때 두 띠가 미끄러지는 거리(px). 금속은 좌우로, 오로라는 위아래로 주로 움직여 서로 엇갈린다. */
const METAL_SHIFT = { x: 150, y: 30 }
const AURORA_SHIFT = { x: 20, y: 180 }
/** 띠가 가장 멀리 가는 거리(px). 이동 폭과 경로 끝에서 계산해 그 둘이 바뀌어도 따라온다. */
const TRAVEL = Math.ceil(Math.max(METAL_SHIFT.x, METAL_SHIFT.y, AURORA_SHIFT.x, AURORA_SHIFT.y) * HOLO_REACH)

/** 띠가 덮는 카드의 최대 크기(pt). 상자는 카드를 재지 않는 고정 크기라 이보다 큰 카드는 가장자리가 빈다. 펼친 월간 카드도 이 안이다. */
export const HOLO_COVER = 2400
/**
 * 그라디언트 비트맵의 두께(pt). iOS 는 뷰 크기만큼의 비트맵을 메인 스레드에서 그리고 크기가 바뀌면 다시 그린다.
 * 그라디언트는 직각 방향으로 색이 같으니 가늘게 그려 그쪽으로 GPU 변환으로 늘린다.
 */
const STRIP = 8

/** 오로라 띠 상자. 세로로 카드 위 `TRAVEL` 부터 `HOLO_COVER` 아래 `TRAVEL` 까지이고, 가로는 가운데에서 양쪽으로 늘린다. */
const AURORA_LENGTH = HOLO_COVER + TRAVEL * 2
const AURORA_SCALE = AURORA_LENGTH / STRIP
/** 금속 띠 상자. 돌아가 있어 길이 · 두께 모두 카드 대각선에 이동 거리를 더한 만큼이다. */
const METAL_LENGTH = Math.ceil(HOLO_COVER * Math.SQRT2 + TRAVEL * 2)
const METAL_SCALE = METAL_LENGTH / STRIP

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

/** 상자가 고정 크기라 색 자리도 한 번만 편다. */
const METAL_GRADIENT = {
  dark: repeatStops(METAL_LENGTH, METAL_PERIOD, METAL_STOPS, METAL_COLORS.dark),
  light: repeatStops(METAL_LENGTH, METAL_PERIOD, METAL_STOPS, METAL_COLORS.light),
}
const AURORA_GRADIENT = repeatStops(AURORA_LENGTH, AURORA_PERIOD, AURORA_OFFSETS, AURORA_LOOP)

/**
 * 고가 드롭 카드 · 보스 행 전면의 오로라 금속빛. 은색 금속 띠와 오로라 색 띠를 겹치고, 두 띠가 엇갈려 흐르는 층.
 *
 * 부모의 바탕과 내용 사이에 둔다. 내용 위에 두면 보스 행 칸 위로 올라온다. 카드를 재지 않고 카드와 같은 프레임에 선다.
 * 띠 간격이 px 라 카드가 길어져도 위아래가 같은 세기다.
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
  const metal = METAL_GRADIENT[isDark ? 'dark' : 'light']
  const { x, y } = props.motion

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
  // 변환은 뒤에서부터 걸린다. 두께로 늘리고, 돌리고, 경로만큼 옮긴다.
  const metalStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -METAL_LENGTH / 2,
    marginTop: -STRIP / 2,
    width: METAL_LENGTH,
    height: STRIP,
    transform: [
      { translateX: x.value * METAL_SHIFT.x },
      { translateY: y.value * METAL_SHIFT.y },
      { rotate: `${METAL_ROTATE_DEG}deg` },
      { scaleY: METAL_SCALE },
    ],
  }))
  const auroraStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: '50%',
    top: -TRAVEL,
    marginLeft: -STRIP / 2,
    width: STRIP,
    height: AURORA_LENGTH,
    // 금속 띠의 밝기 위에 오로라의 색조와 채도를 그대로 얹는다. `hue` 는 채도를 거의 회색인 금속에서 가져와 오로라가 회색이 된다.
    mixBlendMode: 'color',
    transform: [
      { translateX: x.value * AURORA_SHIFT.x },
      { translateY: y.value * AURORA_SHIFT.y },
      { scaleX: AURORA_SCALE },
    ],
  }))

  return (
    <View
      testID={props.testID ?? 'hologram-sheen'}
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        // `color-dodge` 는 카드 바탕색을 키워 붉은 바탕 테마에서 붉어진다. 검정에 가까운 카드 위의 `screen` 은 효과 층의 색을 따른다.
        { overflow: 'hidden', borderRadius: variant.radius, mixBlendMode: isDark ? 'screen' : 'multiply' },
      ]}
    >
      <AnimatedBox style={fadeStyle}>
        <View style={[StyleSheet.absoluteFill, { isolation: 'isolate' }]}>
          <AnimatedBox testID="hologram-metal" style={metalStyle}>
            <LinearGradient
              colors={metal.colors}
              locations={metal.locations}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </AnimatedBox>
          <AnimatedBox testID="hologram-aurora" style={auroraStyle}>
            <LinearGradient
              colors={AURORA_GRADIENT.colors}
              locations={AURORA_GRADIENT.locations}
              start={{ x: 0.5, y: 1 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </AnimatedBox>
        </View>
      </AnimatedBox>
    </View>
  )
}
