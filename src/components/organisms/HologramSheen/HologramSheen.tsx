import { useEffect, useId, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { AURORA } from '../../../constants/style/aurora'
import { AnimatedView, Svg } from '../../../lib/nativewind-interop'
import { subscribeTilt } from '../../../native/tilt'
import { useThemeMode } from '../../../theme/context'

/**
 * 세기 둘. 값은 시안(CSS `radial-gradient` + `background-size` · `background-position` 키프레임)을 그대로 옮긴 것이다.
 *
 * `scale` 은 그라디언트 그림 크기를 상자 크기에 곱한 몫이고, 빛 덩이의 반지름은 그 그림의 대각선 절반에 마지막 색 멈춤(`reach`)을 곱한 값이다.
 * 보스 행은 캐릭터 카드보다 한 단계 약하다(세기 60% · 느린 주기 · 작은 빛).
 */
const VARIANTS = {
  card: {
    radius: 14,
    opacity: 0.75,
    scale: { x: 2.2, y: 3.2 },
    reach: 0.58,
    segmentMs: 1500,
    stops: [
      { offset: 0, color: AURORA.cyan, opacity: 0.55 },
      { offset: 0.22 / 0.58, color: AURORA.lilac, opacity: 0.42 },
      { offset: 0.38 / 0.58, color: AURORA.pink, opacity: 0.25 },
      { offset: 1, color: AURORA.pink, opacity: 0 },
    ],
  },
  row: {
    radius: 10,
    opacity: 0.45,
    scale: { x: 2.6, y: 4.2 },
    reach: 0.52,
    segmentMs: 2250,
    stops: [
      { offset: 0, color: AURORA.cyan, opacity: 0.5 },
      { offset: 0.24 / 0.52, color: AURORA.lilac, opacity: 0.38 },
      { offset: 1, color: AURORA.lilac, opacity: 0 },
    ],
  },
} as const

/** 빛이 도는 경로. 시안 키프레임의 `background-position`(0~1)이고, 처음과 끝이 같아 이음매 없이 반복된다. */
const PATH_X = [0, 0.6, 1, 0.4, 0]
const PATH_Y = [0.3, 0, 0.6, 1, 0.3]
const SEGMENTS = PATH_X.length - 1
/** CSS `ease-in-out` 과 같은 곡선. 시안이 구간마다 이 곡선으로 움직인다. */
const EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)

/** 다크의 어두운 면에서는 `screen` 으로 빛이 더해지기만 해서, 같은 불투명도면 라이트보다 세 보인다. */
const DARK_STRENGTH = 0.8

/** 빛을 끝까지 밀었을 때의 거리(상자 폭의 배수). 도는 경로 위에 손의 움직임을 얹는다. */
const TILT_REACH = 0.25
/** 빛이 끝까지 밀리는 기울기(30°, 단위 g). 90° 에 맞추면 손으로 기울이는 15° 쯤에서 빛이 거의 안 밀린다. */
const TILT_FULL = Math.sin(Math.PI / 6)
/** 폰을 세워 들면 앞뒤 값이 늘 −1 가까이라, 천천히 따라가는 기준값과의 차이만 기울기로 쓴다. 빨리 따라오면 기울인 효과가 바로 사라진다. */
const BASELINE_FOLLOW = 0.005
const TILT_SPRING = { damping: 18, stiffness: 90 }

/** 빛 하나가 맡는 높이. 펼친 카드는 이 띠마다 빛을 하나씩 둔다. 더 잘게 나누면 빛이 겹쳐 카드가 한 색으로 물든다. */
const BAND_HEIGHT = 150
/** 이웃한 띠의 빛이 경로에서 떨어진 거리(구간 수). 같은 자리에 있으면 빛 여럿이 한 덩이로 움직인다. */
const BAND_PHASE = 1.3

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value))
}

