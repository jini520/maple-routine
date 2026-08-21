// 이 파일이 지키는 것은 **"어느 빌드가 실 광고를 쓰는가"** 하나다.
//
// 틀려도 화면에는 아무 증상이 없다 — 테스트 ID 가 남으면 광고는 멀쩡히 뜨는데 수익만 0이고,
// 반대로 실 ID 가 개발 빌드에 나가면 자기 광고를 한 번 누르는 순간 무효 트래픽으로 AdMob 계정이
// 위험해진다(되돌리기 매우 어려움 — `features/ads.md`). 그래서 판정을 눈으로 확인할 방법이 없고
// 여기가 유일한 방어선이다.
//
// **판정 함수는 `@core/native/ads` 의 진짜 것을 쓴다.** 흉내 내면 core 가 규칙을 바꿨을 때
// 이 테스트만 초록으로 남는다 — 검사 대상은 `toAdsEnv` 가 그 함수에 **무엇을 넘기는가** 이지
// 판정 자체가 아니다(그건 core 쪽 테스트가 이미 덮는다).

import { shouldUseTestAds } from '@core/native/ads'

import { toAdsEnv, type AdsEnvSource } from '../ads-env'

/** 스토어에 나가는 릴리스 빌드의 기본값 — 개발 번들도 아니고 환경 변수도 없다. */
const STORE_BUILD: AdsEnvSource = {
  isDevBundle: false,
  adsTest: undefined,
  liveUpdateChannel: undefined,
}

function usesTestAds(source: Partial<AdsEnvSource>): boolean {
  return shouldUseTestAds(toAdsEnv({ ...STORE_BUILD, ...source }))
}

describe('toAdsEnv → shouldUseTestAds', () => {
  // 이 한 줄이 수익의 전제다. 여기가 true 로 뒤집히면 스토어 빌드가 테스트 광고를 띄운다.
  it('스토어 빌드는 실 광고를 쓴다', () => {
    expect(usesTestAds({})).toBe(false)
  })

  // `EXPO_PUBLIC_*` 이 Vite 의 `import.meta.env` 자리를 대신한다 — 둘 다 빌드 시점에 번들로
  // 박히는 값이고, 그 성질이 이 게이트가 요구하는 전부다.
  it('EXPO_PUBLIC_ADS_TEST=1 이면 테스트 광고를 쓴다', () => {
    expect(usesTestAds({ adsTest: '1' })).toBe(true)
  })

  it('베타 채널 빌드는 테스트 광고를 쓴다 — 정의상 스토어에 나가지 않는다', () => {
    expect(usesTestAds({ liveUpdateChannel: 'beta' })).toBe(true)
  })

  it('production 채널 빌드는 실 광고를 쓴다', () => {
    expect(usesTestAds({ liveUpdateChannel: 'production' })).toBe(false)
  })

  // core 의 규칙은 `=== '1'` 이다. 켠 줄 알았는데 안 켜진 값들이 실제로 안 켜지는지 못 박아 둔다
  // (반대 방향으로 틀리는 것보다는 낫지만, 모르고 실 광고로 테스트하는 것도 위험하다).
  it.each(['0', 'true', '', 'yes'])('EXPO_PUBLIC_ADS_TEST=%p 는 켜지 않는다', (adsTest) => {
    expect(usesTestAds({ adsTest })).toBe(false)
  })
})

describe('__DEV__ 는 테스트 광고 쪽으로만 기운다', () => {
  // 개발 번들에서 환경 변수를 잊는 것이 가장 흔한 실수다. 그 경우 Capacitor 쪽은 실 광고가
  // 나갔고(`features/ads.md` ⚠️), 여기서는 안 나간다.
  it('개발 번들은 환경 변수가 없어도 테스트 광고를 쓴다', () => {
    expect(usesTestAds({ isDevBundle: true })).toBe(true)
  })

  // 환경 변수로 실 광고를 되돌릴 수 없다 — 비대칭이라 그렇다. 테스트 광고가 잘못 나가면 손해가
  // 없고, 실 광고가 잘못 나가면 계정이 날아간다.
  it.each([
    ['환경 변수 없음', {}],
    ['ADS_TEST=0', { adsTest: '0' }],
    ['production 채널', { liveUpdateChannel: 'production' }],
  ])('개발 번들에서는 %s 여도 테스트 광고다', (_label, source) => {
    expect(usesTestAds({ ...source, isDevBundle: true })).toBe(true)
  })

  // 반대편 — `__DEV__` 가 꺼지면 이 값은 아무것도 하지 않고 판정을 환경 변수에 그대로 넘긴다.
  // (릴리스 빌드는 `__DEV__ === false` 라, 이것만으로는 실기기 테스트 빌드를 못 막는다.)
  it('릴리스 번들에서는 환경 변수가 그대로 판정한다', () => {
    expect(usesTestAds({ isDevBundle: false, adsTest: '1' })).toBe(true)
    expect(usesTestAds({ isDevBundle: false, adsTest: undefined })).toBe(false)
  })
})

describe('core 가 읽는 키를 채운다', () => {
  // 키 이름이 어긋나면 아무 에러 없이 **모든 빌드가 실 광고**가 된다(빈 객체 = 스토어 빌드).
  // 타입은 `Parameters<typeof shouldUseTestAds>[0]` 에서 뽑아 오므로 tsc 가 먼저 잡지만,
  // 값이 실제로 실려 가는지는 여기서 본다.
  it('환경 변수 값을 그대로 싣는다', () => {
    expect(toAdsEnv({ isDevBundle: false, adsTest: '1', liveUpdateChannel: 'beta' })).toEqual({
      VITE_ADS_TEST: '1',
      VITE_LIVE_UPDATE_CHANNEL: 'beta',
    })
  })

  it('없는 값을 지어내지 않는다', () => {
    expect(toAdsEnv(STORE_BUILD)).toEqual({
      VITE_ADS_TEST: undefined,
      VITE_LIVE_UPDATE_CHANNEL: undefined,
    })
  })
})
