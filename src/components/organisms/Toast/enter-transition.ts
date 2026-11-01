/**
 * `transition-opacity duration-200 ease-out`. 흐르는 것은 투명도 하나뿐이다.
 *
 * `Toast.tsx` 가 아니라 별도 파일인 것은 컴포넌트 파일이 컴포넌트 아닌 값을 함께 export 하면
 * fast refresh 가 깨지기 때문이다.
 *
 * `as const` 인 이유는 `DropEffectOverlay` 의 `FLOAT_ANIMATION` 과 같다. Reanimated 의 CSS
 * 타입으로 주석을 달면 `Animated.View` 의 `style` 과 안 맞물린다.
 */
export const ENTER_TRANSITION = {
  transitionProperty: 'opacity',
  transitionDuration: '200ms',
  transitionTimingFunction: 'ease-out',
} as const
