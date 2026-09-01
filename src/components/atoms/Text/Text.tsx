// 글자 atom. 이 앱은 글자를 여기서만 그린다([[ADR-152]] 결정 4).
//
// 쓰는 법: `<Text className="text-sm text-text">문구</Text>`. 상자가 글자를 못 따라가는 자리는
// `fixed` 를 준다(결정 5). 시스템 글자 배수는 이 atom 이 `[1.0, 1.235]` 로 자르므로 호출부가
// `allowFontScaling` 을 만질 일이 없고, 공개 타입에서 아예 지웠다.
//
// `react-native` 의 `Text` 직접 import 는 ESLint 와 `src/__tests__/font-scaling-policy.test.ts` 가
// 막는다. **이 파일이 그 규칙의 예외 둘 중 하나다**(다른 하나는 `atoms/TextInput/TextInput.tsx`).
import { Text as RNText, useWindowDimensions, type TextProps as RNTextProps } from 'react-native'

import { BASE_TEXT_STYLE } from './app-font'
import { fontScalingProps, type Clamped } from './font-scaling'

export type TextProps = Clamped<RNTextProps>

export function Text({ fixed = false, style, ...rest }: TextProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()

  // 글꼴이 맨 앞이라 호출부가 덮을 수 있다. 계산한 프롭은 뒤에 온다. 스프레드로 들어온 값이
  // 클램프를 못 이기게.
  return (
    <RNText {...rest} style={[BASE_TEXT_STYLE, style]} {...fontScalingProps(fontScale, fixed)} />
  )
}
