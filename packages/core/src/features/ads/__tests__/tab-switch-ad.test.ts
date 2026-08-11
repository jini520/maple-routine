import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@core/native/ads', () => ({
  initializeAds: vi.fn(async () => {}),
  loadInterstitial: vi.fn(async () => {}),
  isInterstitialLoaded: vi.fn(() => true),
  showInterstitial: vi.fn(async () => true),
}))

vi.mock('@core/storage/ads', () => ({
  getLastAdShownAt: vi.fn(async () => null),
  setLastAdShownAt: vi.fn(async () => {}),
}))

const native = await import('@core/native/ads')
const storage = await import('@core/storage/ads')
const { AD_MIN_UPTIME_MS } = await import('../policy')
const { maybeShowTabSwitchAd, __resetAdsForTest } = await import('../tab-switch-ad')

const mockedNative = vi.mocked(native)
const mockedStorage = vi.mocked(storage)

// 게이트를 통과하는 기본 상태 — 앱이 켜진 지 충분히 지났고, 노출 기록이 없고, 광고가 준비됨.
function passingState(): void {
  vi.setSystemTime(new Date(10_000_000))
  __resetAdsForTest({ appStartedAt: 10_000_000 - AD_MIN_UPTIME_MS })
  mockedNative.isInterstitialLoaded.mockReturnValue(true)
  mockedStorage.getLastAdShownAt.mockResolvedValue(null)
  mockedNative.showInterstitial.mockResolvedValue(true)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  passingState()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('maybeShowTabSwitchAd', () => {
  it('게이트를 통과하면 광고를 표시하고 노출 시각을 기록한다', async () => {
    await maybeShowTabSwitchAd()

    expect(mockedNative.showInterstitial).toHaveBeenCalledTimes(1)
    expect(mockedStorage.setLastAdShownAt).toHaveBeenCalledWith(10_000_000)
  })

  it('표시 후 다음 광고를 미리 받아둔다', async () => {
    // 사전 로드가 없으면 다음 탭 전환은 항상 "준비 안 됨"으로 건너뛰어 광고가 한 번만 뜬다.
    await maybeShowTabSwitchAd()

    expect(mockedNative.loadInterstitial).toHaveBeenCalled()
  })

  it('준비된 광고가 없으면 표시하지 않고 로드만 걸어둔다', async () => {
    mockedNative.isInterstitialLoaded.mockReturnValue(false)

    await maybeShowTabSwitchAd()

    expect(mockedNative.showInterstitial).not.toHaveBeenCalled()
    expect(mockedNative.loadInterstitial).toHaveBeenCalled()
  })

  it('앱 시작 직후에는 표시하지 않는다', async () => {
    __resetAdsForTest({ appStartedAt: 10_000_000 - AD_MIN_UPTIME_MS + 1 })

    await maybeShowTabSwitchAd()

    expect(mockedNative.showInterstitial).not.toHaveBeenCalled()
  })

  it('실제로 뜨지 않았으면 노출 시각을 기록하지 않는다', async () => {
    // 안 떴는데 기록하면 30분간 광고가 통째로 죽는다.
    mockedNative.showInterstitial.mockResolvedValue(false)

    await maybeShowTabSwitchAd()

    expect(mockedStorage.setLastAdShownAt).not.toHaveBeenCalled()
  })

  it('광고를 표시하는 동안 들어온 중복 호출은 무시한다', async () => {
    // 탭을 연타하면 표시가 끝나기 전에 다시 들어온다 — 두 번 띄우면 정책 위반이다.
    const first = maybeShowTabSwitchAd()
    const second = maybeShowTabSwitchAd()
    await Promise.all([first, second])

    expect(mockedNative.showInterstitial).toHaveBeenCalledTimes(1)
  })

  it('네이티브가 던져도 호출부로 전파하지 않는다', async () => {
    // 광고 실패가 탭 이동을 깨뜨리면 안 된다.
    mockedNative.showInterstitial.mockRejectedValue(new Error('ad failed'))

    await expect(maybeShowTabSwitchAd()).resolves.toBeUndefined()
  })
})
