/**
 * 결정형 진행률 바 atom.
 *
 * **값을 클램프하지 않는다.** 여기서 잘라 두면 호출부의 계산이 틀렸을 때 그 사실이 화면에서
 * 지워진다. 퍼센트 환산도 호출부 몫이다.
 */
import { View } from 'react-native'
import { cubicBezier } from 'react-native-reanimated'

import { AnimatedView } from '../../../lib/nativewind-interop'

/**
 * 트랙 높이. `thin` 은 `today` 의 2x2 초기화 타일만 쓴다.
 *
 * **높이를 아는 것은 트랙뿐이다.** 채움은 `h-full` 로 따라온다. 둘이 각자 알면 한쪽만 바꿀 때
 * 어긋난다(위젯 3 에서 낸 회귀).
 */
const HEIGHT_CLASS = { base: 'h-1.5', thin: 'h-1' } as const

const TRACK_CLASS = 'w-full overflow-hidden rounded-full bg-track'

/**
 * 채움 색. **이름을 `bg-${tone}` 로 조립하지 않는다.** Tailwind 는 소스를 문자열로 훑어
 * 조립한 이름을 못 찾고, 없는 클래스는 에러가 아니라 **색 없는 막대**가 된다.
 */
const FILL_CLASS = {
  primary: 'h-full rounded-full bg-primary',
  third: 'h-full rounded-full bg-third',
} as const

/**
 * `animated` 가 채움에 얹는 폭 트랜지션. 값 셋은 Tailwind 의 `transition-[width]` 와 같다.
 *
 * **그 클래스로는 못 쓴다.** CSS 로 컴파일은 되는데 NativeWind 가 RN 스타일로 안 옮겨 **스타일에
 * 아무것도 안 남는다**(실측). 에러 없이 그냥 안 움직인다. `as const` 인 이유는
 * `float-animation.ts` 와 같다.
 */
const WIDTH_TRANSITION = {
  transitionProperty: 'width',
  transitionDuration: '150ms',
  transitionTimingFunction: cubicBezier(0.4, 0, 0.2, 1),
} as const

export interface ProgressBarProps {
  /** 채움 비율(0~100). 클램프는 호출부가 한다. */
  percent: number
  /** 채움 색. `third` 는 컨텐츠 스케줄러의 `IllustratedCard` 둘이 위에 선 배지와 맞추려고 쓴다. */
  tone?: keyof typeof FILL_CLASS
  /** 두께. 기본은 `h-1.5` 이고 세 번째 값은 두지 않는다. */
  height?: keyof typeof HEIGHT_CLASS
  /**
   * 접근성 값. 주면 `accessibilityRole="progressbar"` 와 함께 낸다. 값이 이미 글자로 읽히는
   * 자리는 안 준다(`ResetCountdownWidget` 의 경과 바).
   */
  aria?: { now: number; max: number }
  /** 폭 변화에 트랜지션을 걸지. 값이 연속으로 흐르는 `UpdatePromptModal` 의 다운로드만 쓴다. */
  animated?: boolean
  /** 채움 요소에 붙일 test id. 트랙은 그 부모다. */
  fillTestId?: string
}

export function ProgressBar(props: ProgressBarProps): React.JSX.Element {
  const tone = props.tone ?? 'primary'
  const height = props.height ?? 'base'

  return (
    <View
      accessibilityRole={props.aria === undefined ? undefined : 'progressbar'}
      accessibilityValue={
        props.aria === undefined ? undefined : { now: props.aria.now, min: 0, max: props.aria.max }
      }
      className={`${HEIGHT_CLASS[height]} ${TRACK_CLASS}`}
    >
      <AnimatedView
        testID={props.fillTestId}
        className={FILL_CLASS[tone]}
        style={
          props.animated === true
            ? { width: `${props.percent}%`, ...WIDTH_TRANSITION }
            : { width: `${props.percent}%` }
        }
      />
    </View>
  )
}
