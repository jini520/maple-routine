// 글자 atom — **이 앱에서 글자를 그리는 유일한 자리**다([[ADR-152]] 결정 4).
//
// ## 왜 래퍼가 필요한가
//
// RN `<Text>` 의 `allowFontScaling` 기본값이 `true` 라, 아무것도 안 하면 OS 배수(iOS
// 0.823~3.571)를 **그대로** 받는다. 이 앱은 10px 이하가 110곳이라 축소를 못 견디고, today 격자는
// 행 높이가 76 으로 고정이라 확대를 못 견딘다. 그래서 배수를 `[1.0, 1.235]` 로 자른다.
//
// 자르는 프롭은 **글자를 그리는 자리마다** 붙어야 하고 하나라도 빠지면 그 자리만 조용히 옛 동작으로
// 남는다(410곳). 그래서 값을 아는 곳을 하나로 모으고, `react-native` 의 `Text`·`TextInput` 직접
// import 는 ESLint(`no-restricted-imports`)와 테스트(`src/__tests__/font-scaling-policy.test.ts`)가
// 막는다 — 규칙이 문서에만 있으면 새 화면이 조용히 예전 방식으로 돌아간다([[ADR-094]] 결정 2 와
// 같은 판단).
//
// **이 파일이 그 규칙의 유일한 예외다.**
//
// ## 계층상 atom 인 이유
//
// 다른 계층을 참조하지 않고 `react-native` 만 본다([[ADR-094]] 결정 2 의 의존 방향). 스타일을 하나도
// 안 갖는 atom 이라는 점에서 Badge·Button 과 다르지만, 그것은 이 컴포넌트가 «생김새» 가 아니라
// «글자가 커지는 방식» 을 소유하기 때문이다.
//
// ## `allowFontScaling` 을 프롭으로 열지 않는다
//
// 공개 타입에서 아예 지운다(`Omit`) — 열어 두면 호출부가 클램프를 무를 수 있고, 그러면 «한 곳이
// 값을 쥔다» 가 깨진다. 칸에 묶여 못 커지는 자리는 그 대신 **`fixed`** 를 쓴다(결정 5). 기준은
// «작아 보인다» 가 아니라 **«상자가 글자를 따라 커지는가»** 다.
import {
  Text as RNText,
  TextInput as RNTextInput,
  useWindowDimensions,
  type TextInputProps as RNTextInputProps,
  type TextProps as RNTextProps,
} from 'react-native'

import { fontScalingProps } from './font-scaling'

/** 클램프를 앱이 쥐므로 배수 프롭 둘은 호출부에서 사라지고, 대신 `fixed` 가 생긴다. */
type Clamped<P> = Omit<P, 'allowFontScaling' | 'maxFontSizeMultiplier'> & {
  /** 상자가 글자를 못 따라가는 자리 — 시스템 글자 크기를 아예 안 따른다([[ADR-152]] 결정 5). */
  fixed?: boolean
}

export type TextProps = Clamped<RNTextProps>
export type TextInputProps = Clamped<RNTextInputProps>

export function Text({ fixed = false, ...rest }: TextProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()

  // 계산한 프롭이 **뒤에** 온다 — 스프레드로 들어온 값이 클램프를 못 이기게.
  return <RNText {...rest} {...fontScalingProps(fontScale, fixed)} />
}

export function TextInput({ fixed = false, ...rest }: TextInputProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()

  return <RNTextInput {...rest} {...fontScalingProps(fontScale, fixed)} />
}
