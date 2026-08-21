# 스플래시 (Splash Screen)

> **범위**: 앱 실행 스플래시 한 장 — 언제 뜨고, 무엇으로 그리고, 누가 내리는가.
> **관련 소스**: `app.json`(`expo-splash-screen` 플러그인 블록) · `assets/splash-icon.png` · Android `values/colors.xml`(`splashscreen_background`) · iOS `Images.xcassets/SplashScreen{Background,Logo}` · 진입점 `index.ts` → `src/boot-splash.ts`(붙들기·실패 안전 타이머) · `src/app/AppShell.tsx`(`MIN_SPLASH_MS`) · 포트 `src/native/splash-screen.ts` + 어댑터 `src/native/adapters/rn-splash-screen.ts`.
> **관련 ADR**: [[ADR-138]](자산 파이프라인) [[ADR-128]](RN 어댑터) [[ADR-117]] 결정 3·4(실패 안전 타이머·내리는 코드 한 곳 — 🔗 로 살아남은 부분) [[ADR-136]](앱 루트 바탕색). **관련 문서**: [live-update.md](./live-update.md), [../foundation/release.md](../foundation/release.md).
>
> ⚠️ **웹뷰 시절 스플래시는 이 문서에 없다.** 두 장(네이티브 + DOM 커버)이던 구조, `SplashActivity` 비트맵, MIUI force-dark 색 split 은 전부 캐패시터 앱의 것이고 저장소에서 사라졌다 — 아래 「폐기된 정책」 에만 남는다.

## 정책 — 네이티브 스플래시 **한 장**뿐이다 ([[ADR-128]] · [[ADR-138]])

RN 에는 문서(document)가 없어 덮을 DOM 커버라는 개념 자체가 없다. 스플래시는 OS 가 그리는 네이티브
화면 하나이고, 앱이 하는 일은 **언제까지 붙들고 언제 내리는가** 둘뿐이다.

- **그림·색은 `app.json` 한 곳이 정한다** — `expo-splash-screen` 플러그인 블록:
  `image: ./assets/splash-icon.png` · `backgroundColor: #F58B0F` · `resizeMode: contain` · `imageWidth: 200`.
  `expo prebuild` 가 이 값을 네이티브로 내린다(Android `values/colors.xml` 의
  `splashscreen_background`, iOS `SplashScreenBackground.colorset`).
- **다크모드에서도 같은 밝은 주황이다**([[ADR-138]] 결정 4, 사용자 판정). `values-night/colors.xml`
  이 비어 있고 iOS colorset 에 luminosity 변형이 없다 — 두 모드가 `#F58B0F` 하나를 함께 쓴다.
  **대가**: MIUI/HyperOS 다크에서 force-dark 에 갈색으로 깎일 수 있다(iOS 는 force-dark 가 없어 무관).
  그것을 막던 것은 색이 아니라 «캐패시터를 안 거치는 비트맵 액티비티» 라는 **구조**였고, 그 구조는
  Expo 로 넘어오지 않았다.
- **`app.json` 을 고쳤으면 `expo prebuild` 를 돌려야 반영된다**(네이티브가 커밋돼 있다). prebuild 는
  **fingerprint 를 바꾸므로 OTA 재배포가 뒤따라야 한다**([[ADR-137]] 정정 2).

## 붙들기와 내리기 — 셋이 내린다

**붙들기는 React 트리 밖, 전역 스코프여야 한다.** `index.ts` 가 `registerRootComponent` **앞에서**
`holdSplashUntilAppReady()`(`src/boot-splash.ts`)를 부르고, 그 안에서
`SplashScreen.preventAutoHideAsync()` 를 호출한다 — 라이브러리 문서가 컴포넌트·훅 안에서 부르지
말라고 명시한다(늦으면 이미 내려간 뒤다). 안 부르면 스플래시가 첫 렌더 전에 스스로 사라져
테마 복원 전 화면이 노출된다.

**내리는 주체는 셋이고, 셋 다 포트 `hideSplashScreen()` 하나를 지난다**([[ADR-117]] 결정 4 가 세운 규칙).

| 주체 | 자리 | 언제 |
|---|---|---|
| 정상 부팅 | `AppShell` 의 이펙트 타이머 | `MIN_SPLASH_MS`(1초) 경과 시점 |
| 실패 안전 타이머 | `boot-splash.ts`, **트리 밖** | 8초(`SPLASH_FAILSAFE_MS`) — 부팅 렌더가 끝내 오지 않을 때 |
| `ErrorBoundary` 폴백 | 폴백 마운트 시 | 부팅 렌더가 던졌을 때 |

실패 안전 타이머가 트리 밖에 있는 이유가 요점이다 — 정상 경로 타이머는 **언마운트 클린업이
취소하므로**, 렌더가 던지면 내릴 주체가 함께 죽어 브랜드색 화면에 갇힌다([[ADR-117]] 결정 3).

**웹판과 갈린 것 셋**(근거는 `boot-splash.ts` 주석):

- **가드가 없다.** 웹의 8초 타이머는 `#boot-cover` 가 아직 있을 때만 걷었는데, 그 가드가 막던 것은
  «사용자가 마침 `지금 적용` 을 눌러 올라간 리로드 커버까지 걷는 것» 이었다. RN 에는 그 커버가 없고
  (`show()` 가 no-op), `hideAsync()` 는 이미 내려간 스플래시에 무해하다.
- **덮는 범위가 좁다.** 웹 타이머는 앱 번들과 다른 스크립트라 번들이 통째로 깨져도 돌았다. RN 은
  번들이 하나라 이 타이머가 구하는 것은 *"번들은 평가됐는데 React 가 끝내 마운트되지 않는"* 경우뿐이다.
- **포트를 거친다.** `SplashScreen.hideAsync()` 를 직접 부르지 않는다 — 내리는 자리가 늘어도 전부
  같은 한 함수를 지나게 한다.

**`show()` 는 no-op 이다**(`rn-splash-screen.ts`). 그 함수가 존재한 이유는 웹뷰 리로드 하나였는데
(OTA 적용·캐시 초기화 직전 웹뷰 배경색을 덮는다) RN 에는 **문서를 다시 로드하는 일 자체가 없어**
덮을 구간이 생기지 않는다. `preventAutoHideAsync()` 로 흉내 내는 것은 답이 아니다 — 이미 내려간
스플래시에는 아무 효과가 없어 화면은 그대로인데 호출부만 덮였다고 믿는다.

## 아이콘·스플래시 자산 파이프라인 ([[ADR-138]], 2026-08-14)

디자인은 이미 결정된 것이라 **다시 만들지 않고 옮겼다** — 바뀐 것은 만드는 도구뿐이다
(`capacitor-assets` → `expo prebuild`).

- **원천은 캐패시터 것을 읽었다** — 아이콘은 `resources/ios/icon.png`(루트 `icon-only.png` 가
  **아니다** — 플랫폼 오버라이드가 우선이라 실제 출시본은 이쪽이었다), 스플래시 로크업은
  `resources/splash.png` 에서 추출했다(`drawable/splash_icon_lockup.png` 는 옛 디자인이라 흰 워드마크가
  흰 배경에서 안 보인다). 산출물은 `assets/` 세 장(`icon.png`·`adaptive-icon.png`·`splash-icon.png`).
- **Android adaptive icon 은 여백을 소스에 넣는다** — `capacitor-assets` 는 XML 에서 fg/bg 를 둘 다
  `inset 16.7%` 로 감쌌지만 **Expo 는 그 inset 을 안 넣는다**. 그래서 1024 캔버스 가운데에 아이콘을
  **66.6%**(681px)로 얹어 두 파이프라인이 같은 비율에 도달하게 했다. 배경색 `#E6DECF` 는 아이콘
  가장자리에서 **뽑은** 노트 종이색이라 이음매가 없다.
- **Expo 에는 `capacitor-assets` 의 함정 셋이 없다**(플랫폼 오버라이드 우선 · adaptive inset 구조 ·
  아이콘만 바꿀 때 스플래시 보호). `app.json` 한 곳을 읽고 아이콘·스플래시가 독립 항목이라 서로를
  덮지 않는다.

## 미검증

- **실기기에서 스플래시가 실제로 뜨고 걷히는 것.** 지금까지 확인된 것은 빌드
  (`expo prebuild` + `assembleDebug` · `pod install` + `xcodebuild`)와 포트 계약(jest)까지다.
- **MIUI/HyperOS 다크에서 `#F58B0F` 가 얼마나 깎이는지.** 옛 구조가 안 넘어와 대응이 없는 상태다.

## 폐기된 정책 (history)

- ~~Capacitor 플러그인 JS 브릿지 show/hide 로 스플래시 유지~~ → Android 는 플러그인 install 이 늦어 유지 안 됨(🗑 [[ADR-025]] 구현 중 폐기).
- ~~HTML 부트 스플래시 이원화(네이티브+HTML 로고)~~ → 이중 로고 발생 → 폐기(🗑 [[ADR-025]]).
- ~~Android 네이티브 스플래시를 무채색+아이콘 없음으로 축소하고 브랜드를 `index.html` HTML 레이어로 이전~~ → 실기기 2차 검증 전부 실패, 전체 폐기(🗑 [[ADR-028]], 구현 없음). "WebView 레이어로 옮긴다"는 접근이 구조적으로 불가능했다.
- ~~다크모드 색을 더 밝게 튜닝~~ → `#D06100` 이 force-dark 통과 상한임을 실기기 hue 스윕으로 확인(🗑 [[ADR-028]]).
- ~~Capacitor/WebView 를 안 거치는 초경량 `SplashActivity` + 비트맵(`@drawable/splash`)을 진짜 런처로~~ → **다크모드 진짜 브랜드색 노출에 유일하게 성공한 구조**였으나 Expo 로 넘어오지 않았다(🗑 [[ADR-029]] → [[ADR-138]]). 지금은 색 하나로 간다.
- ~~라이트 `#FB8101` / 다크 `#D06100` `values-night` split, 단색 6곳 통일~~ → RN 은 `#F58B0F` 한 색이고 `values-night/colors.xml` 이 비어 있다([[ADR-138]] 결정 4).
- ~~WebView 배경을 오렌지로 두어 흰 깜빡임 제거(`capacitor.config` `backgroundColor`)~~ → 웹뷰가 없다. 앱 루트 바탕은 [[ADR-136]] 이 칠한다.
- ~~DOM 커버(`#boot-cover` · `[data-splash-cover]`)와 `index.html` 인라인 8초 스크립트, `window.Capacitor?.Plugins?.SplashScreen?.hide()` 전역 브릿지~~ → RN 에는 문서가 없다. 8초 실패 안전 타이머만 `boot-splash.ts` 로 이사했다(⛔ [[ADR-117]] 결정 3·4 중 살아남은 부분).
- ~~iOS `SplashScreen.show()` 가 `isUserInteractionEnabled = false` 를 걸어 실패 시 터치까지 죽는다~~ → `expo-splash-screen` 은 터치를 막지 않는다(`ErrorBoundary` 주석 참고). 그래서 «영구 벽돌» 위험이 이 형태로는 없다.
