/**
 * 화면이 쓰는 **상단 안전영역** — 안드로이드에만 하한이 있다 ([[ADR-139]] 정정 1).
 *
 * ## 왜 인셋을 그대로 안 쓰나
 *
 * [[ADR-139]] 결정 1 이 헤더 패딩을 `insets.top` «그대로» 로 만들면서, 그 값의 **플랫폼 차이가
 * 화면에 직접 나왔다.**
 *
 * | | `insets.top` 의 정체 | 실측 |
 * |---|---|---|
 * | iOS | 노치·다이내믹 아일랜드 | **59** |
 * | 안드로이드 | 상태바 94px @ density 3.0 (1080×2640) | **31.3** |
 *
 * 절반이 안 된다. 웹에서는 양쪽에 같은 16 이 얹혀 그 차이가 눌려 있었고, 상수를 걷어내자 원래
 * 비율이 드러났다 — 실기기 보고가 *"iOS 는 괜찮은데 안드로이드에서 여백이 부족"* 이었다
 * (2026-08-18).
 *
 * ## 왜 헤더가 아니라 **여기**에 하한을 다나
 *
 * [[ADR-134]] 상단 페이드 구간이 이 값과 **같은 선**이기 때문이다([[ADR-139]] 결정 1 의 대가).
 * 헤더 패딩에만 더하면 제목은 내려가는데 페이드는 31.3 에 남아 그 선이 갈라진다 — 대가를 치르고
 * 얻은 성질을 버리는 셈이다. 값을 밑에 깔면 제목과 페이드가 계속 같은 것을 본다.
 *
 * ## 왜 `lib/` 인가
 *
 * 이 값을 보는 자리가 여럿이고(헤더 넷 · 화면 셸의 페이드와 마진 · 빈 상태 셋 · 처리방침) 어느 한
 * 컴포넌트의 것이 아니다 — `bottom-bar-metrics.ts` 가 여기 있는 것과 **같은 근거**다.
 *
 * ## `useSafeAreaInsets` 를 덮어쓰지 않는다
 *
 * 인셋을 **그대로** 봐야 하는 자리가 남는다 — 오버레이(`Modal`·캐릭터 피커·계정 드롭다운)의
 * `insets.top` 은 «리듬» 이 아니라 **«상태바를 안 가린다»** 를 뜻해서, 하한을 깔면 실제로 필요한
 * 것보다 더 내려가 카드만 좁아진다. 그래서 래퍼가 아니라 **다른 이름**이고, 두 쓰임이 한눈에
 * 갈린다. 어느 쪽을 써야 하는지는 `src/__tests__/top-safe-area-policy.test.ts` 가 지킨다.
 */

import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * 안드로이드 상단 안전영역의 **하한** ([[ADR-139]] 정정 1, 사용자 판정 2026-08-18).
 *
 * 실기기 31.3 → 48 이라 결정 1 이 걷어낸 1rem 과 비슷한 크기가 되지만 **성질이 다르다** — 인셋이
 * 이미 48 이상인 기기(큰 컷아웃)에는 아무것도 안 더한다. 더하는 상수였다면 그런 기기에서 제목이
 * 화면 한참 아래에서 시작하고, 그것은 결정 1 이 없앤 상태보다 나쁘다.
 *
 * **기기 하나를 보고 고른 값이다.** 인셋이 40~48 인 기기에서는 하한이 더하는 양이 0 에 가까워지고,
 * 그 구간에서 다시 «부족» 보고가 오면 값이 아니라 **정책**을 다시 본다([[ADR-139]] 정정 1 「대가」).
 */
export const ANDROID_TOP_SAFE_AREA_MIN_PX = 48

/**
 * 화면 상단이 비워야 하는 세로 — 인셋과 하한 중 **큰 쪽**(안드로이드만).
 *
 * 플랫폼을 인자로 받는 것은 `bottom-inset.ts` 와 같은 이유다 — 값의 갈림을 화면을 렌더하지 않고
 * 볼 수 있어야 «상수를 눈으로 고르고 테스트는 렌더 트리를 뒤지는» 상태가 안 된다. 여기서는 그
 * 이유가 더 강하다: 테스트는 iOS 로 도는데 이 정정은 **안드로이드에서만 값을 바꾼다.**
 */
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

/**
 * 위 값을 화면에서 바로 쓰는 훅 — 쓰는 자리가 여덟이라 세 줄을 여덟 벌 두지 않는다.
 *
 * [[ADR-139]] 결정 3 이 *"여백을 되살릴 땐 여덟 자리가 아니라 한 자리부터"* 라 한 그 여덟이
 * 여기서도 같은 여덟이다. 순수 함수를 따로 내보내는 이유는 위 주석대로 **테스트가 플랫폼을 골라야**
 * 하기 때문이고, 훅은 그 함수에 `Platform.OS` 를 먹이는 것 외에 하는 일이 없다.
 */
export function useTopSafeAreaPx(): number {
  const insets = useSafeAreaInsets()

  return resolveTopSafeAreaPx({ insetTopPx: insets.top, platform: Platform.OS })
}
