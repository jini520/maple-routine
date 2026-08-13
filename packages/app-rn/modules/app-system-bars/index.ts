import { requireOptionalNativeModule } from 'expo'

/**
 * 하단 시스템 내비게이션 바 글리프의 명암([[ADR-128]] 3단계 — `SystemBarsPort` 의 절반).
 *
 * ## 왜 네이티브 코드가 필요한가
 *
 * RN·Expo 어디에도 이것을 여는 API 가 없다. `expo-status-bar` 는 **상단**만 다루고, 하단을 다루는
 * `expo-navigation-bar` 는 이 앱에 없는 의존성이다. 반면 필요한 일은 안드로이드 한 줄
 * (`WindowInsetsControllerCompat.isAppearanceLightNavigationBars`)이고 웹뷰 쪽도 자체 플러그인으로
 * 같은 한 줄을 부르고 있었다 — 그래서 의존성을 하나 더 들이는 대신 `app-background` 와 같은 방식으로
 * 로컬 모듈을 하나 둔다.
 *
 * ## iOS 에는 이 개념이 없다
 *
 * 하단 시스템 내비게이션 바 자체가 없다. 그래서 `platforms` 가 `android` 하나이고 여기서
 * `requireNativeModule` 이 아니라 **`requireOptionalNativeModule`** 을 쓴다 — iOS 에서는 `null` 이
 * 오고 어댑터가 조용히 아무것도 하지 않는다(`rn-system-bars.ts`). 웹뷰 구현도 같은 자리에
 * `if (platform !== 'android') return` 을 두고 있었다. `not-implemented.ts` 의 기준으로 말하면
 * *"이 플랫폼에 그 개념이 없다"* 쪽이라 **정당한 no-op** 이다.
 */
export interface AppSystemBarsNativeModule {
  /** `dark`: 어두운 표면(다크 테마)이면 `true` → 글리프를 밝게 그린다. */
  setNavigationBarStyle(dark: boolean): Promise<void>
}

export default requireOptionalNativeModule<AppSystemBarsNativeModule>('AppSystemBars')
