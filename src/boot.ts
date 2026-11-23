import {
  setAdsPort,
  setBackGesturePort,
  setColorSchemePort,
  setBrowserPort,
  setClipboardPort,
  setHapticsPort,
  setBackgroundTaskPort,
  setScreenCornersPort,
  setStoreReviewPort,
  setKeyboardPort,
  setLiveUpdatePort,
  setNotificationsPort,
  setPushPort,
  setSplashScreenPort,
  setStatusBarPort,
  setSystemBarsPort,
  setThemeAppearancePort,
  setUuidPort,
} from './native/ports'
import { setAssetFilesPort, setPreferencesPort, setSqlitePort } from './storage/ports'
import { startGameData } from './features/game-data/sync'
import { startDeviceConversion } from './features/device-conversion/run'
import { useLiveUpdateStore } from './features/live-update/store'
import { nexonMaintenanceReporter } from './features/nexon-maintenance/store'
import { setFriendsStream, setMaintenanceReporter } from './nexon/http'
import { streamFriends } from './server/friends-stream'

import { rnAdsPort } from './native/adapters/rn-ads'
import { rnBackGesturePort } from './native/adapters/rn-back-gesture'
import { rnClipboardPort } from './native/adapters/rn-clipboard'
import { rnColorSchemePort } from './native/adapters/rn-color-scheme'
import { rnHapticsPort } from './native/adapters/rn-haptics'
import { rnScreenCornersPort } from './native/adapters/rn-screen-corners'
import { rnBackgroundTaskPort } from './native/adapters/rn-background-task'
import { rnStoreReviewPort } from './native/adapters/rn-store-review'
import { rnKeyboardPort } from './native/adapters/rn-keyboard'
import { rnNotificationsPort } from './native/adapters/rn-notifications'
import { rnPushPort } from './native/adapters/rn-push'
import { rnSplashScreenPort } from './native/adapters/rn-splash-screen'
import { rnStatusBarPort } from './native/adapters/rn-status-bar'
import { rnSystemBarsPort } from './native/adapters/rn-system-bars'
import { rnThemeAppearancePort } from './native/adapters/rn-theme-appearance'
import { rnBrowserPort } from './native/adapters/rn-browser'
import { rnUuidPort } from './native/adapters/rn-uuid'
import { rnLiveUpdatePort } from './native/adapters/rn-live-update'
import { rnPreferencesPort } from './storage/adapters/rn-preferences'
import { rnSqlitePort } from './storage/adapters/rn-sqlite'
import { rnAssetFilesPort } from './storage/adapters/rn-asset-files'

/**
 * 저장소 · 네이티브 포트 스물하나를 한 번에 주입하는 함수. 진입점 `index.ts` 가 `registerRootComponent(App)` 앞에서 부른다.
 *
 * 저장소 · 네이티브를 처음 만지는 코드보다 먼저 불러야 한다. 주입 전 접근은 슬롯(`storage/ports.ts` · `native/ports.ts`)이 던져서,
 * 순서가 틀리면 조용히 넘어가지 않고 에러로 드러난다. 세터를 한 함수에 모으는 것은 하나라도 빠지면 그 기능만 던지고 나머지는 돌아
 * 늦게 발견되기 때문이다. 주입 순서는 서로 상관없다.
 *
 * - `ThemeAppearancePort` 가 놓는 값은 `src/theme/appearance-store.ts` 에 있고 `ThemeProvider` 가 읽는다. 이 포트만 부팅 배선과 렌더
 *   트리가 함께 있어야 성립한다.
 * - `BackGesturePort` 는 `moveToBackground` 만 구현한다. 나머지 둘은 네이티브 스택이 맡아서 부르면 던진다(`rn-back-gesture.ts`).
 * - `SystemBarsPort` 의 `refreshSafeAreaInsets` 는 아무것도 하지 않는다. `SafeAreaProvider` 가 그 갱신을 이미 한다.
 * - `PushPort` 는 구독 · 해제 둘이다. 알림 권한은 로컬과 원격을 가리지 않는 하나라서 `NotificationsPort` 가 든다.
 */
export function installPorts(): void {
  // 저장소 포트.
  setPreferencesPort(rnPreferencesPort)
  setSqlitePort(rnSqlitePort)
  setAssetFilesPort(rnAssetFilesPort)

  // 네이티브 포트.
  setAdsPort(rnAdsPort)
  setBackGesturePort(rnBackGesturePort)
  setColorSchemePort(rnColorSchemePort)
  setHapticsPort(rnHapticsPort)
  setScreenCornersPort(rnScreenCornersPort)
  setBackgroundTaskPort(rnBackgroundTaskPort)
  setStoreReviewPort(rnStoreReviewPort)
  setClipboardPort(rnClipboardPort)
  setKeyboardPort(rnKeyboardPort)
  setNotificationsPort(rnNotificationsPort)
  setPushPort(rnPushPort)
  setSplashScreenPort(rnSplashScreenPort)
  setStatusBarPort(rnStatusBarPort)
  setSystemBarsPort(rnSystemBarsPort)
  setThemeAppearancePort(rnThemeAppearancePort)

  setLiveUpdatePort(rnLiveUpdatePort)
  setBrowserPort(rnBrowserPort)
  setUuidPort(rnUuidPort)

  // 포트는 아니지만 방향을 뒤집는 것은 같다. `nexon/` 이 우리 서버를 직접 부르면 계층이
  // 거꾸로 선다. 로그인 자격의 프렌즈 조회는 이 함수를 거쳐 서버가 넥슨을 대신 부른다.
  setFriendsStream(streamFriends)
  // 같은 이유다. 점검 응답을 받으면 머리글 바로 아래의 점검 배너를 세운다.
  setMaintenanceReporter(nexonMaintenanceReporter)
}

/**
 * 게임 데이터 사본을 읽고, 없으면 잠금 화면 뒤에서 받는 부팅 곁가지. 포트 주입 뒤에 부른다. 저장소를 읽기 때문이다.
 *
 * OTA 부팅 확인도 여기서 띄운다. 처음 실행인지와 잠근 채인지는 사본을 읽어야 알고, 잠근 채면 게임 데이터 받기가
 * 그 확인을 기다린다. 두 기능이 서로를 모르게 이어 주는 자리가 여기다.
 *
 * 1.0.15 기기 변환도 여기서 건다. 게임 데이터가 준비되면 돌고, 끝날 때까지 기록 표와 Preferences 에 든 기록의 접근을 막는다.
 *
 * 결과를 안 기다린다. 화면은 `features/game-data/sync` 의 상태를 구독해 다 받기 전에는 잠금 화면을 그린다.
 */
export function loadGameData(): void {
  // 기록 막기를 먼저 건다. 막기 전에 저장소를 건드리면 옛 모양의 기록을 새 코드가 읽는다.
  startDeviceConversion()
  void startGameData((context) => useLiveUpdateStore.getState().checkOnBoot(context))
}
