# ADR-014 광고 배선

> 🟢 유효
> 옛 번호: ADR-090 · ADR-150
> 관련 소스: `native/ads.ts` · `native/adapters/rn-ads.ts` · `native/adapters/ads-env.ts` · `native/ports.ts` 의 `AdsPort` · `app.config.js` · `boot.ts`

## 배경

웹뷰 앱 시절에는 화면 전체가 네이티브 뷰 하나였기 때문에, 카드와 카드 사이에 광고 뷰를 끼워 넣을 수가
없었다. 그래서 띄울 수 있는 광고가 탭을 옮길 때 나오는 전면광고뿐이었다. React Native 로 옮긴 뒤에는
화면 안에 광고 뷰를 넣을 수 있게 되었으므로, 전면광고를 걷고 인라인 광고로 가기로 했다. 지금은 전면광고를
걷은 단계이고, 인라인 광고는 아직 만들지 않았다. 그래서 지금 앱에는 광고가 하나도 나오지 않는다.

## 결정

### 결정 1. 전면광고를 두지 않는다. 미리 받아 두는 요청도 함께 지운다

탭 전환 전면광고를 띄우던 곳과, 부팅할 때 SDK 를 초기화하고 첫 광고를 미리 받아 두던 호출을 모두 지웠다.
띄우는 쪽만 막고 미리 받는 요청을 남겨 두면, 앱을 켤 때마다 화면에 나오지 않을 광고를 요청하게 된다.
AdMob 에는 그것이 노출 없는 요청으로 쌓여 매치율이 떨어진다.

없앤 기능은 무언가가 깨져서 돌아오지 않는다. 누군가 호출 한 줄을 다시 넣으면 돌아온다. 전면광고가 있던
동안에도 광고를 띄우는 곳이 하단바 하나에서 today 위젯까지 늘어났다. 그래서 `interstitial-policy.test.ts`
가 소스에 전면광고 모듈 import · `maybeShowTabSwitchAd` · `startAds` · `shouldGateAd` 가 없는지 확인한다.

### 결정 2. SDK · 포트 · 앱 ID · `app-ads.txt` 는 남긴다

인라인 광고가 그대로 쓸 것들이라, 지금 걷으면 나중에 다시 만들어야 한다. 남겨 둔 것은
`react-native-google-mobile-ads` 의존성, `AdsPort` 와 그 구현 `rnAdsPort`, `boot.ts` 의 `setAdsPort(rnAdsPort)`,
네이티브 설정의 앱 ID, 안내 사이트의 `app-ads.txt`, 테스트 광고 판정이다. `app-ads.txt` 는 다시 올려도 AdMob
이 다시 읽어 가기까지 시간이 걸리므로 특히 지우지 않는다.

SDK 초기화(`rnAdsPort.initialize()`)는 지금 아무 곳에서도 부르지 않는다. 인라인 광고를 붙일 때 부를 위치를
정해야 하고, `AppShell` 에 그 위치를 적은 주석이 있다.

### 결정 3. 광고가 실패해도 앱 동작을 막지 않는다

어댑터는 오류를 던지지 않는다. 광고를 만들거나 받는 데 실패하면 `prepareInterstitial()` 은 `false` 를,
띄우는 데 실패하면 `showInterstitial()` 은 `false` 를 돌려준다. 실제로 화면에 떴을 때만 `true` 다. 띄우지
못했는데 `true` 를 주면 부른 쪽이 노출했다고 기록한다.

띄우는 데 실패한 광고도 다 쓴 것으로 본다. 실패한 광고를 다시 띄우려 하면 같은 실패를 되풀이하므로 다음
광고를 새로 받는다.

### 결정 4. `features/*` 와 `app/*` 은 광고 SDK 를 직접 부르지 않는다

화면과 기능 코드는 `native/ads.ts` 만 부르고, SDK 는 `native/adapters/rn-ads.ts` 만 import 한다. 지금은
광고를 띄우는 화면이 없으므로 `native/ads.ts` 를 부르는 곳도 없다.

### 결정 5. 실제 광고 단위 ID 는 저장소에 두지 않고, 빌드할 때 환경 변수로 넣는다

`EXPO_PUBLIC_ADS_INTERSTITIAL_ANDROID` · `EXPO_PUBLIC_ADS_INTERSTITIAL_IOS` 로 넣는다. 값이 없거나 빈 문자열이면
`resolveInterstitialAdId()` 가 `null` 을 돌려주고, 어댑터는 SDK 를 아예 건드리지 않는다. 잘못된 ID 로 광고를
띄우는 것보다 띄우지 않는 편이 안전하다. 실제 ID 로 내 광고를 누르면 무효 트래픽으로 AdMob 계정이 정지될
수 있고, 정지되면 풀기가 매우 어렵다.

이 ID 는 비밀이 아니다. 앱을 풀어 보면 누구나 꺼낼 수 있다. 그래도 저장소에서 뺀 이유는 둘이다. 값이
바뀌어도 코드를 고치지 않아도 되고, 개발 빌드에 실제 ID 가 섞여 들어갈 경로가 하나라도 줄어든다. Google 이 공개한
테스트 광고 단위 ID 는 누가 눌러도 계정에 영향이 없으므로 `native/ads.ts` 에 그대로 둔다.

### 결정 6. 환경 변수는 어댑터에서 `process.env.EXPO_PUBLIC_이름` 형태 그대로 읽는다

`babel-preset-expo` 는 소스에 `process.env.EXPO_PUBLIC_이름` 이라고 그대로 적힌 곳만 번들에 값으로 바꿔
넣는다. 키를 변수에 담거나 구조 분해로 꺼내면 값이 비어서 나가고, 광고가 아무 표시 없이 사라진다. 그래서
환경 변수를 읽는 곳을 `rn-ads.ts` 의 `adId()` 한 곳으로 모았고, `native/ads.ts` 는 그 값을 인자로 받기만
한다.

