import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveInterstitialAdId, shouldUseTestAds } from '../ads'

/**
 * 광고 ID는 **세 곳**에 흩어져 있고(어댑터 · AndroidManifest · Info.plist), 셋 중 하나만 틀려도
 * 증상이 조용하다 — 테스트 ID가 남으면 수익이 0인 채로 정상 동작하고, 앱 ID가 샘플로 남으면
 * SDK가 초기화에서 죽는다. 어느 쪽도 화면에서는 안 보이므로 여기서 잡는다.
 */

/** Google 공식 테스트 광고의 퍼블리셔 ID. 프로덕션 산출물에 이게 남아 있으면 실패다. */
const GOOGLE_TEST_PUBLISHER = '3940256099942544'
/** Google 문서의 샘플 앱 ID — 개발 중 자리채움으로 쓰였다. */
const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713'

const PUBLISHER = '5278246170608284'

function read(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
}

const MANIFEST = read('../../../android/app/src/main/AndroidManifest.xml')
const INFO_PLIST = read('../../../ios/App/App/Info.plist')

/**
 * 테스트 광고 게이트는 **빌드 시점 환경 변수**로만 판정한다.
 *
 * `import.meta.env.DEV` 를 쓰던 초안은 실제로 아무것도 막지 못했다 — Vite가 `vite build`
 * 산출물에서 그 값을 항상 `false` 로 치환하는데, Capacitor 앱은 개발 중에도 언제나 빌드된
 * 번들로 돌기 때문이다(프로덕션 번들에서 `Tu(getPlatform(), !1)` 로 치환된 것을 확인).
 * 즉 실기기 테스트 빌드에도 실 광고가 나가고 있었다.
 */
describe('shouldUseTestAds', () => {
  it('기본 빌드는 실 광고를 쓴다', () => {
    expect(shouldUseTestAds({})).toBe(false)
  })

  it('VITE_ADS_TEST=1 이면 테스트 광고를 쓴다', () => {
    expect(shouldUseTestAds({ VITE_ADS_TEST: '1' })).toBe(true)
  })

  it('베타 채널 빌드는 테스트 광고를 쓴다 — 정의상 스토어에 나가지 않는다', () => {
    expect(shouldUseTestAds({ VITE_LIVE_UPDATE_CHANNEL: 'beta' })).toBe(true)
  })

  it('production 채널 빌드는 실 광고를 쓴다', () => {
    expect(shouldUseTestAds({ VITE_LIVE_UPDATE_CHANNEL: 'production' })).toBe(false)
  })
})

describe('resolveInterstitialAdId', () => {
  it('테스트 광고 빌드는 플랫폼과 무관하게 Google 테스트 ID를 쓴다', () => {
    // 실 ID로 자기 광고를 누르면 무효 트래픽으로 계정이 정지된다 — 이 프로젝트에서 가장
    // 비싼 실수라 게이트를 여기 둔다.
    expect(resolveInterstitialAdId('android', true)).toContain(GOOGLE_TEST_PUBLISHER)
    expect(resolveInterstitialAdId('ios', true)).toContain(GOOGLE_TEST_PUBLISHER)
  })

  it('스토어 빌드는 실 광고 단위를 쓴다', () => {
    expect(resolveInterstitialAdId('android', false)).toBe(`ca-app-pub-${PUBLISHER}/7028964814`)
    expect(resolveInterstitialAdId('ios', false)).toBe(`ca-app-pub-${PUBLISHER}/9084282510`)
  })

  it('프로덕션 빌드에 Google 테스트 퍼블리셔가 남아 있지 않다', () => {
    // 테스트 ID를 실수로 출시하면 앱은 멀쩡히 돌고 광고도 뜨는데 수익만 0이다 — 조용해서 위험하다.
    expect(resolveInterstitialAdId('android', false)).not.toContain(GOOGLE_TEST_PUBLISHER)
    expect(resolveInterstitialAdId('ios', false)).not.toContain(GOOGLE_TEST_PUBLISHER)
  })

  it('안드로이드와 iOS는 서로 다른 광고 단위를 쓴다', () => {
    // AdMob은 플랫폼별로 앱을 따로 등록한다. 한쪽 ID를 양쪽에 쓰면 정책 위반이다.
    expect(resolveInterstitialAdId('android', false)).not.toBe(resolveInterstitialAdId('ios', false))
  })

  it('네이티브가 아닌 플랫폼에서는 null 이다', () => {
    // 웹(npm run dev)에는 AdMob이 없다. null 이 어댑터 전체의 no-op 스위치 역할을 한다.
    expect(resolveInterstitialAdId('web', false)).toBeNull()
  })
})

