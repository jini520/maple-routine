/**
 * 테스트 광고 판정에 넣을 값을 RN 에서 **무엇으로 채우는가** — 실기기 없이 검증되는 자리다
 * (step 1 `capacitor-storage-keys.ts` · step 2 `capacitor-sqlite-open.ts` · step 3
 * `notification-request.ts` 와 같은 배치).
 *
 * **판정 자체는 여기 없다.** `shouldUseTestAds` 는 `src/native/ads` 의 것 하나뿐이고 이 파일이
 * 하는 일은 그 함수의 **인자를 채우는 것**뿐이다. 실 ID 로 자기 광고를 누르면 무효 트래픽으로
 * AdMob 계정이 정지되고 되돌리기가 매우 어려운데([[ADR-090]] · `features/ads.md`), 그 방어선이
 * 플랫폼마다 두 벌이 되면 한쪽만 틀려도 사고가 난다.
 *
 * ## 왜 `EXPO_PUBLIC_*` 인가
 *
 * Capacitor 쪽은 `import.meta.env` 를 넘긴다(`VITE_ADS_TEST` · `VITE_LIVE_UPDATE_CHANNEL`) —
 * **빌드 시점에 번들로 박히는 값**이라는 것이 요점이었다. RN 에서 정확히 같은 성질을 갖는 것이
 * Expo 의 `EXPO_PUBLIC_*` 이다(`babel-preset-expo` 가 번들에 리터럴로 인라인한다). 그래서 이름만
 * 갈아끼운다 — `EXPO_PUBLIC_ADS_TEST` · `EXPO_PUBLIC_LIVE_UPDATE_CHANNEL`.
 *
 * 반환 객체의 키가 `VITE_` 로 남는 이유는 그것이 **core 함수의 인자 이름**이기 때문이다. 그 함수는
 * Vite 에 묶여 있지 않고 키 두 개짜리 객체를 받을 뿐이라, 이름을 고치는 것은 core 를 고치는 것이고
 * 이 전환의 규칙([[ADR-128]] 결정 4)에 어긋난다.
 *
 * ## ⚠️ 실측 — Metro 트랜스폼 캐시가 이 값을 무효화하지 않는다
 *
 * `expo export --platform android` 로 번들 해시를 재 봤다(2026-08-11).
 *
 * | 순서 | 명령 | 번들 |
 * |---|---|---|
 * | 1 | `EXPO_PUBLIC_ADS_TEST=1 expo export` | `b6ebca23…` |
 * | 2 | `expo export`(변수 없음, 캐시 그대로) | `b6ebca23…` — **1번 그대로** |
 * | 3 | `expo export --clear` | `cc5b56a1…` |
 * | 4 | `EXPO_PUBLIC_ADS_TEST=1 expo export`(캐시 그대로) | `cc5b56a1…` — **3번 그대로** |
 *
 * 1↔3 이 다르므로 값은 **빌드 시점에 번들로 박히는 것이 맞다**(`EXPO_PUBLIC_ADS_TEST` 문자열이
 * 산출물에 없다 = 리터럴로 치환됐다). 그런데 2·4 는 캐시가 이겨서 **직전 값이 그대로 남았고**,
 * 특히 **4번이 위험한 방향**이다 — 테스트 광고로 빌드한 줄 알았는데 실 광고 번들이 나온다.
 *
 * 그래서 **테스트 빌드는 캐시를 비우고 만들어야 한다**(`--clear` / `--reset-cache`). 이 사실은
 * 지금 코드로 강제할 수 없다 — app-rn 에는 아직 릴리스 빌드 경로 자체가 없으므로, 그 경로를
 * 만드는 단계에서 명령에 박아야 한다(`features/ads.md` 에도 적어 두었다).
 * 위에서 `__DEV__` 를 함께 보는 이유가 여기서 한 번 더 선다 — `expo run:android` 개발 빌드는
 * `dev` 플래그가 Metro 캐시 키에 들어가서 이 함정을 안 밟는다.
 *
 * ## `__DEV__` 는 **테스트 광고 쪽으로만** 기운다
 *
 * Capacitor 초안이 `import.meta.env.DEV` 로 갈랐다가 실패한 이력이 있다(`features/ads.md` ⚠️) —
 * Vite 가 빌드 산출물에서 그 값을 항상 `false` 로 치환하는데 Capacitor 앱은 개발 중에도 언제나
 * 빌드된 번들로 돌아서, **실기기 테스트 빌드에 실 광고가 나가고 있었다.** RN 의 `__DEV__` 도 같은
 * 한계를 갖는다 — 테스터에게 나가는 릴리스 빌드는 `__DEV__ === false` 라 이것만으로는 못 막는다.
 *
 * 그래서 여기서 `__DEV__` 는 **환경 변수를 대신하지 않고 덧붙기만 한다**: 켜져 있으면 테스트 광고를
 * 강제하고, 꺼져 있으면 아무것도 안 하고 환경 변수 판정에 그대로 넘긴다. 즉 이 값이 바꿀 수 있는
 * 방향은 "실 광고 → 테스트 광고" 한 쪽뿐이라, 틀려도 손해가 없는 쪽으로만 틀린다. 반대로
 * `__DEV__` 가 `true` 인 번들은 정의상 Metro 개발 번들이라 스토어에 나갈 수 없다.
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
