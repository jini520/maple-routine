/**
 * 켜고 끄는 스위치. **앱의 스위치는 이것 하나다.**
 *
 * 스크린리더 계약(`role="switch"`·`aria-checked`·`aria-label`)과 선택 촉각을 이 부품이 든다.
 * 호출부에서 `selectionFeedback()` 을 또 부르면 한 번 누르고 두 번 울린다.
 *
 * @example
 * // 행 왼쪽에 글자가 따로 서는 자리
 * <Switch on={on} label="알림 받기" size="lg" onToggle={toggle} className="ml-auto" />
 *
 * // 글자를 눌러도 토글돼야 하는 자리. 글자 크기는 자리마다 달라 호출부가 정한다
 * <Switch on={showAll} label="모든 보스 보기" size="lg" onToggle={toggle} className="gap-1.5">
 *   <Text className="text-xs font-medium text-text-muted">모든 보스 보기</Text>
 * </Switch>
 */
import { Pressable, View } from 'react-native'
import { cubicBezier, useReducedMotion } from 'react-native-reanimated'

import { AnimatedView } from '../../../lib/nativewind-interop'
import { selectionFeedback } from '../../../native/haptics'

/**
 * 크기 두 벌의 치수(px).
 *
 * `travel` 은 `트랙 폭 − 손잡이 − 2` 다. 세 수가 서로 맞아야 손잡이가 트랙을 넘지도 덜 가지도
 * 않는다. 자리마다 적으면 한 벌만 고쳐져 크기끼리 어긋난다.
 */
const SWITCH_SIZE = {
  sm: { track: 'h-4 w-7', knob: 'h-3 w-3', travel: 14 },
  lg: { track: 'h-6 w-11', knob: 'h-5 w-5', travel: 22 },
} as const

/**
 * 손잡이가 미끄러지는 트랜지션. 세그먼트의 미끄러지는 상자(`useSlidingThumb`)와 같은 시간·곡선.
 *
 * `transition-*` 클래스로는 못 쓴다. NativeWind 가 RN 스타일로 안 옮겨 에러 없이 안 움직인다.
 */
const KNOB_TRANSITION = {
  transitionProperty: 'transform',
  transitionDuration: '200ms',
  transitionTimingFunction: cubicBezier(0.32, 0.72, 0, 1),
} as const

export interface SwitchProps {
  on: boolean
  /** 스크린리더가 읽는 이름. 옆 글자가 있으면 그것을 그대로 적는다. */
  label: string
  onToggle: () => void
  /** 안 적으면 `sm`. */
  size?: keyof typeof SWITCH_SIZE
  /** 스위치 왼쪽에 서는 글자. 누름 과녁 안이라 글자를 눌러도 토글된다. */
  children?: React.ReactNode
  /** 자리잡기(`ml-auto`·`gap-1.5`)는 호출부 몫이다. */
  className?: string
}

export function Switch(props: SwitchProps): React.JSX.Element {
  const size = SWITCH_SIZE[props.size ?? 'sm']
  const reduceMotion = useReducedMotion()
  const knobPlace = { transform: [{ translateX: props.on ? size.travel : 2 }] }

  return (
    <Pressable
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      // 켜고 끄는 것도 고른 값이 바뀌는 일이라 선택 촉각이다.
      onPress={() => {
        selectionFeedback()
        props.onToggle()
      }}
      className={`shrink-0 flex-row items-center ${props.className ?? ''}`}
    >
      {props.children}
      {/* 트랙 색은 안 흐른다. 색까지 기다리면 누른 스위치가 그동안 안 눌린 것처럼 보인다. */}
      <View
        testID="switch-track"
        className={`${size.track} shrink-0 flex-row items-center rounded-full ${
          props.on ? 'bg-primary' : 'bg-surface-2'
        }`}
      >
        <AnimatedView
          testID="switch-knob"
          className={`${size.knob} rounded-full bg-surface`}
          // 움직임 줄이기면 트랜지션 키를 아예 안 준다. 곧바로 선다.
          style={reduceMotion ? knobPlace : { ...knobPlace, ...KNOB_TRANSITION }}
        />
      </View>
    </Pressable>
  )
}
