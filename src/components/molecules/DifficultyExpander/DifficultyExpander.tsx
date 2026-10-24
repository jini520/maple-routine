/**
 * 난이도 고르개. 고른 배지 하나에 오른쪽 화살표가 붙어 있고, 누르면 모든 난이도 배지가 고른 배지 자리에서 나와 오른쪽
 * 제자리로 미끄러지며 펼쳐진다. 하나를 고르면 배지들이 고른 배지 자리로 모이며 접힌다.
 *
 * 팝오버가 아니다. 펼친 줄은 부모 줄 위에 겹쳐 서서 옆의 것(인원 스테퍼)을 덮는다. 그래서 부모는 이 부품을 줄의 끝에 두고,
 * 오른쪽 끝에 두면 `align="end"` 로 왼쪽을 향해 펼친다. 오른쪽으로 펼치면 화면 밖으로 넘친다.
 * 고르지 않은 난이도도 제 색을 흐리게 띤다. 회색으로 두면 어느 난이도가 무엇인지 글자를 읽어야 안다.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { ChevronRightIcon, difficultyBadgeStyle, Text } from '../../atoms'
import { DIFFICULTY_NAME } from '../../../constants/domain/boss-difficulty'
import { LinearGradient } from '../../../lib/nativewind-interop'
import { selectionFeedback } from '../../../native/haptics'
import { useThemeAppearance } from '../../../theme/context'
import type { BossDifficulty } from '../../../types'

/** 배지 높이와 사이 */
const PILL_HEIGHT = 22
const PILL_GAP = 2
/** 펼친 줄 바탕이 배지 줄 밖으로 나오는 여백. 한쪽만 주면 바탕이 배지 줄과 어긋나 보인다 */
const PLATE_PAD = 3
/** 고르지 않은 난이도의 진하기 */
const OFF_OPACITY = 0.35
/** 배지마다 늦게 출발하는 간격. 한꺼번에 움직이면 펼쳐지는 것이 아니라 한 덩어리가 미끄러지는 것으로 보인다 */
const STAGGER_MS = 35
const OPEN_SPRING = { damping: 15, stiffness: 260, mass: 0.6 }
/** 접힐 때 고른 배지가 돌아가는 시간과 나머지가 투명해지는 시간 */
const CLOSE_MS = 200
const FADE_MS = 60
/**
 * 펼친 줄이 놓이는 칸의 폭. 접힌 배지 폭 안에 두면 줄이 그 폭으로 눌려 배지가 잘린다. 칸은 누름을 통과시킨다.
 */
const LANE_WIDTH = 480

/** 화살표 아이콘 한 변과 글자와의 사이. 배지 오른쪽 여백은 늘 6 이고, 화살표 칸이 사이 2 를 품는다 */
const CHEVRON_SIZE = 9
const CHEVRON_GAP = 2

/** 화살표 칸. 펼침 정도(`shown`, 0~1)만큼 폭과 진하기가 자라고, 0 이면 사이 2 만 남는다 */
function ChevronSlot(props: { color: string; shown: SharedValue<number> | number }): React.JSX.Element {
  const { shown } = props
  const style = useAnimatedStyle(() => {
    const value = Math.min(1, Math.max(0, typeof shown === 'number' ? shown : shown.value))
    return { width: CHEVRON_GAP + CHEVRON_SIZE * value, opacity: value, overflow: 'hidden' }
  })
  return (
    <Animated.View style={style}>
      <View style={{ marginLeft: CHEVRON_GAP, width: CHEVRON_SIZE }}>
        <ChevronRightIcon className="h-[9px] w-[9px]" color={props.color} strokeWidth={3} aria-hidden />
      </View>
    </Animated.View>
  )
}

/**
 * 난이도 배지. `chevron` 이 화살표가 보이는 정도다(0 이면 없고 1 이면 다 보인다). 고른 배지가 펼쳐지며 미끄러지는 동안
 * 화살표가 줄어 사라지고, 돌아오는 동안 다시 자란다. 한순간에 생기고 사라지면 배지가 바뀌는 것으로 보인다.
 */
