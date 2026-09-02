/**
 * 드롭 연출 중앙 아이템의 부유 애니메이션 값. `2.6s ease-in-out infinite`,
 * `translateY(-5 → 5 → -5)`.
 *
 * 컴포넌트 파일이 아니라 곁 파일인 것은 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가
 * 깨지기 때문이다.
 *
 * **`as const` 를 타입 주석으로 바꾸지 말 것.** `CSSAnimationProperties` 로 주석을 달면 그 타입의
 * `animationDelay` 가 `Animated.View` 의 `style` 과 안 맞물려 타입이 깨진다(실측).
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
 * (`opacity.233s ease, transform.333s cubic-bezier(.2,1.3,.35,1)`)의 짝이다.
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
  // 웹의 둘 중 **긴 쪽**(transform.333s)을 쓴다. RN 의 한 애니메이션은 속성별로 시간을 못 가른다.
  // 짧은 쪽(opacity.233s)이 늘어나는 차이는 남지만, 어긋나면 안 되는 것은 **끝나는 시점**이다.
  animationDuration: '333ms',
  // **문자열 `cubic-bezier(...)` 는 안 받는다**. Reanimated 의 CSS API 는 미리 정의된 이름
  // (linear·ease·ease-in…)만 문자열로 받고, 임의 곡선은 `cubicBezier()` 헬퍼를 쓴다. 문자열로
  // 두면 **런타임에 던져 ErrorBoundary 로 떨어진다**(2026-08-13 시뮬레이터에서 실제로 그랬다).
  // 값은 웹의 `cubic-bezier(.2,1.3,.35,1)` 그대로. y2 가 1 을 넘는 오버슈트라 팝인이 살짝 튄다.
  animationTimingFunction: cubicBezier(0.2, 1.3, 0.35, 1),
  animationFillMode: 'both',
} as const
