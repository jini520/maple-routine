import { AdMob } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

/**
 * AdMob 어댑터 ([[ADR-090]] 결정 4, [[ADR-005]]).
 *
 * `features/*`·`app/*` 은 이 파일만 부른다 — 플러그인을 직접 import 하지 않는다.
 * 웹(`npm run dev`)에서는 전부 no-op 이다. 가드가 없으면 개발 서버가 부팅 중 죽는다
 * (`native/splash-screen.ts` 와 같은 패턴).
 */

/**
 * Google 공식 **테스트** 광고 단위 — 실 ID 발급은 사용자 작업이다(AdMob 앱 등록 필요).
 * 출시 전에 반드시 교체할 것. 테스트 ID는 AdMob 계정과 무관해 무효 트래픽 위험이 없다.
 */
const TEST_INTERSTITIAL_AD_ID = {
  android: 'ca-app-pub-3940256099942544/1033173712',
  ios: 'ca-app-pub-3940256099942544/4411468910',
} as const

/**
 * 플러그인이 "로드됐는지" 묻는 API를 주지 않는다 — `prepareInterstitial`/`showInterstitial`
 * 둘뿐이라 준비 상태를 여기서 들고 있는다. prepare 가 resolve 하면 준비됨, 표시하면 소진.
 */
let isLoaded = false

function adId(): string | null {
  const platform = Capacitor.getPlatform()
  if (platform === 'android') return TEST_INTERSTITIAL_AD_ID.android
  if (platform === 'ios') return TEST_INTERSTITIAL_AD_ID.ios
  return null
}

/** SDK 초기화. 실패해도 던지지 않는다 — 광고 때문에 부팅이 막히면 안 된다. */
export async function initializeAds(): Promise<void> {
  if (adId() === null) return
  try {
    await AdMob.initialize()
  } catch {
    // 초기화 실패는 광고 없음으로 끝난다. isLoaded 가 false 로 남아 게이트가 알아서 막는다.
  }
}

/**
 * 다음 광고를 미리 받아둔다. 표시 직전이 아니라 **미리** 부르는 것이 요점이다 — 탭을 누른 뒤
 * 요청하면 왕복 동안 화면이 먼저 바뀌고 그 위를 광고가 덮는다(정책 위반 형태).
 */
export async function loadInterstitial(): Promise<void> {
  const id = adId()
  if (id === null || isLoaded) return
  try {
    await AdMob.prepareInterstitial({ adId: id })
    isLoaded = true
  } catch {
    isLoaded = false
  }
}

export function isInterstitialLoaded(): boolean {
  return isLoaded
}

/**
 * 준비된 광고를 표시한다. 표시 여부를 boolean 으로 돌려주므로, 호출부는 **실제로 떴을 때만**
 * 마지막 노출 시각을 기록할 수 있다(안 떴는데 기록하면 30분간 광고가 통째로 죽는다).
 */
export async function showInterstitial(): Promise<boolean> {
  if (adId() === null || !isLoaded) return false
  try {
    await AdMob.showInterstitial()
    return true
  } catch {
    return false
  } finally {
    // 성공이든 실패든 이 광고는 소진됐다고 본다 — 실패한 광고를 다시 보여주려 매달리면
    // 같은 실패를 반복한다. 다음 것을 새로 받는 편이 낫다.
    isLoaded = false
  }
}
