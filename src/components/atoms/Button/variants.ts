/**
 * 버튼 변형 일곱의 **외형 표**. `design-system.md` 의 `기본 컴포넌트` 절이 규정한 것을 코드로 옮긴
 * 것이다.
 *
 * `Button.tsx` 와 파일이 나뉘어 있다. 스타일 표와 컴포넌트 코드를 섞지 않는다.
 */

/**
 * 변형별 **상자** 클래스. 배경·테두리·라운딩만 있고 글자 유틸도 여백도 없다.
 *
 * 글자 유틸을 여기 넣으면 RN 에서 조용히 죽는다. 상자에 앉아 있기만 하고 안쪽 `Text` 가 못 받는다
 * 라운딩이 pill 로 고정인 것은 디자인 원칙 2 를 코드가 지키기 위해서다
 * (카드 14px · 버튼 pill · 인풋 10px).
 *
 * 여백은 `BUTTON_SIZE_CLASS` 가 갖는다. 여섯이 전부 같은 값을 적고 있었으니 변형의 성질이 아니다.
 */
export const BUTTON_VARIANT_CLASS = {
  primary: 'rounded-full bg-primary',
  /** 주 CTA 옆이나 아래에 서는 부 동작. `danger` 와 같은 테두리 pill 이되 색이 중립이다. */
  outline: 'rounded-full border border-border',
  text: 'rounded-full',
  /**
   * 테마색 테두리 pill 에 테마색 글자. `outline` 과 같은 자리에 서되 선도 글자도 `primary` 계열이다.
   *
   * ⚠️ **밝은 테마에서 대비가 낮다**(사용자 결정). `primary-ink` 를 표면에 얹은 값이
   * 머쉬맘 2.38 · 엔젤릭버스터 2.26 · 검은마법사 3.96 으로 AA(4.5)에 못 미친다. 색을 맞추는 쪽을
   * 택한 것이므로 **밝은 테마에서 옅게 보이는 것은 알고 둔 것**이고, 안 읽힌다는 보고가 오면
   * 고칠 자리는 이 두 줄이 아니라 `primary-ink` 파생 규칙이다.
   */
  primaryOutline: 'rounded-full border border-primary',
  /**
   * 주 동작이되 채운 알약보다 한 단 약한 자리. `outline` 과 같은 자리에 서되 테두리 대신 옅은 면이다.
   *
   * 글자색이 `primary-ink` 가 아닌 것이 이 변형의 핵심이다. 옅은 틴트 위에 같은 계열 잉크를 얹으면
   * 테마에 따라 명도 대비가 1.6 까지 떨어져 글자가 안 읽힌다(머쉬맘 실측).
   */
  tint: 'rounded-full bg-primary-tint',
  danger: 'rounded-full border border-error',
  /**
   * 되돌릴 수 없는 동작을 **작게** 내리는 자리. 상자는 `text` 와 같고 글자색만 갈린다.
   *
   * 테두리를 두르면 그것대로 눈길을 끌어 안전한 기본값(취소)과 비중이 붙는다. 파괴 동작이 취소보다
   * 커 보이면 안 되고, 위험하다는 신호는 색 하나로 충분하다.
   */
  dangerText: 'rounded-full',
} as const

/**
 * 크기별 **여백** 클래스. 변형과 직교한다.
 *
 * **호출부가 `className` 으로 여백을 못 덮어서 여기 있다.** `px-3.5` 와 `px-5` 는 같은 속성에
 * 특이도가 같아, 이어 붙인 순서가 아니라 생성된 CSS 순서가 이긴다. 그 순서는 테일윈드가 정하므로
 * 덮으려는 쪽이 질 수 있고 그때 아무 에러도 안 난다.
 *
 * `compact` 는 카드나 배너 **안에** 끼는 버튼 자리다. 32px 라 권장 타깃 44px 아래이므로
 * 호출부가 `hitSlop` 으로 손가락 자리를 되돌려 줄 것.
 */
export const BUTTON_SIZE_CLASS = {
  default: 'px-5 py-2.5',
  compact: 'px-3.5 py-1.5',
} as const

/** 버튼 변형 일곱. 상자 표의 키가 곧 이 타입이다. */
export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASS

/** 버튼 크기 둘. 여백 표의 키가 곧 이 타입이다. */
export type ButtonSize = keyof typeof BUTTON_SIZE_CLASS

/**
 * 라벨 **글자 크기** 하나. 변형과 크기가 함께 정한다.
 *
 * **표를 겹치지 않고 함수로 고르는 이유는 실측이다.** `text-13` 을 `text-sm` 뒤에 이어 붙였더니
 * 렌더된 `fontSize` 가 14 로 나왔다. 안 덮인다. 그런데 `text-sm` 은 `text-base` 를 덮는다.
 * **어느 쪽이 이길지가 클래스 이름 쌍마다 갈리므로 덮어쓰기에 기대지 않는다.** 한 벌만
 * 내보내면 겹칠 일이 없다.
 *
 * `primary` 만 `default` 에서 16px 인 것은 웹 `<button>` 이 그 크기를 상속으로 받고 있었기
 * 때문이다. `compact` 는 그 예외를 안 둔다 - 좁은 자리에 끼는 버튼이라 변형별로 갈릴 이유가 없다.
 *
 * @param variant 외형
 * @param size 여백 크기
 */
export function buttonTextSizeClass(variant: ButtonVariant, size: ButtonSize): string {
  if (size === 'compact') return 'text-13'
  return variant === 'primary' ? 'text-base' : 'text-sm'
}

/**
 * 변형별 **글자** 클래스. `Button` 이 라벨을 감싸는 `Text` 에 준다. 굵기와 색만 있다.
 *
 * 크기는 `buttonTextSizeClass` 가 따로 낸다. 여기 같이 적으면 `compact` 가 그것을 못 덮는다.
 */
export const BUTTON_VARIANT_TEXT_CLASS = {
  primary: 'font-semibold text-on-primary',
  outline: 'font-semibold text-text',
  text: 'font-medium text-text-muted',
  primaryOutline: 'font-semibold text-primary-ink',
  tint: 'font-semibold text-text',
  danger: 'font-semibold text-error-ink',
  dangerText: 'font-medium text-error-ink',
} as const

/**
 * 대기 스피너 색. **라벨 색과 같은 토큰이어야 한다**. 한 버튼 안에서 두 색이 갈리면 안 된다.
 *
 * 글자 표에서 색만 떼어 따로 적는 이유는 스피너가 `Svg` 라서다. 글자 표를 통째로 주면 크기·두께
 * 클래스가 함께 흘러 들어간다. 두 표가 갈리지 않는지는 `Button.test.tsx` 가 본다.
 */
export const BUTTON_VARIANT_SPINNER_CLASS = {
  primary: 'text-on-primary',
  outline: 'text-text',
  text: 'text-text-muted',
  primaryOutline: 'text-primary-ink',
  tint: 'text-text',
  danger: 'text-error-ink',
  dangerText: 'text-error-ink',
} as const
