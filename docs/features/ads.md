# 광고 (Ads)

> **범위**: AdMob ID 를 어디에 두고 테스트 광고와 실 광고를 어떻게 가르는지, 그리고 개인정보
> 처리방침 요건. 광고 포맷과 노출 정책은 정하지 않은 상태다.
> **관련 소스**: `src/native/ads.ts`(광고 단위 ID · 판정 함수) · `src/native/adapters/ads-env.ts`
> (환경 변수 읽기) · `src/native/adapters/rn-ads.ts`(`AdsPort` 구현) · `app.json`(앱 ID).
> **관련 문서**: [settings.md](./settings.md), [site.md](./site.md), [../foundation/release.md](../foundation/release.md).

## 지금 상태

**앱에 광고가 하나도 없다.** 전면광고 구현은 [[ADR-150]] 이 걷었고 [[ADR-156]] 이 코드를 지웠다.
인라인 광고는 아직 붙이지 않았다.

남아 있는 것은 **ID 배선과 테스트 광고 판정**뿐이다. `react-native-google-mobile-ads` 의존성,
`AdsPort` 어댑터, 앱 ID 설정이 그대로 서 있어서 광고를 붙일 때 이 문서만 보면 된다.

## AdMob ID

### ID 가 사는 곳은 두 군데다

| 값 | 어디에 | 형태 |
|---|---|---|
| 광고 단위 ID | `src/native/ads.ts` | `ca-app-pub-…/…`(슬래시) |
| Android · iOS 앱 ID | `app.json` 의 `react-native-google-mobile-ads` 플러그인 인자 | `ca-app-pub-…~…`(물결) |

앱 ID 는 `app.json` 한 곳에만 적는다. `expo prebuild` 가 그것을 읽어 `AndroidManifest.xml` 과
`Info.plist` 에 써 넣으므로, 네이티브 파일을 손으로 고치면 다음 prebuild 에 덮인다.

**플랫폼마다 값이 다르다.** AdMob 이 Android 와 iOS 를 별개 앱으로 등록하기 때문이다. 앱 ID 도
광고 단위 ID 도 서로 다르고, 한쪽 값을 양쪽에 쓰면 정책 위반이다.

### 테스트 광고와 실 광고는 빌드 시점에 갈린다

실 ID 로 자기 광고를 누르면 무효 트래픽으로 **AdMob 계정이 정지**될 수 있고 되돌리기가 매우
어렵다. 그래서 개발 중에는 반드시 테스트 광고여야 한다.

| 빌드 | 나가는 광고 |
|---|---|
| 릴리스 빌드 | 실 광고. 스토어에 나가는 빌드다 |
| `EXPO_PUBLIC_ADS_TEST=1` 로 만든 빌드 | 테스트 광고 |
| `__DEV__`(개발 클라이언트) | 테스트 광고 강제 |

판정은 `src/native/adapters/ads-env.ts` 가 환경 변수를 읽고 `src/native/ads.ts` 의
`shouldUseTestAds` 가 내린다. 이 둘은 **테스트 광고 쪽으로만 밀 수 있다.** 켜져 있으면 테스트
광고를 강제하고 꺼져 있으면 아무것도 하지 않으므로, 실수로 실 광고가 켜지는 방향이 없다.

⚠️ **런타임 플래그로는 가를 수 없다.** 웹 시절 `import.meta.env.DEV` 로 가르려다 실패한 전례가
있다. 번들러가 프로덕션 산출물에서 그 값을 항상 `false` 로 치환하는데 앱은 개발 중에도 빌드된
번들로 돌아서, **실기기 테스트 빌드에 실 광고가 나갔다.** 그래서 빌드 시점 환경 변수를 쓴다.

⚠️ **Metro 트랜스폼 캐시가 `EXPO_PUBLIC_*` 을 무효화하지 않는다**(2026-08-11 실측). 프로덕션
번들을 만든 직후 `EXPO_PUBLIC_ADS_TEST=1` 로 다시 빌드하면 캐시가 이겨서 **실 광고 번들이 그대로
나온다**(번들 해시가 같다). **테스트 빌드는 캐시를 비우고 만들어야 한다**(`--clear` 또는
`--reset-cache`). 측정 기록은 `ads-env.ts` 상단에 있다.

### 틀려도 화면에는 아무 증상이 없다

테스트 ID 가 남으면 광고는 정상으로 뜨는데 수익만 0 이고, 앱 ID 가 샘플로 남으면 SDK 가
초기화에서 죽는다. 둘 다 눈으로 확인할 방법이 없다.

그래서 테스트가 지킨다. `src/native/adapters/__tests__/rn-ads.test.ts` 는 어댑터가 실제로 요청한
`adUnitId` 가 `resolveInterstitialAdId` 의 결과와 같은지 보고,
`src/native/adapters/__tests__/ads-env.test.ts` 는 환경 변수 조합마다 `shouldUseTestAds` 판정이
맞는지 본다. 광고 단위 ID 문자열은 `src/native/ads.ts` 밖에 한 글자도 없다.

## 개인정보 처리방침

광고 SDK 가 들어오면서 생긴 스토어 요건이다. **게시와 앱 내 링크 둘 다 필요하다.** Play 사용자
데이터 정책이 스토어 등록정보와 앱 안 양쪽에 링크를 요구한다.

| 항목 | 상태 |
|---|---|
| 웹 게시 | 완료(2026-08-04 확인). `https://mapleroutine.store/privacy` · 원본은 [`PRIVACY.md`](../../PRIVACY.md) |
| 앱 내 링크 | 완료(2026-08-04). 설정 화면 footer 맨 위([settings.md](./settings.md)) |

## 정하지 않은 것

- **광고 포맷과 노출 지점.** 어떤 형태로(배너 · 네이티브 광고) 어디에 넣을지 정해진 것이 없다.
- **SDK 초기화를 부를 자리.** `rnAdsPort.initialize()` 함수는 `rn-ads.ts` 에 그대로 있지만
  부르는 곳이 없다. 광고를 붙일 때 함께 정한다.
