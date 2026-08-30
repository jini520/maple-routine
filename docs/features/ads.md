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

### 실 광고 단위 ID는 저장소에 없다

빌드할 때 환경 변수로 넣는다. 값이 없으면 광고가 나가지 않는다.

| 환경 변수 | 값 |
|---|---|
| `EXPO_PUBLIC_ADS_INTERSTITIAL_ANDROID` | Android 전면광고 단위 ID |
| `EXPO_PUBLIC_ADS_INTERSTITIAL_IOS` | iOS 전면광고 단위 ID |

`.env.example` 을 `.env` 로 복사해서 값을 채운다. `.env` 는 커밋하지 않는다. 값은 AdMob 콘솔의
광고 단위에서 가져온다. 슬래시가 들어간 값이다(`ca-app-pub-…/…`).

> `.env` 를 무시하려고 `.gitignore` 를 고치면 **OTA 지문이 바뀐다**(2026-08-31 실측:
> `8151fd06…` → `72740141…`). `.gitignore` 가 지문 소스(`bareGitIgnore`)이기 때문이다. 이번
> 변경으로 이미 한 번 바뀌었다. 발행할 때는 못박은 값을 쓰므로([[ADR-190]]) 문제가 되지
> 않지만, `.gitignore` 를 고칠 때마다 같은 일이 일어난다는 것은 알고 있어야 한다.

**값이 없으면 광고를 아예 켜지 않는다.** 잘못된 ID로 광고를 띄우는 것보다 안 띄우는 편이
안전하기 때문이다. 실제 ID로 자기 광고를 클릭하면 무효 트래픽으로 처리되어 AdMob 계정이 정지될
수 있고, 한 번 정지되면 복구하기가 매우 어렵다. 빈 문자열도 없는 것으로 본다.

이 ID는 비밀이 아니다. 앱을 뜯으면 누구나 꺼낼 수 있다. 저장소에서 뺀 이유는 값이 바뀔 때 코드를
고치지 않으려는 것과, 개발 빌드에 실 ID가 섞여 들어갈 경로를 하나 줄이려는 것이다.

### 환경 변수를 읽는 곳은 어댑터 한 곳이다

`src/native/adapters/rn-ads.ts` 의 `adId()` 가 `process.env.EXPO_PUBLIC_…` 을 읽어서
`src/native/ads.ts` 의 `resolveInterstitialAdId()` 에 넘긴다. 판정은 그 함수가 한다.

**변수 이름을 그 형태 그대로 써야 한다.** `babel-preset-expo` 가 `process.env.EXPO_PUBLIC_이름`
이라고 적힌 곳만 번들에 값으로 바꿔 넣기 때문이다. 키를 변수로 만들거나 구조 분해로 꺼내면
치환이 안 되고 값이 비어서 나간다. 그러면 광고가 조용히 사라지고 화면에는 아무 표시가 없다.
`src/__tests__/ads-id-not-committed.test.ts` 가 이 형태를 확인한다.

테스트 광고 ID는 `src/native/ads.ts` 에 그대로 둔다. Google이 공개한 고정값이라 설정이 아니고,
누가 눌러도 AdMob 계정에 영향이 없다.

### 앱 ID도 환경 변수로 넣는다

| 환경 변수 | 값 |
|---|---|
| `EXPO_PUBLIC_ADS_APP_ID_ANDROID` | Android 앱 ID |
| `EXPO_PUBLIC_ADS_APP_ID_IOS` | iOS 앱 ID |

앱 ID는 물결이 들어간 값이다(`ca-app-pub-…~…`). 광고 단위 ID와 달리 런타임에 읽는 값이 아니다.
`expo prebuild` 가 `AndroidManifest.xml` 과 `Info.plist` 에 넣는다. 그래서 JS 쪽에서는 못 바꾸고
`app.config.js` 가 `app.json` 을 읽어서 이 두 값만 갈아끼운다.

