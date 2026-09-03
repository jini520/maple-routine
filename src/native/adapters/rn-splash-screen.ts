import * as SplashScreen from 'expo-splash-screen'

import type { SplashScreenPort } from '../ports'

/**
 * `SplashScreenPort` 의 RN 구현.
 *
 * `expo-splash-screen` 을 고른 근거는 버전이 SDK 에 묶인다는 것이다(`~57.0.6`). 후보였던
 * `react-native-bootsplash` 는 SDK 와 독립적으로 버전이 움직이고 에셋 생성 CLI 를 따로 돌려야
 * 하는데, 광고 SDK 가 정확히 그 독립 버저닝 때문에 Kotlin 메타데이터 충돌로 빌드를 깨뜨렸다.
 * 두 라이브러리 모두 다시 띄우는 API 가 없어서 그 축은 선택에 영향을 주지 않았다.
 *
 * 이 어댑터는 네이티브 스플래시 한 장만 다룬다.
 *
 * 스플래시를 계속 띄워 두는 일은 여기가 아니다. 앱 진입점에서 전역으로 부르는
 * `SplashScreen.preventAutoHideAsync()` 가 그 자리다. 그 라이브러리 문서가 React 컴포넌트·훅
 * 안이 아니라 전역 스코프에서 부르라고 명시한다. 늦으면 이미 내려간 뒤다.
 */
export const rnSplashScreenPort: SplashScreenPort = {
  async hide() {
    await SplashScreen.hideAsync()
  },

  /**
   * no-op 이다. 이 플랫폼에 그 개념이 없다.
   *
   * RN 에는 문서를 다시 로드하는 일 자체가 없어 덮을 구간이 생기지 않는다. 흉내 내려면
   * `preventAutoHideAsync()` 뿐인데 그건 이미 내려간 스플래시에는 아무 효과가 없다. 화면은
   * 그대로인데 호출부만 덮였다고 믿게 되므로 없는 것보다 나쁘다. `expo-splash-screen` 의 API
   * 는 `preventAutoHideAsync`·`setOptions`·`hide`·`hideAsync` 넷뿐이다.
   */
  async show() {},
}
