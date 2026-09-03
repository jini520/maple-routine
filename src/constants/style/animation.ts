/**
 * className 으로 낼 수 없어 스타일 값으로 남는 애니메이션.
 *
 * `animate-spin`(1초 선형 무한 회전)을 새로고침 아이콘에 건다. NativeWind 에는 그 클래스가 없고,
 * 없는 클래스는 에러가 아니라 안 도는 아이콘이라 값으로 준다. Reanimated 의 CSS 애니메이션
 * 스타일이고 `AnimatedView` 에 얹는다.
 *
 * 호출부가 둘이라(컨텐츠 스케줄러 · 보스 스케줄러) 화면 밖으로 올렸다. 컴포넌트 파일이 값을
 * export 하면 fast refresh 가 깨진다.
 *
 * 모션 줄이기(`useReducedMotion`)는 호출부가 판단한다. 이 값은 돌린다 만 말하고 돌릴지 말지는
 * 그 자리의 사정이다.
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
