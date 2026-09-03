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
} from '../ports'

/**
 * 네이티브 포트의 테스트 기본값.
 *
 * 포트 역전 전에는 `@capacitor/*` 모듈이 어느 테스트에서나 그냥 import 돼 동작했다. 테스트 환경의
 * 플랫폼이 `web` 이라 모든 어댑터가 no-op 이었기 때문이다. 여기 있는 것이 정확히 그 자리를 메운다:
 * no-op 포트다(광고 없음· 라이브 업데이트 미지원·
 * 네트워크 종류 모름· 리스너 해제는 안전한 빈 함수).
 *
 * 이것이 없으면 앱을 렌더하기만 하는 테스트(부팅 시 스플래시 해제·안전영역 인셋·시스템 뒤로가기)가
 * "포트 미주입" 에러를 던진다. 네이티브 어댑터 자체를 검사하는 테스트는 자기 파일에서 Capacitor
 * 구현을 다시 주입해 이 기본값을 덮는다.
 */
export function installNoopNativePorts(): void {
  // `matchMedia` 없는 환경의 폴백과 같다. 테스트 기본 환경은 `node` 라 문서도 미디어 쿼리도 없다.
  setColorSchemePort({ get: () => 'light' })

  // 기본 환경에 `document` 가 없으므로 아무것도 칠하지 않는다. 문서에 실제로 반영되는지는
  // `features/theme/__tests__/store.test.ts` 가 jsdom 에서 진짜 어댑터를 주입해 검사한다.
  setThemeAppearancePort({ apply: () => {} })

  setAdsPort({
    initialize: async () => {},
    prepareInterstitial: async () => false,
    showInterstitial: async () => false,
  })

  setSplashScreenPort({
    hide: async () => {},
    show: async () => {},
  })

  setStatusBarPort({ setStyle: async () => {} })

  setSystemBarsPort({
    setNavigationBarStyle: async () => {},
    refreshSafeAreaInsets: async () => {},
  })

  setKeyboardPort({ addVisibilityListener: async () => () => {} })

  setNotificationsPort({
    requestPermission: async () => false,
    hasPermission: async () => false,
    schedule: async () => {},
    cancel: async () => {},
    getPendingCount: async () => 0,
  })

  setBackGesturePort({
    setEnabled: async () => {},
    moveToBackground: async () => {},
    addListeners: async () => () => {},
  })

  setLiveUpdatePort({
// 런타임이 없으므로 아래 조회들은 호출부의 가드에 막혀 도달하지 않는다.
    isSupported: () => false,
    notifyAppReady: async () => {},
    getCurrentVersion: async () => '0.0.0',
    getChannel: () => 'production',
    check: async () => ({ kind: 'unsupported' }),
    download: async () => {},
    apply: async () => {},
    getNetworkType: async () => 'unknown',
    openStore: () => {},
  })
}
