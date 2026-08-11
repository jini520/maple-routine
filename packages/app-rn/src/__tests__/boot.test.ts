// 부팅 배선 — 이 파일이 지키는 것은 셋이다.
//
// 1. **`installPorts()` 가 포트를 하나도 빠뜨리지 않는가.** 하나가 빠지면 그 기능만 던지고 나머지는
//    멀쩡히 돌아 발견이 늦다. 그래서 기대 목록을 손으로 적지 않고 **core 가 내보내는 `get*Port`
//    전부**와 대조한다 — core 에 포트가 하나 늘면 배선을 고칠 때까지 여기가 빨개진다.
// 2. **주입된 것이 진짜 그 어댑터인가.** `toBe` 로 참조를 본다(어느 세터에 어느 어댑터를 넣었는지가
//    뒤바뀌어도 "던지지 않는다"는 통과한다).
// 3. **아직 매핑되지 않은 셋이 조용한 no-op 이 아니라 던지는가**, 그리고 그 메시지가 *왜* 없는지를
//    말하는가. 나중에 안전영역이 0 일 때 원인이 첫 호출에서 드러나야 한다.
//
// 목으로 바꾸는 것은 **네이티브 SDK 진입점뿐**이다. 넷 다 import 시점에 네이티브 모듈을 잡아
// jest 에서는 그냥 던지므로(로컬 Expo 모듈의 `requireNativeModule`, notifee 의 `NotifeeNativeModule`
// 등) 배선을 검사하려면 그 자리를 비켜 줘야 한다. 어댑터 **동작**은 여기서 검사하지 않는다 —
// 그건 각 어댑터의 테스트 몫이고, 이 파일이 보는 것은 "어느 슬롯에 무엇이 들어갔는가" 뿐이다.

jest.mock('../../modules/capacitor-storage', () => ({ __esModule: true, default: {} }))

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

import * as nativePorts from '@core/native/ports'
import * as storagePorts from '@core/storage/ports'

import { installPorts } from '../boot'
import {
  notImplementedBackGesturePort,
  notImplementedLiveUpdatePort,
  notImplementedSystemBarsPort,
} from '../native/adapters/not-implemented'
import { rnAdsPort } from '../native/adapters/rn-ads'
import { rnColorSchemePort } from '../native/adapters/rn-color-scheme'
import { rnHuntingTimerPort } from '../native/adapters/rn-hunting-timer'
import { rnKeyboardPort } from '../native/adapters/rn-keyboard'
import { rnNotificationsPort } from '../native/adapters/rn-notifications'
import { rnSplashScreenPort } from '../native/adapters/rn-splash-screen'
import { rnStatusBarPort } from '../native/adapters/rn-status-bar'
import { rnThemeAppearancePort } from '../native/adapters/rn-theme-appearance'
import { rnPreferencesPort } from '../storage/adapters/rn-preferences'
import { rnSqlitePort } from '../storage/adapters/rn-sqlite'

/** 배선표 — `[core 의 게터 이름, 게터, 들어가야 할 어댑터]`. */
const WIRED: [string, () => unknown, unknown][] = [
  ['getPreferencesPort', storagePorts.getPreferencesPort, rnPreferencesPort],
  ['getSqlitePort', storagePorts.getSqlitePort, rnSqlitePort],
  ['getAdsPort', nativePorts.getAdsPort, rnAdsPort],
  ['getColorSchemePort', nativePorts.getColorSchemePort, rnColorSchemePort],
  ['getHuntingTimerPort', nativePorts.getHuntingTimerPort, rnHuntingTimerPort],
  ['getKeyboardPort', nativePorts.getKeyboardPort, rnKeyboardPort],
  ['getNotificationsPort', nativePorts.getNotificationsPort, rnNotificationsPort],
  ['getSplashScreenPort', nativePorts.getSplashScreenPort, rnSplashScreenPort],
  ['getStatusBarPort', nativePorts.getStatusBarPort, rnStatusBarPort],
  ['getThemeAppearancePort', nativePorts.getThemeAppearancePort, rnThemeAppearancePort],
  ['getBackGesturePort', nativePorts.getBackGesturePort, notImplementedBackGesturePort],
  ['getLiveUpdatePort', nativePorts.getLiveUpdatePort, notImplementedLiveUpdatePort],
  ['getSystemBarsPort', nativePorts.getSystemBarsPort, notImplementedSystemBarsPort],
]

