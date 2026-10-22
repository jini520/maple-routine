/**
 * 글자 atom. 이 앱은 글자를 여기서만 그린다.
 *
 * `react-native` 의 `Text` 직접 import 는 ESLint 와 `src/__tests__/font-scaling-policy.test.ts` 가
 * 막는다. **이 파일이 그 규칙의 예외 둘 중 하나다**(다른 하나는 `atoms/TextInput/TextInput.tsx`).
 */
import { cssInterop } from 'nativewind'
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native'

import { useTextScale } from '../../../theme/text-scale'
import { BASE_TEXT_STYLE } from './app-font'
import { scaleTextStyle } from './font-scaling'

/** RN 의 `TextProps` 에서 시스템 배수 프롭 둘을 뺀 것. 배수는 앱 설정이 정한다. */
export type TextProps = Omit<RNTextProps, 'allowFontScaling' | 'maxFontSizeMultiplier'>

/**
 * 글자 하나. RN 의 `Text` 프롭을 그대로 받는다.
 *
 * 시스템 글자 크기는 따르지 않고, 설정의 글자 크기 배수를 크기와 줄 높이에 곱한다.
 *
 * @example
 * <Text className="text-sm text-text">문구</Text>
 */
export function Text({ style, ...rest }: TextProps): React.JSX.Element {
  const scale = useTextScale()

  /** 글꼴이 맨 앞이라 호출부가 덮을 수 있다. 시스템 배수 끄기는 뒤에 와서 스프레드가 못 이긴다. */
  return (
    <RNText
      {...rest}
      style={scaleTextStyle(StyleSheet.flatten([BASE_TEXT_STYLE, style]), scale)}
      allowFontScaling={false}
    />
  )
}

/** `className` 을 `style` 로 풀어 받는 등록. 안 하면 클래스로 준 크기를 몰라 배수를 못 곱한다. */
cssInterop(Text, { className: 'style' })
