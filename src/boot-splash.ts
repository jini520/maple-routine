import * as SplashScreen from 'expo-splash-screen'

import { hideSplashScreen } from './native/splash-screen'

/**
 * 스플래시를 React 트리 밖에서 다루는 두 가지. 붙들기와 실패 안전 타이머.
 *
 * 진입점(`index.ts`)이 `registerRootComponent` 앞에서 이 함수 하나를 부른다.
 *
 * ① 붙들기. `preventAutoHideAsync()` 는 전역 스코프여야 한다. `expo-splash-screen` 문서가
 * React 컴포넌트·훅 안이 아니라 전역 스코프에서 부르라고 명시한다. 늦으면 이미 내려간 뒤다.
 * 안 부르면 스플래시가 첫 렌더 전에 스스로 사라져 테마 복원 전 화면이 깜빡인다. 내리는 것은
 * `AppShell` 이다(최소 표시 시간 뒤).
 *
 * ② 실패 안전 타이머. 스플래시를 내리는 정상 경로는 `AppShell` 의 이펙트 타이머 하나뿐이고
 * 그 타이머는 언마운트 클린업이 취소한다. 부팅 렌더가 던지면 내릴 주체가 사라져 브랜드색
 * 화면에 갇힌다. 그래서 이 타이머만 트리 밖에 둔다. 트리가 죽어도 사는 자리가 이 저장소에서는
 * 진입점이다.
 *
 * 지키는 것 셋.
 * - 가드가 없다. 걷을지 말지 재는 가드는 리로드 커버가 있을 때의 장치였는데 RN 에는 그 커버가
 *   없다. `SplashScreenPort.show()` 가 no-op 이고 `hideAsync()` 는 이미 내려간 스플래시에
 *   무해하다.
 * - 덮는 범위가 좁다. 번들이 하나라, 이 타이머가 구하는 것은 번들은 평가됐는데 React 가 끝내
 *   마운트되지 않는 경우뿐이다. 번들 평가 자체가 실패하면 여기까지 오지 않는다.
 * - `SplashScreen.hideAsync()` 를 직접 부르지 않고 포트를 거친다(`hideSplashScreen`). 스플래시를
 *   내리는 자리가 넷이 되어도 전부 같은 한 함수를 지나게 한다. 포트는 `installPorts()` 가 이미
 *   넣어 뒀다.
 */
export const SPLASH_FAILSAFE_MS = 8000

export function holdSplashUntilAppReady(): void {
  // 붙들기 실패는 삼킨다. 실패했다면 스플래시가 일찍 사라질 뿐이고, 여기서 던지면 그 대가로
  // 앱이 아예 안 뜬다.
  void SplashScreen.preventAutoHideAsync().catch(() => {})

  setTimeout(() => {
    void hideSplashScreen().catch(() => {})
  }, SPLASH_FAILSAFE_MS)
}
