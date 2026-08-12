// 토스트 남은 시간 바 애니메이션 — `index.css` 의 `@keyframes toast-shrink`(step 7).
//
// **`Toast.tsx` 가 아니라 별도 파일인 이유**는 `Button/variants.ts` 와 같다: 컴포넌트 파일이 컴포넌트
// 아닌 값을 함께 export 하면 fast refresh 가 깨진다. export 가 필요한 것은
// `keyframes-parity.test.ts` 가 이 고정 부분을 웹 선언과 직접 견주기 때문이다.
//
// **지속시간만 빠져 있다.** 토스트마다 다르고(성공 2초 / 정보 2.5초) 그래서 웹도 클래스로 못 적고
// 인라인 `style` 로 넣던 자리다(`animation: toast-shrink ${toast.duration}ms linear forwards`).
// 런타임 값이라 대조할 상수가 없으므로 나눠 둔다.
//
// `as const` 인 이유는 `float-animation.ts` 와 같다(그 파일 주석).

export const TIMER_ANIMATION_BASE = {
  animationName: {
    from: { transform: [{ scaleX: 1 }] },
    to: { transform: [{ scaleX: 0 }] },
  },
  animationTimingFunction: 'linear',
  animationFillMode: 'forwards',
} as const

/** 웹이 인라인으로 넣던 지속시간을 얹는다. */
export function timerAnimation(durationMs: number) {
  return { ...TIMER_ANIMATION_BASE, animationDuration: `${durationMs}ms` } as const
}