값이 없으면 Google 테스트 앱 ID로 떨어진다. `.env` 없이도 `expo start` 와 개발 빌드가 돌아야 하기
때문이다. 그 값은 AdMob 계정과 무관해서 잘못 눌러도 위험이 없다.

Android와 iOS는 값이 서로 다르다. AdMob이 두 플랫폼을 별개의 앱으로 등록하기 때문이다. 앱 ID도
광고 단위 ID도 다르고, 한쪽 값을 양쪽에 쓰면 정책 위반이다.

> ⚠️ **릴리스 빌드는 반드시 `.env` 를 채우고 만들어야 한다.** `runtimeVersion` 정책이
> `fingerprint` 인데, `app.json` 은 파일이 아니라 **해석된 설정**(`expoConfig`)으로 지문에
> 들어간다. 즉 여기서 나온 값이 곧 지문이다. 값을 비우고 빌드하면 테스트 앱 ID가 들어가서 지문이
> 달라지고, 스토어 바이너리가 받던 OTA 가 끊긴다.
>
> 값을 제대로 채우면 지문은 옮기기 전과 **완전히 같다**(2026-08-31 측정).
>
> 커밋된 prebuild 산출물(`android/app/src/main/AndroidManifest.xml`·`ios/app/Info.plist`)에는
> 아직 옛 값이 남아 있다. 지금 걷으면 지문이 달라져서 지금 나가 있는 스토어 바이너리의 OTA가
> 끊기므로, **다음 스토어 릴리스 때 같이 정리한다**(사용자 결정, 2026-08-31 ·
> [../foundation/release.md](../foundation/release.md) 맨 위).
>
> | 상태 | 지문 |
> |---|---|
> | 옮기기 전 | `72740141be5ab18548ab6d66146dce0730b32df0` |
> | 옮긴 뒤 + `.env` 채움 | `72740141be5ab18548ab6d66146dce0730b32df0` (같다) |
> | 옮긴 뒤 + `.env` 없음 | `9c4d110d46a5be57fc098ba28fa0b088ab635037` (다르다) |

### 개발 중에는 테스트 광고만 나가야 한다

| 빌드 | 어떤 광고가 나가는가 |
|---|---|
| 릴리스 빌드에 실 ID를 넣은 경우 | 실제 광고 |
| 릴리스 빌드에 실 ID가 없는 경우 | 광고 없음 |
| `EXPO_PUBLIC_ADS_TEST=1`로 만든 빌드 | 테스트 광고 |
| `__DEV__` (개발 클라이언트) | 테스트 광고 |

`src/native/adapters/ads-env.ts` 가 환경 변수를 읽고, `src/native/ads.ts` 의 `shouldUseTestAds()`
가 최종 판단을 한다. 두 값 모두 테스트 광고를 켜는 쪽으로만 동작한다. 값이 없으면 아무 일도 하지
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

테스트 ID가 그대로 남아 있으면 광고는 정상적으로 나오고 수익만 0이 된다. 실 ID를 안 넣으면 광고가
아예 안 나온다. 앱 ID가 샘플 값이면 SDK 초기화 단계에서 앱이 죽는다. 셋 다 눈으로 확인할 방법이
없다.

그래서 테스트로 확인한다.

- `src/native/__tests__/interstitial-ad-id.test.ts`. 환경 변수가 있을 때와 없을 때
  `resolveInterstitialAdId()` 가 무엇을 주는지 확인한다.
- `src/__tests__/ads-id-not-committed.test.ts`. 실 광고 단위 ID가 소스에 다시 들어왔는지,
  어댑터가 환경 변수를 리터럴로 읽는지 확인한다.
- `src/native/adapters/__tests__/rn-ads.test.ts`. 어댑터가 실제로 요청한 `adUnitId` 가 환경
  변수 값과 같은지, 값이 없을 때 SDK를 건드리지 않는지 확인한다.
- `src/native/adapters/__tests__/ads-env.test.ts`. 환경 변수 조합별로 `shouldUseTestAds()` 의
  결과가 맞는지 확인한다.

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