function Pill(props: { difficulty: BossDifficulty; chevron?: SharedValue<number> | number }): React.JSX.Element {
  const { gradient, border, textStyle } = difficultyBadgeStyle(props.difficulty)
  return (
    <LinearGradient
      testID={`difficulty-pill-${props.difficulty}`}
      colors={gradient}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      className="flex-row items-center rounded-full"
      style={{ height: PILL_HEIGHT, paddingLeft: 8, paddingRight: 6, ...border }}
    >
      <Text className="text-chip-sm font-bold" style={textStyle}>
        {DIFFICULTY_NAME[props.difficulty]}
      </Text>
      <ChevronSlot color={textStyle.color as string} shown={props.chevron ?? 0} />
    </LinearGradient>
  )
}

/** 펼친 줄에 선 고른 배지. 접힌 자리(펼침 정도 0)에서는 화살표가 다 보이고, 제자리로 갈수록 줄어 사라진다 */
function SelectedPill(props: { difficulty: BossDifficulty; progress: SharedValue<number> }): React.JSX.Element {
  const { progress } = props
  const chevron = useDerivedValue(() => 1 - progress.value)
  return <Pill difficulty={props.difficulty} chevron={chevron} />
}

/** 펼친 줄의 배지 하나. 접힌 배지 자리에서 제자리로 미끄러져 나오고, 접을 때 그리로 돌아간다 */
function SlidingPill(props: {
  open: boolean
  /** 제자리의 왼쪽 끝(줄 기준) */
  x: number
  /** 접힌 배지의 왼쪽 끝(줄 기준). 배지들이 여기서 출발한다 */
  from: number
  /** 펼칠 때 늦게 출발하는 차례 */
  order: number
  /** 고른 배지. 흐려지지 않고 접힌 배지 자리로 돌아가 접힌 배지와 바로 이어진다 */
  selected: boolean
  onClosed?: () => void
  /** 배지 자리. 고른 배지는 펼침 정도를 받아 화살표를 줄이고 키운다 */
  children: (progress: SharedValue<number>) => React.ReactNode
}): React.JSX.Element {
  const progress = useSharedValue(0)
  /** 고르지 않은 배지를 접을 때 지우는 값. 자리는 그대로 두고 투명해지기만 한다 */
  const fade = useSharedValue(1)
  const { open, order, selected } = props
  // 렌더마다 새로 오는 콜백을 효과의 의존에 넣으면 그때마다 애니메이션이 처음부터 다시 돈다.
  const onClosed = useRef(props.onClosed)
  useEffect(() => {
    onClosed.current = props.onClosed
  }, [props.onClosed])

  function notifyClosed(): void {
    onClosed.current?.()
  }

  useEffect(() => {
    if (open) {
      fade.set(1)
      progress.set(withDelay(order * STAGGER_MS, withSpring(1, OPEN_SPRING)))
      return
    }
    // 접힐 때는 고른 배지만 움직인다. 나머지가 차례로 모여들면 펼칠 때보다 길고 어수선해 보였다.
    if (!selected) {
      fade.set(withTiming(0, { duration: FADE_MS }))
      return
    }
    progress.set(
      withTiming(0, { duration: CLOSE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(notifyClosed)()
      }),
    )
  }, [open, order, selected, progress, fade])

  const style = useAnimatedStyle(() => ({
    opacity: selected ? 1 : Math.min(1, progress.value * 1.6) * fade.value,
    transform: [{ translateX: (progress.value - 1) * (props.x - props.from) }],
  }))

  // 자리 · 모양은 바깥 View, 움직임만 Animated.View. 둘을 한 배열로 주면 정적 쪽이 버려진다.
  return (
    <View style={{ position: 'absolute', left: props.x, top: 0 }}>
      <Animated.View style={style}>{props.children(progress)}</Animated.View>
    </View>
  )
}

