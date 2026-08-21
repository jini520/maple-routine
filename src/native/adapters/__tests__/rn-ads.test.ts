/// <reference types="node" />
// 순수 규칙(`ads-env.test.ts`)이 지키는 것은 "어느 빌드가 실 광고를 쓰는가" 이고, 이 파일이
// 지키는 것은 둘이다 — **어댑터가 그 판정을 스스로 다시 쓰지 않는가**(광고 단위 ID 를 core 에서만
// 가져오는가)와 **포트 계약을 지키는가**(`showInterstitial()` 이 안 떴는데 `true` 를 주면 호출부가
// 노출 시각을 기록해 30분간 광고가 통째로 죽는다 — [[ADR-090]] 결정 3).
//
// 목으로 흉내 내는 것은 AdMob 의 동작이 아니라 **SDK 가 우리에게 주는 모양**뿐이다
// (`createForAdRequest` 가 받는 ID, `load()` 뒤에 오는 `LOADED`/`ERROR` 이벤트, `show()` 의 Promise).
// 열거형은 손으로 베끼지 않고 라이브러리의 부작용 없는 하위 모듈에서 진짜 값을 끌어온다 —
// 베끼면 상상한 값을 검사하게 된다(step 3 notifee 목과 같은 판단).
//
// jest 기본 플랫폼은 ios 이고 `__DEV__` 는 true 다. 아래에서 둘 다 명시적으로 바꿔 가며 본다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Platform } from 'react-native'

import { resolveInterstitialAdId } from '@core/native/ads'

// `mock` 접두사는 필수다 — `jest.mock` 팩토리가 위로 끌어올려지므로 babel 이 그 접두사가 붙은
// 것만 바깥 변수 참조로 허용한다.
interface MockAd {
  adUnitId: string
  listeners: { type: string; listener: () => void }[]
  loadCount: number
  showCount: number
}

const mockAds: MockAd[] = []
const mockInitialize = jest.fn(async () => {})
let mockLoadResult: 'loaded' | 'error' = 'loaded'
let mockCreateThrows = false
let mockShowThrows = false

jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: mockInitialize }),
  AdEventType: jest.requireActual('react-native-google-mobile-ads/lib/commonjs/AdEventType')
    .AdEventType,
  InterstitialAd: {
    createForAdRequest: (adUnitId: string) => {
      if (mockCreateThrows) throw new Error('createForAdRequest failed')
      const ad: MockAd = { adUnitId, listeners: [], loadCount: 0, showCount: 0 }
      mockAds.push(ad)
      return {
        addAdEventListener: (type: string, listener: () => void) => {
          const entry = { type, listener }
          ad.listeners.push(entry)
          return () => {
            ad.listeners = ad.listeners.filter((it) => it !== entry)
          }
        },
        // 실제 SDK 는 비동기로 이벤트를 주지만 여기서는 동기로 쏜다 — 리스너를 `load()` **뒤에**
        // 붙이는 구현이면 결과를 놓쳐 곧바로 타임아웃으로 드러난다.
        load: () => {
          ad.loadCount += 1
          for (const it of [...ad.listeners]) {
            if (it.type === mockLoadResult) it.listener()
          }
        },
        show: async () => {
          ad.showCount += 1
          if (mockShowThrows) throw new Error('has not loaded and could not be shown')
        },
      }
    },
  },
}))

import type { AdsPort } from '@core/native/ports'

/**
 * 어댑터는 사전 로드한 광고를 **모듈 수준 상태**로 들고 있다(플러그인이 로드 여부를 묻는 API 를
 * 안 준다 — `features/ads.md`). 그래서 테스트마다 모듈을 새로 평가한다. 상태를 비우는 전용
 * export 를 두지 않은 것은, 제품 코드에 테스트용 문을 내는 대신 여기서 격리할 수 있어서다.
 */
let rnAdsPort: AdsPort

function setPlatform(os: string): void {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true, writable: true })
}

function setDevBundle(isDev: boolean): void {
  ;(globalThis as unknown as { __DEV__: boolean }).__DEV__ = isDev
}

const originalPlatform = Platform.OS
const originalDev = __DEV__

beforeEach(() => {
  // `jest.requireActual` 인 것은 취향이 아니다 — 이 러너에서 동적 `import()` 는 `require` 로 안
  // 내려가고(`--experimental-vm-modules` 필요), 그렇다고 `require` 를 직접 쓰면 lint 가 막는다.
  // 여기서 되살리려는 것은 `../rn-ads` 뿐이고 그 의존(SDK)은 위 `jest.mock` 이 계속 덮는다.
  jest.resetModules()
  ;({ rnAdsPort } = jest.requireActual('../rn-ads') as { rnAdsPort: AdsPort })

  mockAds.length = 0
  mockInitialize.mockClear()
  mockLoadResult = 'loaded'
  mockCreateThrows = false
  mockShowThrows = false
  setPlatform(originalPlatform)
  setDevBundle(originalDev)
  // 셸에 남아 있는 값이 판정을 흔들지 않게 한다 — 이 파일이 보는 것은 `__DEV__` 축이다.
  delete process.env.EXPO_PUBLIC_ADS_TEST
  delete process.env.EXPO_PUBLIC_LIVE_UPDATE_CHANNEL
})