/**
 * 고가 드롭 카드 · 보스 행 면 위를 도는 오로라 빛. 정해진 경로를 계속 돌고, 폰을 기울이면 그 방향으로 조금 더 밀리는 층.
 *
 * 펼친 카드처럼 높은 상자는 띠마다 빛을 하나씩 두고 엇갈려 돌린다. 부모의 바탕과 내용 사이에 둔다. 내용 위에 두면 글자까지 물든다. 움직임 줄이기면 경로의 첫 자리에 멈추고 기울기도 읽지 않는다.
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
  const progress = useSharedValue(0)
  const tiltX = useSharedValue(0)
  const tiltY = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    // 0 → 1 → … → 4 를 한 바퀴로 돌고 0 에서 다시 시작한다. 경로의 0 과 4 가 같은 자리라 이음매가 안 보인다.
    progress.value = withRepeat(
      withSequence(
        ...Array.from({ length: SEGMENTS }, (_, index) =>
          withTiming(index + 1, { duration: variant.segmentMs, easing: EASE_IN_OUT }),
        ),
      ),
      -1,
    )
  }, [reduceMotion, variant, progress])

  const bands = Math.max(1, Math.round(size.height / BAND_HEIGHT))
  const band = { width: size.width, height: size.height / bands }

  useEffect(() => {
    if (reduceMotion || band.width === 0) return
    let baseline: number | null = null
    return subscribeTilt((tilt) => {
      baseline = baseline === null ? tilt.y : baseline + (tilt.y - baseline) * BASELINE_FOLLOW
      tiltX.value = withSpring(clampUnit(tilt.x / TILT_FULL) * band.width * TILT_REACH, TILT_SPRING)
      tiltY.value = withSpring(-clampUnit((tilt.y - baseline) / TILT_FULL) * band.height * TILT_REACH * 2, TILT_SPRING)
    })
  }, [reduceMotion, band.width, band.height, tiltX, tiltY])

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
        {
          overflow: 'hidden',
          borderRadius: variant.radius,
          opacity: variant.opacity * (isDark ? DARK_STRENGTH : 1),
          mixBlendMode: isDark ? 'screen' : 'normal',
        },
      ]}
    >
      {band.width > 0 &&
        Array.from({ length: bands }, (_, index) => (
          <SheenLight
            key={index}
            variant={variant}
            band={band}
            index={index}
            gradientId={`${gradientId}-${index}`}
            progress={progress}
            tiltX={tiltX}
            tiltY={tiltY}
          />
        ))}
    </View>
  )
}

/** 띠 하나를 맡아 경로를 도는 빛 덩이 하나. 띠 번호만큼 경로의 앞선 자리에서 출발한다. */
function SheenLight(props: {
  variant: (typeof VARIANTS)[keyof typeof VARIANTS]
  band: { width: number; height: number }
  index: number
  gradientId: string
  progress: SharedValue<number>
  tiltX: SharedValue<number>
  tiltY: SharedValue<number>
}): React.JSX.Element {
  const { variant, band, index, progress, tiltX, tiltY } = props
  const imageW = band.width * variant.scale.x
  const imageH = band.height * variant.scale.y
  const blobRadius = variant.reach * Math.hypot(imageW / 2, imageH / 2)
  const top = band.height * index

  const blobStyle = useAnimatedStyle(() => {
    const steps = PATH_X.map((_, step) => step)
    const at = (progress.value + index * BAND_PHASE) % SEGMENTS
    const px = interpolate(at, steps, PATH_X)
    const py = interpolate(at, steps, PATH_Y)
    // CSS `background-position: p%` 는 그림의 왼쪽 위를 (상자 − 그림) × p 에 둔다. 빛의 중심은 그림의 가운데다.
    const centerX = (band.width - imageW) * px + imageW / 2
    const centerY = top + (band.height - imageH) * py + imageH / 2
    return {
      transform: [
        { translateX: centerX - blobRadius + tiltX.value },
        { translateY: centerY - blobRadius + tiltY.value },
      ],
    }
  })

  return (
    <AnimatedView
      testID="hologram-sheen-light"
      style={[{ position: 'absolute', left: 0, top: 0, width: blobRadius * 2, height: blobRadius * 2 }, blobStyle]}
    >
      <Svg width={blobRadius * 2} height={blobRadius * 2}>
        <Defs>
          <RadialGradient id={props.gradientId} cx="50%" cy="50%" r="50%">
            {variant.stops.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
            ))}
          </RadialGradient>
        </Defs>
        <Circle cx={blobRadius} cy={blobRadius} r={blobRadius} fill={`url(#${props.gradientId})`} />
      </Svg>
    </AnimatedView>
  )
}
