# 스플래시 (Splash Screen)

> **범위**: 앱 실행 스플래시. iOS 런치 스토리보드, Android 경량 `SplashActivity` + 비트맵, MIUI/HyperOS force-dark 대응.
> **관련 소스**: Android `SplashActivity`(진짜 런처) + `MainActivity` · `@drawable/splash`(비트맵) · `values-night` · iOS 런치 스토리보드 · Capacitor SplashScreen 플러그인 · `capacitor.config.ts`(`backgroundColor`/`androidScaleType`) · `index.html`(`#boot-cover`).
> **관련 ADR**: [[ADR-025]] [[ADR-028]] [[ADR-029]]. **관련 문서**: [../trouble/2026-07-16-splash-darkmode-native-activity.md](../trouble/2026-07-16-splash-darkmode-native-activity.md), [live-update.md](./live-update.md).

## 정책 ([[ADR-025]] → [[ADR-029]])
- **iOS**: 런치 스토리보드(오렌지 배경 + `Splash` 이미지=로고+워드마크) + Capacitor SplashScreen 플러그인 유지. `App.tsx` 가 최소 표시 시간(1s) 뒤 `SplashScreen.hide()`(`launchAutoHide:false`).
- **Android**([[ADR-029]] — [[ADR-025]]의 12+ 테마 방식을 대체): Capacitor/WebView를 전혀 안 거치는 **초경량 `SplashActivity`** 를 앱의 진짜 런처로 두고, OS 강제 무채색 첫 프레임 직후 `android:windowBackground=@drawable/splash`(비트맵, **force-dark 면역**)를 곧바로 그려 ~1.2초 유지한 뒤 `MainActivity` 로 넘긴다. 실기기 녹화 2회로 `#FB8101` 과 사실상 동일한 `(252,128,2)` 가 ~0.9초 안정 노출됨 확인 — 프로젝트 스플래시 작업 전체에서 **다크모드 진짜 브랜드색 노출 최초 성공**.
- **WebView 배경**: 흰 깜빡임 제거용으로 오렌지(`capacitor.config` `backgroundColor`).

## MIUI/HyperOS force-dark 대응 ([[ADR-025]])
HyperOS 다크모드 force-dark 가 밝은 스플래시 배경색을 앱 설정 무관하게 **luminance 기준으로 강제로 어둡게** 만드는 문제를 실기기로 규명. 배경색을 `@color/splash_background` 로 빼고 라이트 `#FB8101`/다크 `#D06100`(강제 다크 변환을 통과하는 상한)으로 `values-night` split. 단색 통일(2026-07-17, [[ADR-029]] 정정): 스플래시 이미지 교체로 배경이 `#F58B0F`(UI primary)로 바뀌었는데 코드 단색이 안 따라가 리로드 커버 이음새로 드러나, 단색 6곳(웹뷰 배경·splash_colors 라이트·iOS 스토리보드·플러그인 bg·boot-cover·오버레이)을 이미지 기준 `#F58B0F` 로 통일(다크 `#D06100` 유지).

## 핵심 교훈
- **Capacitor 브릿지+플러그인 초기화가 끝나기 전엔 HTML 레이어가 그려질 시점 자체가 없다** — 그래서 "브랜드 룩을 WebView/HTML 레이어로 옮긴다"는 접근([[ADR-028]])은 실기기에서 실패했고, "Capacitor를 아예 안 거치는 별도 네이티브 액티비티 + 비트맵"([[ADR-029]])만 성공했다.
- 콜드스타트 내내 무언가는 보여야 하는데, 브랜드 없는 무채색보다 살짝 어두운 주황(`#D06100`)이 낫다.

## 폐기된 정책 (history)
- ~~Capacitor 플러그인 JS 브릿지 show/hide로 스플래시 유지~~ → Android는 플러그인 install이 늦어 유지 안 됨([[ADR-025]] 구현 중 폐기).
- ~~HTML 부트 스플래시 이원화(네이티브+HTML 로고)~~ → 이중 로고 발생 → 폐기([[ADR-025]]).
- ~~Android 네이티브 스플래시를 무채색+아이콘 없음으로 축소하고 브랜드를 `index.html` HTML 레이어로 이전~~ → 실기기 2차 검증 전부 실패, 전체 폐기([[ADR-028]], 구현 없음). "WebView 레이어로 옮긴다"는 접근이 구조적으로 불가능. **이 결론은 [[ADR-029]] 의 "Capacitor 미경유 네이티브 액티비티 + 비트맵"으로 뒤집힘**(그 방식은 성공).
- ~~다크모드 색을 더 밝게 튜닝~~ → `#D06100` 이 force-dark 통과 상한임을 실기기 hue 스윕으로 확인, 색 튜닝 대신 [[ADR-029]] 방식 채택([[ADR-028]]).
