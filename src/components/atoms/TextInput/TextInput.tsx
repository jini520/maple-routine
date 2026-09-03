/**
 * 입력 칸 atom. RN 의 `TextInput` 을 그대로 그리고 네 가지를 대신 채운다.
 *
 * `react-native` 의 `TextInput` 직접 import 는 ESLint 와 `src/__tests__/font-scaling-policy.test.ts`
 * 가 막는다. **이 파일이 그 규칙의 예외 둘 중 하나다**(다른 하나는 `atoms/Text/Text.tsx`).
 */
import {
  TextInput as RNTextInput,
  useWindowDimensions,
  type TextInputProps as RNTextInputProps,
} from 'react-native'

import { useThemeAppearance } from '../../../theme/context'
import { BASE_TEXT_STYLE } from '../Text/app-font'
import { fontScalingProps, type Clamped } from '../Text/font-scaling'

/** RN 의 `TextInputProps` 에서 배수 프롭 둘을 빼고 `fixed` 를 더한 것. */
export type TextInputProps = Clamped<RNTextInputProps>

/** 조합이 안 도는 키보드. 숫자만 나오므로 IME 가 조합 구간을 쥘 일이 없다. */
const NUMERIC_KEYBOARDS = new Set<RNTextInputProps['keyboardType']>([
  'number-pad',
  'numeric',
  'decimal-pad',
  'phone-pad',
])

/**
 * 입력 칸 하나. `value`·`onChangeText` 를 평소처럼 준다. 호출부가 아래 셋을 안 고른다.
 *
 *  ① 시스템 글자 배수를 `[1.0, 1.235]` 로 자른다
 *  ② 조합이 도는 칸은 `value` 대신 `defaultValue` 로 심는다
 *  ③ 자리표시자 색과 상자를 못박아 두 플랫폼을 맞춘다.
 *
 * 치수를 주고 싶으면 `className` 이나 `style` 로 주면 되고, 그쪽이 여기 기본값을 이긴다.
 *
 * **시트 안에서는 `organisms/SheetTextInput` 을 쓸 것**. 이 아톰은 자기가
 * 어디 담기는지 모른다.
 *
 * @example
 * // 숫자 칸. `keyboardType` 이 숫자면 `value` 로 통제하므로 서식이 산다
 * <TextInput
 *   aria-label="판매가"
 *   value={meso === 0 ? '' : meso.toLocaleString()}
 *   onChangeText={(text) => setMeso(parseMesoInput(text))}
 *   keyboardType="number-pad"
 *   className="px-3 py-2"
 * />
 *
 * // 글자 칸. 같은 프롭을 주지만 안에서 `defaultValue` 로 심어 한글 조합이 산다.
 * // 그래서 **밖에서 값을 갈아 끼워도 안 바뀐다.** 다시 심어야 하면 `key` 를 준다
 * <TextInput aria-label="아이템" value={name} onChangeText={setName} placeholder="아이템 명" />
 */
export function TextInput({
  fixed = false,
  value,
  keyboardType,
  ...rest
}: TextInputProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()
  const { definition } = useThemeAppearance()

  /**
   * 숫자 키패드 칸은 되쓰기가 필요하다(`1234` 를 `1,234` 로 갈아 끼운다). 글자 칸은 되쓰면 한글
   * 조합이 깨진다. 그래서 갈림은 키보드 종류다.
   */
  const numeric = keyboardType !== undefined && NUMERIC_KEYBOARDS.has(keyboardType)

  return (
    <RNTextInput
      /** `{...rest}` 보다 앞이라 호출부가 직접 주면 그쪽이 이긴다. */
      placeholderTextColor={definition.textDisabled}
      {...rest}
      keyboardType={keyboardType}
      {...(numeric ? { value } : { defaultValue: value })}
      /** 플랫폼 기본 상자를 지우는 값. 배열 앞이라 호출부의 치수가 이긴다. */
      style={[
        { ...BASE_TEXT_STYLE, padding: 0, includeFontPadding: false, textAlignVertical: 'center' },
        rest.style,
      ]}
      /** 계산한 프롭이 뒤에 온다. 스프레드로 들어온 값이 클램프를 못 이기게. */
      {...fontScalingProps(fontScale, fixed)}
    />
  )
}
