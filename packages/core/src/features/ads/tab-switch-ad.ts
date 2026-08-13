import {
  initializeAds,
  isInterstitialLoaded,
  loadInterstitial,
  showInterstitial,
} from '@core/native/ads'
import { getLastAdShownAt, setLastAdShownAt } from '@core/storage/ads'
import { canShowInterstitial } from './policy'

/**
 * 탭 전환 전면광고 오케스트레이션 ([[ADR-090]] 결정 2·3).
 *
 * 판정은 `policy.ts` 의 순수 함수가 하고, 여기서는 저장소·네이티브를 엮어 그 판정에 필요한 값을
 * 모으고 결과를 반영한다.
 */

/**
 * 모듈 평가 시각을 앱 시작 시각으로 쓴다.
 *
 * `App.tsx` 의 `APP_START_MS` 와 따로 두는 이유는 결합을 만들지 않기 위해서다 — 둘 다 앱
 * 부트스트랩에서 평가되므로 차이는 밀리초 단위고, 60초 게이트에 영향을 주지 않는다.
 */
let appStartedAt = Date.now()

/**
 * 표시 중 재진입 차단.
 *
 * 탭을 연타하면 표시가 끝나기 전에 다시 들어온다. 게이트만으로는 못 막는다 — 노출 시각은
 * 표시가 **끝난 뒤** 기록되므로, 그 사이에 들어온 호출은 아직 옛 기록을 보고 통과해버린다.
 */
let isShowing = false

/** 부팅 시 1회. 실패해도 던지지 않으므로 호출부가 결과를 볼 필요가 없다. */
export async function startAds(): Promise<void> {
  await initializeAds()
  await loadInterstitial()
}

export async function maybeShowTabSwitchAd(): Promise<void> {
  if (isShowing) {
    return
  }
  isShowing = true

  try {
    const lastShownAt = await getLastAdShownAt()
    const now = Date.now()

    if (!canShowInterstitial({ now, appStartedAt, lastShownAt, isLoaded: isInterstitialLoaded() })) {
      // 준비된 광고가 없어서 막힌 경우를 대비해 로드를 걸어둔다 — 다음 전환에는 뜰 수 있게.
      // 다른 게이트에 막힌 경우에도 무해하다(이미 준비돼 있으면 어댑터가 그냥 반환한다).
      await loadInterstitial()
      return
    }

    // 실제로 떴을 때만 기록한다. 안 떴는데 기록하면 30분간 광고가 통째로 죽는다.
    if (await showInterstitial()) {
      await setLastAdShownAt(now)
    }

    // 표시했으면 그 광고는 소진됐다 — 다음 것을 미리 받아두지 않으면 이후 전환은 영원히
    // "준비 안 됨"으로 건너뛴다.
    await loadInterstitial()
  } catch {
    // 광고 실패가 탭 이동을 깨뜨리면 안 된다. 조용히 삼킨다.
  } finally {
    isShowing = false
  }
}

/** 테스트 전용 — 모듈 수준 상태를 되돌린다. */
export function __resetAdsForTest(options: { appStartedAt: number }): void {
  appStartedAt = options.appStartedAt
  isShowing = false
}
