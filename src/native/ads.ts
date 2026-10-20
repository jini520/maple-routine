/**
 * 광고 단위 ID 판정. 테스트 광고를 쓸지와 이 플랫폼에서 쓸 ID 를 고르는 순수 함수 둘.
 *
 * 부르는 곳은 어댑터(`adapters/rn-ads.ts`)다. 판정을 플랫폼 구현마다 복제하지 않으려고 여기 둔다.
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
 * **빌드 시점 환경 변수로 가른다.** 개발 플래그로 가르면 실기기 테스트 빌드에도 실 광고가
 * 나가고, 자기 광고를 한 번 누르는 순간 무효 트래픽으로 계정이 위험해진다.
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
