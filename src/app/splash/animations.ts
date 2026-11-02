/**
 * 2겹 스플래시의 움직임 값. 잎과 이름의 페이드 인, 글자 하나씩 뛰기, 눈 내림이다. Reanimated 의 CSS 애니메이션
 * 스타일이고 `Animated.View` 에 얹는다.
 *
 * 컴포넌트 파일이 아니라 곁 파일인 것은 컴포넌트 아닌 값을 함께 export 하면 fast refresh 가 깨지기 때문이다.
 * `as const` 를 타입 주석으로 바꾸지 말 것. `CSSAnimationProperties` 로 주석을 달면 `animationDelay` 가
 * `Animated.View` 의 `style` 과 안 맞물려 타입이 깨진다.
 */
import { cubicBezier } from 'react-native-reanimated'

import type { SplashSnowFlake } from './layout'

/** 잎과 이름이 함께 또렷해지는 시간 */
export const LOCKUP_FADE_MS = 300

/** 글자 하나가 뛰는 시간과 다음 글자가 뛰기 시작하기까지의 간격 */
export const HOP_MS = 600
export const HOP_STAGGER_MS = 180

/** 뛰는 높이. 글자 크기에 대한 비율 */
const HOP_HEIGHT_RATIO = 0.16

/** 눈 조각이 좌우로 흔들리는 폭 */
const SWAY_PX = 10

/** 등장이 끝나는 시각. 다섯 글자의 마지막 뜀이 끝나는 때다. */
export function entranceEndMs(glyphCount: number): number {
  return LOCKUP_FADE_MS + HOP_STAGGER_MS * (glyphCount - 1) + HOP_MS
}

export const LOCKUP_FADE_ANIMATION = {
  animationName: { from: { opacity: 0 }, to: { opacity: 1 } },
  animationDuration: `${LOCKUP_FADE_MS}ms`,
  animationTimingFunction: 'ease-out',
  animationFillMode: 'both',
} as const

/**
 * 글자 하나가 한 번 뛰는 움직임. 페이드가 끝난 뒤 `index` 번째 글자 차례에 시작한다.
 *
 * @param index 이름에서 몇 번째 글자인가. 띄어쓰기도 한 자리다
 */
export function hopAnimation(namePx: number, index: number) {
  return {
    animationName: {
      '0%': { transform: [{ translateY: 0 }] },
      '45%': { transform: [{ translateY: -namePx * HOP_HEIGHT_RATIO }] },
      '100%': { transform: [{ translateY: 0 }] },
    },
    animationDuration: `${HOP_MS}ms`,
    animationDelay: `${LOCKUP_FADE_MS + HOP_STAGGER_MS * index}ms`,
    animationTimingFunction: cubicBezier(0.3, 0, 0.2, 1),
    animationFillMode: 'both',
  } as const
}

/**
 * 화면 위 밖에서 아래 밖까지 일정한 속도로 내리고 다시 위에서 시작한다.
 *
 * 지연이 음수인 것은 `startRatio` 만큼 진행된 자리에서 시작하기 위해서다. CSS 와 같고, Reanimated 네이티브도
 * 시작 시각을 `생성 시각 + 지연` 으로 잡아 음수를 그대로 받는다.
 */
export function fallAnimation(flake: SplashSnowFlake) {
  return {
    animationName: {
      from: { transform: [{ translateY: flake.fromY }] },
      to: { transform: [{ translateY: flake.toY }] },
    },
    animationDuration: `${flake.fallMs}ms`,
    animationDelay: `${-Math.round(flake.fallMs * flake.startRatio)}ms`,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    animationFillMode: 'both',
  } as const
}

/** 좌우로 오가는 흔들림 */
export function swayAnimation(flake: SplashSnowFlake) {
  return {
    animationName: {
      from: { transform: [{ translateX: -SWAY_PX }] },
      to: { transform: [{ translateX: SWAY_PX }] },
    },
    animationDuration: `${flake.swayMs}ms`,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
  } as const
}

/** 눈송이의 회전. 눈뭉치(`spinMs` 0)에는 걸지 않는다. */
export function spinAnimation(flake: SplashSnowFlake) {
  return {
    animationName: {
      from: { transform: [{ rotate: '0deg' }] },
      to: { transform: [{ rotate: '360deg' }] },
    },
    animationDuration: `${flake.spinMs}ms`,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  } as const
}
