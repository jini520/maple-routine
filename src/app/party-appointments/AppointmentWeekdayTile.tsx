/**
 * 반복 약속의 요일 타일. 시작 · 종료 타일과 같은 머리(아이콘 원 · 라벨 · 주황 값) 아래에 요일 일곱의 세그먼트가 선다.
 *
 * 순서는 리셋 주(목 → 수)이고 고른 요일은 꽉 찬 주황 상자에 흰 글자다. 누르면 확인 없이 바로 바뀐다.
 * 자정을 넘는 약속은 상자가 다음 요일까지 한 알약으로 늘어난다. 끝 칸 수요일에서 목요일로 넘어가면 이웃이 아니라 양 끝에 하나씩 둔다.
 * 날짜는 적지 않는다. 반복이 언제부터 서는지는 시트가 요일 · 시각에서 낸다.
 */
import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { RepeatIcon, Text } from '../../components/atoms'
import { RESET_WEEKDAYS } from '../../features/party-appointments/draft'
import { WEEKDAY_LABELS } from '../../lib/calendar'
import { useThemeAppearance } from '../../theme/context'

/** 상자는 정적 스타일과 애니메이션 스타일을 한 배열로 받는다. NativeWind 의 Animated.View 에 주면 정적 쪽이 사라진다 */
const AnimatedBox = Animated.createAnimatedComponent(View)

/** 앱의 세그먼트 상자와 같은 미끄러짐 */
const SLIDE_MS = 200
const EASE = Easing.bezier(0.32, 0.72, 0, 1)

interface Slot {
  x: number
  width: number
}

export interface AppointmentWeekdayTileProps {
  /** 0 = 일요일 */
  weekday: number
  /** 자정을 넘는 약속. 값이 다음 요일까지 적히고 그 요일 글자 아래에 점이 붙는다 */
  endsNextDay: boolean
  onChange: (weekday: number) => void
}

export function AppointmentWeekdayTile(props: AppointmentWeekdayTileProps): React.JSX.Element {
  const { definition } = useThemeAppearance()
  const reduceMotion = useReducedMotion()
  const [slots, setSlots] = useState<readonly (Slot | undefined)[]>([])
  const index = RESET_WEEKDAYS.indexOf(props.weekday)
  const nextWeekday = (props.weekday + 1) % 7
  const lastIndex = RESET_WEEKDAYS.length - 1
  // 다음 요일이 바로 오른쪽 칸이면 상자를 늘려 합친다. 끝 칸에서 넘어가면 맨 앞 칸에 상자를 하나 더 둔다.
  const merged = props.endsNextDay && index < lastIndex
  const wraps = props.endsNextDay && index === lastIndex
  const from = slots[index]
  const to = merged ? slots[index + 1] : from

  const x = useSharedValue(0)
  const width = useSharedValue(0)
  /** 처음 자리를 잡기 전에는 안 보인다. 0 폭으로 그리면 왼쪽 끝에 실선 하나가 번쩍인다 */
  const visible = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (from === undefined || to === undefined) return
    const targetWidth = to.x + to.width - from.x
    // 처음 서는 자리에서는 안 미끄러진다. 열자마자 왼쪽 끝에서 달려오면 안 누른 이동으로 보인다.
    if (!placed.current || reduceMotion) {
      x.value = from.x
      width.value = targetWidth
      visible.value = 1
      placed.current = true
      return
    }
    x.value = withTiming(from.x, { duration: SLIDE_MS, easing: EASE })
    width.value = withTiming(targetWidth, { duration: SLIDE_MS, easing: EASE })
  }, [from, to, reduceMotion, visible, width, x])
  const thumbStyle = useAnimatedStyle(() => ({
    opacity: visible.value,
    width: width.value,
    transform: [{ translateX: x.value }],
  }))

  function measure(at: number, slot: Slot): void {
    setSlots((current) => {
      const known = current[at]
      if (known?.x === slot.x && known.width === slot.width) return current
      const next = [...current]
      next[at] = slot
      return next
    })
  }

  const filled = (weekday: number): boolean =>
    weekday === props.weekday || (props.endsNextDay && weekday === nextWeekday)
  const thumbBase = { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: definition.primary } as const
  const value = props.endsNextDay
    ? `매주 ${WEEKDAY_LABELS[props.weekday]} ~ ${WEEKDAY_LABELS[nextWeekday]}요일`
    : `매주 ${WEEKDAY_LABELS[props.weekday]}요일`

  return (
    <View className="flex-1 gap-2 rounded-xl bg-card-body px-3 pb-3 pt-2.5">
      <View className="flex-row items-center gap-2.5">
        <View className="h-[30px] w-[30px] items-center justify-center rounded-full bg-primary-tint">
          <RepeatIcon className="h-[15px] w-[15px] text-primary-ink" strokeWidth={2} aria-hidden />
        </View>
        <View>
          <Text className="text-11 text-text-muted">요일</Text>
          <Text className="text-sm font-bold text-primary-ink">{value}</Text>
        </View>
      </View>
      <View className="rounded-full bg-surface p-0.5">
        {/* 상자와 칸은 테두리도 여백도 없는 같은 부모 안이어야 잰 자리가 맞는다. */}
        <View className="flex-row">
          <AnimatedBox testID="weekday-thumb" pointerEvents="none" style={[thumbBase, thumbStyle]} />
          {wraps && (
            <View
              testID="weekday-thumb-wrap"
              pointerEvents="none"
              style={[
                thumbBase,
                { opacity: slots[0] === undefined ? 0 : 1, width: slots[0]?.width ?? 0, transform: [{ translateX: slots[0]?.x ?? 0 }] },
              ]}
            />
          )}
          {RESET_WEEKDAYS.map((weekday, at) => {
            const selected = weekday === props.weekday
            const label = WEEKDAY_LABELS[weekday]
            return (
              <Pressable
                key={weekday}
                role="button"
                aria-label={`${label}요일`}
                aria-selected={selected}
                onLayout={(event) => measure(at, event.nativeEvent.layout)}
                onPress={() => {
                  if (!selected) props.onChange(weekday)
                }}
                className="h-[30px] flex-1 items-center justify-center rounded-full"
              >
                {/* 글자색은 상자를 안 기다린다. 기다리면 누른 칸이 그동안 안 눌린 것처럼 보인다. */}
                <Text className={`text-13 ${filled(weekday) ? 'font-bold text-on-primary' : 'font-semibold text-text'}`}>
                  {label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    </View>
  )
}
