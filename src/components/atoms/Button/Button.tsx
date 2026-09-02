/**
 * 버튼 atom. `design-system.md` 의 `기본 컴포넌트` 절이 규정한 버튼 넷을 그린다
 *
 *
 * **외형만 갖고 레이아웃은 호출부에 남긴다.** 폭·정렬·간격은 `className` 으로 준다
 * . 색·여백·글자를 정하는 표는 `variants.ts` 에 있다(결정 3).
 */
import { Children, type ReactNode } from 'react'
import { Pressable, View, type PressableProps } from 'react-native'

import { MapleSpinner } from '../Spinner'
import { Text } from '../Text/Text'
import {
  BUTTON_VARIANT_CLASS,
  BUTTON_VARIANT_SPINNER_CLASS,
  BUTTON_VARIANT_TEXT_CLASS,
  type ButtonVariant,
} from './variants'

/** 라벨 옆이 아니라 라벨 자리에 서므로 크기는 의 16px 그대로다. */
const BUSY_SPINNER_SIZE = 16

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  /** 외형. 변형이 정하는 것은 색·테두리·여백·글자이고 자리는 안 정한다. */
  variant: ButtonVariant
  /** 상자 클래스(레이아웃). 글자 유틸은 여기가 아니라 `textClassName` 이다. */
  className?: string
  /** 글자 클래스. 변형 기본값 뒤에 이어 붙어 그것을 덮는다. */
  textClassName?: string
  /**
   * 대기 중인가. 라벨이 가려지고 그 자리에 스피너가 겹친다.
   *
   * 못 누르게 하는 것은 이 프롭이 아니라 `disabled` 다. 대기 중에 누를 수 있는지는 버튼 모양이
   * 아니라 화면의 판단이라 호출부에 남긴다.
   */
  busy?: boolean
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
 *   busy={props.isSubmitting}
 *   onPress={handleSubmit}
 *   disabled={isSubmitDisabled}
 *   className="w-full flex-row items-center justify-center"
 * >
 *   확인
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
 *
 * @example
 * // 대기. 라벨은 그대로 두고 `busy` 만 켠다. 스피너는 버튼이 그린다
 * <Button variant="primary" busy={isSubmitting} disabled={isSubmitting} onPress={handleSubmit}>
 *   확인
 * </Button>
 */
export function Button({
  variant,
  className,
  textClassName,
  busy = false,
  children,
  ...rest
}: ButtonProps): React.JSX.Element {
  // 라벨을 지우지 않고 가린다. 자리를 그대로 차지해야 버튼 폭이 안 줄고, `opacity` 는 접근성
  // 트리를 안 건드려서 스크린리더는 라벨을 그대로 읽는다.
  const label = join(join(BUTTON_VARIANT_TEXT_CLASS[variant], textClassName), busy ? 'opacity-0' : undefined)

  return (
    <Pressable
      role="button"
      aria-busy={busy}
      className={join(BUTTON_VARIANT_CLASS[variant], className)}
      {...rest}
    >
      {Children.map(children, (child) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <Text className={label}>{child}</Text>
        ) : (
          child
        ),
      )}
      {busy && (
        // 겹쳐 그린다. 흐름 안에 두면 그만큼 버튼이 넓어져 대기 전 폭이 안 남는다.
        <View testID="button-busy" className="absolute inset-0 items-center justify-center">
          <MapleSpinner size={BUSY_SPINNER_SIZE} className={BUTTON_VARIANT_SPINNER_CLASS[variant]} />
        </View>
      )}
    </Pressable>
  )
}
