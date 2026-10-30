/**
 * 강화 전 · 강화 후 레벨을 고르는 격자. 심볼 강화와 헥사 스킬이 같이 쓴다.
 *
 * 위의 탭 둘이 지금 고르는 쪽을 보이고, 칸을 누르면 그 쪽 값이 바뀐다. 강화 전을 고르면 탭이 강화 후로 넘어간다.
 * 한 번에 한 값만 바뀌어야 어느 쪽이 바뀌는지 헷갈리지 않는다. 고른 범위는 끊김 없는 띠로 잇고 양 끝은 주색 원이다.
 */
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { Text } from '../../../components/atoms'
import { TABULAR_NUMS } from '../../../constants/style/text-styles'
import { boxShadowOf } from '../../../lib/shadow'
import { selectionFeedback } from '../../../native/haptics'
import { useThemeAppearance } from '../../../theme/context'
import { canPick, gridColumns, pickLevel, type LevelRange, type RangeEnd } from './level-range'

/** 고른 탭의 그림자. 세그먼트의 고른 칸과 같다. 트랙에서 떠 보이게 하는 몫이다. */
const TAB_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.12,
  shadowRadius: 3,
  elevation: 2,
} as const

/** 숨쉬는 그림자가 내려가는 바닥과 한 방향 시간(ms). 왕복이라 한 주기는 두 배다. 모션 줄이기를 켜면 바닥에 멈춘다. */
const BREATH_DIM = 0.25
const BREATH_MS = 1100

const GlowBox = Animated.createAnimatedComponent(View)

/**
 * 고른 탭 뒤의 숨쉬는 그림자. 테마 주색으로 약하고 넓게 번진다. 지금 어느 쪽을 고르는지 눈에 띄게 하는 몫이다.
 * 번짐이 좁으면 테두리 선처럼 읽혀서 넓고 옅게 둔다.
 *
 * `className` 을 안 쓴다. 애니메이션 상자에 정적 스타일을 함께 주면 NativeWind 가 정적 쪽을 버린다.
 */
function BreathingGlow(): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const opacity = useSharedValue(1)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1
      return
    }
    opacity.value = withRepeat(withTiming(BREATH_DIM, { duration: BREATH_MS }), -1, true)
  }, [reduceMotion, opacity])

  const breath = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <GlowBox
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: 9, boxShadow: boxShadowOf(definition.primary, { opacity: 0.35, radius: 12, y: 0 }) },
        breath,
      ]}
    />
  )
}

/** 칸 높이와 원 지름. 원이 칸보다 6 작아 줄 사이가 붙어 보이지 않는다. */
const CELL_HEIGHT = 36
const DOT = 30

export function LevelRangeGrid(props: {
  /** 가장 낮은 레벨. 헥사 0 · 심볼 1. */
  min: number
  /** 만렙. 헥사 30 · 아케인 20 · 어센틱 11. */
  max: number
  range: LevelRange
  editing: RangeEnd
  /** 대상을 안 골랐다. 탭과 칸이 흐리게 서고 안 눌린다. */
  disabled?: boolean
  onChange: (next: { range: LevelRange; editing: RangeEnd }) => void
  /** `testID` 뿌리. */
  testID: string
}): React.JSX.Element {
  const { range, editing } = props
  const columns = gridColumns(props.min, props.max)
  const levels = Array.from({ length: props.max - props.min + 1 }, (_, index) => props.min + index)
  const disabled = props.disabled === true

  function tab(end: RangeEnd, caption: string, level: number): React.JSX.Element {
    const on = !disabled && editing === end
    return (
      <Pressable
        role="tab"
        aria-selected={on}
        aria-label={`${caption} Lv.${level}`}
        testID={`${props.testID}-tab-${end}`}
        disabled={disabled}
        onPress={() => props.onChange({ range, editing: end })}
        className={`flex-1 flex-row items-baseline justify-center gap-1.5 rounded-[9px] px-2.5 py-1.5 ${on ? 'bg-control-thumb' : ''}`}
        style={on ? TAB_SHADOW : undefined}
      >
        {on && <BreathingGlow />}
        <Text className={`text-11 font-semibold ${on ? 'text-primary-ink' : 'text-text-muted'}`}>{caption}</Text>
        <Text className="text-15 font-bold text-text" style={TABULAR_NUMS}>
          {disabled ? '-' : `Lv.${level}`}
        </Text>
      </Pressable>
    )
  }

  return (
    <View className={`gap-2.5 ${disabled ? 'opacity-40' : ''}`}>
      <View role="tablist" className="flex-row items-center gap-0.5 rounded-xl bg-control-track p-[3px]">
        {tab('from', '강화 전', range.from)}
        <Text className="mx-2 text-text-disabled">→</Text>
        {tab('to', '강화 후', range.to)}
      </View>

      <View className="flex-row flex-wrap">
        {levels.map((level, index) => {
          const column = index % columns
          const inside = !disabled && level >= range.from && level <= range.to
          const end = !disabled && (level === range.from || level === range.to)
          const pickable = !disabled && canPick(range, editing, level, props.max)
          // 띠는 줄 끝 · 범위 끝에서만 둥글다. 칸 사이를 틈 없이 이어야 한 범위로 읽힌다.
          const roundLeft = level === range.from || column === 0
          const roundRight = level === range.to || column === columns - 1 || level === props.max
          return (
            <Pressable
              key={level}
              role="button"
              aria-label={`Lv.${level}`}
              aria-disabled={!pickable}
              disabled={!pickable}
              testID={`${props.testID}-level-${level}`}
              onPress={() => {
                selectionFeedback()
                props.onChange(pickLevel(range, editing, level))
              }}
              className="items-center justify-center"
              style={{ width: `${100 / columns}%`, height: CELL_HEIGHT }}
            >
              {inside && range.from !== range.to && (
                <View
                  className="absolute bottom-[3px] top-[3px] bg-primary-tint"
                  style={{
                    left: level === range.from ? '50%' : 0,
                    right: level === range.to ? '50%' : 0,
                    borderTopLeftRadius: roundLeft ? 999 : 0,
                    borderBottomLeftRadius: roundLeft ? 999 : 0,
                    borderTopRightRadius: roundRight ? 999 : 0,
                    borderBottomRightRadius: roundRight ? 999 : 0,
                  }}
                />
              )}
              <View
                className={`items-center justify-center rounded-full ${end ? 'bg-primary' : ''}`}
                style={{ width: DOT, height: DOT }}
              >
                <Text
                  className={`text-13 ${
                    end ? 'font-bold text-on-primary' : inside ? 'font-bold text-primary-ink' : pickable ? 'text-text' : 'text-text-disabled'
                  }`}
                  style={TABULAR_NUMS}
                >
                  {level}
                </Text>
              </View>
            </Pressable>
          )
        })}
      </View>

    </View>
  )
}