describe('네이티브 앱 ID 설정', () => {
  it('AndroidManifest 에 실제 AdMob 앱 ID가 있다', () => {
    expect(MANIFEST).toContain(`ca-app-pub-${PUBLISHER}~4314603345`)
  })

  it('Info.plist 에 실제 AdMob 앱 ID가 있다', () => {
    expect(INFO_PLIST).toContain(`ca-app-pub-${PUBLISHER}~7370911447`)
  })

  it('네이티브 설정에 Google 샘플 앱 ID가 남아 있지 않다', () => {
    // 샘플 앱 ID를 그대로 출시하면 광고가 우리 계정으로 잡히지 않는다.
    expect(MANIFEST).not.toContain(SAMPLE_APP_ID)
    expect(INFO_PLIST).not.toContain(SAMPLE_APP_ID)
  })

  it('두 플랫폼의 앱 ID가 서로 다르다', () => {
    const android = /ca-app-pub-\d+~\d+/.exec(MANIFEST)?.[0]
    const ios = /ca-app-pub-\d+~\d+/.exec(INFO_PLIST)?.[0]
    expect(android).toBeDefined()
    expect(ios).toBeDefined()
    expect(android).not.toBe(ios)
  })
})

describe('iOS 스토어 제출 설정', () => {
  it('SKAdNetwork 목록에 Google 식별자가 있다', () => {
    // Google Mobile Ads SDK 필수 항목이다. 빠져도 앱은 멀쩡히 돌지만 iOS 기여 분석이
    // 안 돼 수익이 낮게 잡힌다 — 또 하나의 "증상 없는" 실패라 여기서 잡는다.
    expect(INFO_PLIST).toContain('cstr6suwn9.skadnetwork')
  })

  it('SKAdNetwork 식별자를 40개 이상 선언한다', () => {
    const count = [...INFO_PLIST.matchAll(/<string>[a-z0-9]+\.skadnetwork<\/string>/g)].length
    expect(count).toBeGreaterThanOrEqual(40)
  })

  it('ATT 문구를 넣지 않는다 — 추적 권한을 요청하지 않기로 했다', () => {
    // 2026-08-04 결정: 추적 권한을 요청하지 않고 비개인화 광고만 받는다.
    // 이 키가 들어왔다는 건 누군가 ATT를 붙였다는 뜻이고, 그렇다면 프롬프트 표시 시점·문구가
    // Apple 규칙을 지키는지 다시 봐야 한다. 조용히 늘어나지 않게 여기서 막는다.
    //
    // `<key>` 요소로 검사하는 이유 — plist 주석이 이 이름을 언급하기 때문이다. 단순 부분
    // 문자열로 보면 "왜 이 키를 안 넣었는지" 설명하는 주석 자체가 테스트를 깨뜨린다.
    expect(INFO_PLIST).not.toContain('<key>NSUserTrackingUsageDescription</key>')
  })

  it('수출 규정 준수 키를 선언한다', () => {
    // 없으면 빌드를 올릴 때마다 App Store Connect가 같은 질문을 반복한다.
    expect(INFO_PLIST).toContain('<key>ITSAppUsesNonExemptEncryption</key>')
  })
})
