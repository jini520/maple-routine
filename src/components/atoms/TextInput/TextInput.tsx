// 입력 칸 atom. RN 의 `TextInput` 을 그대로 그리고 네 가지를 대신 채운다([[ADR-152]] 정정 1).
//
//   ① 시스템 글자 배수를 `[1.0, 1.235]` 로 자른다([[ADR-152]] 결정 4)
//   ② 시트가 키보드를 보려면 필요한 초점 값을 채운다([[ADR-170]] 정정 10)
//   ③ 조합이 도는 칸은 `value` 대신 `defaultValue` 로 심는다([[ADR-170]] 정정 12)
//   ④ 자리표시자 색과 상자를 못박아 두 플랫폼을 맞춘다([[ADR-179]] 결정 5 · [[ADR-170]] 정정 13)
//
// 쓰는 법: `value`·`onChangeText` 를 평소처럼 준다. 호출부는 위 넷을 안 고른다. 치수를 주고 싶으면
// `className` 이나 `style` 로 주면 되고, 그쪽이 여기 기본값을 이긴다.
//
// `react-native` 의 `TextInput` 직접 import 는 ESLint 와 `src/__tests__/font-scaling-policy.test.ts`
// 가 막는다. **이 파일이 그 규칙의 예외 둘 중 하나다**(다른 하나는 `atoms/Text/Text.tsx`).
import { useBottomSheetInternal } from '@gorhom/bottom-sheet'
import { useEffect, useRef } from 'react'
import {
  TextInput as RNTextInput,
  useWindowDimensions,
  type TextInputProps as RNTextInputProps,
} from 'react-native'

import { useThemeAppearance } from '../../../theme/context'
import { BASE_TEXT_STYLE } from '../Text/app-font'
import { fontScalingProps, type Clamped } from '../Text/font-scaling'

export type TextInputProps = Clamped<RNTextInputProps>

/**
 * 초점 이벤트의 형태는 RN 의 프롭에서 뽑아 쓴다. 그 타입의 이름과 자리가 RN 판마다 달라서
 * (`TextInputFocusEvent`·`FocusEvent`) 직접 가져오면 판을 올릴 때 조용히 어긋난다.
 */
type FocusEvent = Parameters<NonNullable<RNTextInputProps['onFocus']>>[0]

/**
 * 이벤트에서 초점의 정체를 꺼낸다. 없으면 `undefined` 다.
 *
 * 실기에서는 언제나 실려 오지만 테스트가 `fireEvent(칸, 'focus')` 처럼 이벤트 없이 부르는 자리가
 * 있다. 거기서 던지면 이 atom 을 쓰는 화면 테스트가 통째로 죽는다.
 */
function targetOf(event: FocusEvent | undefined): number | undefined {
  return event?.nativeEvent?.target
}

/** 조합이 안 도는 키보드. 숫자만 나오므로 IME 가 조합 구간을 쥘 일이 없다([[ADR-170]] 정정 12). */
const NUMERIC_KEYBOARDS = new Set<RNTextInputProps['keyboardType']>([
  'number-pad',
  'numeric',
  'decimal-pad',
  'phone-pad',
])

export function TextInput({
  fixed = false,
  onFocus,
  onBlur,
  value,
  keyboardType,
  ...rest
}: TextInputProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()
  const { definition } = useThemeAppearance()
  // 시트 밖에서는 이 훅이 던지므로 `unsafe`(`true`)로 묻는다.
  const keyboardState = useBottomSheetInternal(true)?.animatedKeyboardState ?? null
  /** 내가 켰던 초점. 언마운트할 때 남의 것을 끄지 않으려고 기억한다. */
  const myTarget = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (keyboardState === null) return
    return () => {
      if (myTarget.current !== undefined && keyboardState.get().target === myTarget.current) {
        keyboardState.set((state) => ({ ...state, target: undefined }))
      }
    }
  }, [keyboardState])

  function handleFocus(event: FocusEvent): void {
    const target = targetOf(event)
    if (target !== undefined) {
      myTarget.current = target
      keyboardState?.set((state) => ({ ...state, target }))
    }
    onFocus?.(event)
  }

  // 끄는 조건이 `켜져 있는 것이 나인가` 라, 시트 안 두 칸을 오갈 때 켬과 흐림이 어느 순서로 와도
  // 성립한다([[ADR-170]] 정정 10).
  function handleBlur(event: FocusEvent): void {
    const target = targetOf(event)
    if (keyboardState !== null && target !== undefined && keyboardState.get().target === target) {
      keyboardState.set((state) => ({ ...state, target: undefined }))
    }
    onBlur?.(event)
  }

  // 숫자 키패드 칸은 되쓰기가 필요하다(`1234` 를 `1,234` 로 갈아 끼운다). 글자 칸은 되쓰면 한글
  // 조합이 깨진다. 그래서 갈림은 키보드 종류다([[ADR-170]] 정정 12).
  const numeric = keyboardType !== undefined && NUMERIC_KEYBOARDS.has(keyboardType)

  return (
    <RNTextInput
      // `{...rest}` 보다 앞이라 호출부가 직접 주면 그쪽이 이긴다([[ADR-179]] 결정 5).
      placeholderTextColor={definition.textDisabled}
      {...rest}
      keyboardType={keyboardType}
      {...(numeric ? { value } : { defaultValue: value })}
      // 플랫폼 기본 상자를 지운다([[ADR-170]] 정정 13). 배열 앞이라 호출부의 치수가 이긴다.
      style={[
        { ...BASE_TEXT_STYLE, padding: 0, includeFontPadding: false, textAlignVertical: 'center' },
        rest.style,
      ]}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // 계산한 프롭이 뒤에 온다. 스프레드로 들어온 값이 클램프를 못 이기게.
      {...fontScalingProps(fontScale, fixed)}
    />
  )
}
