// 진행률 바 폭 트랜지션 — 웹의 `transition-[width]` 한 클래스가 펼쳐진 값(step 7).
//
// **`ProgressBar.tsx` 가 아니라 별도 파일인 이유**는 `Button/variants.ts` 와 같다: 컴포넌트 파일이
// 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨진다. 여기서는 `keyframes-parity.test.ts` 가
// 이 값을 웹 원본과 대조해야 해서 export 가 필요했다.
//
// ## 왜 NativeWind 의 `transition-*` 클래스를 안 쓰나
//
// Tailwind v4 의 `transition-*` 은 지속시간·곡선을 유틸리티로 따로 주지 않으면 **프리셋 기본값**을
// 쓴다(`--default-transition-duration: 150ms` · `--default-transition-timing-function:
// cubic-bezier(0.4, 0, 0.2, 1)`). 웹 호출부에 `duration-*`·`ease-*` 가 없으므로 그 두 기본값이 곧 이
// 프리미티브의 실제 값인데, **RN 에는 그 프리셋이 없어** 클래스를 그대로 쓰면 값이 조용히 달라진다.
// 그래서 웹이 실제로 쓰던 두 값을 여기 적고, 그것이 여전히 웹의 값과 같은지는
// `src/__tests__/keyframes-parity.test.ts` 가 `tailwindcss/theme.css` 를 **직접 읽어** 확인한다.
//
// `as const` 인 이유는 `float-animation.ts` 와 같다(그 파일 주석 — Reanimated 의 CSS 타입으로 주석을
// 달면 `Animated.View` 의 `style` 과 안 맞물린다).
import { cubicBezier } from 'react-native-reanimated'

export const WIDTH_TRANSITION = {
  transitionProperty: 'width',
  transitionDuration: '150ms',
  transitionTimingFunction: cubicBezier(0.4, 0, 0.2, 1),
} as const
