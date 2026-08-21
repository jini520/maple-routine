// 버튼 atom — `design-system.md` 「기본 컴포넌트」절의 Primary/Text 규정과, 실제로 쓰이고 있던
// danger(파괴적 동작)·outline(부 동작) 변형을 코드로 승격한 것([[ADR-094]] 결정 3).
//
// **외형만 갖고 레이아웃은 호출부에 남긴다.** 실측(2026-08-05)에서 primary 9곳의 공통 토큰은
// `variants.ts` 의 것뿐이었고 `w-full`·`gap-2` 는 5~6곳에서만 쓰였다. 그것들은 "이 버튼이 어떻게
// 생겼나"가 아니라 "이 자리에 어떻게 놓이나"라, atom 이 가지면 호출부마다 예외 프롭이 생긴다.
//
// ── RN 으로 옮기며 바뀐 것 셋 ─────────────────────────────────────────────────────
//
// ① `<button>` → `Pressable`. `role="button"` 을 명시하는 것은 웹에서 태그가 공짜로 주던 시맨틱을
//    잃지 않기 위해서다. `{...rest}` 보다 앞에 두어 호출부가 덮을 수 있다.
// ② **글자 클래스를 안쪽 `Text` 가 받는다.** RN 은 글자 스타일이 상자에서 상속되지 않는다
//    (`variants.ts` 의 설명). 그래서 문자열·숫자 children 만 골라 `Text` 로 감싸고, 요소 children
//    (아이콘 등)은 그대로 통과시킨다 — 웹에서 텍스트 노드만 버튼의 폰트를 물려받고 아이콘은 자기
//    스타일로 서던 것과 같은 결과다.
// ③ `type` 프롭이 사라졌다. 웹에서 기본값을 `button` 으로 둔 이유가 *"폼 안에서 실수로 submit 되는
//    사고"* 였는데 RN 에는 폼도 submit 도 없다. 남겨 두면 아무 일도 안 하는 프롭이 된다.
//
// 호출부에서 `className` 에 글자 유틸(`text-sm` 등)을 주던 자리는 **`textClassName` 으로 옮겨야
// 한다** — 상자에 주면 조용히 무시된다(웹 호출부 4곳이 그렇게 쓰고 있다: ThemeModal ·
// AccountFlowStatus · ErrorBoundary · CharacterTrackingPicker). step 4~6 이 옮길 때 함께 처리한다.
import { Children, type ReactNode } from 'react'
import { Pressable, type PressableProps } from 'react-native'

import { Text } from '../Text/Text'
import { BUTTON_VARIANT_CLASS, BUTTON_VARIANT_TEXT_CLASS, type ButtonVariant } from './variants'

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  variant: ButtonVariant
  /** 상자 클래스(레이아웃). 글자 유틸은 여기가 아니라 `textClassName` 이다. */
  className?: string
  /** 글자 클래스 — 변형 기본값 뒤에 이어 붙는다. */
  textClassName?: string
  children?: ReactNode
}

function join(base: string, extra: string | undefined): string {
  return extra === undefined ? base : `${base} ${extra}`
}

export function Button({
  variant,
  className,
  textClassName,
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  const label = join(BUTTON_VARIANT_TEXT_CLASS[variant], textClassName)

  return (
    <Pressable role="button" className={join(BUTTON_VARIANT_CLASS[variant], className)} {...rest}>
      {Children.map(children, (child) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <Text className={label}>{child}</Text>
        ) : (
          child
        ),
      )}
    </Pressable>
  )
}
