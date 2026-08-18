/**
 * 화면이 쓰는 **하단 안전영역** — 안드로이드에만 하한이 있다 ([[ADR-132]] 정정 31).
 *
 * `top-safe-area.ts` 의 하단 판이고, **같은 실기기 보고에서 나왔다**(2026-08-18).
 *
 * ## 왜 인셋을 그대로 안 쓰나
 *
 * [[ADR-132]] 결정 11 의 «안전영역 위 12» 가 **0** 이 되면서(그 12 는 바 높이로 옮겼다) 바의 자리가
 * `insets.bottom` «그대로» 가 됐고, 그때부터 그 값의 **플랫폼 차이가 화면에 직접 나온다.**
 *
 * | | `insets.bottom` 의 정체 | 실측 |
 * |---|---|---|
 * | iOS | 홈 인디케이터 | **34** |
 * | 안드로이드 | `navigationBars` 45px @ density 3.0 (제스처 내비) | **15** |
 *
 * 상단(31.3 대 59)과 **같은 비율**이다 — 같은 원인의 다른 끝이다.
 *
 * ## 왜 이 값을 **여럿이 함께** 봐야 하나
 *
 * 상단보다 이유가 강하다. 상단은 어긋나면 제목과 페이드 끝선이 갈리는 것으로 끝나지만, 하단은
 * **바가 뜨는 높이 · 콘텐츠가 남기는 몫 · 페이드 · 토스트**가 서로 물려 있다 — 한 자리만 인셋으로
 * 남으면 마지막 카드가 캡슐 뒤로 들어가거나(콘텐츠 몫) 토스트가 캡슐 위에 겹친다(토스트).
 *
 * ## `useSafeAreaInsets` 를 덮어쓰지 않는다
 *
 * 인셋을 **그대로** 봐야 하는 자리가 남는다 — 오버레이(`BottomSheet`·캐릭터 피커·계정 드롭다운)의
 * `insets.bottom` 은 «리듬» 이 아니라 **«내비바를 안 가린다»** 를 뜻해서, 하한을 깔면 시트가 실제로
 * 필요한 것보다 더 올라와 내용만 좁아진다. `top-safe-area.ts` 와 같은 경계이고, 어느 쪽을 써야
 * 하는지는 `src/__tests__/bottom-safe-area-policy.test.ts` 가 지킨다.
 *
 * 하위 페이지에서는 **한 화면이 둘 다 본다** — 스크롤포트가 비우는 몫은 내비바가 실제로 차지하는
 * 자리(인셋)이고, 콘텐츠 끝에 남기는 몫은 하한이 더한 리듬이다(`ScreenScroll/bottom-inset.ts`).
 */

import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * 안드로이드 하단 안전영역의 **하한** ([[ADR-132]] 정정 31, 사용자 판정 2026-08-18).
 *
 * **iOS 인셋과 같은 수라는 것이 이 값의 전부다.** 상단의 48 은 iOS(59) 아래에서 고른 값이지만
 * 하단은 고를 것이 없다 — 홈 인디케이터가 34 라, 하한을 34 로 두면 안드로이드가 iOS 를 따라잡고
 * iOS 는 정확히 하한에 앉아 한 픽셀도 안 바뀐다. 48 이었다면 그것은 «두 플랫폼을 맞추는 값» 이
 * 아니라 «안드로이드만 더 띄우는 값» 이다(사용자 판정에서 기각).
 *
 * `Math.max` 라 3버튼 내비(인셋 48)에는 **아무것도 안 더한다** — 더하는 상수였다면 그런 기기에서
 * 캡슐이 화면 한참 위에 뜬다.
 */
export const ANDROID_BOTTOM_SAFE_AREA_MIN_PX = 34

/**
 * 화면 하단이 비워야 하는 세로 — 인셋과 하한 중 **큰 쪽**(안드로이드만).
 *
 * 플랫폼을 인자로 받는 이유는 `top-safe-area.ts`·`bottom-inset.ts` 와 같다 — 값의 갈림을 화면을
 * 렌더하지 않고 볼 수 있어야 한다. 여기서는 그 이유가 더 강하다: 테스트는 iOS 로 도는데 iOS
 * 인셋(34)이 곧 하한이라 **렌더 트리에서는 이 정정이 한 픽셀도 안 보인다.**
 */
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

/** 위 값을 화면에서 바로 쓰는 훅 — `useTopSafeAreaPx()` 와 같은 모양이다. */
export function useBottomSafeAreaPx(): number {
  const insets = useSafeAreaInsets()

  return resolveBottomSafeAreaPx({ insetBottomPx: insets.bottom, platform: Platform.OS })
}
