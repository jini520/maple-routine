/**
 * 테스트 광고 판정에 넣을 값을 `EXPO_PUBLIC_*` 환경 변수에서 채우는 어댑터.
 *
 * 판정 자체는 `src/native/ads` 의 `shouldUseTestAds` 한 곳이고 여기는 인자만 채운다. 반환 키가
 * `VITE_` 인 것은 그 함수의 인자 이름이라서다.
 *
 * ⚠️ **테스트 빌드는 캐시를 비우고 만들 것**(`--clear` · `--reset-cache`). Metro 트랜스폼 캐시가
 * 이 값을 무효화하지 않아서, 캐시가 남으면 테스트 광고로 빌드한 줄 알고 **실 광고 번들이 나간다**
 * (번들 해시로 실측). 실 ID 로 자기 광고를 누르면 무효 트래픽으로 AdMob 계정이 정지된다.
 *
 * `__DEV__` 는 환경 변수를 대신하지 않고 테스트 광고 쪽으로만 기운다. 릴리스 빌드는
 * `__DEV__ === false` 라 이것만으로는 못 막는다.
 *
 * @see docs/features/ads.md 테스트 광고 정책
 */

import type { shouldUseTestAds } from '../ads'

/**
 * `shouldUseTestAds` 가 읽는 모양. 손으로 베끼지 않고 그 함수에서 뽑아 오므로, core 가 키 이름을
 * 바꾸면 런타임이 아니라 **tsc 에서** 먼저 깨진다(광고 ID 가 틀리는 실패는 화면에 증상이 없다).
 */
export type AdsEnv = Parameters<typeof shouldUseTestAds>[0]

export interface AdsEnvSource {
  /** RN 의 `__DEV__`. Metro 가 개발 번들에만 `true` 로 박는다. */
  isDevBundle: boolean
  /** `process.env.EXPO_PUBLIC_ADS_TEST` */
  adsTest: string | undefined
  /** `process.env.EXPO_PUBLIC_LIVE_UPDATE_CHANNEL` */
  liveUpdateChannel: string | undefined
}

export function toAdsEnv(source: AdsEnvSource): AdsEnv {
  return {
    VITE_ADS_TEST: source.isDevBundle ? '1' : source.adsTest,
    VITE_LIVE_UPDATE_CHANNEL: source.liveUpdateChannel,
  }
}
