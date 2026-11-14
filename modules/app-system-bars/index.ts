import { NativeModule, requireOptionalNativeModule } from 'expo'

/**
 * 하단 시스템 내비게이션 바 글리프의 명암([[ADR-128]] 3단계 — `SystemBarsPort` 의 절반)과 그 바가 3버튼인지.
 *
 * 3버튼인지도 RN 에서는 알 수 없다. `react-native-safe-area-context` 는 아래 인셋 하나만 주고, 그 값으로는
 * 3버튼(48 안팎)과 제스처(15~24)를 어림잡을 수밖에 없다.
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
export declare class AppSystemBarsNativeModule extends NativeModule<AppSystemBarsEvents> {
  /** `dark`: 어두운 표면(다크 테마)이면 `true` → 글리프를 밝게 그린다. */
  setNavigationBarStyle(dark: boolean): Promise<void>
  /**
   * 아래에 3버튼 내비게이션 바가 있는가. 탭할 수 있는 시스템 바 인셋(`tappableElement`)의 아래 값이 0 보다 큰지다.
   * 제스처 내비게이션에서는 0 이다. 동기 함수라 첫 렌더부터 맞는 값을 쓴다.
   */
  isButtonNavigation(): boolean
}

type AppSystemBarsEvents = {
  /** 3버튼 내비게이션 바가 생기거나 사라졌다. 사용자가 방식을 바꾸거나 버튼 줄을 숨기면 온다. */
  onButtonNavigationChange: (event: { buttonNavigation: boolean }) => void
}

export default requireOptionalNativeModule<AppSystemBarsNativeModule>('AppSystemBars')
