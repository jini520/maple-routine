/**
 * className 으로 낼 수 없어 **스타일 값으로 남는** 애니메이션.
 *
 * ## `animate-spin`
 *
 * 웹은 Tailwind 기본 유틸 `animate-spin`(1초 선형 무한 회전)을 새로고침 아이콘에 건다. NativeWind
 * 에는 그 클래스가 없고, **없는 클래스는 에러가 아니라 안 도는 아이콘**이라 값으로 준다
 * (Reanimated 의 CSS 애니메이션 스타일. `AnimatedView` 에 얹는다).
 *
 * **step 4 가 화면 안 비-export 상수로 두고 *"보스 스케줄러가 붙는 step 5 에서 둘이 된다"* 고 적어
 * 둔 자리다.** 그 둘이 됐다(컨텐츠 스케줄러 · 보스 스케줄러). 의 "호출부 2곳
 * 이상"을 넘겼고, 컴포넌트 파일이 값을 export 하면 fast refresh 가 깨지므로(`Button/variants.ts`·
 * `row-class.ts` 와 같은 판단) 여기로 온다.
 *
 * 모션 줄이기(`useReducedMotion`)는 **호출부가 판단한다**. 이 값은 "돌린다"만 말하고, 돌릴지
 * 말지는 그 자리의 사정이다(웹의 `motion-reduce:animate-none` 이 클래스였던 자리).
 */
export const SPIN_ANIMATION = {
  animationName: {
    from: { transform: [{ rotate: '0deg' }] },
    to: { transform: [{ rotate: '360deg' }] },
  },
  animationDuration: '1000ms',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
} as const
