/**
 * 난이도 고르개. 고른 배지 하나에 오른쪽 화살표가 붙어 있고, 누르면 배지가 그 자리에서 오른쪽으로 늘어나 모든 난이도가
 * 같은 높이로 펼쳐진다. 하나를 고르면 고른 배지로 줄어든다.
 *
 * 팝오버가 아니다. 펼친 줄은 부모 줄 위에 겹쳐 서서 옆의 것(인원 스테퍼)을 덮는다. 그래서 부모는 이 부품을 줄의 왼쪽 끝에 둔다.
 * 고르지 않은 난이도도 제 색을 흐리게 띤다. 회색으로 두면 어느 난이도가 무엇인지 글자를 읽어야 안다.
 */
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { ChevronRightIcon, difficultyFill, Text } from '../../atoms'
import { DIFFICULTY_NAME } from '../../../constants/domain/boss-difficulty'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { useThemeAppearance } from '../../../theme/context'
import type { BossDifficulty } from '../../../types'

/** 배지 높이와 사이 */
const PILL_HEIGHT = 22
const PILL_GAP = 2
/** 고르지 않은 난이도의 진하기 */
const OFF_OPACITY = 0.35
/** 펼치고 접는 시간 */
const EXPAND_MS = 220

function Pill(props: { difficulty: BossDifficulty; withChevron?: boolean }): React.JSX.Element {
  const { gradient, textStyle } = difficultyFill(props.difficulty)
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="flex-row items-center rounded-full"
      style={{ height: PILL_HEIGHT, paddingLeft: 8, paddingRight: props.withChevron === true ? 6 : 8, gap: 2 }}
    >
      <Text className="text-chip-sm font-bold" style={textStyle}>
        {DIFFICULTY_NAME[props.difficulty]}
      </Text>
      {props.withChevron === true && (
        <ChevronRightIcon className="h-[9px] w-[9px]" color={textStyle.color as string} strokeWidth={3} aria-hidden />
      )}
    </LinearGradient>
  )
}

export function DifficultyExpander(props: {
  /** 읽는 이름의 뿌리. 보스 이름이다 */
  label: string
  difficulties: readonly BossDifficulty[]
  value: BossDifficulty
  onChange: (next: BossDifficulty) => void
}): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const [shown, setShown] = useState(false)
  const [widths, setWidths] = useState({ closed: 0, open: 0 })
  const progress = useSharedValue(0)

  const widthStyle = useAnimatedStyle(() => ({
    overflow: 'hidden',
    width: widths.open === 0 ? undefined : widths.closed + (widths.open - widths.closed) * progress.value,
  }))

  function open(): void {
    setShown(true)
    progress.set(withTiming(1, { duration: EXPAND_MS, easing: Easing.out(Easing.cubic) }))
  }

  function close(): void {
    progress.set(
      withTiming(0, { duration: EXPAND_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setShown)(false)
      }),
    )
  }

  const options = props.difficulties.map((difficulty) => {
    const on = difficulty === props.value
    return (
      <Pressable
        key={difficulty}
        role="radio"
        aria-checked={on}
        aria-label={`${props.label} ${DIFFICULTY_NAME[difficulty]}`}
        onPress={() => {
          if (!on) props.onChange(difficulty)
          close()
        }}
        style={on ? undefined : { opacity: OFF_OPACITY }}
      >
        <Pill difficulty={difficulty} />
      </Pressable>
    )
  })

  return (
    <View>
      <Pressable
        role="button"
        aria-label={`${props.label} 난이도 ${DIFFICULTY_NAME[props.value]}, 눌러서 바꾸기`}
        onPress={open}
        onLayout={(event) => {
          const closed = event.nativeEvent.layout.width
          setWidths((current) => (current.closed === closed ? current : { ...current, closed }))
        }}
        className="self-start"
      >
        <Pill difficulty={props.value} withChevron />
      </Pressable>
      {/* 펼친 폭을 재는 줄. 보이지 않고 누를 수 없다. */}
      <View
        pointerEvents="none"
        className="absolute left-0 top-0 flex-row opacity-0"
        style={{ gap: PILL_GAP, paddingRight: 6 }}
        onLayout={(event) => {
          const openWidth = event.nativeEvent.layout.width
          setWidths((current) => (current.open === openWidth ? current : { ...current, open: openWidth }))
        }}
        aria-hidden
      >
        {props.difficulties.map((difficulty) => (
          <Pill key={difficulty} difficulty={difficulty} />
        ))}
      </View>
      {shown && (
        // 자리 · 바탕은 바깥 View, 폭만 Animated.View. 둘을 한 배열로 주면 정적 쪽이 버려진다.
        <View role="radiogroup" aria-label={`${props.label} 난이도`} className="absolute left-0 top-0 z-10 rounded-full" style={{ backgroundColor: definition.surface }}>
          <Animated.View style={widthStyle}>
            <View className="flex-row" style={{ gap: PILL_GAP, paddingRight: 6 }}>
              {options}
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  )
}
