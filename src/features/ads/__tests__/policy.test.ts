import { describe, expect, it } from 'vitest'
import { AD_MIN_INTERVAL_MS, AD_MIN_UPTIME_MS, canShowInterstitial } from '../policy'

// 게이트 세 개를 **모두** 만족할 때만 통과한다(ADR-090 결정 3). 각 게이트는 정책 위반 하나씩을
// 막으므로, 하나라도 빠지면 그 위반이 되살아난다 — 그래서 개별 반증 케이스를 따로 세운다.
const BASE = {
  now: 10_000_000,
  appStartedAt: 10_000_000 - AD_MIN_UPTIME_MS,
  lastShownAt: 10_000_000 - AD_MIN_INTERVAL_MS,
  isLoaded: true,
}

describe('canShowInterstitial', () => {
  it('세 게이트를 모두 만족하면 표시한다', () => {
    expect(canShowInterstitial(BASE)).toBe(true)
  })

  it('마지막 노출로부터 30분이 안 지났으면 표시하지 않는다', () => {
    // "after every user action" 금지를 넘기는 장치 — 이게 없으면 탭을 옮길 때마다 광고가 뜬다.
    expect(canShowInterstitial({ ...BASE, lastShownAt: BASE.now - AD_MIN_INTERVAL_MS + 1 })).toBe(
      false,
    )
  })

  it('앱 시작으로부터 60초가 안 지났으면 표시하지 않는다', () => {
    // 열자마자 탭을 누르면 실행 직후 광고가 떠 "app load 시 전면광고"로 읽힌다(명시적 금지 조항).
    expect(canShowInterstitial({ ...BASE, appStartedAt: BASE.now - AD_MIN_UPTIME_MS + 1 })).toBe(
      false,
    )
  })

  it('사전 로드된 광고가 없으면 표시하지 않는다', () => {
    // 탭을 누른 뒤 요청하면 화면이 먼저 바뀌고 그 위를 광고가 덮는다 = "콘텐츠를 보는 중 갑자기 뜨는" 형태.
    expect(canShowInterstitial({ ...BASE, isLoaded: false })).toBe(false)
  })

  it('노출 기록이 없으면(첫 실행) 간격 게이트를 통과한다', () => {
    expect(canShowInterstitial({ ...BASE, lastShownAt: null })).toBe(true)
  })

  it('경계값 — 정확히 30분·60초가 지난 순간은 통과한다', () => {
    expect(
      canShowInterstitial({
        ...BASE,
        lastShownAt: BASE.now - AD_MIN_INTERVAL_MS,
        appStartedAt: BASE.now - AD_MIN_UPTIME_MS,
      }),
    ).toBe(true)
  })

  it('저장된 노출 시각이 미래여도(기기 시계 변경) 표시하지 않는다', () => {
    // 시계를 되돌리면 경과가 음수가 된다 — 음수를 "간격 미달"로 취급해야 광고가 폭주하지 않는다.
    expect(canShowInterstitial({ ...BASE, lastShownAt: BASE.now + 60_000 })).toBe(false)
  })
})
