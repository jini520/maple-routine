// 드랍 연출 중앙 아이템의 부유 — `index.css` 의 `@keyframes fx-drop-float`(step 7).
// `2.6s ease-in-out infinite`, `translateY(-5 → 5 → -5)`.
//
// **`DropEffectOverlay.tsx` 가 아니라 별도 파일인 이유**는 `Button/variants.ts` 와 같다: 컴포넌트
// 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다.
//
// ## 왜 export 해야 하나 — 이 값은 렌더 트리로 검사할 수 없다
//
// 이 애니메이션이 붙는 래퍼는 `itemUrl !== null` 안쪽인데 RN 의 아이템 아이콘 URL 은 아직 전부
// `null` 이라(step 4 의 에셋 벽, `core-shims`) **그 노드가 한 번도 렌더되지 않는다**. 그래서 값이
// 웹의 `@keyframes` 와 같은지는 `src/__tests__/keyframes-parity.test.ts` 가 이 상수를 직접 읽어
// 지킨다 — 에셋이 도착해 노드가 살아나면 그때 렌더로도 검사할 수 있다.
//
// ## 왜 `as const` 인가 (취향이 아니다)
//
// `CSSAnimationProperties` 로 **주석을 달면 타입이 깨진다**(실측). 그 타입의 `animationDelay` 는
// `TimeUnit | TimeUnit[]` 인데 `Animated.View` 의 `style` 이 거치는 `MaybeSharedValueRecursive` 가 그
// 배열을 `string[] | number[]` 로 갈라 놓아, 섞인 배열이 어느 쪽에도 안 들어간다. 리터럴로 두면 없는
// 키라 애초에 부딪히지 않는다.
//
// 웹이 이 부유를 **별도 래퍼**에 걸어 둔 이유는 RN 에서도 그대로다 — 중앙정렬(바깥)·부유(가운데)·
// 팝인(안쪽) 세 transform 이 한 요소에 겹치면 서로를 덮어쓴다.

export const FLOAT_ANIMATION = {
  animationName: {
    from: { transform: [{ translateY: -5 }] },
    '50%': { transform: [{ translateY: 5 }] },
    to: { transform: [{ translateY: -5 }] },
  },
  animationDuration: '2600ms',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
} as const
