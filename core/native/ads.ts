import { getAdsPort } from './ports'

/**
 * AdMob 어댑터 ([[ADR-090]] 결정 4, [[ADR-005]]).
 *
 * `features/*`·`app/*` 은 이 파일만 부른다 — 플러그인을 직접 import 하지 않는다.
 * 웹(`npm run dev`)에서는 전부 no-op 이다. 가드가 없으면 개발 서버가 부팅 중 죽는데, 그 판정은
 * 포트 구현(`adapters/capacitor-ads.ts`)이 아래 두 순수 함수로 내린다 — 광고를 쓸 수 없는 환경이면
 * `prepareInterstitial()` 이 `false` 를 돌려주므로 이 파일은 플랫폼을 알 필요가 없다.
 */

/**
 * 전면광고 단위 ID.
 *
 * **개발 빌드는 항상 테스트 ID를 쓴다** — 실 ID로 자기 광고를 누르면 무효 트래픽으로 AdMob 계정이
 * 정지될 수 있고, 그건 되돌리기가 매우 어렵다. Google 테스트 ID는 계정과 무관해 그 위험이 없다.
 *
 * 플랫폼별로 갈리는 이유는 AdMob이 **Android와 iOS를 별개 앱으로 등록**하기 때문이다 — 앱 ID도
 * 광고 단위 ID도 서로 다르고, 한쪽 ID를 양쪽에 쓰면 정책 위반이다.
 *
 * 앱 ID(`~` 가 들어가는 값)는 여기가 아니라 `AndroidManifest.xml` · `Info.plist` 에 있다.
 * 세 곳이 흩어져 있어 `__tests__/ads.test.ts` 가 드리프트를 잡는다.
 */
const INTERSTITIAL_AD_IDS = {
  test: {
    android: 'ca-app-pub-3940256099942544/1033173712',
    ios: 'ca-app-pub-3940256099942544/4411468910',
  },
  production: {
    android: 'ca-app-pub-5278246170608284/7028964814',
    ios: 'ca-app-pub-5278246170608284/9084282510',
  },
} as const

/**
 * 이 빌드가 테스트 광고를 써야 하는가.
 *
 * **`import.meta.env.DEV` 로는 안 된다.** Vite는 `vite build` 산출물에서 그 값을 항상 `false` 로
 * 치환하고, Capacitor 앱은 개발 중에도 **언제나 빌드된 번들**로 돈다 — 즉 `DEV` 로 가르면
 * 실기기 테스트 빌드에도 실 광고가 나가고, 자기 광고를 한 번 누르는 순간 무효 트래픽으로
 * 계정이 위험해진다. `DEV` 가 `true` 인 곳은 브라우저(`npm run dev`)뿐인데 거기서는 플랫폼이
 * `web` 이라 어댑터가 어차피 no-op 이다. 그래서 **빌드 시점 환경 변수**로 가른다.
 *
 * 베타 채널을 함께 보는 이유는 그 빌드가 정의상 스토어에 나가지 않기 때문이다(사이드로딩).
 */
export function shouldUseTestAds(env: {
  VITE_ADS_TEST?: string
  VITE_LIVE_UPDATE_CHANNEL?: string
}): boolean {
  return env.VITE_ADS_TEST === '1' || env.VITE_LIVE_UPDATE_CHANNEL === 'beta'
}

/**
 * 플랫폼·빌드에 맞는 광고 단위 ID. 네이티브가 아니면 `null` 이고, 그 `null` 이 이 어댑터
 * 전체의 no-op 스위치 역할을 한다(웹에는 AdMob이 없다).
 *
 * 순수 함수로 빼둔 것은 테스트 때문이다 — 잘못된 ID는 화면에 아무 증상도 남기지 않는다.
 */
export function resolveInterstitialAdId(platform: string, useTestAds: boolean): string | null {
  if (platform !== 'android' && platform !== 'ios') {
    return null
  }
  return INTERSTITIAL_AD_IDS[useTestAds ? 'test' : 'production'][platform]
}

/**
 * 플러그인이 "로드됐는지" 묻는 API를 주지 않는다 — `prepareInterstitial`/`showInterstitial`
 * 둘뿐이라 준비 상태를 여기서 들고 있는다. prepare 가 resolve 하면 준비됨, 표시하면 소진.
 */
let isLoaded = false

/** SDK 초기화. 실패해도 던지지 않는다 — 광고 때문에 부팅이 막히면 안 된다. */
export async function initializeAds(): Promise<void> {
  try {
    await getAdsPort().initialize()
  } catch {
    // 초기화 실패는 광고 없음으로 끝난다. isLoaded 가 false 로 남아 게이트가 알아서 막는다.
  }
}

/**
 * 다음 광고를 미리 받아둔다. 표시 직전이 아니라 **미리** 부르는 것이 요점이다 — 탭을 누른 뒤
 * 요청하면 왕복 동안 화면이 먼저 바뀌고 그 위를 광고가 덮는다(정책 위반 형태).
 */
export async function loadInterstitial(): Promise<void> {
  if (isLoaded) return
  try {
    // 광고를 쓸 수 없는 환경이면 포트가 false 를 돌려준다 — 그 자리가 옛 `adId() === null` 게이트다.
    isLoaded = await getAdsPort().prepareInterstitial()
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
  if (!isLoaded) return false
  try {
    return await getAdsPort().showInterstitial()
  } catch {
    return false
  } finally {
    // 성공이든 실패든 이 광고는 소진됐다고 본다 — 실패한 광고를 다시 보여주려 매달리면
    // 같은 실패를 반복한다. 다음 것을 새로 받는 편이 낫다.
    isLoaded = false
  }
}
