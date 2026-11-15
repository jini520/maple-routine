/**
 * 화면 크기 구간과 콘텐츠 폭. 창 크기를 직접 읽는 유일한 판정.
 *
 * 화면마다 따로 판정하면 기준이 갈린다. 그래서 콘텐츠 폭 · 하단바 모양 · 위아래 여백이 모두 이 값을 따른다.
 * 창 크기가 필요한 곳은 `useWindowDimensions` 대신 `useScreenLayout()` 을 쓴다(`window-width-policy.test.ts`).
 */
import { useContext } from 'react'
import { Platform, useWindowDimensions } from 'react-native'
import { SafeAreaInsetsContext } from 'react-native-safe-area-context'

/** 오른쪽 레일 화면의 위아래 여백. 위쪽 안전영역이 0 이라 없으면 헤더가 화면 위 끝에 붙는다. */
export const SIDE_RAIL_EDGE_GAP_PX = 24

/**
 * `side-rail` 은 오른쪽에 레일이 있는 iOS 화면(아이폰 듀오의 외부 · 안쪽 화면), `phone` 은 그 밖 전부다.
 * 태블릿은 전용 배치를 두지 않아 `phone` 과 같은 배치를 쓴다.
 */
export type ScreenLayoutKind = 'phone' | 'side-rail'

export interface ScreenLayout {
  kind: ScreenLayoutKind
  /** 창 폭. 창 전체를 덮는 그림과 하단바만 쓴다. */
  windowWidthPx: number
  windowHeightPx: number
  /** 콘텐츠가 놓이는 폭. 창 왼쪽 끝에서 시작한다. */
  contentWidthPx: number
  /** 콘텐츠 오른쪽에 비우는 폭. `side-rail` 이 아니면 0. */
  railWidthPx: number
  /** 콘텐츠 위아래에 더 띄우는 몫. `side-rail` 이 아니면 0. */
  edgeGapPx: number
}

export function resolveScreenLayout(options: {
  windowWidthPx: number
  windowHeightPx: number
  /** `useSafeAreaInsets().right`. */
  insetRightPx: number
  /** `Platform.OS`. */
  platform: string
}): ScreenLayout {
  const { windowWidthPx, windowHeightPx, insetRightPx } = options
  // 화면 크기로 가르지 않는다. 듀오 안쪽 화면은 짧은 변이 600 을 넘어도 외부 화면과 같은 레일이 있다.
  // 안드로이드의 옆 안전영역은 화면 구멍 자리라 세로 막대가 들어가지 않는다. 그래서 iOS 에서만 가른다.
  const sideRail = options.platform === 'ios' && insetRightPx > 0

  return {
    kind: sideRail ? 'side-rail' : 'phone',
    windowWidthPx,
    windowHeightPx,
    contentWidthPx: sideRail ? windowWidthPx - insetRightPx : windowWidthPx,
    railWidthPx: sideRail ? insetRightPx : 0,
    edgeGapPx: sideRail ? SIDE_RAIL_EDGE_GAP_PX : 0,
  }
}

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 }

/**
 * 지금 창의 구간과 콘텐츠 폭을 내는 훅.
 *
 * 인셋은 `useSafeAreaInsets` 대신 컨텍스트로 읽는다. 글자 atom 이 이 훅을 거치는데, 프로바이더 밖(atom 테스트)에서
 * `useSafeAreaInsets` 는 던지기 때문이다. 프로바이더가 없으면 인셋 0 으로 본다.
 */
export function useScreenLayout(): ScreenLayout {
  const { width, height } = useWindowDimensions()
  const insets = useContext(SafeAreaInsetsContext) ?? NO_INSETS
  return resolveScreenLayout({ windowWidthPx: width, windowHeightPx: height, insetRightPx: insets.right, platform: Platform.OS })
}