function resetPorts(): void {
  nativePorts.__resetNativePortsForTest()
  storagePorts.__resetStoragePortsForTest()
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

    expect(declared.length).toBe(13)
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
})

/**
 * 아직 매핑되지 않은 포트의 메서드를 **인자 없이** 부른다. 인자를 채우지 않는 것이 요점이다 —
 * 이 구현들은 무엇을 받든 던지므로, 인자를 지어내면 "그 값이라서 던졌나" 하는 여지가 생긴다.
 */
function callBare(fn: unknown): unknown {
  return (fn as () => unknown)()
}

/** 동기 throw 든 거부된 Promise 든 받아서 에러를 돌려준다. 어느 쪽도 아니면 실패시킨다. */
async function captureFailure(fn: unknown): Promise<Error> {
  let result: unknown
  try {
    result = callBare(fn)
  } catch (error) {
    return error as Error
  }
  try {
    await result
  } catch (error) {
    return error as Error
  }
  throw new Error('던지지도 거부하지도 않았다 — 조용한 no-op 이다')
}

// `ThemeAppearancePort` 는 step 1(theme-system)에서 이 목록을 떠났다 — 이제 실구현이 배선되므로
// 위 `WIRED` 가 그 자리를 본다.
const STAGE_THREE_PORTS: [string, Record<string, unknown>][] = [
  ['SystemBarsPort', notImplementedSystemBarsPort as unknown as Record<string, unknown>],
  ['BackGesturePort', notImplementedBackGesturePort as unknown as Record<string, unknown>],
]

describe('아직 매핑되지 않은 포트 — 3단계(뷰 레이어) 몫 둘', () => {
  const cases = STAGE_THREE_PORTS.flatMap(([portName, port]) =>
    Object.keys(port).map((method) => [portName, method, port[method]] as const),
  )

  it('둘의 메서드를 빠짐없이 검사한다', () => {
    expect(cases.map(([portName, method]) => `${portName}.${method}`)).toEqual([
      'SystemBarsPort.setNavigationBarStyle',
      'SystemBarsPort.refreshSafeAreaInsets',
      'BackGesturePort.setEnabled',
      'BackGesturePort.moveToBackground',
      'BackGesturePort.addListeners',
    ])
  })

  it.each(cases)('%s.%s() 는 조용히 넘어가지 않고 던진다', async (_portName, _method, fn) => {
    await expect(captureFailure(fn)).resolves.toBeInstanceOf(Error)
  })

  // 메시지가 없으면 "왜 안 되는지"를 코드에서 찾아야 한다. 이 셋은 3단계에서 채워진다.
  it.each(cases)('%s.%s() 의 메시지가 단계 3 을 가리킨다', async (portName, method, fn) => {
    const error = await captureFailure(fn)

    expect(error.message).toContain('단계 3')
    expect(error.message).toContain(`${portName}.${method}()`)
    expect(error.message).toContain('docs/migration/README.md')
  })
})

