import { AdMob } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'
import { resolveInterstitialAdId, shouldUseTestAds } from '@core/native/ads'
import type { AdsPort } from '@core/native/ports'

/**
 * `AdsPort` 의 Capacitor 구현([[ADR-128]], [[ADR-090]] 결정 4).
 *
 * 웹(`npm run dev`)에서는 전부 no-op 이다 — 가드가 없으면 개발 서버가 부팅 중 죽는다. 그 판정은
 * `adId()` 하나로 모인다: 광고 단위 ID가 없는 플랫폼이 곧 광고를 쓸 수 없는 플랫폼이다.
 *
 * **ID 결정은 여기서 다시 쓰지 않는다** — `native/ads.ts` 의 순수 함수를 그대로 부른다. 실 ID로
 * 자기 광고를 누르면 무효 트래픽으로 계정이 정지되고 되돌리기가 매우 어려워서, 그 게이트는 플랫폼
 * 구현마다 복제되면 안 된다.
 */
function adId(): string | null {
  return resolveInterstitialAdId(Capacitor.getPlatform(), shouldUseTestAds(import.meta.env))
}

export const capacitorAdsPort: AdsPort = {
  async initialize() {
    if (adId() === null) return
    await AdMob.initialize()
  },
  async prepareInterstitial() {
    const id = adId()
    if (id === null) return false
    await AdMob.prepareInterstitial({ adId: id })
    return true
  },
  async showInterstitial() {
    if (adId() === null) return false
    await AdMob.showInterstitial()
    return true
  },
}
