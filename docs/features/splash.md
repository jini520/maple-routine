# 스플래시 (Splash Screen)

> **범위**: 앱 실행 스플래시 한 장. 언제 뜨고, 무엇으로 그리고, 누가 내리는가.
> **여기 없는 것**: 웹뷰 시절의 두 장 구조(네이티브 + DOM 커버), `SplashActivity` 비트맵, MIUI
> force-dark 색 split 은 전부 캐패시터 앱의 것이고 저장소에서 사라졌다. 아래
> [폐기된 정책](#폐기된-정책-history)에만 남는다.
> **관련 문서**: [live-update.md](./live-update.md) ·
> [../foundation/release.md](../foundation/release.md) · [theme.md](./theme.md)

## 관련 소스

| 구분 | 파일 | 하는 일 |
|---|---|---|
| 설정 | `app.json` 의 `expo-splash-screen` 블록 | 1겹의 색. **로고는 없다**([[ADR-216]] 정정 1) |
| 에셋 | `assets/splash-icon-none.png` | 1겹용 완전 투명 PNG. 플러그인이 아이콘 항목을 하드코딩해 **지울 수가 없어** 투명으로 비운다 |
| 에셋 | `assets/splash-icon.png` | 로고. **2겹이 쓴다** |
| 2겹 | `src/app/BootSplash.tsx` | 앱이 그리는 브랜드 화면. 애니메이션이 들어갈 자리 |
| 산출물 | Android `values/colors.xml` 의 `splashscreen_background` | `expo prebuild` 가 내린다 |
| 산출물 | iOS `Images.xcassets/SplashScreen{Background,Logo}` | 같다 |
| 붙들기 | `index.ts` → `src/boot-splash.ts` | 붙들기와 실패 안전 타이머 |
| 내리기 | `BootSplash` 의 `onLayout` | 정상 경로. **시계가 아니라 2겹이 그려졌다는 사실이 신호다** |
| 포트 | `src/native/splash-screen.ts` · `adapters/rn-splash-screen.ts` | 내리는 자리를 하나로 모은다 |

**관련 ADR**: [[ADR-138]](자산 파이프라인) · [[ADR-128]](RN 어댑터) · [[ADR-136]](앱 루트 바탕색) ·
⛔ ADR-117 결정 3·4(실패 안전 타이머, 내리는 코드 한 곳. 🔗 로 살아남은 부분)

## 정책: 지금은 네이티브 스플래시 **한 장**뿐이다 ([[ADR-128]] · [[ADR-138]])

> ⚠️ **[[ADR-216]] 이 이 한 장을 두 겹으로 바꾸는 중이다**(설계, 미구현). 아래는 그 전의 현행이다.
> 애니메이션이 들어갈 자리가 지금 구조에 없다는 것이 그 ADR 의 출발점이고, 그 조사에서
> **1겹을 내리는 타이머가 화면에 무엇이 그려졌는지 모른다**는 것이 드러났다. 아래
> [내리기의 문제](#내리기의-문제-adr-216-이-고친다)를 함께 볼 것.

RN 에는 문서(document)가 없어 덮을 DOM 커버라는 개념 자체가 없다. 스플래시는 OS 가 그리는 네이티브
화면 하나이고, 앱이 하는 일은 **언제까지 띄워 두고 언제 내리는가** 둘뿐이다.

- **1겹의 색은 `app.json` 한 곳이 정한다**. `expo-splash-screen` 플러그인 블록:
  `image: ./assets/splash-icon-none.png`(완전 투명) · `backgroundColor: #FFFFFF` ·
  `dark.backgroundColor: #000000`. `expo prebuild` 가 이 값을 네이티브로 내린다
  (Android `values/colors.xml` 과 `values-night/colors.xml` 의 `splashscreen_background`,
  iOS `SplashScreenBackground.colorset`).
- **1겹은 시스템 테마를 따라간다**([[ADR-216]] 결정 4 정정 2, 사용자 지정). 라이트에서 흰색,
  다크에서 검정. 브랜드는 2겹이 든다.
  **덤으로 MIUI/HyperOS force-dark 문제가 구조에서 사라진다** - 다크에서 1겹이 검정이라 **깎을
  밝은 색이 없고**, 브랜드 주황은 전부 RN 뷰인 2겹으로 옮겨갔다. ⛔ [[ADR-025]] 의 색 split 이
  풀려던 문제고 [[ADR-138]] 결정 4 가 대가로 받아들였던 것이다. **MIUI 실기기 미검증이다.**
- **`app.json` 을 고쳤으면 `expo prebuild` 를 돌려야 반영된다**(네이티브가 커밋돼 있다). prebuild 는
  **fingerprint 를 바꾸므로 OTA 재배포가 뒤따라야 한다**([[ADR-137]] 정정 2).
- ⚠️ **prebuild 는 `android/` 를 통째로 지우고 다시 만든다**(로그의 `Clearing android`). 그래서
  커밋 안 된 것 셋이 함께 사라진다(2026-09-04, 두 번 재현).
  | 사라지는 것 | 증상 |
  |---|---|
  | `android/app/build.gradle` 의 릴리스 서명 블록([[ADR-091]]) | release 가 **서명 없이** 나온다 |
  | `android/keystore.properties` | 같다. 블록이 살아 있어도 키를 못 찾는다 |
  | `android/app/build/` 의 APK | 직전 빌드 산출물이 없어진다 |
  prebuild 뒤 `git diff android/app/build.gradle` 을 보고, 산출물이
  `app-release-unsigned.apk` 로 나왔으면 이것부터 의심할 것.
- `values/styles.xml` 도 prebuild 산출물이다. `AppTheme` 을 손으로 고치면 다음 prebuild 가 지우므로
  바꿀 것이 있으면 `app.config.js` 의 config plugin 으로 넣을 것.

## 띄워 두기와 내리기

**띄워 두는 호출은 React 트리 밖, 전역 스코프여야 한다.** `index.ts` 가 `registerRootComponent` **앞에서**
`holdSplashUntilAppReady()`(`src/boot-splash.ts`)를 부르고, 그 안에서
`SplashScreen.preventAutoHideAsync()` 를 호출한다. 라이브러리 문서가 컴포넌트·훅 안에서 부르지
말라고 명시한다(늦으면 이미 내려간 뒤다). 안 부르면 스플래시가 첫 렌더 전에 스스로 사라져
테마 복원 전 화면이 노출된다.

**내리는 주체는 셋이고, 셋 다 포트 `hideSplashScreen()` 하나를 지난다**([[ADR-117]] 결정 4 가 세운 규칙).

| 주체 | 자리 | 언제 |
|---|---|---|
| 정상 부팅 | `AppShell` 의 이펙트 타이머 | `MIN_SPLASH_MS`(1초) 경과 시점 |
| 실패 안전 타이머 | `boot-splash.ts`, **트리 밖** | 8초(`SPLASH_FAILSAFE_MS`). 부팅 렌더가 끝내 오지 않을 때 |
| `ErrorBoundary` 폴백 | 폴백 마운트 시 | 부팅 렌더가 던졌을 때 |

실패 안전 타이머가 트리 밖에 있는 이유가 요점이다. 정상 경로 타이머는 **언마운트 클린업이
취소하므로**, 렌더가 던지면 내릴 주체가 함께 죽어 브랜드색 화면에 갇힌다([[ADR-117]] 결정 3).

## 내리기의 문제 ([[ADR-216]] 이 고친다)

**이 타이머는 화면에 무엇이 그려졌는지 모른다.**

```ts
// src/app/AppShell.tsx:128
const remaining = MIN_SPLASH_MS - (Date.now() - APP_START_MS)
```

기준점 `APP_START_MS = Date.now()` 가 같은 파일 모듈 최상위라 앱 실행 시점이 아니라 **번들이
평가되는 시점**이다. 실제 공식은 `번들 평가까지 걸린 시간 + 1초` 다.

그래서 이 타이머가 보장하는 것은 스플래시가 1초 이상 보인다는 것뿐이고, **그것이 걷힐 때 아래에
무엇이 있는지는 보장하지 않는다.** 지금 빈 화면이 안 보이는 것은 설계가 맞아서가 아니라 부팅이
그 1초보다 빨랐던 것뿐이다. `expo-splash-screen` 문서도 `hide()` 에 같은 경고를 단다.

여기에 OS 쪽 제약이 하나 더 겹친다. **안드로이드는 스플래시를 앱에 넘기는 데 제한 시간을 둔다.**
그 안에 앱이 못 받으면 시스템이 그냥 걷어 가는데(logcat 의 `transferring splash screen timeout`),
`AppTheme` 에 `android:windowBackground` 지정이 없어 그때 드러나는 것이 **검정**이다.

계측(에뮬레이터 · **debug 빌드** · 2026-09-04, 1겹을 흰색 2겹을 노란색으로 갈라 녹화):

| 구간 | 길이 | 정체 |
|---|---|---|
| 1.60 ~ 6.40s | 4.80s | 흰색. 1겹 |
| 6.55 ~ 10.30s | **3.75s** | **검정** |
| 10.65 ~ 12.40s | 1.75s | 노랑. 2겹 |

**이 숫자는 못 쓴다.** debug 라 Metro 에서 번들을 받고 그래서 제한 시간에 걸렸다.

**release 에서 재 봤더니 검정이 없다**(에뮬레이터 Pixel 8 API 36 · release · `pm clear` 후 · 2026-09-04).

| | 기준선(시계로 내림) | 2겹 배선 후 |
|---|---|---|
| 주황 총 길이 | 1.80s | 2.43s |
| **검정** | **0** | **0** |
| `transferring splash screen timeout` | 없음 | 없음 |
| `Displayed` | +1s621ms | +2s088ms |

기준선의 1.80초는 `번들 평가 0.8초 + MIN_SPLASH_MS 1초` 다. 그러니까 **검정은 debug 산출물이었다.**
Metro 가 12초에서 14초를 쓰는 바람에 OS 제한 시간에 걸린 것이고, 번들이 내장인 release 는 그 근처에도
안 간다. debug 로는 이 확인을 할 수 없다. 그쪽은 매번 걸린다.

**웹판과 갈린 것 셋**(근거는 `boot-splash.ts` 주석):

- **가드가 없다.** 웹의 8초 타이머는 `#boot-cover` 가 아직 있을 때만 지웠는데, 그 가드가 막던 것은
  ‘사용자가 마침 `지금 적용` 을 눌러 올라간 리로드 커버까지 지우는 것’이었다. RN 에는 그 커버가 없고
  (`show()` 가 no-op), `hideAsync()` 는 이미 내려간 스플래시에 무해하다.
- **덮는 범위가 좁다.** 웹 타이머는 앱 번들과 다른 스크립트라 번들이 통째로 깨져도 돌았다. RN 은
  번들이 하나라 이 타이머가 구하는 것은 *"번들은 평가됐는데 React 가 끝내 마운트되지 않는"* 경우뿐이다.
- **포트를 거친다.** `SplashScreen.hideAsync()` 를 직접 부르지 않는다. 내리는 자리가 늘어도 전부
  같은 한 함수를 지나게 한다.

**`show()` 는 no-op 이다**(`rn-splash-screen.ts`). 그 함수가 존재한 이유는 웹뷰 리로드 하나였는데
(OTA 적용·캐시 초기화 직전 웹뷰 배경색을 덮는다) RN 에는 **문서를 다시 로드하는 일 자체가 없어**
덮을 구간이 생기지 않는다. `preventAutoHideAsync()` 로 흉내 내는 것은 답이 아니다. 이미 내려간
스플래시에는 아무 효과가 없어 화면은 그대로인데 호출부만 덮였다고 믿는다.

## 아이콘·스플래시 자산 파이프라인 ([[ADR-138]], 2026-08-14)

디자인은 이미 결정된 것이라 **다시 만들지 않고 옮겼다**. 바뀐 것은 만드는 도구뿐이다
(`capacitor-assets` → `expo prebuild`).

- **원천은 캐패시터 것을 읽었다**. 아이콘은 `resources/ios/icon.png`(루트 `icon-only.png` 가
  **아니다**. 플랫폼 오버라이드가 우선이라 실제 출시본은 이쪽이었다), 스플래시 로크업은
  `resources/splash.png` 에서 추출했다(`drawable/splash_icon_lockup.png` 는 옛 디자인이라 흰 워드마크가
  흰 배경에서 안 보인다). 산출물은 `assets/` 세 장(`icon.png`·`adaptive-icon.png`·`splash-icon.png`).
- **Android adaptive icon 은 여백을 소스에 넣는다**. `capacitor-assets` 는 XML 에서 fg/bg 를 둘 다
  `inset 16.7%` 로 감쌌지만 **Expo 는 그 inset 을 안 넣는다**. 그래서 1024 캔버스 가운데에 아이콘을
  **66.6%**(681px)로 얹어 두 파이프라인이 같은 비율에 도달하게 했다. 배경색 `#E6DECF` 는 아이콘
  가장자리에서 **뽑은** 노트 종이색이라 이음매가 없다.
- **Expo 에는 `capacitor-assets` 의 함정 셋이 없다**(플랫폼 오버라이드 우선 · adaptive inset 구조 ·
  아이콘만 바꿀 때 스플래시 보호). `app.json` 한 곳을 읽고 아이콘·스플래시가 독립 항목이라 서로를
  덮지 않는다.

## 미검증

- **실기기에서 스플래시가 실제로 뜨고 걷히는 것.** 지금까지 확인된 것은 빌드
  (`expo prebuild` + `assembleDebug` · `pod install` + `xcodebuild`)와 포트 계약(jest)까지다.
- **MIUI/HyperOS 다크에서 1겹이 검정으로 그대로 뜨는지.** [[ADR-216]] 결정 4 정정 2 가 구조로
  풀었다고 보지만(깎을 밝은 색이 없다) 실기기로 안 봤다. 2겹의 주황이 RN 뷰라 안 깎이는 것도
  같이 확인해야 한다.

## 폐기된 정책 (history)

- ~~Capacitor 플러그인 JS 브릿지 show/hide 로 스플래시 유지~~ → Android 는 플러그인 install 이 늦어 유지 안 됨(🗑 [[ADR-025]] 구현 중 폐기).
- ~~HTML 부트 스플래시 이원화(네이티브+HTML 로고)~~ → 이중 로고 발생 → 폐기(🗑 [[ADR-025]]).
- ~~Android 네이티브 스플래시를 무채색+아이콘 없음으로 축소하고 브랜드를 `index.html` HTML 레이어로 이전~~ → 실기기 2차 검증 전부 실패, 전체 폐기(🗑 [[ADR-028]],
구현 없음). "WebView 레이어로 옮긴다"는 접근이 구조적으로 불가능했다.
- ~~다크모드 색을 더 밝게 튜닝~~ → `#D06100` 이 force-dark 통과 상한임을 실기기 hue 스윕으로 확인(🗑 [[ADR-028]]).
- ~~Capacitor/WebView 를 안 거치는 초경량 `SplashActivity` + 비트맵(`@drawable/splash`)을 진짜 런처로~~ → **다크모드 진짜 브랜드색 노출에 유일하게
성공한 구조**였으나 Expo 로 넘어오지 않았다(🗑 [[ADR-029]] → [[ADR-138]]). 지금은 색 하나로 간다.
- ~~라이트 `#FB8101` / 다크 `#D06100` `values-night` split, 단색 6곳 통일~~ → 한때 RN 은 `#F58B0F` 한 색이었고 `values-night/colors.xml`
이 비어 있었다([[ADR-138]] 결정 4). 지금은 split 이 **다시 살아 있다** - 다만 브랜드색 두 가지가 아니라 흰색/검정이다([[ADR-216]] 결정 4 정정 2).
- ~~WebView 배경을 오렌지로 두어 흰 깜빡임 제거(`capacitor.config` `backgroundColor`)~~ → 웹뷰가 없다. 앱 루트 바탕은 [[ADR-136]] 이 칠한다.
- ~~DOM 커버(`#boot-cover` · `[data-splash-cover]`)와 `index.html` 인라인 8초 스크립트,
`window.Capacitor?.Plugins?.SplashScreen?.hide()` 전역 브릿지~~ → RN 에는 문서가 없다. 8초 실패 안전 타이머만 `boot-splash.ts` 로 이사했다(⛔
[[ADR-117]] 결정 3·4 중 살아남은 부분).
- ~~iOS `SplashScreen.show()` 가 `isUserInteractionEnabled = false` 를 걸어 실패 시 터치까지 죽는다~~ → `expo-splash-screen` 은
터치를 막지 않는다(`ErrorBoundary` 주석 참고). 그래서 ‘영구 벽돌’ 위험이 이 형태로는 없다.
