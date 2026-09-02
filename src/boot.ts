import {
  setAdsPort,
  setBackGesturePort,
  setColorSchemePort,
  setKeyboardPort,
  setLiveUpdatePort,
  setNotificationsPort,
  setSplashScreenPort,
  setStatusBarPort,
  setSystemBarsPort,
  setThemeAppearancePort,
} from './native/ports'
import { setPreferencesPort, setSqlitePort } from './storage/ports'

import { rnAdsPort } from './native/adapters/rn-ads'
import { rnBackGesturePort } from './native/adapters/rn-back-gesture'
import { rnColorSchemePort } from './native/adapters/rn-color-scheme'
import { rnKeyboardPort } from './native/adapters/rn-keyboard'
import { rnNotificationsPort } from './native/adapters/rn-notifications'
import { rnSplashScreenPort } from './native/adapters/rn-splash-screen'
import { rnStatusBarPort } from './native/adapters/rn-status-bar'
import { rnSystemBarsPort } from './native/adapters/rn-system-bars'
import { rnThemeAppearancePort } from './native/adapters/rn-theme-appearance'
import { rnLiveUpdatePort } from './native/adapters/rn-live-update'
import { rnPreferencesPort } from './storage/adapters/rn-preferences'
import { rnSqlitePort } from './storage/adapters/rn-sqlite'

/**
 * 포트 13종을 한 번에 주입한다(— `packages/core` 는 인터페이스만 갖고 구현은
 * 앱이 넣는다). `app-capacitor` 의 짝은 `main.tsx` + `native/adapters/index.ts` 다.
 *
 * (아래 `setThemeAppearancePort` 가 값을 놓는 자리는 `src/theme/appearance-store.ts` 이고 그것을
 * 읽는 것은 `ThemeProvider` 다 — 이 포트만 부팅 배선과 렌더 트리가 함께 있어야 성립한다.)
 *
 * ## 언제 불러야 하는가 — **저장소·네이티브를 처음 만지는 코드보다 먼저**
 *
 * 웹 쪽 참조 구현(`main.tsx`)이 세터 셋을 파일 맨 위에 두고 그 이유를 적어 두었다: 바로 아래
 * `checkOnBoot()` 부터 Preferences 를 읽고 라이브 업데이트를 확인하며, 그 실패 경로는 스플래시까지
 * 건드린다. RN 쪽 짝은 진입점 `index.ts` 이고, `registerRootComponent(App)` **앞**에
 * 부른다 — 그 호출이 하는 일은 `AppRegistry` 등록이라 실제 렌더는 번들 평가가 끝난 뒤에 오지만,
 * "렌더보다 먼저"를 코드 순서로 읽히게 두는 편이 낫다.
 *
 * 주입 전 접근은 조용히 넘어가지 않고 던지므로(`ports.ts` 의 슬롯), 순서가 틀리면 무음 실패가
 * 아니라 에러로 드러난다.
 *
 * ## 왜 세터를 한 함수에 모으는가
 *
 * 하나라도 빠지면 **그 기능만** 던지고 나머지는 멀쩡히 돌아 발견이 늦다. 그래서 "전부"를 한
 * 자리에서 보장한다(`installCapacitorNativePorts` 와 같은 판단). 주입 순서는 서로 무관하다 —
 * 포트끼리 참조하지 않는다.
 *
 * ## 이제 열셋이 전부 실구현이다
 *
 * 마지막까지 던지던 `LiveUpdatePort` 가 로 채워졌다(`rn-live-update.ts`) — 그 하나가
 * 「아직 안 만들었다」로 남아 있던 이유는 다른 열둘과 달리 **프로토콜 자체가 바뀌기** 때문이었고
 * 그래서 `not-implemented.ts` 는 이제 비었다.
 *
 * 그 목록을 먼저 떠난 것이 셋이다:
 * - `ThemeAppearancePort`(step 1, theme-system) — `rn-theme-appearance.ts` 가 자리를 채웠다.
 * - `BackGesturePort`(step 2, navigation) — **절반만 구현이다.** `moveToBackground` 는 실구현이고
 *  (그 하나는 내비게이션 라이브러리가 대신해 주지 않는다) 나머지 둘은 계속
 *   던지되 사유가 갈린다: *"아직 안 했다"* 가 아니라 *"이제 네이티브 스택이 소유한다."*
 *   그래서 메시지도 `not-implemented.ts` 가 아니라 `rn-back-gesture.ts` 가 갖는다.
 * - `SystemBarsPort`(step 6, templates) — 이쪽도 절반씩이다. `setNavigationBarStyle` 은 로컬 Expo
 *   모듈로 그대로 옮겼고, `refreshSafeAreaInsets` 는 **의도적인 no-op** 이다(던지지 않는다 —
 *   `SafeAreaProvider` 가 그 갱신을 이미 자동으로 하므로 거부가 진짜 고장과 구분을 없앤다).
 */
export function installPorts(): void {
  // 저장소 먼저 — 웹 쪽 `main.tsx` 와 같은 순서다(기술적 의존은 없고, 두 앱을 나란히 읽기 위한 것).
  setPreferencesPort(rnPreferencesPort)
  setSqlitePort(rnSqlitePort)

  // RN 구현이 있는 열.
  setAdsPort(rnAdsPort)
  setBackGesturePort(rnBackGesturePort)
  setColorSchemePort(rnColorSchemePort)
  setKeyboardPort(rnKeyboardPort)
  setNotificationsPort(rnNotificationsPort)
  setSplashScreenPort(rnSplashScreenPort)
  setStatusBarPort(rnStatusBarPort)
  setSystemBarsPort(rnSystemBarsPort)
  setThemeAppearancePort(rnThemeAppearancePort)

  setLiveUpdatePort(rnLiveUpdatePort)
}
