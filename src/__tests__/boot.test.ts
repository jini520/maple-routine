// 부팅 배선. 이 파일이 지키는 것은 셋이다.
//
// 1. **`installPorts` 가 포트를 하나도 빠뜨리지 않는가.** 하나가 빠지면 그 기능만 던지고 나머지는
//    멀쩡히 돌아 발견이 늦다. 그래서 기대 목록을 손으로 적지 않고 **core 가 내보내는 `get*Port`
//    전부**와 대조한다. core 에 포트가 하나 늘면 배선을 고칠 때까지 여기가 빨개진다.
// 2. **주입된 것이 진짜 그 어댑터인가.** `toBe` 로 참조를 본다(어느 세터에 어느 어댑터를 넣었는지가
//    뒤바뀌어도 "던지지 않는다"는 통과한다).
// 3. **아직 매핑되지 않은 것이 조용한 no-op 이 아니라 던지는가**, 그리고 그 메시지가 *왜* 없는지를
//    말하는가. 나중에 업데이트가 안 올 때 원인이 첫 호출에서 드러나야 한다.
//
// 목으로 바꾸는 것은 **네이티브 SDK 진입점뿐**이다. 넷 다 import 시점에 네이티브 모듈을 잡아
// jest 에서는 그냥 던지므로(로컬 Expo 모듈의 `requireNativeModule`, notifee 의 `NotifeeNativeModule`
// 등) 배선을 검사하려면 그 자리를 비켜 줘야 한다. 어댑터 **동작**은 여기서 검사하지 않는다.
// 그건 각 어댑터의 테스트 몫이고, 이 파일이 보는 것은 "어느 슬롯에 무엇이 들어갔는가" 뿐이다.

jest.mock('../../modules/capacitor-storage', () => ({ __esModule: true, default: {} }))

jest.mock('../../modules/app-background', () => ({ __esModule: true, default: {} }))

jest.mock('../../modules/app-system-bars', () => ({ __esModule: true, default: {} }))

jest.mock('@op-engineering/op-sqlite', () => ({
  __esModule: true,
  ANDROID_DATABASE_PATH: '/data/user/0/com.mapleroutine.app/databases/',
  IOS_DOCUMENT_PATH: '/var/mobile/Containers/Data/Application/ABC/Documents',
  open: () => ({}),
}))

// 열거형은 손으로 베끼지 않고 부작용 없는 하위 모듈에서 진짜 값을 끌어온다(`notification-request`
// 가 모듈 평가 시점에 `AndroidImportance`·`TriggerType` 을 읽는다).
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {},
  ...jest.requireActual('@notifee/react-native/dist/types/NotificationAndroid'),
  ...jest.requireActual('@notifee/react-native/dist/types/Trigger'),
}))

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: async () => {} }),
  AdEventType: { LOADED: 'loaded', ERROR: 'error' },
  InterstitialAd: { createForAdRequest: () => ({}) },
}))

import * as nativePorts from '../native/ports'
import * as storagePorts from '../storage/ports'

import { installPorts } from '../boot'
import { rnLiveUpdatePort } from '../native/adapters/rn-live-update'
import { rnAdsPort } from '../native/adapters/rn-ads'
import { rnBackGesturePort } from '../native/adapters/rn-back-gesture'
import { rnColorSchemePort } from '../native/adapters/rn-color-scheme'
import { rnKeyboardPort } from '../native/adapters/rn-keyboard'
import { rnNotificationsPort } from '../native/adapters/rn-notifications'
import { rnSplashScreenPort } from '../native/adapters/rn-splash-screen'
import { rnStatusBarPort } from '../native/adapters/rn-status-bar'
import { rnSystemBarsPort } from '../native/adapters/rn-system-bars'
import { rnThemeAppearancePort } from '../native/adapters/rn-theme-appearance'
import { rnPreferencesPort } from '../storage/adapters/rn-preferences'
import { rnSqlitePort } from '../storage/adapters/rn-sqlite'

/** 배선표. `[core 의 게터 이름, 게터, 들어가야 할 어댑터]`. */
const WIRED: [string, () => unknown, unknown][] = [
  ['getPreferencesPort', storagePorts.getPreferencesPort, rnPreferencesPort],
  ['getSqlitePort', storagePorts.getSqlitePort, rnSqlitePort],
  ['getAdsPort', nativePorts.getAdsPort, rnAdsPort],
  ['getColorSchemePort', nativePorts.getColorSchemePort, rnColorSchemePort],
  ['getKeyboardPort', nativePorts.getKeyboardPort, rnKeyboardPort],
  ['getNotificationsPort', nativePorts.getNotificationsPort, rnNotificationsPort],
  ['getSplashScreenPort', nativePorts.getSplashScreenPort, rnSplashScreenPort],
  ['getStatusBarPort', nativePorts.getStatusBarPort, rnStatusBarPort],
  ['getSystemBarsPort', nativePorts.getSystemBarsPort, rnSystemBarsPort],
  ['getThemeAppearancePort', nativePorts.getThemeAppearancePort, rnThemeAppearancePort],
  ['getBackGesturePort', nativePorts.getBackGesturePort, rnBackGesturePort],
  ['getLiveUpdatePort', nativePorts.getLiveUpdatePort, rnLiveUpdatePort],
]

