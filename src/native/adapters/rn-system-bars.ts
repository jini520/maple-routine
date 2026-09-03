import type { SystemBarsPort } from '../ports'

import AppSystemBars from '../../../modules/app-system-bars'

/**
 * `SystemBarsPort` 의 RN 구현. 두 메서드의 사정이 정반대다.
 *
 * `setNavigationBarStyle` 은 로컬 Expo 모듈(`modules/app-system-bars`)이 진짜로 한다.
 * `refreshSafeAreaInsets` 는 할 일이 없다.
 *
 * 그 함수의 존재 이유는 유실 복구였다. 네이티브가 최초 인셋을 적용하는 시점이 화면 준비보다
 * 빠르면 그 값이 아무 데도 안 닿고 사라져, 마운트 뒤에 한 번 다시 보내 달라고 요청했다.
 *
 * RN 에는 주입도 유실도 없다. `react-native-safe-area-context` 가 자기 네이티브 리스너로
 * 인셋을 받아 `SafeAreaProvider` 를 통해 값으로 내려주고, 회전·폴더블 접힘·키보드 변화도 그쪽이
 * 알아서 다시 내려보낸다. 강제하던 갱신을 프로바이더가 이미 자동으로 한다.
 *
 * 그래서 던지지 않는다. 이쪽은 해야 하는데 아직 안 했다 가 아니라 이 플랫폼에 그 개념이 없다
 * 이고, 그 칸의 처리는 정당한 no-op 이다. 던지게 두면 안전영역은 정상 동작 중인데 부팅마다
 * 처리되지 않은 거부가 남아 진짜 고장과 구분이 안 된다.
 *
 * 이 no-op 이 조용하지 않다는 것은 `__tests__/rn-system-bars.test.ts` 가 맡는다.
 */
export const rnSystemBarsPort: SystemBarsPort = {
  /**
   * iOS 에서는 네이티브 모듈이 없어 `AppSystemBars` 가 `null` 이고 그때는 아무것도 하지 않는다.
   * 그 플랫폼에는 하단 시스템 내비게이션 바 자체가 없다.
   */
  async setNavigationBarStyle(isDarkTheme) {
    await AppSystemBars?.setNavigationBarStyle(isDarkTheme)
  },

  /** 의도적으로 비어 있다. 다시 요청할 대상도, 유실될 주입도 없다. */
  async refreshSafeAreaInsets() {},
}