describe('아직 매핑되지 않은 포트 — LiveUpdatePort', () => {
  const cases = Object.keys(notImplementedLiveUpdatePort).map(
    (method) =>
      [method, (notImplementedLiveUpdatePort as unknown as Record<string, unknown>)[method]] as const,
  )

  it('여덟 메서드를 빠짐없이 검사한다', () => {
    expect(cases.map(([method]) => method)).toEqual([
      'isSupported',
      'notifyAppReady',
      'getCurrent',
      'httpGet',
      'download',
      'applyBundle',
      'getNetworkType',
      'openStore',
    ])
  })

  it.each(cases)('LiveUpdatePort.%s() 는 던진다', async (_method, fn) => {
    await expect(captureFailure(fn)).resolves.toBeInstanceOf(Error)
  })

  // 이쪽은 뷰 레이어가 아니라 **프로토콜**이 없다(@capgo → expo-updates). 3단계라고 말하면 틀린
  // 안내가 되므로 메시지가 갈려야 한다.
  it.each(cases)('LiveUpdatePort.%s() 는 단계 3 이 아니라 별도 ADR 을 가리킨다', async (method, fn) => {
    const error = await captureFailure(fn)

    expect(error.message).toContain('ADR-127')
    expect(error.message).toContain('결정 7')
    expect(error.message).toContain(`LiveUpdatePort.${method}()`)
    expect(error.message).not.toContain('단계 3')
  })
})

describe('시그니처에 맞는 실패 모양', () => {
  // 동기 시그니처라 Promise 를 돌려줄 수 없다. `isSupported()` 가 동기인 것 자체가 계약이다 —
  // 매니페스트를 받기 전에 판정해야 지원하지 않는 환경에서 네트워크가 안 나간다.
  it('isSupported · openStore 는 동기로 던진다', () => {
    expect(() => callBare(notImplementedLiveUpdatePort.isSupported)).toThrow()
    expect(() => callBare(notImplementedLiveUpdatePort.openStore)).toThrow()
  })

  // 동기 `throw` 로 두면 `await` 없이 `.catch()` 만 단 호출부에서 예외가 그대로 터진다
  // (`rn-hunting-timer.ts` 와 같은 판단).
  //
  // 호출을 **썽크로** 두고 하나씩 만들어 바로 소비한다 — 배열에 Promise 를 한꺼번에 만들어 두면
  // 중간에서 동기로 던졌을 때 앞엣것들이 처리되지 않은 거부로 남아 러너 자체가 죽는다(깨끗한
  // 실패로 안 보인다).
  const ASYNC_CALLS: [string, () => unknown][] = [
    [
      'SystemBarsPort.setNavigationBarStyle',
      () => notImplementedSystemBarsPort.setNavigationBarStyle(true),
    ],
    [
      'SystemBarsPort.refreshSafeAreaInsets',
      () => notImplementedSystemBarsPort.refreshSafeAreaInsets(),
    ],
    ['BackGesturePort.setEnabled', () => notImplementedBackGesturePort.setEnabled(true)],
    ['BackGesturePort.moveToBackground', () => notImplementedBackGesturePort.moveToBackground()],
    [
      'BackGesturePort.addListeners',
      () => notImplementedBackGesturePort.addListeners({ onInvoked: () => {} }),
    ],
    ['LiveUpdatePort.notifyAppReady', () => notImplementedLiveUpdatePort.notifyAppReady()],
    ['LiveUpdatePort.getCurrent', () => notImplementedLiveUpdatePort.getCurrent()],
    [
      'LiveUpdatePort.httpGet',
      () => notImplementedLiveUpdatePort.httpGet({ url: 'https://example.test' }),
    ],
    [
      'LiveUpdatePort.download',
      () =>
        notImplementedLiveUpdatePort.download(
          { url: 'https://example.test', version: '1.0.0', checksum: 'x' },
          () => {},
        ),
    ],
    ['LiveUpdatePort.applyBundle', () => notImplementedLiveUpdatePort.applyBundle('id')],
    ['LiveUpdatePort.getNetworkType', () => notImplementedLiveUpdatePort.getNetworkType()],
  ]

  it.each(ASYNC_CALLS)('%s 는 동기 throw 가 아니라 거부된 Promise 다', async (_label, call) => {
    let result: unknown
    expect(() => {
      result = call()
    }).not.toThrow()

    expect(result).toBeInstanceOf(Promise)
    await expect(result).rejects.toThrow()
  })
})