afterAll(() => {
  setPlatform(originalPlatform)
  setDevBundle(originalDev)
})

describe('광고 단위 ID 는 core 가 정한다', () => {
  // 이 파일에 ID 문자열이 없다는 것이 요점이다. 기대값도 core 함수에서 뽑는다 — 손으로 적으면
  // 그 순간 방어선이 두 벌이 되고, 한쪽만 틀려도 실 ID 로 자기 광고를 누르게 된다.
  it.each(['ios', 'android'])('%s 에서 core 가 준 ID 로 광고를 만든다', async (os) => {
    setPlatform(os)
    setDevBundle(true)

    await expect(rnAdsPort.prepareInterstitial()).resolves.toBe(true)

    expect(mockAds).toHaveLength(1)
    expect(mockAds[0].adUnitId).toBe(resolveInterstitialAdId(os, true))
  })

  it('개발 번들은 테스트 광고 단위를 쓴다', async () => {
    setDevBundle(true)
    await rnAdsPort.prepareInterstitial()

    expect(mockAds[0].adUnitId).toBe(resolveInterstitialAdId(Platform.OS, true))
    expect(mockAds[0].adUnitId).not.toBe(resolveInterstitialAdId(Platform.OS, false))
  })

  // 반대편 — 환경 변수가 없는 릴리스 번들은 실 광고 단위를 쓴다. 이게 뒤집히면 수익이 0이 된다.
  it('릴리스 번들은 환경 변수가 없으면 실 광고 단위를 쓴다', async () => {
    setDevBundle(false)
    await rnAdsPort.prepareInterstitial()

    expect(mockAds[0].adUnitId).toBe(resolveInterstitialAdId(Platform.OS, false))
  })

  it('EXPO_PUBLIC_ADS_TEST 를 읽는다', async () => {
    setDevBundle(false)
    process.env.EXPO_PUBLIC_ADS_TEST = '1'
    await rnAdsPort.prepareInterstitial()

    expect(mockAds[0].adUnitId).toBe(resolveInterstitialAdId(Platform.OS, true))
  })
})

describe('광고를 쓸 수 없는 플랫폼', () => {
  // `resolveInterstitialAdId` 가 `null` 을 주는 플랫폼이면 SDK 를 아예 건드리지 않는다.
  // 세 메서드가 각자 확인한다 — 하나라도 새면 그 자리에서 SDK 가 없다고 터진다.
  it('SDK 를 건드리지 않고 조용히 넘어간다', async () => {
    setPlatform('web')

    await expect(rnAdsPort.initialize()).resolves.toBeUndefined()
    await expect(rnAdsPort.prepareInterstitial()).resolves.toBe(false)
    await expect(rnAdsPort.showInterstitial()).resolves.toBe(false)

    expect(mockInitialize).not.toHaveBeenCalled()
    expect(mockAds).toHaveLength(0)
  })
})

describe('initialize', () => {
  it('네이티브에서는 SDK 를 초기화한다', async () => {
    await rnAdsPort.initialize()
    expect(mockInitialize).toHaveBeenCalledTimes(1)
  })
})

describe('prepareInterstitial', () => {
  it('로드되면 true 다', async () => {
    mockLoadResult = 'loaded'
    await expect(rnAdsPort.prepareInterstitial()).resolves.toBe(true)
    expect(mockAds[0].loadCount).toBe(1)
  })

  it('로드 실패는 던지지 않고 false 다', async () => {
    mockLoadResult = 'error'
    await expect(rnAdsPort.prepareInterstitial()).resolves.toBe(false)
  })

  // 던지면 이 포트를 부르는 쪽이 함께 흔들린다 — 광고는 실패해도 앱을 멈추지 않는다.
  it('광고 생성 자체가 던져도 false 다', async () => {
    mockCreateThrows = true
    await expect(rnAdsPort.prepareInterstitial()).resolves.toBe(false)
  })

  // 리스너를 남겨 두면 같은 광고의 다음 이벤트(만료·클릭)가 이미 끝난 Promise 를 다시 건드린다.
  it('결과가 오면 리스너를 정리한다', async () => {
    await rnAdsPort.prepareInterstitial()
    expect(mockAds[0].listeners).toHaveLength(0)
  })
})

