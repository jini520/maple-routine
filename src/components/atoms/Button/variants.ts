// 버튼 외형 토큰 — `design-system.md` 「기본 컴포넌트」절의 규정을 코드로 옮긴 것(ADR-094 결정 3).
//
// **`Button.tsx` 가 아니라 별도 파일인 이유**: 외부 URL로 나가는 이동은 `<button>` 이 아니라
// `<a>` 여야 하므로(링크 시맨틱·`target`/`rel`) 겉모습만 입힐 길이 필요한데, 컴포넌트 파일이
// 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다(`react-refresh/only-export-components`).
// `Button` 자신도 여기서 가져다 쓰므로 두 벌이 되지 않는다.
//
// 라운딩이 pill 로 고정인 것은 디자인 원칙 2(컴포넌트 성격별 라운딩 차등 — 카드 14px ·
// 버튼 pill · 인풋 10px)를 지키기 위해서다. 여기에 라운딩 옵션을 열면 그 원칙이 무너진다.
export const BUTTON_VARIANT_CLASS = {
  primary: 'rounded-full bg-primary text-on-primary font-semibold hover:bg-primary-hover px-5 py-2.5',
  // 주 CTA 옆/아래에 서는 부 동작. danger 와 같은 테두리 pill 이되 색이 중립이라 파괴적 동작과
  // 헷갈리지 않고, hover 는 새 색을 만들지 않고 선택 카드와 같은 primary-tint 를 쓴다.
  outline:
    'rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-text hover:bg-primary-tint',
  text: 'rounded-full px-5 py-2.5 text-sm font-medium text-text-muted hover:text-text',
  danger:
    'rounded-full border border-error px-5 py-2.5 text-sm font-semibold text-error-ink hover:bg-error-tint',
} as const

export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASS
