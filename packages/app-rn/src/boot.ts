import {
  setAdsPort,
  setBackGesturePort,
  setColorSchemePort,
  setHuntingTimerPort,
  setKeyboardPort,
  setLiveUpdatePort,
  setNotificationsPort,
  setSplashScreenPort,
  setStatusBarPort,
  setSystemBarsPort,
  setThemeAppearancePort,
} from '@core/native/ports'
import { setPreferencesPort, setSqlitePort } from '@core/storage/ports'

import { rnAdsPort } from './native/adapters/rn-ads'
import { rnColorSchemePort } from './native/adapters/rn-color-scheme'
import { rnHuntingTimerPort } from './native/adapters/rn-hunting-timer'
import { rnKeyboardPort } from './native/adapters/rn-keyboard'
import { rnNotificationsPort } from './native/adapters/rn-notifications'
import { rnSplashScreenPort } from './native/adapters/rn-splash-screen'
import { rnStatusBarPort } from './native/adapters/rn-status-bar'
import {
  notImplementedBackGesturePort,
  notImplementedLiveUpdatePort,
  notImplementedSystemBarsPort,
  notImplementedThemeAppearancePort,
} from './native/adapters/not-implemented'
import { rnPreferencesPort } from './storage/adapters/rn-preferences'
import { rnSqlitePort } from './storage/adapters/rn-sqlite'

/**
 * 포트 13종을 한 번에 주입한다([[ADR-127]] 결정 4 — `packages/core` 는 인터페이스만 갖고 구현은
 * 앱이 넣는다). `app-capacitor` 의 짝은 `main.tsx` + `native/adapters/index.ts` 다.
 *
 * ## 언제 불러야 하는가 — **저장소·네이티브를 처음 만지는 코드보다 먼저**
 *
 * 웹 쪽 참조 구현(`main.tsx`)이 세터 셋을 파일 맨 위에 두고 그 이유를 적어 두었다: 바로 아래
 * `checkOnBoot()` 부터 Preferences 를 읽고 라이브 업데이트를 확인하며, 그 실패 경로는 스플래시까지
 * 건드린다([[ADR-117]]). RN 쪽 짝은 진입점 `index.ts` 이고, `registerRootComponent(App)` **앞**에
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
 * ## 넷은 아직 구현이 아니라 **거부**다
 *
 * `ThemeAppearancePort`·`SystemBarsPort`·`BackGesturePort` 는 3단계(뷰 레이어)에서, `LiveUpdatePort`
 * 는 [[ADR-127]] 결정 7 의 별도 ADR 에서 채워진다. 그때까지 비워 두지 않고 **던지는 구현**을 넣는
 * 이유는 `not-implemented.ts` 가 적어 두었다 — 슬롯의 일반 메시지는 *"주입을 잊었다"* 로 읽히지
 * *"아직 안 만들었다"* 로 읽히지 않는다.
 */
export function installPorts(): void {
  // 저장소 먼저 — 웹 쪽 `main.tsx` 와 같은 순서다(기술적 의존은 없고, 두 앱을 나란히 읽기 위한 것).
  setPreferencesPort(rnPreferencesPort)
  setSqlitePort(rnSqlitePort)

  // RN 구현이 있는 일곱.
  setAdsPort(rnAdsPort)
  setColorSchemePort(rnColorSchemePort)
  setHuntingTimerPort(rnHuntingTimerPort)
  setKeyboardPort(rnKeyboardPort)
  setNotificationsPort(rnNotificationsPort)
  setSplashScreenPort(rnSplashScreenPort)
  setStatusBarPort(rnStatusBarPort)

  // 아직 매핑되지 않은 넷 — 부르면 왜 없는지를 말하며 던진다.
  setBackGesturePort(notImplementedBackGesturePort)
  setLiveUpdatePort(notImplementedLiveUpdatePort)
  setSystemBarsPort(notImplementedSystemBarsPort)
  setThemeAppearancePort(notImplementedThemeAppearancePort)
}
