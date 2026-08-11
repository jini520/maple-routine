// 결정형 진행률 바 — [[ADR-061]] 결정 6이 "예외 없이 h-1.5 프리미티브 하나"로 정한 것을
// 코드로 승격한 atom([[ADR-094]] 결정 3). 그 전에는 같은 마크업이 9곳에 복붙돼 있었고,
// 그중 두 곳은 클래스 순서까지 달랐다.
//
// atom 규칙: 상태를 갖지 않고 토큰과 자기 상자만 안다. 값 계산(클램프·퍼센트 환산)은
// 호출부 몫이다 — 여기서 클램프하면 "왜 100을 넘겨도 안 넘치지"가 숨는다.
//
// ── RN 으로 옮기며 바뀐 것 셋 ─────────────────────────────────────────────────────
//
// ① 채움 색이 **정적 클래스 표**가 됐다. 웹은 `` `bg-${tone}` `` 로 만들었는데, Tailwind 는 소스를
//    문자열로 훑으므로 그렇게 조립한 이름은 스캔에 안 잡힌다 — 웹에서는 `bg-primary`·`bg-third` 가
//    다른 파일에 있어 우연히 살아 있었고, RN 은 스캔 범위가 이 패키지뿐이라 **그 우연이 없다**.
//    없는 클래스는 에러가 아니라 **색 없는 막대**가 되므로 조립을 없앤다.
// ② `role`·`aria-*` → `accessibilityRole`·`accessibilityValue`(RN 의 같은 뜻 프롭).
// ③ `transition-[width]` 를 **뺐다** — 아래 `animated` 설명 참고.
import { View } from 'react-native'

const TRACK_CLASS = 'h-1.5 w-full overflow-hidden rounded-full bg-track'

/** 조립하지 않는다 — 이유는 파일 머리 ①. */
const FILL_CLASS = {
  primary: 'h-1.5 rounded-full bg-primary',
  third: 'h-1.5 rounded-full bg-third',
} as const

export interface ProgressBarProps {
  /** 채움 비율(0~100). 클램프하지 않는다 — 호출부가 이미 자기 단위로 계산해 넘긴다. */
  percent: number
  /**
   * 채움 색. 기본은 브랜드 강조(`primary`)이고, 컨텐츠 스케줄러의 카드 진행률만
   * `third` 를 쓴다(카드 배색과 충돌하지 않게).
   */
  tone?: keyof typeof FILL_CLASS
  /**
   * 접근성 값. 주면 `accessibilityRole="progressbar"` 와 값을 함께 낸다.
   *
   * 선택인 이유 — 기존 9곳 중 업데이트 모달 하나만 role·aria 없이 그리고 있어서, 지금 붙이면
   * 화면이 바뀐다([[ADR-094]] 결정 4). 접근성 보강은 별도 변경으로 다룬다.
   */
  aria?: { now: number; max: number }
  /**
   * 폭 변화에 트랜지션을 건다 — 값이 연속으로 흐르는 다운로드 진행률용.
   *
   * ⚠️ **아직 아무 일도 하지 않는다.** 웹은 `transition-[width]` 한 클래스였지만 RN 에는 CSS
   * 트랜지션이 없다(NativeWind 의 `transition-*` 은 Reanimated 워클릿을 타는데, 그 배선은
   * **step 7(animations)** 몫이다 — 지금 그 클래스를 쓰면 테스트 런타임에서 즉시 죽는다, 실측).
   * 프롭을 남겨 두는 것은 step 4~6 이 옮길 호출부가 계약을 안 바꾸게 하기 위해서다. 폭은 값이
   * 바뀌는 즉시 그 자리로 점프한다.
   */
  animated?: boolean
  /** 채움 요소에 붙일 test id. */
  fillTestId?: string
}

export function ProgressBar(props: ProgressBarProps): React.JSX.Element {
  const tone = props.tone ?? 'primary'

  return (
    <View
      accessibilityRole={props.aria === undefined ? undefined : 'progressbar'}
      accessibilityValue={
        props.aria === undefined ? undefined : { now: props.aria.now, min: 0, max: props.aria.max }
      }
      className={TRACK_CLASS}
    >
      <View
        testID={props.fillTestId}
        className={FILL_CLASS[tone]}
        style={{ width: `${props.percent}%` }}
      />
    </View>
  )
}
