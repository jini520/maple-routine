/**
 * 화면이 쓰는 **안전영역.** 위아래 둘 다 안드로이드에만 하한이 있다
 * ([[ADR-139]] 정정 1 · [[ADR-132]] 정정 31).
 *
 * ## 왜 인셋을 그대로 안 쓰나
 *
 * 두 결정이 헤더 패딩과 바 위치를 인셋 **그대로** 로 만들면서, 그 값의 플랫폼 차이가 화면에 직접
 * 나왔다. 같은 실기기 보고에서 위아래가 함께 나왔다(2026-08-18).
 *
 * | | iOS 의 정체 | 실측 | 안드로이드의 정체 | 실측 |
 * |---|---|---|---|---|
 * | 위 | 노치·다이내믹 아일랜드 | **59** | 상태바 94px @ density 3.0 | **31.3** |
 * | 아래 | 홈 인디케이터 | **34** | `navigationBars` 45px (제스처 내비) | **15** |
 *
 * **비율이 같다.** 같은 원인의 두 끝이다. 웹에서는 양쪽에 같은 16 이 얹혀 눌려 있었고, 상수를
 * 걷어내자 원래 비율이 드러났다.
 *
 * ## 왜 컴포넌트가 아니라 여기에 하한을 다나
 *
 * 위는 [[ADR-134]] 상단 페이드 구간이 이 값과 **같은 선**이라, 헤더 패딩에만 더하면 제목은
 * 내려가는데 페이드는 31.3 에 남아 선이 갈라진다.
 *
 * 아래는 이유가 더 강하다. **바가 뜨는 높이 · 콘텐츠가 남기는 몫 · 페이드 · 토스트**가 서로 물려
 * 있어서, 한 자리만 인셋으로 남으면 마지막 카드가 캡슐 뒤로 들어가거나 토스트가 캡슐 위에 겹친다.
 *
 * ## `useSafeAreaInsets` 를 덮어쓰지 않는다
 *
 * 인셋을 **그대로** 봐야 하는 자리가 남는다. 오버레이(`Modal`·`BottomSheet`·캐릭터 피커·계정
 * 드롭다운)의 인셋은 리듬이 아니라 **「상태바·내비바를 안 가린다」** 를 뜻해서, 하한을 깔면 실제로
 * 필요한 것보다 더 움직여 내용만 좁아진다. 그래서 래퍼가 아니라 **다른 이름**이고, 어느 쪽을 써야
 * 하는지는 `src/__tests__/{top,bottom}-safe-area-policy.test.ts` 가 지킨다.
 *
 * 하위 페이지에서는 **한 화면이 둘 다 본다.** 스크롤포트가 비우는 몫은 내비바가 실제로 차지하는
 * 자리(인셋)이고, 콘텐츠 끝에 남기는 몫은 하한이 더한 리듬이다(`ScreenScroll/bottom-inset.ts`).
 *
 * ## 플랫폼을 인자로 받는 이유
 *
 * 값의 갈림을 화면을 렌더하지 않고 볼 수 있어야 「상수를 눈으로 고르고 테스트는 렌더 트리를 뒤지는」
 * 상태가 안 된다(`bottom-inset.ts` 와 같은 판단). 여기서는 이유가 더 강하다. 테스트는 iOS 로
 * 도는데 위쪽 정정은 **안드로이드에서만** 값을 바꾸고, 아래쪽은 iOS 인셋(34)이 곧 하한이라
 * **렌더 트리에서는 한 픽셀도 안 보인다.**
 */
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * 안드로이드 **상단** 하한 (사용자 판정 2026-08-18).
 *
 * 실기기 31.3 → 48 이라 [[ADR-139]] 결정 1 이 걷어낸 1rem 과 비슷한 크기지만 **성질이 다르다.**
 * 인셋이 이미 48 이상인 기기(큰 컷아웃)에는 아무것도 안 더한다. 더하는 상수였다면 그런 기기에서
 * 제목이 화면 한참 아래에서 시작하고, 그것은 결정 1 이 없앤 상태보다 나쁘다.
 *
 * **기기 하나를 보고 고른 값이다.** 인셋이 40~48 인 기기에서는 더하는 양이 0 에 가까워지고, 그
 * 구간에서 다시 「부족」 보고가 오면 값이 아니라 **정책**을 다시 본다.
 */
export const ANDROID_TOP_SAFE_AREA_MIN_PX = 48

/**
 * 안드로이드 **하단** 하한 (사용자 판정 2026-08-18).
 *
 * **iOS 인셋과 같은 수라는 것이 이 값의 전부다.** 위의 48 은 iOS(59) 아래에서 고른 값이지만 여기는
 * 고를 것이 없다. 홈 인디케이터가 34 라, 하한을 34 로 두면 안드로이드가 iOS 를 따라잡고 iOS 는
 * 정확히 하한에 앉아 한 픽셀도 안 바뀐다. 48 이었다면 그것은 「두 플랫폼을 맞추는 값」이 아니라
 * 「안드로이드만 더 띄우는 값」이다(사용자 판정에서 기각).
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
 * [[ADR-139]] 결정 3 이 *"여백을 되살릴 땐 여덟 자리가 아니라 한 자리부터"* 라 한 그 여덟이다.
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