export function DifficultyExpander(props: {
  /** 읽는 이름의 뿌리. 보스 이름이다 */
  label: string
  difficulties: readonly BossDifficulty[]
  value: BossDifficulty
  onChange: (next: BossDifficulty) => void
  /** 붙은 쪽. 기본 `start` 는 오른쪽으로, `end` 는 왼쪽으로 펼친다 */
  align?: 'start' | 'end'
}): React.JSX.Element {
  const end = props.align === 'end'
  const { definition } = useThemeAppearance()
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  const [widths, setWidths] = useState<readonly number[]>([])
  const plate = useSharedValue(0)

  const xs = widths.reduce<number[]>((acc, _, index) => {
    acc.push(index === 0 ? 0 : acc[index - 1]! + widths[index - 1]! + PILL_GAP)
    return acc
  }, [])
  const measured = widths.length === props.difficulties.length && widths.every((width) => width > 0)
  const laneWidth = measured ? xs[xs.length - 1]! + widths[widths.length - 1]! : 0
  // `end` 면 접힌 배지가 줄의 오른쪽 끝에 붙어 있다. 접힌 배지는 화살표 몫만큼 넓다.
  const selectedIndex = props.difficulties.indexOf(props.value)
  const homeOf = (index: number): number => xs[index] ?? 0
  const from = end && measured ? laneWidth - (widths[selectedIndex] ?? 0) - CHEVRON_SIZE : 0
  const edge = end ? { right: 0 } : { left: 0 }

  // 정적 값도 움직임 스타일 안에 둔다. 정적 스타일과 한 배열로 주면 정적 쪽이 버려진다.
  const plateStyle = useAnimatedStyle(() => ({ flex: 1, opacity: plate.value }))

  function expand(): void {
    setShown(true)
    setOpen(true)
    plate.set(withTiming(1, { duration: 120 }))
  }

  function collapse(): void {
    setOpen(false)
    plate.set(withTiming(0, { duration: FADE_MS }))
  }

  return (
    // 펼친 동안 형제보다 위에 선다. RN 은 나중 형제를 위에 그려서, 그대로 두면 오른쪽 스테퍼가 펼친 줄을 덮는다.
    <View testID="difficulty-expander" style={shown ? { zIndex: 10, elevation: 10 } : undefined}>
      <Pressable
        role="button"
        aria-label={`${props.label} 난이도 ${DIFFICULTY_NAME[props.value]}, 눌러서 바꾸기`}
        onPress={expand}
        style={shown ? { opacity: 0 } : undefined}
        className={end ? 'self-end' : 'self-start'}
      >
        <Pill difficulty={props.value} chevron={1} />
      </Pressable>

      <View pointerEvents="box-none" style={{ position: 'absolute', ...edge, top: 0, width: LANE_WIDTH, height: PILL_HEIGHT }}>
        {/* 배지마다 폭을 재는 줄. 보이지 않고 누를 수 없다. */}
        <View pointerEvents="none" aria-hidden className="flex-row opacity-0" style={{ gap: PILL_GAP }}>
          {props.difficulties.map((difficulty, index) => (
            <View
              key={difficulty}
              onLayout={(event) => {
                const width = event.nativeEvent.layout.width
                setWidths((current) => {
                  if (current[index] === width) return current
                  const next = [...current]
                  next[index] = width
                  return next
                })
              }}
            >
              <Pill difficulty={difficulty} />
            </View>
          ))}
        </View>

        {shown && (
          <View testID="difficulty-expander-lane" role="radiogroup" aria-label={`${props.label} 난이도`} style={{ position: 'absolute', ...edge, top: 0, width: laneWidth, height: PILL_HEIGHT }}>
            {/* 옆 UI 를 덮는 바탕. 배지 줄을 사방으로 같은 여백만큼 감싼다. 배지 밖을 누르면 접는다. */}
            <View
              testID="difficulty-expander-plate"
              style={{ position: 'absolute', left: -PLATE_PAD, top: -PLATE_PAD, bottom: -PLATE_PAD, right: -PLATE_PAD }}
            >
              <Animated.View style={plateStyle}>
                <Pressable
                  aria-label={`${props.label} 난이도 닫기`}
                  onPress={collapse}
                  className="flex-1 rounded-full"
                  style={{ backgroundColor: definition.surface }}
                />
              </Animated.View>
            </View>
            {props.difficulties.map((difficulty, index) => {
              const on = difficulty === props.value
              return (
                <SlidingPill
                  key={difficulty}
                  open={open}
                  x={homeOf(index)}
                  from={from}
                  order={index}
                  selected={on}
                  onClosed={on ? () => setShown(false) : undefined}
                >
                  {(progress) => (
                  <Pressable
                    role="radio"
                    aria-checked={on}
                    aria-label={`${props.label} ${DIFFICULTY_NAME[difficulty]}`}
                    onPress={() => {
                      // 두드림은 고른 값이 실제로 바뀔 때만이다.
                      if (!on) {
                        selectionFeedback()
                        props.onChange(difficulty)
                      }
                      collapse()
                    }}
                    style={on ? undefined : { opacity: OFF_OPACITY }}
                  >
                    {on ? <SelectedPill difficulty={difficulty} progress={progress} /> : <Pill difficulty={difficulty} />}
                  </Pressable>
                  )}
                </SlidingPill>
              )
            })}
          </View>
        )}
      </View>
    </View>
  )
}
