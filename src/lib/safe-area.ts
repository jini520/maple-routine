/**
 * 화면이 쓰는 안전영역. 위아래 둘 다 안드로이드에만 하한을 다는 계산.
 *
 * 인셋을 그대로 쓰면 플랫폼 차이가 화면에 직접 나온다(위 iOS 59 대 안드로이드 31.3, 아래 34 대 15).
 * 위는 상단 페이드 구간이 이 값과 같은 선이라 헤더 패딩에만 더하면 선이 갈라지고, 아래는 바 높이 ·
 * 콘텐츠 몫 · 페이드 · 토스트가 서로 물려 있어 한 자리만 인셋으로 남으면 카드가 캡슐 뒤로 들어간다.
 *
 * **`useSafeAreaInsets` 를 덮어쓰지 않는다.** 오버레이의 인셋은 리듬이 아니라 `상태바·내비바를 안
 * 가린다` 를 뜻해서 하한을 깔면 내용만 좁아진다. 어느 쪽을 쓸지는
 * `src/__tests__/{top,bottom}-safe-area-policy.test.ts` 가 지킨다.
 *
 * 플랫폼을 인자로 받는 것은 값의 갈림을 렌더 없이 보기 위해서다. 위쪽 하한은 안드로이드에서만 값을
 * 바꾸고 아래쪽은 iOS 인셋이 곧 하한이라, 렌더 트리에서는 한 픽셀도 안 보인다.
 */
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * 안드로이드 **상단** 하한 (사용자 판정 2026-08-18).
 *
 * 실기기 31.3 → 48 이라 이 걷어낸 1rem 과 비슷한 크기지만 **성질이 다르다.**
 * 인셋이 이미 48 이상인 기기(큰 컷아웃)에는 아무것도 안 더한다. 더하는 상수였다면 그런 기기에서
 * 제목이 화면 한참 아래에서 시작하고, 그것은 결정 1 이 없앤 상태보다 나쁘다.
 *
 * **기기 하나를 보고 고른 값이다.** 인셋이 40~48 인 기기에서는 더하는 양이 0 에 가까워지고, 그
 * 구간에서 다시 부족 보고가 오면 값이 아니라 **정책**을 다시 본다.
 */
export const ANDROID_TOP_SAFE_AREA_MIN_PX = 48

/**
 * 안드로이드 **하단** 하한 (사용자 판정 2026-08-18).
 *
 * **iOS 인셋과 같은 수라는 것이 이 값의 전부다.** 위의 48 은 iOS(59) 아래에서 고른 값이지만 여기는
 * 고를 것이 없다. 홈 인디케이터가 34 라, 하한을 34 로 두면 안드로이드가 iOS 를 따라잡고 iOS 는
 * 정확히 하한에 앉아 한 픽셀도 안 바뀐다. 48 이었다면 그것은 두 플랫폼을 맞추는 값이 아니라
 * 안드로이드만 더 띄우는 값이다(사용자 판정에서 기각).
 *
 * `Math.max` 라 3버튼 내비(인셋 48)에는 **아무것도 안 더한다.**
 */
export const ANDROID_BOTTOM_SAFE_AREA_MIN_PX = 34

/** 화면 상단이 비워야 하는 세로. 인셋과 하한 중 **큰 쪽**이다(안드로이드만). */
export function resolveTopSafeAreaPx(options: {
  /** `useSafeAreaInsets().top`. */
  insetTopPx: number
  /** `Platform.OS`. */
  platform: string
}): number {
  return options.platform === 'android'
    ? Math.max(options.insetTopPx, ANDROID_TOP_SAFE_AREA_MIN_PX)
    : options.insetTopPx
}

/** 화면 하단이 비워야 하는 세로. 인셋과 하한 중 **큰 쪽**이다(안드로이드만). */
export function resolveBottomSafeAreaPx(options: {
  /** `useSafeAreaInsets().bottom`. */
  insetBottomPx: number
  /** `Platform.OS`. */
  platform: string
}): number {
  return options.platform === 'android'
    ? Math.max(options.insetBottomPx, ANDROID_BOTTOM_SAFE_AREA_MIN_PX)
    : options.insetBottomPx
}

/**
 * 위 값을 화면에서 바로 쓰는 훅. 쓰는 자리가 여덟이라 세 줄을 여덟 벌 두지 않는다.
 *
 *  이 *"여백을 되살릴 땐 여덟 자리가 아니라 한 자리부터"* 라 한 그 여덟이다.
 */
export function useTopSafeAreaPx(): number {
  const insets = useSafeAreaInsets()

  return resolveTopSafeAreaPx({ insetTopPx: insets.top, platform: Platform.OS })
}

/** `useTopSafeAreaPx()` 의 하단 판. */
export function useBottomSafeAreaPx(): number {
  const insets = useSafeAreaInsets()

  return resolveBottomSafeAreaPx({ insetBottomPx: insets.bottom, platform: Platform.OS })
}
