/**
 * 버튼 변형 넷의 **외형 표**. `design-system.md` 의 `기본 컴포넌트` 절이 규정한 것을 코드로 옮긴
 * 것이다([[ADR-094]] 결정 3 · [[ADR-198]]).
 *
 * `Button.tsx` 와 파일이 나뉘어 있다. 스타일 표와 컴포넌트 코드를 섞지 않는다([[ADR-198]] 결정 3).
 */

/**
 * 변형별 **상자** 클래스. 배경·테두리·여백·라운딩만 있고 글자 유틸은 없다.
 *
 * 글자 유틸을 여기 넣으면 RN 에서 조용히 죽는다. 상자에 앉아 있기만 하고 안쪽 `Text` 가 못 받는다
 * ([[ADR-198]] 결정 2). 라운딩이 pill 로 고정인 것은 디자인 원칙 2 를 코드가 지키기 위해서다
 * (카드 14px · 버튼 pill · 인풋 10px).
 */
export const BUTTON_VARIANT_CLASS = {
  primary: 'rounded-full bg-primary px-5 py-2.5',
  /** 주 CTA 옆이나 아래에 서는 부 동작. `danger` 와 같은 테두리 pill 이되 색이 중립이다. */
  outline: 'rounded-full border border-border px-5 py-2.5',
  text: 'rounded-full px-5 py-2.5',
  danger: 'rounded-full border border-error px-5 py-2.5',
} as const

/**
 * 변형별 **글자** 클래스. `Button` 이 라벨을 감싸는 `Text` 에 준다.
 *
 * `primary` 만 16px 인 것은 웹 `<button>` 이 그 크기를 상속으로 받고 있었기 때문이다. RN 의 `Text`
 * 기본값은 14px 라, 안 적으면 그 자리만 작아진다([[ADR-198]] 결정 4).
 */
export const BUTTON_VARIANT_TEXT_CLASS = {
  primary: 'text-base font-semibold text-on-primary',
  outline: 'text-sm font-semibold text-text',
  text: 'text-sm font-medium text-text-muted',
  danger: 'text-sm font-semibold text-error-ink',
} as const

/** 버튼 변형 넷. 상자 표의 키가 곧 이 타입이다. */
export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASS
