# 스플래시 (Splash Screen)

> **범위**: 앱 실행 스플래시. iOS 런치 스토리보드, Android 경량 `SplashActivity` + 비트맵, MIUI/HyperOS force-dark 대응.
> **관련 소스**: Android `SplashActivity`(진짜 런처) + `MainActivity` · `@drawable/splash`(비트맵) · `values-night` · iOS 런치 스토리보드 · Capacitor SplashScreen 플러그인 · `capacitor.config.ts`(`backgroundColor`/`androidScaleType`) · `index.html`(`#boot-cover`) · RN 어댑터 `packages/app-rn/src/native/adapters/rn-splash-screen.ts`(아래 「RN 어댑터」).
> **관련 ADR**: [[ADR-025]] [[ADR-028]] [[ADR-029]] [[ADR-117]]. **관련 문서**: [../trouble/2026-07-16-splash-darkmode-native-activity.md](../trouble/2026-07-16-splash-darkmode-native-activity.md), [live-update.md](./live-update.md).

## 정책 ([[ADR-025]] → [[ADR-029]])
- **iOS**: 런치 스토리보드(오렌지 배경 + `Splash` 이미지=로고+워드마크) + Capacitor SplashScreen 플러그인 유지. `App.tsx` 가 최소 표시 시간(1s) 뒤 `SplashScreen.hide()`(`launchAutoHide:false`).
- **Android**([[ADR-029]] — [[ADR-025]]의 12+ 테마 방식을 대체): Capacitor/WebView를 전혀 안 거치는 **초경량 `SplashActivity`** 를 앱의 진짜 런처로 두고, OS 강제 무채색 첫 프레임 직후 `android:windowBackground=@drawable/splash`(비트맵, **force-dark 면역**)를 곧바로 그려 ~1.2초 유지한 뒤 `MainActivity` 로 넘긴다. 실기기 녹화 2회로 `#FB8101` 과 사실상 동일한 `(252,128,2)` 가 ~0.9초 안정 노출됨 확인 — 프로젝트 스플래시 작업 전체에서 **다크모드 진짜 브랜드색 노출 최초 성공**.
- **WebView 배경**: 흰 깜빡임 제거용으로 오렌지(`capacitor.config` `backgroundColor`).

## MIUI/HyperOS force-dark 대응 ([[ADR-025]])
HyperOS 다크모드 force-dark 가 밝은 스플래시 배경색을 앱 설정 무관하게 **luminance 기준으로 강제로 어둡게** 만드는 문제를 실기기로 규명. 배경색을 `@color/splash_background` 로 빼고 라이트 `#FB8101`/다크 `#D06100`(강제 다크 변환을 통과하는 상한)으로 `values-night` split. 단색 통일(2026-07-17, [[ADR-029]] 정정): 스플래시 이미지 교체로 배경이 `#F58B0F`(UI primary)로 바뀌었는데 코드 단색이 안 따라가 리로드 커버 이음새로 드러나, 단색 6곳(웹뷰 배경·splash_colors 라이트·iOS 스토리보드·플러그인 bg·boot-cover·오버레이)을 이미지 기준 `#F58B0F` 로 통일(다크 `#D06100` 유지).

## 스플래시를 **내리는** 쪽 ([[ADR-117]])

