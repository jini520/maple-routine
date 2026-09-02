/**
 * 드랍 연출 중앙 아이템의 부유. `index.css` 의 `@keyframes fx-drop-float`(step 7).
 * `2.6s ease-in-out infinite`, `translateY(-5 → 5 → -5)`.
 *
 * **`DropEffectOverlay.tsx` 가 아니라 별도 파일인 이유**는 `Button/variants.ts` 와 같다: 컴포넌트
 * 파일이 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다.
 *
 * ## 이 값은 아무것도 검사하지 않는다
 *
 * 렌더로 못 본다. 이 애니메이션이 붙는 래퍼는 `itemUrl !== null` 안쪽인데 RN 의 아이템 아이콘 URL 은
 * 아직 전부 `null` 이라(step 4 의 에셋 벽, `core-shims`) **그 노드가 한 번도 렌더되지 않는다**.
 * 값을 웹 `@keyframes` 와 대조하던 `keyframes-parity.test.ts` 도 웹 소스와 함께 지워졌다
 * . 지금 이 값을 지키는 것은 위 두 줄의 출처 표기뿐이고, 에셋이 도착해
 * 노드가 살아나면 그때 렌더로 검사할 수 있다.
 *
 * ## 왜 `as const` 인가 (취향이 아니다)
 *
 * `CSSAnimationProperties` 로 **주석을 달면 타입이 깨진다**(실측). 그 타입의 `animationDelay` 는
 * `TimeUnit | TimeUnit[]` 인데 `Animated.View` 의 `style` 이 거치는 `MaybeSharedValueRecursive` 가 그
 * 배열을 `string[] | number[]` 로 갈라 놓아, 섞인 배열이 어느 쪽에도 안 들어간다. 리터럴로 두면 없는
 * 키라 애초에 부딪히지 않는다.
 *
 * 웹이 이 부유를 **별도 래퍼**에 걸어 둔 이유는 RN 에서도 그대로다. 중앙정렬(바깥)·부유(가운데)·
 * 팝인(안쪽) 세 transform 이 한 요소에 겹치면 서로를 덮어쓴다.
 */

import { cubicBezier } from 'react-native-reanimated'

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

/**
 * 중앙 아이템 팝인. 웹의 인라인 트랜지션
 * (`opacity .233s ease, transform .333s cubic-bezier(.2,1.3,.35,1)`)의 짝이다.
 *
 * **`@keyframes` 가 아니라 트랜지션이었다**는 점이 중요하다. 가 못박은 것이
 * 이 자리다. 팝인은 프레임 fps 를 안 따르므로, fps 배율을 바꿀 땐 **이 두 시간도 같은 배율로**
 * 바꿔야 팝인 종료와 버스트 종료(711ms)가 어긋나지 않는다. 값이 여기 한곳에 모여 있는 이유다.
 *
 * RN 에는 상태가 바뀌면 알아서 보간 하는 트랜지션이 없으므로, 켜질 때 한 번 재생되는
 * 애니메이션으로 표현한다. 이 오버레이에서 아이템은 **한 번 뜨고 끝**이라(꺼졌다 켜지지 않는다)
 * 결과가 같다.
 */
export const POP_IN_ANIMATION = {
  animationName: {
    from: { opacity: 0, transform: [{ scale: 0.5 }] },
    to: { opacity: 1, transform: [{ scale: 1 }] },
  },
  // 웹의 둘 중 **긴 쪽**(transform .333s)을 쓴다. RN 의 한 애니메이션은 속성별로 시간을 못 가른다.
  // 짧은 쪽(opacity .233s)이 늘어나는 차이는 남지만, 어긋나면 안 되는 것은 **끝나는 시점**이다.
  animationDuration: '333ms',
  // **문자열 `cubic-bezier(...)` 는 안 받는다**. Reanimated 의 CSS API 는 미리 정의된 이름
  // (linear·ease·ease-in…)만 문자열로 받고, 임의 곡선은 `cubicBezier()` 헬퍼를 쓴다. 문자열로
  // 두면 **런타임에 던져 ErrorBoundary 로 떨어진다**(2026-08-13 시뮬레이터에서 실제로 그랬다).
  // 값은 웹의 `cubic-bezier(.2,1.3,.35,1)` 그대로. y2 가 1 을 넘는 오버슈트라 팝인이 살짝 튄다.
  animationTimingFunction: cubicBezier(0.2, 1.3, 0.35, 1),
  animationFillMode: 'both',
} as const
