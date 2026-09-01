/**
 * 버튼 atom. `design-system.md` 의 `기본 컴포넌트` 절이 규정한 버튼 넷을 그린다
 * ([[ADR-094]] 결정 3 · [[ADR-198]]).
 *
 * **외형만 갖고 레이아웃은 호출부에 남긴다.** 폭·정렬·간격은 `className` 으로 준다
 * ([[ADR-198]] 결정 1). 색·여백·글자를 정하는 표는 `variants.ts` 에 있다(결정 3).
 */
import { Children, type ReactNode } from 'react'
import { Pressable, type PressableProps } from 'react-native'

import { Text } from '../Text/Text'
import { BUTTON_VARIANT_CLASS, BUTTON_VARIANT_TEXT_CLASS, type ButtonVariant } from './variants'

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  /** 외형. 변형이 정하는 것은 색·테두리·여백·글자이고 자리는 안 정한다. */
  variant: ButtonVariant
  /** 상자 클래스(레이아웃). 글자 유틸은 여기가 아니라 `textClassName` 이다. */
  className?: string
  /** 글자 클래스. 변형 기본값 뒤에 이어 붙어 그것을 덮는다. */
  textClassName?: string
  /** 문자열과 숫자는 라벨로 보고 `Text` 로 감싼다. 요소는 그대로 통과한다. */
  children?: ReactNode
}

function join(base: string, extra: string | undefined): string {
  return extra === undefined ? base : `${base} ${extra}`
}

/**
 * 버튼 하나.
 *
 * 문자열과 숫자 `children` 만 골라 `Text` 로 감싸므로 아이콘 같은 요소는 자기 클래스로 선다.
 * `role="button"` 을 직접 박는 것은 RN 에 `<button>` 태그가 없어서이고, `{...rest}` 보다 앞에 두어
 * 호출부가 덮을 수 있게 했다. 외부 URL 로 나가는 버튼이 `role="link"` 로 그렇게 한다.
 *
 * @example
 * // 온보딩 API 키 확인. 폭과 정렬은 호출부가 준다.
 * <Button
 *   variant="primary"
 *   onPress={handleSubmit}
 *   disabled={isSubmitDisabled}
 *   className="w-full flex-row items-center justify-center gap-2"
 * >
 *   {props.isSubmitting && <MapleSpinner size={16} />}
 *   {props.isSubmitting ? '확인 중' : '확인'}
 * </Button>
 *
 * @example
 * // 겉모습만 빌리는 자리. 시맨틱은 링크다.
 * <Button variant="outline" role="link" onPress={() => void Linking.openURL(GUIDE_URL)}>
 *   API 키 발급 방법 보기
 * </Button>
 *
 * @example
 * // 글자 크기를 바꿀 때는 `textClassName` 이다. 상자에 주면 무시된다.
 * <Button variant="primary" onPress={props.onClose} textClassName="text-sm">
 *   닫기
 * </Button>
 */
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
