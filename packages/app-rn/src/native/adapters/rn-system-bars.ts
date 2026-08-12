import type { SystemBarsPort } from '@core/native/ports'

import AppSystemBars from '../../../modules/app-system-bars'

/**
 * `SystemBarsPort` 의 RN 구현 — **두 메서드의 사정이 정반대다.**
 *
 * | 메서드 | 웹뷰에서 하던 일 | RN |
 * |---|---|---|
 * | `setNavigationBarStyle` | 자체 플러그인이 `setAppearanceLightNavigationBars` 를 부른다 | **그대로 옮겼다** — 로컬 Expo 모듈(`modules/app-system-bars`) |
 * | `refreshSafeAreaInsets` | `--safe-area-inset-*` **CSS 변수를 다시 주입**한다 | **할 일이 없다** — 아래 |
 *
 * ## `refreshSafeAreaInsets` 가 no-op 인 이유는 *"못 한다"* 가 아니라 *"이미 되고 있다"* 다
 *
 * 이 함수의 존재 이유는 **유실 복구**였다. 웹뷰에서는 네이티브가 최초 인셋을 적용하는 시점이 DOM
 * 준비보다 빠를 수 있어, 그러면 주입한 값이 아무 데도 닿지 않고 사라진다 — 그래서 앱이 마운트된 뒤
 * 한 번 "다시 보내 달라"고 요청했다(`App.tsx` 의 마운트 effect · `SystemBarsPlugin.refreshInsets`).
 *
 * RN 에는 **주입도 유실도 없다.** `react-native-safe-area-context` 가 자기 네이티브 리스너로
 * 인셋을 받아 `SafeAreaProvider` 를 통해 컴포넌트에 값으로 내려주고, 회전·폴더블 접힘·키보드 변화도
 * 그쪽이 알아서 다시 내려보낸다. 즉 이 함수가 **강제하던 갱신을 프로바이더가 이미 자동으로 한다.**
 *
 * 그래서 던지지 않는다. `not-implemented.ts` 가 세운 기준에 그대로 얹으면 이쪽은
 * *"해야 하는데 아직 안 했다"* 가 아니라 *"이 플랫폼에 그 개념이 없다"* 이고, 그 칸의 처리는
 * **정당한 no-op** 이다(`rn-splash-screen.ts` 의 `show()` 와 같은 자리). 던지게 두면 반대로 나쁘다 —
 * 안전영역은 **정상 동작 중인데** 부팅마다 처리되지 않은 거부가 남아, 진짜 고장과 구분이 안 된다.
 *
 * 이 no-op 이 조용하지 않다는 것은 `__tests__/rn-system-bars.test.ts` 가 맡는다 — *"아무것도 안 한다"*
 * 를 그 이유와 함께 테스트로 적어 두면 다음 사람이 "구현이 빠졌나" 하고 다시 파지 않는다.
 */
export const rnSystemBarsPort: SystemBarsPort = {
  /**
   * iOS 에서는 네이티브 모듈이 없어 `AppSystemBars` 가 `null` 이고, 그때는 아무것도 하지 않는다 —
   * 그 플랫폼에는 하단 시스템 내비게이션 바 자체가 없다(웹뷰 구현의 `platform !== 'android'` 가드와
   * 같은 자리다).
   */
  async setNavigationBarStyle(isDarkTheme) {
    await AppSystemBars?.setNavigationBarStyle(isDarkTheme)
  },

  /** 의도적으로 비어 있다(파일 머리) — 다시 요청할 대상도, 유실될 주입도 없다. */
  async refreshSafeAreaInsets() {},
}
