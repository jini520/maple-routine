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
import { useBottomSheetInternal } from '@gorhom/bottom-sheet'
import { useEffect, useRef } from 'react'
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

/**
 * 초점 이벤트의 형태는 **RN 의 프롭에서 뽑아 쓴다** — 그 타입의 이름과 자리가 RN 판마다 달라서
 * (`TextInputFocusEvent`·`FocusEvent`) 직접 가져오면 판을 올릴 때 조용히 어긋난다.
 */
type FocusEvent = Parameters<NonNullable<RNTextInputProps['onFocus']>>[0]

/**
 * 이벤트에서 **초점의 정체**를 꺼낸다 — 없으면 `undefined` 다.
 *
 * 실기에서는 언제나 실려 오지만, 테스트가 `fireEvent(칸, 'focus')` 처럼 **이벤트 없이** 부르는
 * 자리가 있다. 거기서 던지면 이 아톰을 쓰는 화면 테스트가 통째로 죽는다 — 채울 것이 없을 뿐이지
 * 잘못된 상태가 아니다.
 */
function targetOf(event: FocusEvent | undefined): number | undefined {
  return event?.nativeEvent?.target
}

export type TextProps = Clamped<RNTextProps>
export type TextInputProps = Clamped<RNTextInputProps>

export function Text({ fixed = false, ...rest }: TextProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()

  // 계산한 프롭이 **뒤에** 온다 — 스프레드로 들어온 값이 클램프를 못 이기게.
  return <RNText {...rest} {...fontScalingProps(fontScale, fixed)} />
}

/**
 * **언제나 RN 의 `TextInput` 이다 — 시트가 아는 «초점» 만 우리가 채운다**([[ADR-170]] 정정 10).
 *
 * ## 시트가 원하는 것은 부품이 아니라 값 하나다
 *
 * `@gorhom/bottom-sheet` 는 `animatedKeyboardState.target` 이 비어 있으면 키보드 이벤트를 받고도
 * 상태를 **안 올린다**(라이브러리 `useAnimatedKeyboard` — 이벤트를 캐시만 하고 돌아간다). 그래서
 * 시트 안에서 키보드가 떠도 시트가 한 번도 안 올라갔다(정정 5 가 고친 그 증상).
 *
 * 정정 5 는 그 값을 채우려고 `BottomSheetTextInput` 을 썼는데, **그것은 RN 의 입력이 아니다** —
 * 안쪽이 `react-native-gesture-handler` 의 `TextInput`(= `NativeViewGestureHandler` 로 감싼 것,
 * RNGH 자신이 폐기 예정으로 표시해 둔 래퍼)이다. 그 층이 끼자 안드로이드에서 **한글 조합이
 * 깨졌다** — ㅇㅏㄴ 처럼 자모가 따로 확정된다(정정 10).
 *
 * 조합 입력은 IME 가 칸 안에 «조합 중» 구간을 쥐고 그 자리를 갈아 끼우는 방식이라, 그 구간이
 * 한 번 흐트러지면 지금까지 모으던 자모가 그대로 확정된다. 영문·숫자는 한 타에 하나씩 확정되므로
 * **같은 결함이라도 한글에서만 눈에 보인다.**
 *
 * 그래서 부품을 되돌리고 **필요한 값 하나만 직접 채운다** — 라이브러리가 자기 입력에서 하는 일과
 * 같은 일이다(`BottomSheetTextInput` 의 `onFocus`/`onBlur`/언마운트 정리).
 *
 * ## 초점이 옮겨 갈 때 안 꺼진다
 *
 * 끄는 조건이 «지금 켜져 있는 것이 **나**인가» 라, 시트 안 두 칸 사이를 오갈 때 순서가 어느 쪽이든
 * 성립한다 — 흐림이 먼저 오면 껐다가 곧 새 칸이 켜고, 켬이 먼저 오면 흐림은 남의 것이라 안 끈다.
 * (라이브러리는 여기에 «다른 시트 입력이 켜져 있나» 검사를 하나 더 두는데, 그건 **자기 입력들의
 * 노드 집합**을 알아야 하는 일이다. 위 조건만으로 같은 결과가 나오므로 안 따라 한다.)
 *
 * `unsafe`(`true`)로 묻는다 — 시트 밖에서는 그 훅이 **던진다.**
 */
export function TextInput({
  fixed = false,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps): React.JSX.Element {
  const { fontScale } = useWindowDimensions()
  const keyboardState = useBottomSheetInternal(true)?.animatedKeyboardState ?? null
  /** 내가 켰던 초점 — 언마운트할 때 «남의 것을 끄지 않기» 위해 기억한다. */
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

  function handleBlur(event: FocusEvent): void {
    const target = targetOf(event)
    if (keyboardState !== null && target !== undefined && keyboardState.get().target === target) {
      keyboardState.set((state) => ({ ...state, target: undefined }))
    }
    onBlur?.(event)
  }

  // 계산한 프롭이 **뒤에** 온다 — 스프레드로 들어온 값이 클램프를 못 이기게.
  return (
    <RNTextInput
      {...rest}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...fontScalingProps(fontScale, fixed)}
    />
  )
}
