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
 * 조합이 **안 도는** 키보드 — 숫자만 나오므로 IME 가 「조합 중」 구간을 쥘 일이 없다.
 * (`TextInput` 의 되쓰기 갈림에 쓴다. 사유는 그 안 주석.)
 */
const NUMERIC_KEYBOARDS = new Set<RNTextInputProps['keyboardType']>([
  'number-pad',
  'numeric',
  'decimal-pad',
  'phone-pad',
])

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
  value,
  keyboardType,
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

  /**
   * **조합이 도는 칸에는 앱이 글자를 되쓰지 않는다**([[ADR-170]] 정정 12).
   *
   * ## 무엇이 깨졌나
   *
   * 한글은 조합 입력이라 IME 가 칸 안에 「조합 중」 구간을 쥐고 그 자리를 갈아 끼운다. 그 구간이
   * 한 번 흐트러지면 모으던 자모가 그대로 확정된다 — 「안녕」이 「ㅇㅏㄴㄴㅕㅇ」이 된다. 앱이
   * `value` 로 칸에 글자를 **되쓰는** 것이 그 흐트러뜨림이다.
   *
   * ## 계측이 가른 것 (에뮬레이터 API 36 · Gboard 한국어 · 2026-08-27)
   *
   * 같은 아톰·같은 키보드·같은 시트에 칸만 넷을 놓고 「안녕」을 쳤다:
   *
   * | 칸 | 값을 쥔 곳 | `value` 프롭 | 결과 |
   * |---|---|---|---|
   * | 칸이 자기 상태로 | 칸 | 있음 | 안녕 |
   * | **부모 상태**(진짜 시트의 모양) | 부모 | **있음** | **ㅇㅏㄴㄴㅕㅇ** |
   * | 부모 상태 + `className`(NativeWind) | 부모 | 있음 | ㅇㅏㄴㄴㅕㅇ |
   * | 부모 상태 · `defaultValue` | 부모 | **없음** | 안녕 |
   *
   * 그래서 원인은 키보드도(삼성·Gboard 둘 다 난다) NativeWind 도 시트도 아니다. **부모가 다시
   * 그리는 나무 안에 `value` 프롭이 있으면** 깨지고, 없으면 산다. (아톰이 메아리를 흡수해 같은
   * 문자열만 넘기도록 해 봤지만 그래도 깨졌다 — 되쓰는 값이 같은가가 아니라 **되쓸 자리가 있는가**가
   * 가른다.)
   *
   * ## 처방 — 조합이 도는 칸은 `value` 를 **씨앗**으로만 받는다
   *
   * 숫자 키패드가 뜨는 칸은 조합이 없다(한 타에 하나씩 확정된다). 그리고 그런 칸은 되쓰기가
   * **필요하다** — 금액 칸이 친 `1234` 를 `1,234` 로 갈아 끼우는 것이 그 되쓰기다([[ADR-170]] 정정 4).
   * 그래서 갈림은 키보드 종류다:
   *
   * - **숫자 키패드** → 종전대로 `value` 로 통제한다. 서식이 산다.
   * - **그 밖(글자 칸)** → `defaultValue` 로 **한 번만 심고** 되쓰지 않는다. 조합이 산다.
   *
   * 호출부는 아무것도 안 고른다 — `value`/`onChangeText` 를 그대로 쓴다. 이 아톰이 존재하는 이유가
   * 그것이다(파일 머리): *«규칙이 문서에만 있으면 새 화면이 조용히 예전 방식으로 돌아간다»*.
   *
   * ## 대가
   *
   * 글자 칸은 **밖에서 값을 갈아 끼워도 안 바뀐다**(심은 뒤로는 칸이 자기 글자의 주인이다).
   * 지금 그런 자리는 없고 — 시트는 열 때 새로 마운트되므로 수정 모드의 초기값은 씨앗으로 들어간다 —
   * 정말 필요해지면 리액트가 정한 방법이 있다: 그 칸에 `key` 를 줘서 다시 심는다.
   */
  const numeric = keyboardType !== undefined && NUMERIC_KEYBOARDS.has(keyboardType)

  /**
   * **칸의 상자는 두 플랫폼이 같아야 한다**([[ADR-170]] 정정 13).
   *
   * 아무 치수도 안 주면 각 플랫폼의 기본값이 그대로 드러나는데, 그 기본값이 딴판이다 — 같은 시트의
   * 같은 칸을 재니 **안드로이드 41.14dp · iOS 20.00pt** 였다(계측 2026-08-27). 안드로이드 쪽 군살은
   * 우리 스타일이 아니라 **EditText 기본 패딩**(테마의 `rn_edit_text_material` 배경이 들고 오는 것)과
   * **글꼴 패딩**(`includeFontPadding` — 글꼴의 ascent/descent 여백)이다.
   *
   * 셋을 끄면 20.19dp 로 내려와 iOS 와 맞는다. `textAlignVertical` 은 그렇게 줄인 상자 안에서 글자를
   * 가운데로 세운다(안드로이드는 기본이 위쪽 정렬이다).
   *
   * **호출부의 치수가 이긴다** — 이 값들은 배열 앞에 두므로 `style` 이든 `className`(NativeWind)이든
   * 뒤에서 덮어쓴다. 실측으로 확인했다: `px-3 py-2` 를 준 칸은 두 플랫폼 모두 패딩이 그대로 살아 있다.
   */
  // 계산한 프롭이 **뒤에** 온다 — 스프레드로 들어온 값이 클램프를 못 이기게.
  return (
    <RNTextInput
      {...rest}
      keyboardType={keyboardType}
      {...(numeric ? { value } : { defaultValue: value })}
      style={[
        { padding: 0, includeFontPadding: false, textAlignVertical: 'center' },
        rest.style,
      ]}
      onFocus={handleFocus}
      onBlur={handleBlur}
      {...fontScalingProps(fontScale, fixed)}
    />
  )
}
