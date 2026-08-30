# 광고 (Ads)

> **범위**: AdMob 광고 ID를 어디에 설정하는지, 개발 중에 실제 광고가 나가지 않게 막는 방법,
> 개인정보 처리방침과 관련된 스토어 요건.
> **관련 소스**: `src/native/ads.ts`(광고 단위 ID와 판정 함수) · `src/native/adapters/ads-env.ts`
> (환경 변수 읽기) · `src/native/adapters/rn-ads.ts`(`AdsPort` 구현) · `app.json`(앱 ID).
> **관련 문서**: [settings.md](./settings.md), [site.md](./site.md), [../foundation/release.md](../foundation/release.md).

## 현재 상태

지금 앱에는 광고가 없다. 전면광고는 [[ADR-150]]에서 제거하기로 결정했고 [[ADR-156]]에서 코드를
삭제했다. 인라인 광고는 아직 만들지 않았다.

지금 남아 있는 것은 광고 ID 설정과, 개발 빌드에서 테스트 광고를 쓰도록 하는 코드다.
`react-native-google-mobile-ads` 패키지와 `AdsPort` 어댑터도 그대로 있다. 나중에 광고를 다시
넣을 때는 이 문서만 보면 된다.

## 광고 ID

### ID를 설정하는 곳은 두 곳이다

| 값 | 파일 | 형식 |
|---|---|---|
| 광고 단위 ID | `src/native/ads.ts` | `ca-app-pub-…/…` (슬래시) |
| Android·iOS 앱 ID | `app.json`의 `react-native-google-mobile-ads` 플러그인 설정 | `ca-app-pub-…~…` (물결) |

앱 ID는 `app.json`에만 적는다. `expo prebuild`가 이 값을 읽어서 `AndroidManifest.xml`과
`Info.plist`에 넣기 때문이다. 네이티브 파일을 직접 수정하면 다음 prebuild 때 덮어쓴다.

Android와 iOS는 값이 서로 다르다. AdMob이 두 플랫폼을 별개의 앱으로 등록하기 때문이다. 앱 ID도
광고 단위 ID도 다르고, 한쪽 값을 양쪽에 쓰면 정책 위반이다.

### 개발 중에는 테스트 광고만 나가야 한다

실제 광고 ID로 자기 광고를 클릭하면 무효 트래픽으로 처리되어 AdMob 계정이 정지될 수 있다. 한 번
정지되면 복구하기가 매우 어렵다.

| 빌드 | 어떤 광고가 나가는가 |
|---|---|
| 릴리스 빌드 | 실제 광고. 스토어에 올리는 빌드다 |
| `EXPO_PUBLIC_ADS_TEST=1`로 만든 빌드 | 테스트 광고 |
| `__DEV__` (개발 클라이언트) | 테스트 광고 |

`src/native/adapters/ads-env.ts`가 환경 변수를 읽고, `src/native/ads.ts`의 `shouldUseTestAds()`가
최종 판단을 한다. 두 값 모두 테스트 광고를 켜는 쪽으로만 동작한다. 값이 없으면 아무 일도 하지
않기 때문에, 실수로 실제 광고가 켜지는 경로는 없다.

⚠️ **런타임 값으로는 구분할 수 없다.** 예전에 `import.meta.env.DEV`로 구분하려다 실패한 적이 있다.
번들러가 프로덕션 빌드에서 이 값을 항상 `false`로 바꾸는데, 개발 중에도 빌드된 번들로 앱을
실행하기 때문에 실기기 테스트 빌드에 실제 광고가 나갔다. 그래서 지금은 빌드할 때 환경 변수로
구분한다.

⚠️ **Metro의 트랜스폼 캐시는 `EXPO_PUBLIC_*` 값이 바뀌어도 무효화되지 않는다**(2026-08-11 확인).
프로덕션 번들을 만든 다음 `EXPO_PUBLIC_ADS_TEST=1`로 다시 빌드하면 캐시가 그대로 쓰여서 실제 광고
번들이 나온다. 번들 해시가 같다. 테스트 빌드를 만들 때는 캐시를 지워야 한다(`--clear` 또는
`--reset-cache`). 당시 측정 기록은 `ads-env.ts` 파일 위쪽 주석에 있다.

### 설정이 틀려도 화면에는 아무 표시가 없다

테스트 ID가 그대로 남아 있으면 광고는 정상적으로 나오고 수익만 0이 된다. 앱 ID가 샘플 값이면 SDK
초기화 단계에서 앱이 죽는다. 둘 다 눈으로 확인할 방법이 없다.

그래서 테스트로 확인한다.

- `src/native/adapters/__tests__/rn-ads.test.ts`. 어댑터가 실제로 요청한 `adUnitId`가
  `resolveInterstitialAdId()`의 결과와 같은지 확인한다.
- `src/native/adapters/__tests__/ads-env.test.ts`. 환경 변수 조합별로 `shouldUseTestAds()`의
  결과가 맞는지 확인한다.

광고 단위 ID 문자열은 `src/native/ads.ts` 밖에는 없다.

## 개인정보 처리방침

광고 SDK를 넣으면서 생긴 스토어 요건이다. 웹에 게시하는 것과 앱 안에 링크를 넣는 것이 둘 다
필요하다. Play의 사용자 데이터 정책이 스토어 등록정보와 앱 양쪽에 링크를 요구한다.

| 항목 | 상태 |
|---|---|
| 웹 게시 | 완료(2026-08-04 확인). `https://mapleroutine.store/privacy` · 원본은 [`PRIVACY.md`](../../PRIVACY.md) |
| 앱 내 링크 | 완료(2026-08-04). 설정 화면 맨 아래([settings.md](./settings.md)) |

## 아직 정하지 않은 것

- **광고 형식과 표시 위치.** 배너로 할지 네이티브 광고로 할지, 어느 화면에 넣을지 정해진 것이 없다.
- **SDK 초기화를 호출할 위치.** `rnAdsPort.initialize()` 함수는 `rn-ads.ts`에 있지만 호출하는 곳이
  없다. 광고를 다시 넣을 때 같이 정한다.