describe('showInterstitial', () => {
  it('준비된 광고가 없으면 false 다', async () => {
    await expect(rnAdsPort.showInterstitial()).resolves.toBe(false)
    expect(mockAds).toHaveLength(0)
  })

  it('로드 실패한 뒤에도 false 다', async () => {
    mockLoadResult = 'error'
    await rnAdsPort.prepareInterstitial()

    await expect(rnAdsPort.showInterstitial()).resolves.toBe(false)
    expect(mockAds[0].showCount).toBe(0)
  })

  it('준비된 그 광고를 띄우고 true 를 준다', async () => {
    await rnAdsPort.prepareInterstitial()

    await expect(rnAdsPort.showInterstitial()).resolves.toBe(true)
    expect(mockAds).toHaveLength(1)
    expect(mockAds[0].showCount).toBe(1)
  })

  // 한 번 띄운 광고는 소진된다. 두 번째에 true 를 주면 뜨지도 않은 광고의 노출 시각이 기록돼
  // 30분간 광고가 통째로 죽는다.
  it('같은 광고를 두 번 띄우지 않는다', async () => {
    await rnAdsPort.prepareInterstitial()
    await rnAdsPort.showInterstitial()

    await expect(rnAdsPort.showInterstitial()).resolves.toBe(false)
    expect(mockAds[0].showCount).toBe(1)
  })

  // 표시 실패는 "안 떴다"이지 예외가 아니다 — `features/ads/tab-switch-ad.ts` 는 광고 실패가
  // 탭 이동을 깨뜨리지 않는다는 전제 위에 서 있다.
  it('표시가 실패해도 거부하지 않고 false 다', async () => {
    mockShowThrows = true
    await rnAdsPort.prepareInterstitial()

    await expect(rnAdsPort.showInterstitial()).resolves.toBe(false)
  })

  it('표시가 실패해도 그 광고는 소진된다', async () => {
    mockShowThrows = true
    await rnAdsPort.prepareInterstitial()
    await rnAdsPort.showInterstitial()

    mockShowThrows = false
    await expect(rnAdsPort.showInterstitial()).resolves.toBe(false)
  })
})

/**
 * 앱 ID(`~`)는 광고 **단위** ID 와 별개로 네이티브 설정에 있어야 하고, 없으면 SDK 가 부팅 시
 * 크래시한다. 여기서는 두 자리(`app.json` 선언 · prebuild 가 쓴 `AndroidManifest`)가 어긋나지
 * 않는지 본다 — `app.json` 만 고치고 prebuild 를 안 돌리면 커밋된 매니페스트에 **옛 ID 가 남고**
 * 그 실패는 화면 어디에도 안 나타난다(Capacitor 쪽 `native/__tests__/ads.test.ts` 와 같은 계열).
 */
describe('네이티브 앱 ID 설정', () => {
  const packageRoot = join(__dirname, '../../../..')

  const appJson = JSON.parse(readFileSync(join(packageRoot, 'app.json'), 'utf8')) as {
    expo: { plugins: [string, Record<string, unknown>][] }
  }
  const manifest = readFileSync(
    join(packageRoot, 'android/app/src/main/AndroidManifest.xml'),
    'utf8',
  )
  const infoPlist = readFileSync(join(packageRoot, 'ios/app/Info.plist'), 'utf8')

  const options = appJson.expo.plugins.find(
    ([name]) => name === 'react-native-google-mobile-ads',
  )?.[1]

  it('app.json 이 두 플랫폼의 앱 ID 를 선언한다', () => {
    expect(options).toBeDefined()
    // 앱 ID 는 `~`, 광고 단위 ID 는 `/` 다. 둘을 바꿔 넣으면 SDK 가 초기화에서 죽는다.
    expect(options?.androidAppId).toEqual(expect.stringContaining('~'))
    expect(options?.iosAppId).toEqual(expect.stringContaining('~'))
  })

  // AdMob 은 Android 와 iOS 를 **별개 앱**으로 등록한다. 한쪽 ID 를 양쪽에 쓰면 정책 위반이다.
  it('두 플랫폼의 앱 ID 가 서로 다르다', () => {
    expect(options?.androidAppId).not.toBe(options?.iosAppId)
  })

  it('AndroidManifest 가 app.json 과 같은 앱 ID 를 담는다', () => {
    expect(manifest).toContain(`"${String(options?.androidAppId)}"`)
  })

  it('Info.plist 가 app.json 과 같은 앱 ID 를 담는다', () => {
    expect(infoPlist).toContain(`<string>${String(options?.iosAppId)}</string>`)
  })

  // Google 테스트 퍼블리셔의 샘플 앱 ID 를 그대로 출시하면 광고가 우리 계정으로 잡히지 않는다.
  it('Google 샘플 앱 ID 가 아니다', () => {
    const googleTestPublisher = '3940256099942544'
    expect(String(options?.androidAppId)).not.toContain(googleTestPublisher)
    expect(String(options?.iosAppId)).not.toContain(googleTestPublisher)
  })

  // 2026-08-04 결정: 추적 권한을 요청하지 않고 비개인화 광고만 받는다([[ADR-090]]). 이 옵션이
  // 들어왔다는 건 누군가 ATT 를 붙였다는 뜻이고, 그러면 프롬프트 시점·문구가 Apple 규칙을
  // 지키는지 다시 봐야 한다. 조용히 늘어나지 않게 여기서 막는다.
  it('ATT 문구를 넣지 않는다', () => {
    expect(options?.userTrackingUsageDescription).toBeUndefined()
  })
})
