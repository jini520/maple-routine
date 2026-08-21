# 광고 (Ads)

> **범위**: 광고 포맷·노출 지점·노출 게이트·어댑터 경계·스토어 부수 요건. 결정의 배경과 폐기된 대안은 [[ADR-090]].
> **관련 소스**: `src/native/adapters/rn-ads.ts`·`ads-env.ts` · `app.json`(앱 ID) · `src/native/ads.ts`(광고 단위 ID·판정 함수) · `android/…/AndroidManifest.xml` · `ios/app/Info.plist`. **`src/features/ads/`·`src/storage/ads.ts` 는 지금 소비자가 없다** — 아래 「전면광고」 절 참고.
> **관련 ADR**: [[ADR-090]] [[ADR-150]] [[ADR-128]] [[ADR-005]] [[ADR-003]] [[ADR-013]] [[ADR-007]]. **관련 문서**: [settings.md](./settings.md), [../foundation/product.md](../foundation/product.md), [../foundation/architecture.md](../foundation/architecture.md).

## 정책

이 앱의 **유일한 수익화 수단은 광고**다. 판매 상품(인앱 구매·구독·광고 제거)은 두지 않는다
([[ADR-090]] 맥락 — 이슈 #58이 네 번 좁혀진 결과).

> ⚠️ **아래 「탭 전환 전면광고」를 지금 띄우는 앱은 없다.** RN 에서 걷었고([[ADR-150]], 2026-08-19)
> 그것을 쓰던 캐패시터 앱은 저장소에서 사라졌다([[ADR-155]]) — 인라인 광고는 아직 없으므로
> **이 앱은 현재 광고가 하나도 없다(수익 0).** 아래 절을 남겨 두는 이유는 인라인 광고를 붙일 때
> 게이트 정책(간격·업타임·빈도)을 여기서 다시 읽기 때문이다.
>
> 그래서 `src/features/ads/`·`src/storage/ads.ts` 는 **부르는 곳이 없는 코드**가 됐다.
> 지울지 남길지는 인라인 광고 설계와 함께 판단한다(아래 「열린 질문」).

### 포맷과 지점: 탭 전환 시 전면광고(Interstitial) — **지금은 아무도 안 쓴다**

하단 탭바로 화면을 옮길 때(`/content` ↔ `/boss` ↔ `/profit` ↔ `/settings`) 전면광고를 띄운다.

- **앱 시작에는 띄우지 않는다.** 정책이 명시적으로 금지한다 — *"Do not place interstitial ads on
  app load."* 그 자리에 맞는 포맷은 App Open인데 **배포판 플러그인에 구현이 없다**([[ADR-090]] 결정 2).
- **탭 전환은 정책이 허용하는 지점이다** — *"interstitials should only be placed in between pages
  of app content."* 탭 이동은 실제 페이지 전환이다.
- **위반은 "지점"이 아니라 "빈도"다** — *"Placing an interstitial ad after every user action…"*
  즉 탭 전환**마다**가 위반이지 탭 전환**에**가 위반이 아니다. 그래서 아래 게이트가 설계의 본체다.
- **하단 배너는 쓰지 않는다** — 정책상 가장 안전하고 노출도 최다지만 탭바와 세로 공간이 2겹이 된다.
- **웹 광고(AdSense/GPT)를 WebView에 붙일 수 없다** — "Ad placement" 조항이 소프트웨어 애플리케이션
  통합을 금지한다(`(does not apply to AdMob)` = 앱에는 AdMob을 쓰라는 뜻).

### 노출 게이트 — 셋을 **모두** 만족할 때만

| 게이트 | 상수 | 값 | 이유 |
|---|---|---|---|
| 마지막 노출 경과 | `AD_MIN_INTERVAL_MS` | 30분 | "every user action" 금지를 넘기는 장치 |
| 앱 시작 경과 | `AD_MIN_UPTIME_MS` | 60초 | 열자마자 탭을 누르면 실행 직후 광고가 떠 **"app load 시 전면광고"로 읽힌다** |
| 사전 로드 완료 | — | 준비된 광고 有 | 탭 누른 뒤 요청하면 화면이 먼저 바뀌고 그 위를 덮는다 = **"콘텐츠를 보는 중 갑자기 뜨는"** 위반 형태 |

**준비된 광고가 없으면 조용히 건너뛴다.** 광고를 기다리느라 화면 전환을 지연시키지 않는다 —
네비게이션은 광고 상태와 무관하게 즉시 수행하고, 광고는 그 위에 얹힐 뿐이다.

**같은 탭을 다시 누르는 것은 전환이 아니다** — 경로가 실제로 바뀔 때만 후보가 된다.

### 부팅 시퀀스는 건드리지 않는다

앱 시작에 광고를 띄우지 않으므로 `App.tsx` 의 `MIN_SPLASH_MS` 흐름과 `native/splash-screen.ts`
는 **무변경**이다. 부팅 때 하는 일은 SDK 초기화와 첫 광고 사전 로드뿐이고, 둘 다 실패해도
부팅을 막지 않는다.

### 저장

마지막 노출 시각을 `storage/ads.ts`(Preferences)에 영속 저장한다 — 앱 재시작을 넘어야 하므로
메모리로는 부족하다.

**`KEEP_KEYS`에는 넣지 않는다** — 캐시 삭제로 지워져도 광고가 한 번 더 뜨는 것뿐이라 무해하고,
보존해야 할 사용자 자산이 아니다([../persistence/lifecycle.md](../persistence/lifecycle.md)).

### 어댑터 경계

`features/*`·`app/*` 에서 AdMob 플러그인을 **직접 import하지 않는다**([[ADR-005]], CLAUDE.md
아키텍처 규칙). 전부 `native/ads.ts` 를 거친다. `npm run dev`는 브라우저에서 돌고 AdMob은
네이티브 전용이라 **웹에서는 no-op 스텁**이다 — 없으면 개발 서버가 부팅 중 죽는다.

플러그인이 "로드됐는지" 조회하는 API를 주지 않으므로(`prepareInterstitial`/`showInterstitial`
두 개뿐) 어댑터가 준비 상태를 자체 플래그로 들고 있는다. 게이트 판정은 `features/ads/policy.ts`
의 **순수 함수**로 분리해 테스트한다.

### 광고 ID — 세 곳에 흩어져 있고, 개발/프로덕션이 갈린다

| 값 | 위치 |
|---|---|
| 광고 단위 ID(`/`) | `native/ads.ts` |
| Android 앱 ID(`~`) | `android/…/AndroidManifest.xml` |
| iOS 앱 ID(`~`) | `ios/App/App/Info.plist` |

**테스트 광고 여부는 빌드 시점 환경 변수로 가른다.** 실 ID로 자기 광고를 누르면 무효 트래픽으로
**AdMob 계정이 정지**될 수 있고 되돌리기가 매우 어렵다.

| 명령 | 광고 |
|---|---|
| `npm run build` | **실 광고** — 스토어에 나가는 빌드 |
| `npm run build:test-ads` | 테스트 광고 (`VITE_ADS_TEST=1`) |
| `npm run build:beta` | 테스트 광고 — 베타는 정의상 스토어에 안 나간다 |

> **실기기에서 테스트할 때는 반드시 `build:test-ads` 나 `build:beta` 로 빌드할 것.**
> `npm run build` 로 만든 사이드로딩 빌드는 실 광고를 띄운다.

⚠️ **`import.meta.env.DEV` 로는 가를 수 없다**(초안의 오류, 2026-08-04 수정). Vite는 `vite build`
산출물에서 그 값을 **항상 `false` 로 치환**하고, Capacitor 앱은 개발 중에도 **언제나 빌드된
번들**로 돈다 — 즉 `DEV` 로 가르면 실기기 테스트 빌드에도 실 광고가 나간다. `DEV` 가 `true` 인
곳은 브라우저(`npm run dev`)뿐인데 거기서는 플랫폼이 `web` 이라 어댑터가 어차피 no-op 이라,
그 분기는 아무것도 막지 못했다. 프로덕션 번들에서 `getPlatform(), !1` 로 치환된 것을 실제로
확인해 잡았다.

플랫폼별로 갈리는 이유는 AdMob이 **Android와 iOS를 별개 앱으로 등록**하기 때문이다 — 앱 ID도
광고 단위 ID도 서로 다르고, 한쪽 ID를 양쪽에 쓰면 정책 위반이다.

**틀려도 화면에는 아무 증상이 없다** — 테스트 ID가 남으면 광고는 뜨는데 수익만 0이고, 앱 ID가
샘플로 남으면 SDK가 초기화에서 죽는다. 그래서 `native/__tests__/ads.test.ts` 가 세 곳을 모두
읽어 드리프트를 잡는다(ID 선택은 순수 함수 `resolveInterstitialAdId` 로 분리).

### RN 어댑터 — 광고 없음, 전면광고를 걷었다

**`app-rn` 에는 지금 광고가 하나도 안 뜬다**([[ADR-150]], 2026-08-19). [[ADR-128]] 이 RN 으로 간
동인 자체가 광고 인벤토리였고 — 웹뷰에는 카드 *사이*에 광고를 넣을 자리가 원리적으로 없어
전면광고 말고 선택지가 없었다 — 그 제약이 사라졌으므로 **먼저 전면광고를 걷고** 인라인 광고를
후속으로 붙인다.

| 걷은 것 | 남긴 것 |
|---|---|
| `AppShell.tsx` 부팅 `startAds()`(SDK 초기화 + 사전 로드) | `react-native-google-mobile-ads` 의존성 |
| `BottomBar.tsx` 그룹 이동 게이트 | `native/adapters/rn-ads.ts`(`AdsPort` 구현) |
| `WidgetGrid.tsx` 위젯 이동 게이트 | `ads-env.ts`(테스트 광고 강제) |
| `bar-model.ts` 의 `shouldGateAd`·`BarAction` | `boot.ts` 의 `setAdsPort(rnAdsPort)` |
| — | `app.json` 앱 ID · `EXPO_PUBLIC_ADS_TEST` · `app-ads.txt` |

**사전 로드까지 걷은 이유**는 표시만 막으면 실행마다 «뜨지 않을 광고» 를 요청해 임프레션 없는
요청(매치율 0)으로 쌓이기 때문이다. 걷은 것은 「광고를 띄우는 일」이 아니라 「전면광고라는
인벤토리」다.

**`src/__tests__/interstitial-policy.test.ts` 가 되돌아오는 것을 막는다** — app-rn 소스에
`features/ads/tab-switch-ad` import 가 0건이어야 한다. `@src/native/ads` 는 잡지 않는다(어댑터가
계속 쓴다).

> **SDK 초기화 자리가 비어 있다.** `startAds()` 가 초기화와 사전 로드를 함께 했으므로, 인라인
> 광고를 붙일 때 `mobileAds().initialize()`(=`rnAdsPort.initialize()`)를 부를 자리를 새로 정해야
> 한다. 함수 자체는 `rn-ads.ts` 에 그대로 있다.

~~**`packages/core` 는 무변경이다** — `features/ads/`·`native/ads.ts`·`storage/ads.ts` 는
`app-capacitor` 가 지금도 쓰고 있다.~~ → **그 소비자가 사라졌다**([[ADR-155]]).
`src/native/ads.ts` 의 판정 함수 둘은 RN 어댑터가 계속 쓰지만, `src/features/ads/`(게이트
오케스트레이션)와 `src/storage/ads.ts`(마지막 노출 시각)는 **부르는 곳이 0** 이다.

#### 어댑터가 채우는 값 (그대로 유효)

`AdsPort` 구현은 `react-native-google-mobile-ads` 를 쓴다. **판정 함수는 공유한다** —
`core` 의 `shouldUseTestAds`·`resolveInterstitialAdId` 를 그대로 부르고,
`src/` 에는 광고 단위 ID 문자열이 한 글자도 없다(저장소 검색으로 지킨다).

| 값 | 위치 |
|---|---|
| 광고 단위 ID(`/`) | `src/native/ads.ts` |
| Android·iOS 앱 ID(`~`) | `app.json` 의 config plugin 인자 → `expo prebuild` 가 `AndroidManifest.xml`·`Info.plist` 에 쓴다 |

환경 변수는 Vite 이름을 Expo 이름으로 바꿔 채운다(`src/native/adapters/ads-env.ts`) —
`VITE_ADS_TEST` → **`EXPO_PUBLIC_ADS_TEST`**, `VITE_LIVE_UPDATE_CHANNEL` →
**`EXPO_PUBLIC_LIVE_UPDATE_CHANNEL`**. 둘 다 빌드 시점에 번들로 박히는 값이라 성질이 같다.
여기에 RN 의 `__DEV__` 를 **더한다** — 켜져 있으면 테스트 광고를 강제하고 꺼져 있으면 아무것도
하지 않으므로, 바꿀 수 있는 방향이 "실 광고 → 테스트 광고" 한 쪽뿐이다.

> ⚠️ **Metro 트랜스폼 캐시가 `EXPO_PUBLIC_*` 을 무효화하지 않는다**(2026-08-11 실측). 프로덕션
> 번들을 만든 직후 `EXPO_PUBLIC_ADS_TEST=1` 로 다시 빌드하면 **캐시가 이겨서 실 광고 번들이
> 그대로 나온다**(번들 해시 동일). 즉 **테스트 빌드는 캐시를 비우고 만들어야 한다**
> (`--clear`/`--reset-cache`). app-rn 에는 아직 릴리스 빌드 경로가 없으므로, 그 경로를 만들 때
> 명령에 박을 것. 측정표는 `ads-env.ts` 상단.

**play-services-ads 는 24.9 라인으로 맞춘다**(`react-native-google-mobile-ads` **16.0.3** 고정).
최신 16.4.0 이 끌어오는 25.4.0 은 Kotlin 메타데이터 2.3 이라 RN 0.86 의 Kotlin 2.1 에서
**컴파일이 실패**하고, 24.9 는 지금 배포 중인 Capacitor 앱(`@capacitor-community/admob` 의
`24.9.+`)과 같은 라인이다 — 전환은 같은 일을 다른 SDK로 하는 것이지 SDK를 올리는 것이 아니다.

### iOS — 추적 권한(ATT)을 요청하지 않는다

**비개인화 광고만 받는다**(2026-08-04 결정). 추적 허용 팝업을 띄우지 않으므로
`NSUserTrackingUsageDescription` 을 **의도적으로 넣지 않는다**.

- ATT 프롬프트는 표시 시점·문구 규칙이 까다로워 첫 심사의 리젝 사유가 되기 쉽다. 초기에는
  사용자가 적어 eCPM 차이도 미미하고, 필요해지면 나중에 붙일 수 있다.
- 플러그인은 ATT를 **자동 요청하지 않는다** — `requestTrackingAuthorization()` 이 명시 호출
  방식이라 부르지 않으면 프롬프트가 뜨지 않는다. 어댑터는 이 메서드를 부르지 않는다.
- **`npa`(비개인화 강제)는 설정하지 않는다.** iOS는 ATT 미허용이면 IDFA가 없어 시스템이 알아서
  개인화를 제한하지만, `npa` 는 전역 옵션이라 켜면 **광고 ID가 있는 Android 수익까지** 깎는다.

**배포 국가는 한국 한정**(2026-08-04 결정). EU 사용자가 없으므로 **GDPR 동의 관리(Google UMP)
구현이 불필요**하다. 국가를 늘리려면 그 흐름을 먼저 붙여야 한다.

`SKAdNetworkItems` 는 Google Mobile Ads SDK **필수** 항목이다(50개, 첫 값이 Google의
`cstr6suwn9`). 빠져도 앱은 멀쩡히 돌지만 iOS 기여 분석이 안 돼 수익이 낮게 잡힌다 — 또 하나의
"증상 없는" 실패라 `native/__tests__/ads.test.ts` 가 지킨다. 출처는
[3p-skadnetworks](https://developers.google.com/admob/ios/3p-skadnetworks).

## 넥슨 약관과의 관계

광고는 이 앱에 처음으로 **영리 목적**을 들인다([[ADR-007]], [[ADR-090]] 맥락).

- **API 이용약관 제6조⑥** — "승낙 없이 영리 목적으로 이용" 금지. **광고만 달아도 해당한다.**
- **게임IP 사용 가이드** — "광고 및 후원금 수익"은 **명시적 예외**. 다만 가이드가 정의한 UGC
  (게임굿즈·게임영상·팬아트·팬소설)에 API 유틸리티 앱이 해당하는지는 문서만으로 판단 불가.

**동종 서비스 선례**(maplescouter.com·maple.gg·chuchu.gg — 셋 다 게임 애셋을 광범위하게 쓰고
광고를 단다)로 실무 리스크가 낮다고 보고 진행한다. 게임 애셋 사용은 이 앱만의 특수 리스크가
아니라 카테고리 공통 전제다(이 앱도 `src/assets/` 312개).

3사 공통 관행인 **비제휴 고지**는 설정 footer에 반영했다([settings.md](./settings.md)).

**넥슨 파트너스 신청은 범위 밖**(사용자 결정, 2026-08-03).

## 선행 조건 (코드 밖)

| 항목 | 상태 |
|---|---|
| 개인정보 처리방침 **게시** | ✅ **완료**(2026-08-04 확인) — `https://mapleroutine.store/privacy` 200. 원본은 [`PRIVACY.md`](../../PRIVACY.md), Pages 활성화·DNS 반영됨 |
| 개인정보 처리방침 **앱 내 링크** | ✅ **완료**(2026-08-04) — 설정 footer 맨 위. Play 사용자 데이터 정책은 스토어 등록정보 **와 앱 안** 양쪽에 링크를 요구한다([settings.md](./settings.md)) |
| AdMob 앱 등록 + 광고 단위 ID | ✅ **완료**(2026-08-04) — Android·iOS 각각 등록, 실 ID 반영 |
| **`app-ads.txt` 게시** | ✅ **완료**(2026-08-07) — `site/app-ads.txt` → `mapleroutine.store/app-ads.txt`. 없으면 인증 안 된 지면으로 취급돼 **수요가 줄어든다**([site.md](./site.md)) |
| 스토어 게시 후 AdMob 연결 + 검토 | **iOS ✅ 연결·인증 완료**(2026-08-08) — 현재 **Google 검토 대기**(통상 2~3일, 더 걸릴 수 있음). 검토가 끝날 때까지는 *"limited ad serving"* 이라 **광고가 안 뜨는 것이 버그가 아니다**. **Android ❌**(Play 미출시라 착수 불가) |
| Android `AD_ID` 권한 · 데이터 안전 · "광고 포함" 설문 | ❌ |
| iOS ATT | ✅ **요청하지 않기로 결정**(2026-08-04) — 아래 |
| iOS `SKAdNetworkItems` · 수출 규정 준수 키 | ✅ 반영(2026-08-04) |
| 스토어 출시 | **iOS ✅**(App Store `id6797579391`, v1.0.0, 2026-08-06) · **Play ❌**. AdMob 플러그인은 네이티브라 **OTA로 배포 불가** — 새 바이너리 필요 |

## 열린 질문

- **`app-rn` 의 인라인 광고 포맷·지점**([[ADR-150]] 후속) — RN 전환의 동인이었던 «카드 사이 광고»
  를 실제로 어떤 형태로(배너 / 네이티브 광고) 어디에 넣을지. **[[ADR-128]] 5단계의 선행 조건**이다
  — 인라인 없이 전환 릴리스가 나가면 그 순간부터 수익이 0이다. SDK 초기화를 부를 자리도 이때 함께
  정한다
- ~~**App Open 재검토 트리거**(캐패시터 한정)~~ — **소멸했다**([[ADR-155]]): `@capacitor-community/admob` 배포판에 App Open이 올라오면 앱 시작
  광고를 추가할지 다시 본다(사용자 의사 2026-08-04: "플러그인으로 쓸 수 있으면 그때 추가"). App Open
  코드는 `main` 에 2026-04-10 머지됐으나 마지막 릴리스(v8.0.0, 2025-12-27)에는 없다. **AdMob 콘솔에
  앱 오프닝 광고 형식이 보이는 것과 앱에서 쓸 수 있는 것은 별개다** — 콘솔에서 광고 단위는 만들 수
  있지만 호출할 API가 없다. 폐기 당시 설계는 [[ADR-090]] "폐기된 대안"에 남아 있다
- `AD_MIN_INTERVAL_MS` 30분 · `AD_MIN_UPTIME_MS` 60초 적정값 — 실사용 후 조정
- 사전 로드 실패율이 높아 "거의 안 뜨는" 상태가 되면 포맷·지점 재검토

## 폐기된 정책 (history)

- ~~`app-rn` 도 탭 전환 전면광고를 띄운다 — 부팅 `startAds()` 사전 로드 + 그룹 이동 게이트
  (`shouldGateAd`, [[ADR-132]] 결정 9) + 위젯 이동 게이트~~ → **RN 에서만 폐기**([[ADR-150]],
  2026-08-19). 전면광고는 웹뷰에서 «가능한 유일한 포맷» 이었고 RN 에는 그 제약이 없다 — 인라인
  광고를 붙이기 전에 먼저 걷었다. ~~**`app-capacitor` 의 전면광고는 그대로 선다**~~ → 그 앱이
  저장소에서 사라지면서([[ADR-155]]) **이 저장소가 만드는 어떤 바이너리에도 전면광고가 없다**
  (이미 배포된 캐패시터 설치본에는 남아 있고, 네이티브 플러그인이라 OTA 로는 제거되지 않는다)
- ~~테마를 기본/프리미엄으로 나눠 프리미엄을 IAP로 판매~~ → 파는 것은 광고 제거이지 테마가 아님(사용자 정정, 2026-08-03)
- ~~광고 제거를 월간/연간 **구독**으로 판매 + 프리미엄 테마를 구독 리워드로~~ → 넥슨 약관 검토 후 철회, 판매 상품 없이 광고만(2026-08-03)
- ~~후원 페이지를 만들어 후원자에게 광고 제거·테마 해제~~ → 리워드가 붙으면 스토어가 후원이 아니라 인앱 구매로 분류(Google Play가 "ad-free version of an app"을 Play Billing 필수 예시로 명시 / Apple 3.2.1(vii)), 2026-08-03
- ~~**App Open 광고 + 스플래시 시퀀스 통합**(`AD_BUDGET_MS` 2500ms 하드 실링, 콜드 스타트·복귀 30분 간격)~~ → 정책상 가장 정확한 포맷이었으나 **배포판 플러그인에 구현이 없어** 탭 전환 Interstitial로 대체([[ADR-090]] 결정 2, 2026-08-03). 포그라운드 감지용 `@capacitor/app` 의존성도 함께 제거
- ~~테마 배경 이미지 2장을 오리지널 아트로 교체해 IP 리스크 완화~~ → 게임 애셋 312개 중 2개라 리스크가 줄지 않고, 보스·아이템 아이콘은 제품 기능 자체라 교체 불가(2026-08-03)
