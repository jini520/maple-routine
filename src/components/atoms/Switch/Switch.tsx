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
      <View
        testID="switch-track"
        className={`${size.track} shrink-0 flex-row items-center rounded-full ${
          props.on ? 'bg-primary' : 'bg-surface-2'
        }`}
      >
        <View
          testID="switch-knob"
          className={`${size.knob} rounded-full bg-surface`}
          style={{ transform: [{ translateX: props.on ? size.travel : 2 }] }}
        />
      </View>
    </Pressable>
  )
}