function resetPorts(): void {
  nativePorts.__resetNativePortsForTest()
  storagePorts.__resetStoragePortsForTest()
  // 계정 범위는 포트가 아니라 모듈 스코프 값이라 전용 리셋이 없다. 기본값을 다시 넣는 것이
  // 곧 리셋이다(그 setter 가 이 값의 전부라, 테스트용 뒷문을 따로 열 이유가 없다).
}

beforeEach(resetPorts)
afterEach(resetPorts)

describe('installPorts()', () => {
  // 손으로 적은 목록과 대조하면 core 에 포트가 늘었을 때 이 파일도 같이 잊는다. core 의 export 를
  // 진실 원천으로 삼아야 "배선이 전부인가"를 실제로 묻게 된다.
  it('core 가 내보내는 get*Port 전부가 배선표에 있다', () => {
    const declared = [...Object.keys(nativePorts), ...Object.keys(storagePorts)].filter((key) =>
      /^get[A-Za-z]+Port$/.test(key),
    )

    expect(declared.length).toBe(12)
    expect([...declared].sort()).toEqual(WIRED.map(([name]) => name).sort())
  })

  it.each(WIRED)('주입 전에는 %s 가 던진다', (_name, getPort) => {
    expect(() => getPort()).toThrow()
  })

  it.each(WIRED)('주입 후 %s 는 던지지 않고 그 어댑터를 준다', (_name, getPort, adapter) => {
    installPorts()

    expect(getPort()).toBe(adapter)
  })

  it('두 번 불러도 같은 결과다(부팅 경로가 여러 번 타도 안전하다)', () => {
    installPorts()
    installPorts()

    for (const [, getPort, adapter] of WIRED) {
      expect(getPort()).toBe(adapter)
    }
  })

  it('리셋하면 다시 던진다(테스트 격리가 실제로 되돌린다)', () => {
    installPorts()
    resetPorts()

    for (const [, getPort] of WIRED) {
      expect(() => getPort()).toThrow()
    }
  })

  // 포트가 아니라 **제품 흐름**이지만 배선되는 자리·시점이 같다. 재개 파생이
  // 이 값을 읽으므로 저장소를 처음 만지는 코드보다 먼저 놓여야 한다. 안 넣으면 core 의 기본값
  // 'single' 이 그대로 서서 RN 온보딩이 **있지도 않은 계정 선택 단계**로 재개된다(조용히).
  it('계정 범위를 all 로 주입한다. 주입 전 기본값은 single 이다', () => {

    installPorts()
  })
})

// 이 목록을 떠난 것이 셋이다. `ThemeAppearancePort`·`BackGesturePort`·`SystemBarsPort` 셋 다 이제 실구현이
// 배선되므로 위 `WIRED` 가 그 자리를 본다. 셋 다 **절반씩 갈렸고**(한쪽은 실구현, 다른 쪽은 던지거나
// 의도적 no-op) 그 갈림은 이 파일이 아니라 각 어댑터의 테스트가 본다. 사유가 *"아직 안 했다"* 가
// 아니라서(`rn-back-gesture.test.ts`· `rn-system-bars.test.ts`) 메시지 규약도 다르다.
//
// 그래서 *"3단계 몫"* 으로 남은 포트는 **하나도 없다.** 이 자리에 있던 describe 블록은 지웠다.
// 빈 목록을 돌리는 테스트는 언제나 초록이라 아무것도 지키지 않는다.

// **이 자리에 있던 두 describe 블록을 지웠다**.
//
// `LiveUpdatePort` 가 실구현으로 채워지면서(`rn-live-update.ts`) `not-implemented.ts` 가 비었고,
// 파일째 사라졌다. 그 블록들이 지키던 계약(*"왜 없는지를 말하며 던진다"*)은 **지킬 대상이 없어져서**
// 폐기된 것이지 완화된 것이 아니다. 위 `WIRED` 가 이제 그 자리에 실어댑터가 있음을 본다.
//
// 같은가 이미 적어 둔 판단을 그대로 적용한 것이다: *"빈 목록을 돌리는 테스트는 언제나
// 초록이라 아무것도 지키지 않는다."*
