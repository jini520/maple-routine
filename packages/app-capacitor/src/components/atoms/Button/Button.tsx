// 버튼 atom — `design-system.md` 「기본 컴포넌트」절의 Primary/Text 규정과, 실제로 쓰이고 있던
// danger(파괴적 동작) 변형을 코드로 승격한 것(ADR-094 결정 3).
//
// **외형만 갖고 레이아웃은 호출부에 남긴다.** 실측(2026-08-05)에서 primary 9곳의 공통 토큰은
// 아래 7개뿐이었고 `flex`·`w-full`·`items-center`·`gap-2` 는 5~6곳에서만 쓰였다. 그것들은
// "이 버튼이 어떻게 생겼나"가 아니라 "이 자리에 어떻게 놓이나"라, atom 이 가지면 호출부마다
// 예외 프롭이 생긴다. 그래서 `className` 으로 이어 붙인다.
//
// 외형 토큰 자체는 `variants.ts` 에 있다 — `<a>` 가 겉모습만 입어야 하는 자리가 있고, 컴포넌트
// 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨지기 때문이다.
import { BUTTON_VARIANT_CLASS, type ButtonVariant } from './variants'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant
}

export function Button({ variant, className, type, ...rest }: ButtonProps): React.JSX.Element {
  const classes =
    className === undefined
      ? BUTTON_VARIANT_CLASS[variant]
      : `${BUTTON_VARIANT_CLASS[variant]} ${className}`

  // type 기본값을 button 으로 둔다 — HTML 기본값은 submit 이라, 폼 안에 놓인 보조 버튼이
  // 의도치 않게 폼을 보내는 사고가 흔하다.
  return <button type={type ?? 'button'} className={classes} {...rest} />
}
