import * as SplashScreen from 'expo-splash-screen'

import type { SplashScreenPort } from '@core/native/ports'

/**
 * `SplashScreenPort` 의 RN 구현([[ADR-128]] 결정 4 — 밖으로 나가는 시그니처는 Capacitor 구현과 한
 * 글자도 다르지 않다). 정책은 [[ADR-025]]·[[ADR-027]]·[[ADR-117]].
 *
 * **`expo-splash-screen` 을 고른 근거**는 버전이 SDK 에 묶인다는 것이다(`~57.0.6` — `expo` 의
 * `bundledNativeModules.json` 이 SDK 57 짝으로 지정한 값이고, 이미 있는 `expo-status-bar` 와 같은
 * 라인이다). 후보였던 `react-native-bootsplash`(같은 파일이 `^6.3.10` 을 지정) 는 SDK 와 독립적으로
 * 버전이 움직이고 에셋 생성 CLI 를 따로 돌려야 하는데, step 5 에서 광고 SDK 가 정확히 그 독립
 * 버저닝 때문에 Kotlin 메타데이터 충돌로 빌드를 깨뜨렸다. 두 라이브러리 모두 **다시 띄우는 API 가
 * 없어서**(아래 `show()`) 그 축은 선택에 영향을 주지 않았다.
 *
 * ---
 *
 * **이 어댑터는 네이티브 스플래시 한 장만 다룬다.** 웹뷰에서는 두 장이었다 — 네이티브 스플래시 +
 * DOM 커버(`#boot-cover`·`[data-splash-cover]`, [[ADR-117]] 결정 4). 그 두 번째 장은 정의상 웹뷰
 * 구현이고(다른 프레임워크에는 `#boot-cover` 라는 것이 없다) RN 에는 문서가 없으므로 흉내 낼 것도,
 * 걷을 것도 없다.
 *
 * **스플래시를 계속 띄워 두는 일은 여기가 아니다.** Capacitor 쪽에서 그것은 코드가 아니라 설정이었고
 * (`capacitor.config.ts` 의 `launchAutoHide: false`), RN 에서 짝이 되는 것은 앱 진입점에서 전역으로
 * 부르는 `SplashScreen.preventAutoHideAsync()` 다 — 그 라이브러리 문서가 **React 컴포넌트·훅 안이
 * 아니라 전역 스코프**에서 부르라고 명시한다(늦으면 이미 내려간 뒤다). 부팅 흐름 배선은 다음
 * step 이라 여기서는 손대지 않는다.
 */
export const rnSplashScreenPort: SplashScreenPort = {
  async hide() {
    await SplashScreen.hideAsync()
  },

  /**
   * **no-op 이다 — 이 플랫폼에 그 개념이 없다.**
   *
   * `show()` 가 존재한 이유는 웹뷰 리로드 하나였다(OTA 적용·캐시 초기화 직전에 새 문서가 페인트되기
   * 전까지 드러나는 웹뷰 배경색을 덮는다 — [[ADR-027]] 정정·[[ADR-117]] 결정 1·8). RN 에는 **문서를
   * 다시 로드하는 일 자체가 없어** 덮을 구간이 생기지 않는다. 포트 주석이 적어 둔 *"덮을 것이 없는
   * 환경이면 아무것도 하지 않는다"* 가 정확히 이 경우다.
   *
   * 흉내 내려면 `preventAutoHideAsync()` 뿐인데 그건 **이미 내려간 스플래시에는 아무 효과가 없다** —
   * 화면은 그대로인데 호출부만 덮였다고 믿게 되므로, 없는 것보다 나쁘다. `expo-splash-screen` 의 API
   * 는 `preventAutoHideAsync`·`setOptions`·`hide`·`hideAsync` 넷뿐이고 다시 띄우는 것은 없다
   * (`react-native-bootsplash` 도 같다).
   *
   * OTA 는 [[ADR-128]] 결정 7 대로 프로토콜째 재설계 대상이라(@capgo → expo-updates), 그때 적용
   * 경로가 화면을 덮어야 한다면 그 결정에서 이 자리를 다시 본다.
   */
  async show() {},
}
