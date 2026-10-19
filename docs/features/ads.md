# 광고

지금 앱에는 광고가 나오지 않는다. 전면광고는 없앴고 인라인 광고는 아직 만들지 않았다. 남아 있는 것은
광고 SDK, 광고 ID 설정, 개발 빌드에서 테스트 광고만 나가게 하는 판정이다. 왜 이렇게 두었는지는
[[ADR-014]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `native/ads.ts` | 광고 단위 ID 판정(`resolveInterstitialAdId`) · 테스트 광고 판정(`shouldUseTestAds`) · 화면 코드가 부를 함수 |
| `native/adapters/rn-ads.ts` | `AdsPort` 구현. 환경 변수를 읽고 `react-native-google-mobile-ads` 를 부른다 |
| `native/adapters/ads-env.ts` | `__DEV__` 와 환경 변수를 테스트 광고 판정에 넘길 값으로 바꾼다 |
| `boot.ts` | `setAdsPort(rnAdsPort)` |
| `app.config.js` | 광고 플러그인의 앱 ID 를 환경 변수 값으로 바꾼다 |
| `android/app/src/main/AndroidManifest.xml` · `ios/app/Info.plist` | 커밋된 앱 ID |
| `.env.example` | 광고 환경 변수 목록 |
| `site/app-ads.txt` | AdMob 판매 권한 선언([[ADR-015]]) |

## 환경 변수

`.env.example` 을 `.env` 로 복사해 채운다. `.env` 는 커밋하지 않는다.

| 환경 변수 | 값 | 비었을 때 |
|---|---|---|
| `EXPO_PUBLIC_ADS_APP_ID_ANDROID` | 안드로이드 앱 ID(`ca-app-pub-…~…`) | Google 테스트 앱 ID |
| `EXPO_PUBLIC_ADS_APP_ID_IOS` | iOS 앱 ID | Google 테스트 앱 ID |
| `EXPO_PUBLIC_ADS_INTERSTITIAL_ANDROID` | 안드로이드 광고 단위 ID(`ca-app-pub-…/…`) | 광고를 켜지 않는다 |
| `EXPO_PUBLIC_ADS_INTERSTITIAL_IOS` | iOS 광고 단위 ID | 광고를 켜지 않는다 |
| `EXPO_PUBLIC_ADS_TEST` | `1` 이면 테스트 광고 | 아래 표대로 |

앱 ID 는 네이티브 설정 파일에 들어가는 값이라 OTA 로 바꿀 수 없다. 바꾸려면 스토어 빌드를 새로 낸다.
릴리스 빌드는 반드시 `.env` 를 채우고 만든다. 비우면 테스트 앱 ID 가 들어가고 OTA 지문도 달라진다.

## 어떤 빌드에 어떤 광고가 나가는가

| 빌드 | 광고 |
|---|---|
| 개발 번들(`__DEV__`) | 테스트 광고 |
| `EXPO_PUBLIC_ADS_TEST=1` 로 만든 빌드 | 테스트 광고 |
| `EXPO_PUBLIC_LIVE_UPDATE_CHANNEL=beta` 로 만든 빌드 | 테스트 광고 |
| 릴리스 빌드, 광고 단위 ID 있음 | 실제 광고 |
| 릴리스 빌드, 광고 단위 ID 없음 | 광고 없음 |

테스트 광고 빌드를 만들 때는 Metro 캐시를 비운다(`--clear` 또는 `--reset-cache`). 캐시가 남아 있으면 환경
변수를 바꿔도 실제 광고 번들이 나온다.

## 설정이 틀렸을 때

설정이 틀려도 화면에는 아무 표시가 없다.

| 잘못된 설정 | 결과 |
|---|---|
| 릴리스 빌드에 테스트 광고 단위 ID | 광고는 나오지만 수익이 0 |
| 광고 단위 ID 를 안 넣음 | 광고가 나오지 않는다 |
| 앱 ID 가 샘플 값 | 광고가 우리 계정으로 잡히지 않는다 |
| 앱 ID 칸에 광고 단위 ID 를 넣음 | SDK 초기화에서 앱이 죽는다 |

그래서 [[ADR-014]] 의 테스트 표에 있는 테스트들이 이 설정을 대신 확인한다.

## 광고를 다시 붙일 때

- SDK 초기화(`rnAdsPort.initialize()`)를 부를 위치를 정한다. `AppShell` 에 그 위치를 적은 주석이 있다.
- 화면 코드는 `native/ads.ts` 만 부른다.
- 전면광고를 다시 넣으려면 `interstitial-policy.test.ts` 와 [[ADR-014]] 결정 1 을 먼저 바꾼다.

## 개인정보 처리방침

광고 SDK 를 넣으면서 생긴 스토어 요건이다. Play 정책은 스토어 등록정보와 앱 안 양쪽에 링크를 요구한다.
웹에는 `mapleroutine.store/privacy`([[ADR-015]])로 올려 두었다. 앱에서는 설정의 앱 정보 아래에 있는
개인정보 처리방침 화면(`SettingsPrivacyScreen.tsx`)이 이 페이지를 `WebView` 로 띄운다.
