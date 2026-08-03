# 광고 (Ads)

> **범위**: 광고 포맷·노출 지점·노출 게이트·어댑터 경계·스토어 부수 요건. 결정의 배경과 폐기된 대안은 [[ADR-090]].
> **관련 소스**: `native/ads.ts`(어댑터) · `features/ads/`(게이트 판정·오케스트레이션) · `storage/ads.ts`(마지막 노출 시각) · `App.tsx`(초기화·탭 전환 훅) · `android/…/AndroidManifest.xml` · `ios/App/App/Info.plist`.
> **관련 ADR**: [[ADR-090]] [[ADR-005]] [[ADR-003]] [[ADR-013]] [[ADR-007]]. **관련 문서**: [settings.md](./settings.md), [../foundation/product.md](../foundation/product.md), [../foundation/architecture.md](../foundation/architecture.md).

## 정책

이 앱의 **유일한 수익화 수단은 광고**다. 판매 상품(인앱 구매·구독·광고 제거)은 두지 않는다
([[ADR-090]] 맥락 — 이슈 #58이 네 번 좁혀진 결과).

### 포맷과 지점: 탭 전환 시 전면광고(Interstitial)

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

**개발 빌드는 항상 Google 테스트 ID를 쓴다**(`import.meta.env.DEV` 기준). 실 ID로 자기 광고를
누르면 무효 트래픽으로 **AdMob 계정이 정지**될 수 있고 되돌리기가 매우 어렵다.

플랫폼별로 갈리는 이유는 AdMob이 **Android와 iOS를 별개 앱으로 등록**하기 때문이다 — 앱 ID도
광고 단위 ID도 서로 다르고, 한쪽 ID를 양쪽에 쓰면 정책 위반이다.

**틀려도 화면에는 아무 증상이 없다** — 테스트 ID가 남으면 광고는 뜨는데 수익만 0이고, 앱 ID가
샘플로 남으면 SDK가 초기화에서 죽는다. 그래서 `native/__tests__/ads.test.ts` 가 세 곳을 모두
읽어 드리프트를 잡는다(ID 선택은 순수 함수 `resolveInterstitialAdId` 로 분리).

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
| 개인정보 처리방침 | ⚠️ 작성 완료([`PRIVACY.md`](../../PRIVACY.md)) + `mapleroutine.store/privacy` 로 게시 준비 완료(`site/`). **남은 것은 저장소 Pages 활성화 + 가비아 DNS 레코드**(사용자 작업). 앱 내 링크도 아직 없다 |
| AdMob 앱 등록 + 광고 단위 ID | ✅ **완료**(2026-08-04) — Android·iOS 각각 등록, 실 ID 반영. 단 **스토어 미게시라 노출이 제한**된다(아래) |
| 스토어 게시 후 AdMob 연결 + 검토 | ❌ 미게시 앱은 *"limited ad serving"* 이다. 스토어에 올리고 AdMob에서 앱을 연결해 검토(2~3일)를 통과해야 정상 노출된다 — **지금 실기기에서 광고가 안 뜨는 것은 버그가 아니다** |
| Android `AD_ID` 권한 · 데이터 안전 · "광고 포함" 설문 | ❌ |
| iOS ATT(`NSUserTrackingUsageDescription`) | ❌ 개인화 광고를 쓸 경우 |
| 스토어 출시 | ❌ AdMob 플러그인은 네이티브라 **OTA로 배포 불가** — 새 바이너리 필요 |

## 열린 질문

- **App Open 재검토 트리거**: `@capacitor-community/admob` 배포판에 App Open이 올라오면 앱 시작
  광고를 추가할지 다시 본다(사용자 의사 2026-08-04: "플러그인으로 쓸 수 있으면 그때 추가"). App Open
  코드는 `main` 에 2026-04-10 머지됐으나 마지막 릴리스(v8.0.0, 2025-12-27)에는 없다. **AdMob 콘솔에
  앱 오프닝 광고 형식이 보이는 것과 앱에서 쓸 수 있는 것은 별개다** — 콘솔에서 광고 단위는 만들 수
  있지만 호출할 API가 없다. 폐기 당시 설계는 [[ADR-090]] "폐기된 대안"에 남아 있다
- `AD_MIN_INTERVAL_MS` 30분 · `AD_MIN_UPTIME_MS` 60초 적정값 — 실사용 후 조정
- 사전 로드 실패율이 높아 "거의 안 뜨는" 상태가 되면 포맷·지점 재검토

## 폐기된 정책 (history)

- ~~테마를 기본/프리미엄으로 나눠 프리미엄을 IAP로 판매~~ → 파는 것은 광고 제거이지 테마가 아님(사용자 정정, 2026-08-03)
- ~~광고 제거를 월간/연간 **구독**으로 판매 + 프리미엄 테마를 구독 리워드로~~ → 넥슨 약관 검토 후 철회, 판매 상품 없이 광고만(2026-08-03)
- ~~후원 페이지를 만들어 후원자에게 광고 제거·테마 해제~~ → 리워드가 붙으면 스토어가 후원이 아니라 인앱 구매로 분류(Google Play가 "ad-free version of an app"을 Play Billing 필수 예시로 명시 / Apple 3.2.1(vii)), 2026-08-03
- ~~**App Open 광고 + 스플래시 시퀀스 통합**(`AD_BUDGET_MS` 2500ms 하드 실링, 콜드 스타트·복귀 30분 간격)~~ → 정책상 가장 정확한 포맷이었으나 **배포판 플러그인에 구현이 없어** 탭 전환 Interstitial로 대체([[ADR-090]] 결정 2, 2026-08-03). 포그라운드 감지용 `@capacitor/app` 의존성도 함께 제거
- ~~테마 배경 이미지 2장을 오리지널 아트로 교체해 IP 리스크 완화~~ → 게임 애셋 312개 중 2개라 리스크가 줄지 않고, 보스·아이템 아이콘은 제품 기능 자체라 교체 불가(2026-08-03)