### 결정 7. 앱 ID 는 `app.config.js` 가 환경 변수로 바꿔 넣는다

앱 ID(`ca-app-pub-…~…`)는 실행 중에 읽는 값이 아니라 `AndroidManifest.xml` 과 `Info.plist` 에 들어가는
값이다. 그래서 JS 에서는 바꿀 수 없고, `app.config.js` 가 `app.json` 을 읽어 광고 플러그인의 앱 ID 두 개만
`EXPO_PUBLIC_ADS_APP_ID_ANDROID` · `EXPO_PUBLIC_ADS_APP_ID_IOS` 값으로 바꾼다. 값이 없으면 Google 테스트 앱 ID
가 들어간다. `.env` 가 없어도 개발 서버와 개발 빌드가 떠야 하기 때문이다.

릴리스 빌드는 `.env` 를 채운 상태로 만들어야 한다. 비워 두면 테스트 앱 ID 가 들어가 광고 수익이 우리
계정으로 잡히지 않는다. 또 `app.config.js` 가 만든 설정은 OTA 지문에 들어가므로, 값이 달라지면 지문도
달라진다.

AdMob 은 안드로이드와 iOS 를 서로 다른 앱으로 등록하므로 두 플랫폼의 앱 ID 와 광고 단위 ID 는 모두 다르다.
한쪽 값을 양쪽에 쓰면 정책 위반이다.

### 결정 8. 테스트 광고는 빌드할 때 정한다

아래 중 하나라도 맞으면 테스트 광고를 쓴다(`toAdsEnv` → `shouldUseTestAds`).

- `EXPO_PUBLIC_ADS_TEST=1` 로 빌드했다
- `EXPO_PUBLIC_LIVE_UPDATE_CHANNEL=beta` 로 빌드했다. 베타 빌드는 스토어에 나가지 않는다
- `__DEV__` 가 켜진 개발 번들이다

세 값은 모두 테스트 광고를 켜기만 하고 끄지는 못한다. 테스트 광고가 잘못 나가면 손해가 없지만, 실제 광고가
잘못 나가면 계정이 위험하기 때문이다. 실행 중에 얻는 개발 여부만으로 정하면, 빌드된 번들로 실기기 테스트를
할 때 실제 광고가 나간다. 그래서 빌드할 때 넣는 환경 변수로 정한다.

Metro 의 변환 캐시는 `EXPO_PUBLIC_*` 값이 바뀌어도 비워지지 않는다. 테스트 광고 빌드를 만들 때는 반드시
`--clear` 나 `--reset-cache` 로 캐시를 비운다. 그러지 않으면 테스트 광고로 빌드했다고 생각한 번들에 실제
광고가 들어간다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `__tests__/interstitial-policy.test.ts` | 결정 1: 소스에 전면광고 import · 표시 · 미리 받기 · 게이트 판정이 없는지 본다 |
| | 결정 2: 어댑터와 `setAdsPort(rnAdsPort)` 배선이 그대로 있는지 본다 |
| `native/adapters/__tests__/rn-ads.test.ts` | 결정 3: 받기에 실패하거나 광고 생성이 오류를 던져도 `false` 인지, 띄우기에 실패해도 오류 없이 `false` 이고 광고가 소진되는지, 같은 광고를 두 번 띄우지 않는지, 결과가 오면 리스너를 정리하는지 본다 |
| | 결정 5 · 8: 환경 변수의 실제 ID 로 광고를 만드는지, 개발 번들은 실제 ID 가 있어도 테스트 광고를 쓰는지, ID 가 없거나 광고를 쓸 수 없는 플랫폼이면 SDK 를 건드리지 않는지, 한 플랫폼 값만 넣으면 그 플랫폼에서만 광고가 나가는지 본다 |
| | 결정 7: 커밋된 네이티브 파일에 앱 ID 가 있는지, 두 플랫폼 값이 다른지, Google 샘플 앱 ID 가 아닌지, `app.config.js` 가 환경 변수를 네이티브 설정으로 넘기는지 본다 |
| `native/__tests__/interstitial-ad-id.test.ts` | 결정 5: 테스트 광고가 실제 ID 보다 우선하는지, 실제 ID 가 없거나 빈 문자열이면 `null` 인지, `native/ads.ts` 에 Google 테스트 ID 말고 다른 ID 가 없는지 본다 |
| `__tests__/ads-id-not-committed.test.ts` | 결정 5 · 6: 소스 전체에 실제 광고 단위 ID 가 없는지, 어댑터가 환경 변수를 `process.env.EXPO_PUBLIC_이름` 형태로 읽는지 본다 |
| `__tests__/app-config-ads.test.ts` | 결정 7: 환경 변수 값을 그대로 넣는지, 값이 없거나 빈 문자열이면 테스트 앱 ID 가 들어가는지, 다른 플러그인은 건드리지 않는지, `app.json` 에 실제 앱 ID 가 없는지 본다 |
| `native/adapters/__tests__/ads-env.test.ts` | 결정 8: 스토어 빌드는 실제 광고를 쓰는지, `ADS_TEST=1` · 베타 채널 · 개발 번들이면 테스트 광고를 쓰는지, `'1'` 이 아닌 값으로는 켜지지 않는지, 개발 번들에서는 환경 변수로 실제 광고를 되돌릴 수 없는지 본다 |

## 번호 기록

- ADR-014 (2026-10-19): 옛 ADR-090 · 150 을 합쳐 처음 작성
