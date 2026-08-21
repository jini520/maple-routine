// 버튼 외형 토큰 — `design-system.md` 「기본 컴포넌트」절의 규정을 코드로 옮긴 것([[ADR-094]] 결정 3).
//
// **`Button.tsx` 가 아니라 별도 파일인 이유**(웹과 같다): 겉모습만 입혀야 하는 자리가 있고, 컴포넌트
// 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다. `Button` 자신도 여기서 가져다
// 쓰므로 두 벌이 되지 않는다.
//
// 라운딩이 pill 로 고정인 것은 디자인 원칙 2(컴포넌트 성격별 라운딩 차등 — 카드 14px ·
// 버튼 pill · 인풋 10px)를 지키기 위해서다. 여기에 라운딩 옵션을 열면 그 원칙이 무너진다.
//
// ── RN 으로 옮기며 갈라진 것: 한 문자열 → 상자 / 글자 두 벌 ────────────────────────────
//
// 웹은 `<button>` 하나에 배경·여백과 글자색·굵기를 함께 걸었다. **RN 은 글자 스타일이 상자에서
// 자식 `Text` 로 상속되지 않는다**(실측: `Pressable` 의 `className` 에 넣은 `text-*`·`font-*` 는
// 그 View 의 style 에 들어가 앉아 있기만 하고 안쪽 `Text` 는 못 받는다). 그래서 같은 규정을 두 벌로
// 나눈다 — 값은 웹 문자열을 그대로 쪼갠 것이고 새로 만든 값이 없다.
//
// 갈라진 자리 둘만 적어 둔다.
//  * `hover:` 는 **뺐다**. 터치 기기에 hover 가 없고 NativeWind 도 네이티브에서는 그 클래스를 조용히
//    버린다(실측 — 렌더 결과에 흔적이 없다). 남겨 두면 "있는데 안 도는 코드"가 된다. 눌림 피드백은
//    `active:` 라는 다른 축이고, 웹에 없던 것을 여기서 새로 만들지 않는다.
//  * `primary` 의 글자 크기 `text-base` 는 **웹에서 상속으로 받던 값**이다. 웹 `<button>` 은 Tailwind
//    preflight 의 `font: inherit` 로 본문 크기(1rem = 16px)를 물려받았고, 그래서 primary 만 크기
//    클래스가 없었다. RN 의 `Text` 기본값은 14px 라 그대로 두면 웹보다 작아진다 — 문자열이 아니라
//    **그려지는 크기**를 맞춘다. 호출부가 `text-sm` 을 주던 자리는 `textClassName` 으로 옮긴다.
export const BUTTON_VARIANT_CLASS = {
  primary: 'rounded-full bg-primary px-5 py-2.5',
  // 주 CTA 옆/아래에 서는 부 동작. danger 와 같은 테두리 pill 이되 색이 중립이라 파괴적 동작과
  // 헷갈리지 않는다.
  outline: 'rounded-full border border-border px-5 py-2.5',
  text: 'rounded-full px-5 py-2.5',
  danger: 'rounded-full border border-error px-5 py-2.5',
} as const

export const BUTTON_VARIANT_TEXT_CLASS = {
  primary: 'text-base font-semibold text-on-primary',
  outline: 'text-sm font-semibold text-text',
  text: 'text-sm font-medium text-text-muted',
  danger: 'text-sm font-semibold text-error-ink',
} as const

export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASS
