/**
 * `AdsPort` 의 RN 구현(— 밖으로 나가는 시그니처는 Capacitor 구현과 한 글자도
 * 다르지 않다). ID 배선과 테스트 광고 판정은 `features/ads.md`.
 *
 * ## 지금 이 어댑터를 부르는 곳은 **없다**
 *
 * app-rn 은 전면광고를 걷었다. 노출 지점도, 부팅 사전 로드도 없다. 그런데도 이 파일과 `app.json`
 * 의 앱 ID·`app-ads.txt`·테스트 광고 강제를 **남긴 것은 인라인 광고가 그대로 물려받을 배선**이기
 * 때문이다(결정 2). 아래 실 ID 로 자기 광고를 누르면 계정이 정지된다 는 위험은 **포맷과 무관**
 * 하므로 그 방어선도 함께 선다. 인라인을 붙일 때 `initialize()` 를 부를 자리를 새로 정해야 한다 —
 * 그 호출을 하던 `AppShell` 의 `startAds()` 가 사라졌다.
 *
 * **광고 단위 ID 결정은 이 파일에 없다.** `src/native/ads` 의 순수 함수 둘을 그대로 부른다 —
 * `shouldUseTestAds`(테스트 광고인가)와 `resolveInterstitialAdId`(그래서 어느 ID 인가). 이 프로젝트에서
 * 가장 비싼 실수는 실 ID 로 자기 광고를 누르는 것이고(무효 트래픽 → AdMob 계정 정지, 되돌리기 매우
 * 어려움) 그것을 막는 것이 저 두 함수뿐이라, 플랫폼 구현마다 복제되면 한쪽만 틀려도 사고가 난다.
 * 그래서 이 패키지의 `src/` 에는 광고 단위 ID 문자열이 **한 글자도 없다**(주석에도 없다. 저장소
 * 전체 검색으로 지키는 규칙이라 예시로도 적지 않는다).
 *
 * `null` 이 곧 no-op 스위치인 것도 Capacitor 구현과 같다. 다만 RN 앱이 빌드하는 타깃은 android·ios
 * 둘뿐이라 실제로 `null` 이 나오는 경로는 테스트뿐이고, 그래도 세 메서드가 각자 확인한다(웹 폴백을
 * 지운 자리에서 조용히 SDK 를 건드리게 두지 않는다).
 *
 * ---
 *
 * ## Capacitor 플러그인과 다른 점 — 로드 완료를 **이벤트로** 안다
 *
 * `AdMob.prepareInterstitial()` 은 로드가 끝나야 resolve 하는 하나의 Promise 였다. RN 쪽
 * `InterstitialAd` 는 `load()` 가 즉시 반환하고 결과가 `LOADED`/`ERROR` 이벤트로 오므로, 그 둘을
 * 기다려 **같은 계약**(준비됐으면 `true`)으로 되돌린다. 리스너는 `load()` **전에** 붙인다.
 *
 * 타임아웃은 두지 않는다. Capacitor 쪽도 두지 않았고(플러그인 Promise 가 로드 콜백에 그대로 매여
 * 있었다), AdMob SDK 는 노필·네트워크 실패도 실패 콜백으로 돌려준다. 없는 실패 모드에 방어 코드를
 * 미리 만들지 않는다.
 *
 * **검증되지 않은 것**. 실기기에서 광고가 실제로 뜨는 것. 아래 테스트가 흉내 내는 것은 SDK 의
 * 동작이 아니라 **SDK 가 우리에게 주는 모양**뿐이고, 그 위의 런타임은 실기기 몫이다. 스토어 게시
 * 전에는 AdMob 이 *"limited ad serving"* 이라 광고가 안 뜨는 것이 버그가 아니라는 점도 함께
 * 기억할 것.
 */

import { Platform } from 'react-native'
import mobileAds, { AdEventType, InterstitialAd } from 'react-native-google-mobile-ads'

import { resolveInterstitialAdId, shouldUseTestAds } from '../ads'
import type { AdsPort } from '../ports'

import { toAdsEnv } from './ads-env'

/**
 * 이 빌드와 이 플랫폼에서 쓸 광고 단위 ID. 판정은 `native/ads.ts` 가 하고 여기서는 값만 모아
 * 넘긴다.
 *
 * **환경 변수를 여기서 읽는 이유**는 `babel-preset-expo` 가 `process.env.EXPO_PUBLIC_*` 을 번들에
 * 리터럴로 바꿔 넣기 때문이다. 키를 변수로 만들거나 객체로 감싸면 치환이 안 되고 값이 비어서
 * 나간다. 그래서 이 네 줄은 반드시 `process.env.EXPO_PUBLIC_이름` 형태 그대로여야 한다.
 *
 * 실 광고 단위 ID 두 개는 저장소에 없다. 빌드할 때 넣고, 안 넣으면 광고가 안 나간다.
 * `__DEV__` 를 함께 넘기는 이유는 `ads-env.ts` 위쪽 주석에 있다.
 */
function adId(): string | null {
  return resolveInterstitialAdId(
    Platform.OS,
    shouldUseTestAds(
      toAdsEnv({
        isDevBundle: __DEV__,
        adsTest: process.env.EXPO_PUBLIC_ADS_TEST,
        liveUpdateChannel: process.env.EXPO_PUBLIC_LIVE_UPDATE_CHANNEL,
      }),
    ),
    {
      android: process.env.EXPO_PUBLIC_ADS_INTERSTITIAL_ANDROID,
      ios: process.env.EXPO_PUBLIC_ADS_INTERSTITIAL_IOS,
    },
  )
}

/**
 * 사전 로드해 둔 광고. 플러그인이 "로드됐는지" 묻는 API 를 주지 않아 어댑터가 들고 있는 것은
 * Capacitor 시절과 같고, RN 에서는 그 대상이 플래그가 아니라
 * **광고 인스턴스**다. `show()` 를 그 인스턴스에 걸어야 하기 때문이다.
 */
let loadedAd: InterstitialAd | null = null

export const rnAdsPort: AdsPort = {
  async initialize() {
    if (adId() === null) return
    await mobileAds().initialize()
  },

  async prepareInterstitial() {
    const id = adId()
    if (id === null) return false

    try {
      const ad = InterstitialAd.createForAdRequest(id)
      const loaded = await new Promise<boolean>((resolve) => {
        const unsubscribes: (() => void)[] = []
        const settle = (result: boolean): void => {
          for (const unsubscribe of unsubscribes) unsubscribe()
          resolve(result)
        }
        // 리스너를 먼저 붙이고 `load()` 는 마지막이다. 순서가 바뀌면 즉시 도착한 결과를 놓쳐
        // 이 Promise 가 영영 안 풀린다.
        unsubscribes.push(ad.addAdEventListener(AdEventType.LOADED, () => settle(true)))
        unsubscribes.push(ad.addAdEventListener(AdEventType.ERROR, () => settle(false)))
        ad.load()
      })

      loadedAd = loaded ? ad : null
      return loaded
    } catch {
      // 로드 실패는 광고 없음으로 끝난다. 던지면 이 포트를 부르는 쪽이 함께 흔들린다.
      loadedAd = null
      return false
    }
  },

  async showInterstitial() {
    if (adId() === null) return false

    const ad = loadedAd
    // 성공이든 실패든 이 광고는 소진됐다고 본다(core `showInterstitial` 의 `finally` 와 같은 판단) —
    // 실패한 광고를 다시 띄우려 매달리면 같은 실패를 반복한다.
    loadedAd = null
    if (ad === null) return false

    try {
      await ad.show()
      return true
    } catch {
      // **떴는지 안 떴는지가 전부다.** 안 떴는데 `true` 를 주면 호출부가 노출 시각을 기록해
      // 30분간 광고가 통째로 죽는다. 그리고 던지면 안 된다. 광고 실패가
      // 탭 이동을 깨뜨리지 않는다는 전제 위에 `features/ads/tab-switch-ad.ts` 가 서 있다.
      return false
    }
  },
}
