import { getAdsPort } from './ports'

/**
 * AdMob 어댑터.
 *
 * `features/*`·`app/*` 은 이 파일만 부른다. 플러그인을 직접 import 하지 않는다.
 * 웹(`npm run dev`)에서는 전부 no-op 이다. 가드가 없으면 개발 서버가 부팅 중 죽는데, 그 판정은
 * 포트 구현(`adapters/capacitor-ads.ts`)이 아래 두 순수 함수로 내린다. 광고를 쓸 수 없는 환경이면
 * `prepareInterstitial()` 이 `false` 를 돌려주므로 이 파일은 플랫폼을 알 필요가 없다.
 */

/**
 * Google이 공개한 테스트 광고 단위 ID. 계정과 무관한 고정값이라 코드에 그대로 둔다. 설정이
 * 아니고, 누가 눌러도 AdMob 계정에 영향이 없다.
 *
 * 실 광고 단위 ID는 여기 없다. 빌드할 때 환경 변수로 넣는다(`resolveInterstitialAdId` 참고).
 *
 * Android와 iOS가 서로 다른 이유는 AdMob이 두 플랫폼을 별개 앱으로 등록하기 때문이다. 한쪽
 * 값을 양쪽에 쓰면 정책 위반이다.
 */
const TEST_INTERSTITIAL_AD_IDS = {
  android: 'ca-app-pub-3940256099942544/1033173712',
  ios: 'ca-app-pub-3940256099942544/4411468910',
} as const

/**
 * 빌드할 때 환경 변수로 들어오는 실 광고 단위 ID. 두 값 모두 없을 수 있다.
 *
 * 값을 읽는 곳은 어댑터(`adapters/rn-ads.ts`)다. `process.env.EXPO_PUBLIC_*` 은
 * `babel-preset-expo` 가 번들에 리터럴로 바꿔 넣기 때문에, 키를 변수로 만들면 값이 안 들어간다.
 * 그래서 이 모듈은 값을 인자로 받기만 한다.
 */
export interface InterstitialAdIds {
  android: string | undefined
  ios: string | undefined
}

/**
 * 이 빌드가 테스트 광고를 써야 하는가.
 *
 * **`import.meta.env.DEV` 로는 안 된다.** Vite는 `vite build` 산출물에서 그 값을 항상 `false` 로
 * 치환하고, Capacitor 앱은 개발 중에도 **언제나 빌드된 번들**로 돈다. 즉 `DEV` 로 가르면
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
 * 이 플랫폼과 이 빌드에서 쓸 광고 단위 ID. `null` 이면 광고를 켜지 않는다. 어댑터가 이 값 하나로
 * SDK를 건드릴지 말지 판단한다.
 *
 * `null` 이 되는 경우는 둘이다.
 *
 * 1. 네이티브가 아닌 플랫폼.
 * 2. 실 광고를 써야 하는데 환경 변수가 비어 있는 경우. 잘못된 ID로 광고를 띄우는 것보다 안
 *    띄우는 편이 안전하다. 실제 ID로 자기 광고를 클릭하면 AdMob 계정이 정지될 수 있다.
 *
 * 순수 함수로 둔 이유는 테스트 때문이다. ID가 틀려도 화면에는 아무 표시가 없다.
 */
export function resolveInterstitialAdId(
  platform: string,
  useTestAds: boolean,
  productionIds: InterstitialAdIds,
): string | null {
  if (platform !== 'android' && platform !== 'ios') {
    return null
  }
  if (useTestAds) {
    return TEST_INTERSTITIAL_AD_IDS[platform]
  }
  // 셸에서 `EXPO_PUBLIC_...=` 로 비워 두면 빈 문자열이 들어온다. 그것을 ID로 쓰면 SDK가
  // 초기화 단계에서 죽으므로 없는 것으로 본다.
  return productionIds[platform] || null
}

/**
 * 플러그인이 "로드됐는지" 묻는 API를 주지 않는다. `prepareInterstitial`/`showInterstitial`
 * 둘뿐이라 준비 상태를 여기서 들고 있는다. prepare 가 resolve 하면 준비됨, 표시하면 소진.
 */
let isLoaded = false

/** SDK 초기화. 실패해도 던지지 않는다. 광고 때문에 부팅이 막히면 안 된다. */
export async function initializeAds(): Promise<void> {
  try {
    await getAdsPort().initialize()
  } catch {
    // 초기화 실패는 광고 없음으로 끝난다. isLoaded 가 false 로 남아 게이트가 알아서 막는다.
  }
}

/**
 * 다음 광고를 미리 받아두는 예열. 표시 직전이 아니라 미리 부르는 것이 요점이다. 탭을 누른 뒤
 * 요청하면 왕복 동안 화면이 먼저 바뀌고 그 위를 광고가 덮는다(정책 위반 형태).
 */
export async function loadInterstitial(): Promise<void> {
  if (isLoaded) return
  try {
    // 광고를 쓸 수 없는 환경이면 포트가 false 를 돌려준다. 그 자리가 옛 `adId() === null` 게이트다.
    isLoaded = await getAdsPort().prepareInterstitial()
  } catch {
    isLoaded = false
  }
}

export function isInterstitialLoaded(): boolean {
  return isLoaded
}

/**
 * 준비된 광고 표시. 표시 여부를 boolean 으로 돌려주므로, 호출부는 **실제로 떴을 때만**
 * 마지막 노출 시각을 기록할 수 있다(안 떴는데 기록하면 30분간 광고가 통째로 죽는다).
 */
export async function showInterstitial(): Promise<boolean> {
  if (!isLoaded) return false
  try {
    return await getAdsPort().showInterstitial()
  } catch {
    return false
  } finally {
    // 성공이든 실패든 이 광고는 소진됐다고 본다. 실패한 광고를 다시 보여주려 매달리면
    // 같은 실패를 반복한다. 다음 것을 새로 받는 편이 낫다.
    isLoaded = false
  }
}