올리는 장치는 여럿인데(런치 스토리보드 · `SplashActivity` · 플러그인 `show()` · `#boot-cover` · `[data-splash-cover]`) **내리는 코드가 하나뿐이고 그것이 React 트리 안에 있었다.** OTA 적용이 실패한 테스터 기기에서 커버가 영영 안 걷혀 앱이 브랜드 주황에 갇혔다(이슈 #175). iOS `SplashScreen.show()` 는 `parentView.isUserInteractionEnabled = false` 를 걸므로 **터치까지 죽는다** — 그래서 이 자리의 실패는 "못생김"이 아니라 **벽돌**이다.

- **`hideSplashScreen()` 은 `[data-splash-cover]` 도 걷는다**(`querySelectorAll` 로 전부 — 중복 호출로 여러 장 쌓였을 수 있다). 이 오버레이는 `showSplashScreen()` 이 붙이는데(플러그인 창이 못 덮는 하단 내비 바 인셋용, [[ADR-027]] 정정) **걷는 코드가 저장소에 아예 없었다** — *"문서와 함께 사라지므로 별도 정리가 필요 없다"* 는 주석이 **리로드가 성공한다는 전제**였다. 리로드가 실패해 문서가 안 죽으면 영구히 남는다.
- **`#boot-cover` 에 컴포넌트 밖 실패 안전 타이머(8초)를 둔다** — `index.html` 인라인 스크립트. **`#boot-cover` 가 아직 DOM 에 있을 때만** 걷고, 이미 걷혔으면(정상 부팅) **아무것도 하지 않는다.** 정상 부팅은 `MIN_SPLASH_MS`(1초) + 첫 렌더라 8초는 8배 여유이고, capgo 롤백 타임아웃(10초)보다 짧아 *"커버가 걷힌 화면"* 을 사용자가 롤백보다 먼저 본다. 오탐 시 노출되는 것은 테마 적용 전 첫 렌더 정도이고 **영구 벽돌보다 낫다.**
  - **"아직 있을 때만" 가드가 요점이다.** 없으면 정상 부팅 8초 뒤에 사용자가 마침 `지금 적용` 을 눌러 올라간 **리로드 커버까지** 걷어버린다. 그 구간은 `apply()` 의 12초 타임아웃이 맡는다([[ADR-117]] 결정 1) — 두 장치의 담당 구간이 겹치지 않게 하는 것이 이 가드다.
  - 컴포넌트 밖이라는 것도 요점이다. `App.tsx` 의 스플래시 `useEffect` 는 클린업에서 `clearTimeout` 하므로 첫 1초 안에 렌더가 던지면 커버를 걷는 타이머가 **함께 죽는다.** 이 타이머는 React 트리를 모른다.
- **ErrorBoundary 폴백은 마운트 시 `hideSplashScreen()` 을 부른다** — 커버 제거 + 네이티브 스플래시 해제(**터치 복구**)를 한 번에 얻는다. 폴백은 `#root` 안이라 `z-index: 2147483647` 인 `#boot-cover` **밑**에 그려지는데, 폴백의 z-index 를 올리는 것으로는 안 풀린다(올릴 숫자가 없고, 같은 매직 넘버가 두 곳에 생기며, 무엇보다 **보이게 만들어도 `isUserInteractionEnabled = false` 라 '다시 시작' 이 눌리지 않는다**). 커버를 지우면 위에 아무것도 없으므로 z-index 는 올릴 이유 자체가 사라진다. [[ADR-065]] 결정 5 의 *"폴백은 최소로 둔다"* 는 그대로 — 화면에 보이는 것은 하나도 늘지 않는다.

**스플래시를 내리는 주체는 넷이다** — 정상 부팅(`App.tsx` 의 `MIN_SPLASH_MS` 타이머) · `apply()` 실패 catch([[ADR-117]] 결정 1) · 위 8초 인라인 타이머 · ErrorBoundary 폴백. 셋이 새로 생기지만 **셋 중 둘은 `hideSplashScreen()` 을 그대로 부르는 것**이라 커버 제거 로직은 `native/splash-screen.ts` 한 곳에 남는다.

**인라인 타이머만 그 모듈을 못 쓴다**(React 트리 밖·번들 밖이라 import 가 없다) — 그래서 DOM 커버는 직접 지우고 네이티브는 **전역 브릿지로** 부른다(`window.Capacitor?.Plugins?.SplashScreen?.hide()`, optional chaining + `try/catch`). **DOM 만 걷으면 iOS 는 화면만 돌아오고 터치는 죽은 채**이므로(`isUserInteractionEnabled` 는 네이티브 `tearDown()` 에서만 풀린다) 걷는 장치가 넷이면 넷 다 이 성질을 가져야 한다. 다만 **보장은 아니다** — 브릿지가 없거나(웹 개발 서버) 아직 준비되지 않았으면 optional chaining 이 조용히 통과한다. 그 경로와, 넷 다 실행되지 않는 경로(React 가 마운트조차 못 하는 실패)는 capgo 의 10초 롤백이 메운다.

## RN 어댑터 ([[ADR-127]], 2026-08-11)

위 정책은 전부 **웹뷰 사정**이다. RN 구현(`packages/app-rn/src/native/adapters/rn-splash-screen.ts`)이
다루는 것은 **네이티브 스플래시 한 장뿐**이다.

- 라이브러리는 **`expo-splash-screen` `~57.0.6`** — 버전이 SDK 에 묶여 있어 고른 것이다(`expo` 의
  `bundledNativeModules.json` 이 SDK 57 짝으로 지정한 값, 이미 있는 `expo-status-bar` 와 같은 라인).
  후보였던 `react-native-bootsplash` 는 SDK 와 독립적으로 움직이고 에셋 생성 CLI 가 따로 필요하다.
- **`hide()` 는 `SplashScreen.hideAsync()` 하나다.** 걷을 DOM 커버가 없다 —
  `#boot-cover`·`[data-splash-cover]` 는 정의상 웹뷰 구현이고([[ADR-117]] 결정 4) RN 에는 문서가 없다.
  위 «스플래시를 내리는 주체는 넷이다» 도 웹뷰 이야기다(`index.html` 인라인 타이머는 RN 에 자리 자체가
  없다).
- **`show()` 는 no-op 이다.** 그 함수가 존재한 이유는 웹뷰 리로드 하나였는데(OTA 적용·캐시 초기화
  직전에 드러나는 웹뷰 배경색을 덮는다 — [[ADR-027]] 정정 · [[ADR-117]] 결정 1·8) RN 에는 **문서를 다시
  로드하는 일 자체가 없어** 덮을 구간이 생기지 않는다. `preventAutoHideAsync()` 로 흉내 내는 것은
  **답이 아니다** — 이미 내려간 스플래시에는 아무 효과가 없어 화면은 그대로인데 호출부만 덮였다고
  믿는다. OTA 프로토콜은 [[ADR-127]] 결정 7 대로 재설계 대상이라, 새 적용 경로가 화면을 덮어야 하면
  그 결정에서 이 자리를 다시 본다.
- **계속 띄워 두는 일은 어댑터 밖이다.** Capacitor 에서 그것은 코드가 아니라 설정이었고
  (`capacitor.config.ts` `launchAutoHide: false`), RN 짝은 앱 진입점 **전역 스코프**에서 부르는
  `SplashScreen.preventAutoHideAsync()` 다(라이브러리 문서가 컴포넌트·훅 안에서 부르지 말라고 명시 —
  늦으면 이미 내려간 뒤다).

**미검증**: 실기기에서 스플래시가 실제로 뜨고 걷히는 것. 지금까지 확인된 것은 빌드
(`expo prebuild` + `assembleDebug` · `pod install` + `xcodebuild -scheme ExpoSplashScreen`)와 포트
계약(jest)까지다. 브랜드 색·이미지([[ADR-025]]·[[ADR-029]])를 RN 스플래시에 옮기는 것도 아직이다 —
지금 `expo prebuild` 가 만드는 것은 기본 흰 배경이다(`colors.xml` `splashscreen_background` `#FFFFFF`).

## 핵심 교훈
- **Capacitor 브릿지+플러그인 초기화가 끝나기 전엔 HTML 레이어가 그려질 시점 자체가 없다** — 그래서 "브랜드 룩을 WebView/HTML 레이어로 옮긴다"는 접근([[ADR-028]])은 실기기에서 실패했고, "Capacitor를 아예 안 거치는 별도 네이티브 액티비티 + 비트맵"([[ADR-029]])만 성공했다.
- 콜드스타트 내내 무언가는 보여야 하는데, 브랜드 없는 무채색보다 살짝 어두운 주황(`#D06100`)이 낫다.

## 폐기된 정책 (history)
- ~~Capacitor 플러그인 JS 브릿지 show/hide로 스플래시 유지~~ → Android는 플러그인 install이 늦어 유지 안 됨([[ADR-025]] 구현 중 폐기).
- ~~HTML 부트 스플래시 이원화(네이티브+HTML 로고)~~ → 이중 로고 발생 → 폐기([[ADR-025]]).
- ~~Android 네이티브 스플래시를 무채색+아이콘 없음으로 축소하고 브랜드를 `index.html` HTML 레이어로 이전~~ → 실기기 2차 검증 전부 실패, 전체 폐기([[ADR-028]], 구현 없음). "WebView 레이어로 옮긴다"는 접근이 구조적으로 불가능. **이 결론은 [[ADR-029]] 의 "Capacitor 미경유 네이티브 액티비티 + 비트맵"으로 뒤집힘**(그 방식은 성공).
- ~~다크모드 색을 더 밝게 튜닝~~ → `#D06100` 이 force-dark 통과 상한임을 실기기 hue 스윕으로 확인, 색 튜닝 대신 [[ADR-029]] 방식 채택([[ADR-028]]).
- ~~`[data-splash-cover]` 오버레이는 문서와 함께 사라지므로 별도 정리가 필요 없다~~ → **`hideSplashScreen()` 이 걷는다**([[ADR-027]] 2026-07-17 정정 → [[ADR-117]] 결정 4). 리로드가 성공한다는 전제가 틀렸다.
- ~~커버를 걷는 코드는 `App.tsx` 의 `useEffect` 타이머 하나뿐~~ → **넷**(정상 부팅 · `apply()` catch · `#boot-cover` 8초 인라인 타이머 · ErrorBoundary 폴백)([[ADR-117]] 결정 3·6). 유일한 코드가 죽을 수 있는 트리 안에 있었다.
