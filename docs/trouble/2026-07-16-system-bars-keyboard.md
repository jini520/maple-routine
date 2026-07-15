# 시스템 바·키보드 실기기 트러블슈팅 (2026-07-16)

"하단 내비게이션 바 색이 앱 탭바와 안 맞는다"는 한 줄에서 시작해, 시스템 바를 앱이 직접 그리는 구조로 바꾸고 키보드 동작까지 손보게 된 과정. **틀린 진단을 여러 번 거쳤고, 그 원인이 대부분 "측정 대신 추론"이었다**는 게 이 문서의 핵심 교훈이다.

검증 기기: Samsung SM-F711N(Android 15 / WebView 131), Xiaomi 23129RAA4G(Android 13 / WebView 150), iPhone 17(iOS 실기기), iPhone 17 Pro(시뮬레이터).

## 1. 시스템 바 색 불일치

### 1-1. 틀린 진단 ①: 글리프 명암·대비 스크림

**증상**: 하단 내비 바가 앱 탭바와 색이 안 맞음.

**당시 추론**: `targetSdkVersion = 36`이니 Android 15+ edge-to-edge가 강제되고, 그러면 바 배경은 이미 앱이 그리고 있을 테니 문제는 **글리프 명암**이거나 시스템이 덧씌우는 **대비 스크림**일 것이다 → `setAppearanceLightNavigationBars` + `setNavigationBarContrastEnforced(false)` 구현.

**결과**: 해결 안 됨. 배경색을 전혀 건드리지 않는 수정이었다.

**무엇이 틀렸나**: `targetSdk 36`은 **앱이 지향하는 버전**일 뿐, edge-to-edge 강제는 **기기 OS가 Android 15+일 때** 발생한다. 당시 테스트 기기는 **Android 13**이었다. 전제부터 틀린 채 코드를 짰다.

### 1-2. 틀린 진단 ②: `setNavigationBarColor`로 칠하기

**증상**: 스크린샷 픽셀을 재보니 원인이 명확했다 — 탭바는 `#fdfcf6`인데 **시스템 내비 바가 `#000000`(검정 불투명)**.

**해결(당시)**: Android 13에선 `setNavigationBarColor()`가 정상 작동하므로 테마의 `--color-surface`를 읽어 네이티브로 넘겨 칠함. Android 13에서 검정 → `#fdfcf6`로 해결 확인.

**그런데**: 사용자가 **"모든 버전에 호환돼야 한다"**고 지적. Android 15에선 이 API가 **no-op(무시)** 이므로 이 접근은 절반짜리였다. 실제로 Android 15 기기에서 양쪽 바가 `#fafafa` 흰 띠로 남았다.

### 1-3. 단축 hex(`#fff`)를 `Color.parseColor`가 거부

**증상**: 위 접근에서 4개 테마 중 **렌만** 색이 안 바뀜.

**원인**: logcat으로 네이티브에 넘어간 값을 직접 확인:

```
머쉬맘: {"dark":false,"color":"#fdfcf6"}   ✓
혼테일: {"dark":true, "color":"#241110"}   ✓
레테:  {"dark":true, "color":"#1a1720"}   ✓
렌:    {"dark":false,"color":"#fff"}      ← 3자리!
```

렌의 표면색은 `#ffffff`인데 **Vite CSS 미니파이어가 `#fff`로 축약**하고 `getComputedStyle`이 그 축약형을 반환한다. Android `Color.parseColor()`는 `#rrggbb`/`#aarrggbb`만 받고 3자리는 예외를 던지는데, 플러그인의 try/catch가 그 예외를 삼켜 조용히 무시됐다. 다른 테마는 6자리라 무관했다.

**해결**: 어댑터에서 3자리→6자리로 확장. (단 이 문제는 최종 구조에서 **소멸** — 색을 네이티브로 넘기지 않게 되면서 이 버그 종류 자체가 성립하지 않는다.)

### 1-4. 진짜 원인: Capacitor의 WebView 140 게이트

**결정적 데이터**: 두 기기가 정반대로 동작했다.

| | Xiaomi | Samsung |
|---|---|---|
| OS / WebView | Android 13 / **150** | Android 15 / **131** |
| 증상 | 내비 바만 검정 (상태바는 정상) | **양쪽 바 `#fafafa` 흰 띠** |

**원인**: Capacitor 8 내장 `SystemBars`(`node_modules/@capacitor/android/.../plugin/SystemBars.java`)가 **WebView 버전으로 분기**한다:

```java
private static final int WEBVIEW_VERSION_WITH_SAFE_AREA_FIX = 140;
boolean shouldPassthroughInsets = getWebViewMajorVersion() >= WEBVIEW_VERSION_WITH_SAFE_AREA_FIX && hasViewportCover;

if (shouldPassthroughInsets) {
    v.setPadding(0, 0, 0, ...);   // 패딩 없음 → WebView가 edge-to-edge, env()가 정상 동작
}
if (Build.VERSION.SDK_INT >= VANILLA_ICE_CREAM) {   // Android 15+
    v.setPadding(left, top, right, bottom);         // ← WebView를 시스템 바 안쪽으로 밀어냄
}
```

WebView < 140이면(구버전 `env()` 버그 회피용) **WebView 컨테이너에 패딩**을 넣어 바 영역을 앱이 못 그리게 하고, 그 자리엔 네이티브 배경(`#fafafa` = AppCompat DayNight 라이트 기본 windowBackground)이 노출된다. 게다가 Android 15+는 `setNavigationBarColor`가 no-op이라 네이티브로 칠할 수도 없다 — **그 조합에선 어떤 방법으로도 색을 맞출 수 없었다.**

즉 갈림길은 **Android 버전이 아니라 WebView 버전**이었다. 사용자가 Play 스토어에서 WebView를 140+로 업데이트하자 즉시 정상이 됐고(진단 확정), 다시 되돌리자 재현됐다.

**그리고 이건 예외 상황이 아니다** — Android 15인데 WebView가 131에 묶인 실기기가 실제로 존재했다.

**해결**: Capacitor의 인셋 개입을 끄고 우리가 직접 통제한다.

1. `capacitor.config.ts`: `SystemBars: { insetsHandling: 'disable' }` (공식 옵션)
2. `SystemBarsPlugin.java`: 항상 edge-to-edge 고정(`setDecorFitsSystemWindows(false)` + 바 투명 + contrast off), 인셋을 `--safe-area-inset-*` CSS 변수로 직접 주입
3. `index.css`: `--sa-top`/`--sa-bottom` 별칭 정의, 앱은 `env()` 대신 이 변수 사용

**핵심은 `env()`를 안 거치는 것**이다. Capacitor가 140/144로 분기하는 이유가 구버전 WebView의 `env()` 버그인데, 값을 CSS 변수로 직접 주입하면 그 버그가 무관해져 **버전 분기 자체가 소멸**한다. Capacitor도 같은 방향을 `insetsHandling: 'full'`로 Cap 9에 넣을 예정(`SystemBars.java`의 TODO) — 그때 이 플러그인은 걷어낸다.

**검증**(Android 15 + WebView 131, 그 안 되던 조합): 혼테일 `#0b0b0b`/`#241110`, 렌 `#f6f5f5`/`#ffffff` 픽셀 일치.

**부수 효과**: 앱이 직접 그리므로 모달 딤·온보딩(탭바 없음)·회전·폴더블 접힘이 전부 자동으로 맞는다. 색을 네이티브로 넘기지 않으니 1-3의 hex 문제도 사라졌다.

### 1-5. 폐기한 접근 — 다시 시도하지 말 것

- **`setNavigationBarColor(surface)`**: Android 15에서 no-op.
- **컨테이너 뷰에 투톤 배경 그리기**: 키보드 padding을 내비 인셋으로 오인해 색 띠가 번쩍이고(최신 WebView에도 회귀), 온보딩(탭바 없음)에서 색이 틀리고, Capacitor 내부 구현(`getParent()`에 padding을 준다)에 의존해 조용히 깨진다.
- **단색 윈도우 배경**: 상단(bg-bg)과 하단(surface)이 다른데 색은 하나뿐이라 한쪽에 이음매가 남는다.

## 2. 모달이 화면 끝까지 안 덮음

**증상**: 모달을 띄우면 최하단 제스처 영역만 딤이 빠져 밝은 띠로 남음. (앱이 edge-to-edge가 되면서 드러난 문제 — 이전엔 바 영역을 앱이 아예 안 그려 안 보였다.)

**진단**: `fixed inset-0`인데 왜 못 닿는지 이해가 안 돼 실제 기하값을 찍었다.

```
overlayComputed:  position:fixed, top:0px, bottom:0px  →  height 864  ❌
probeFixedInset0: (body 직속, 동일 스타일)              →  height 880  ✅
overlayMargins:   { bottom: "16px" }
parentCls:        "p-4 space-y-4"
```

**원인**: Tailwind v4의 `space-y-*`는 마지막이 아닌 자식에 `margin-block-end`를 붙인다. 모달이 `SettingsScreen`의 `space-y-4` 안에서 렌더돼 오버레이가 `margin-bottom:16px`를 받았고, **`position:fixed`에 `top`/`bottom`이 함께 걸린 요소는 마진만큼 높이가 줄어든다**(`880 - 0 - 0 - 16 = 864`). 조상 체인에 `transform`/`filter`/`contain`은 전부 없었다 — WebView 버그가 아니라 부모 컨텍스트 문제였다.

**해결**: `Modal`을 `createPortal(document.body)`로 렌더. 호출부가 어떤 레이아웃 유틸리티 안에 있든 오버레이가 항상 뷰포트 전체를 덮는다. 모달 5곳이 이 컴포넌트를 공유하므로 한 번에 해결.

**확인**: 오버레이가 상태바·제스처 영역을 덮어도 **시스템 컨트롤은 안 막힌다** — 실기기에서 스와이프업(홈 이동)·상단바 끌어내리기(알림창) 정상 동작 확인.

## 3. 키보드 — 양 플랫폼의 원인이 다름

### 3-1. Android: 탭바가 키보드 위에 얹힘

**원인**: Capacitor가 키보드 높이만큼 컨테이너에 패딩을 넣어 뷰포트가 줄면, `fixed bottom-0`인 탭바가 키보드 바로 위에 얹힌다.

**해결**: 키보드가 뜬 동안 탭바를 숨긴다. **밀어 올리는 동작 자체는 건드리지 않는다** — 없애면 입력창이 키보드에 가린다.

### 3-2. iOS: 콘텐츠 전체가 밀림

**증상**: 입력 포커스 시 콘텐츠가 위로 밀려 상태바를 침범하고, 하단에 WebView 배경(브랜드 오렌지 `#FB8101`)이 노출.

**원인**: **Capacitor iOS 코어엔 키보드 처리 코드가 아예 없다**(`keyboardWillShow` 등 0건). 즉 WKWebView가 입력창을 노출하려 스크롤뷰를 밀어 올리는 **기본 동작**이 그대로 나온 것이고, 콘텐츠가 딱 뷰포트 높이라 그만큼 아래가 비어 배경이 드러났다. 앱 코드로는 막을 수 없다.

**해결**: `@capacitor/keyboard` 도입. iOS `resize` 기본값 `native` = *"키보드가 뜨면 WebView 자체를 줄인다"* → 스크롤로 밀지 않으므로 상태바 침범·배경 노출이 사라진다.

**부수 효과**: 이 플러그인이 `keyboardWillShow`/`keyboardWillHide`를 **양 플랫폼 모두** 제공하므로, 3-1용으로 직접 만들었던 안드로이드 네이티브 이벤트를 걷어내고 `native/keyboard.ts` 하나로 통일했다 — 의존성은 늘었지만 코드는 줄었다.

### 3-3. 키보드 뒤 배경이 브랜드 오렌지

**원인**: `resize:native`로 WebView가 줄면 그 뒤로 기본 배경이 드러나는데, `capacitor.config.ts`의 `backgroundColor: '#FB8101'`(스플래시 깜빡임 방지용)이 그대로 비쳤다.

**해결**: `Keyboard: { autoBackdropColor: 'dom' }`. `'auto'`는 config의 `backgroundColor`(=그 오렌지)를 쓰므로 부적합하고, `'dom'`은 **웹앱 body 배경에서 색을 읽어** 테마를 따라간다.

**함정**: 문서에 *"If the DOM has no resolvable background, the backdrop is left untouched"* — 확인해보니 앱이 `bg-bg`를 AppShell div에만 걸어 **body엔 배경이 없었다**. `index.css`에 `body { background-color: var(--color-bg) }`를 추가해야 비로소 동작한다.

### 3-4. 모달이 키보드에 가려졌다 "뚝" 하고 올라감

**증상**: 키보드가 뜨면 모달이 잠시 가려졌다가 애니메이션 없이 스냅.

**원인**: `@capacitor/keyboard`의 `Keyboard.m`:

```objc
double duration = [...UIKeyboardAnimationDurationUserInfoKey...] + 0.2;   // 하드코딩
[self setKeyboardHeight:(int)height delay:duration];
// → _updateFrame → ResizeNative
[self.webView setFrame:...];   // UIView.animate 없이 즉시
```

**"키보드 애니메이션 시간 + 0.2초"를 기다렸다가 애니메이션 없이 프레임을 바꾼다.** 플러그인의 의도된 동작이고 하드코딩이라 설정으로 못 바꾼다. CSS로도 못 고친다 — 뷰포트 변화는 transition 대상이 아니다.

**해결**: 모달을 **상단 정렬**로 바꿈(`Modal.align`, 기본 `'top'`). 세로 중앙이면 뷰포트가 줄 때 중앙이 키보드 높이의 절반만큼 이동해 크게 튀지만, 상단 고정이면 뷰포트가 줄어도 위치가 변하지 않아 **애초에 튈 일이 없다**. 입력이 없는 `UpdatePromptModal`만 `align="center"` 유지.

**검토했다 버린 대안**: `resize:'none'` + 직접 `transform`으로 애니메이션 — 진짜 애니메이션은 되지만 방금 고친 3-2(밀림)를 되살릴 위험이 커서 손익이 안 맞았다.

## 4. 온보딩이 중앙이 아니고 스크롤됨

**증상**: 온보딩 카드가 정중앙보다 아래로 치우치고 스크롤이 생김.

**원인**: `min-h-screen` 중첩.

```tsx
<div className="min-h-screen ... pt-[var(--sa-top)]">   // AppShell: 100vh + 상단 안전영역
    <div className="flex min-h-screen items-center ...">  // 온보딩: 또 100vh
```

문서 높이가 `sa-top + 100vh`가 돼 뷰포트를 안전영역만큼 초과 → 스크롤이 생기고 중앙이 그만큼 아래로 밀린다. 화면상 편차가 정확히 상단 안전영역 크기와 일치했다. **기존부터 있던 버그**로 이번 변경과 무관.

**해결**: 모달과 같은 상단 정렬로 통일하면서 `min-h` 자체를 제거 — 상단 정렬은 컨테이너 높이가 위치에 영향을 주지 않고 배경은 AppShell이 채우므로, 계산 보정이 아니라 **구조적으로** 사라졌다.

## 5. 테스트 환경 이슈

### 5-1. capgo OTA 번들이 내장 번들을 가림 (세 번 당함)

**증상**: 새 빌드를 설치했는데 새 코드가 실행조차 안 됨. Android에서 두 번, iOS 실기기에서 한 번 — **메모리에 적어두고도** 또 밟았다.

**원인**: 기기가 이미 OTA 번들을 적용해 뒀으면, 새 APK/앱을 깔아도 **내장 번들이 아니라 그 OTA 번들이 로드**된다. 설정 화면의 "현재 버전"이 `1.0.0`(=내장)이 아니면 이 상태다.

**해결**: 네이티브 버전을 올려 capgo의 리셋을 유도한다.

| 플랫폼 | 올릴 값 |
|---|---|
| Android | `android/app/build.gradle`의 `versionCode` |
| **iOS** | `ios/App/App.xcodeproj`의 `CURRENT_PROJECT_VERSION`(= `CFBundleVersion`) |

iOS 근거는 `CapacitorUpdaterPlugin.swift`:

```swift
currentBuildVersion = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "0"
// "Native build version changed from ... Resetting startup bundle to builtin."
```

시뮬레이터는 `simctl uninstall` 후 재설치로도 되지만 데이터가 날아간다. 버전 bump는 데이터를 보존한다.

**이전 문서([[2026-07-15-live-update-testing]] 2-4)에 Android만 적어둔 탓에 iOS에서 못 써먹었다.**

### 5-2. 측정 도구가 측정 대상을 오염시킴

**증상**: iOS 키보드 동작을 보려고 임시 입력창을 넣고 테스트 → "탭바가 안 얹히네 → iOS는 문제 없음"이라고 결론. **틀렸다.**

**원인**: 임시 입력창에 `text-sm`(14px)을 줬는데, **iOS는 폼 글자가 16px 미만이면 포커스 시 자동 확대**한다. 그 확대가 레이아웃을 바꿔 진짜 거동을 가렸다. 실제 앱 입력창(`ApiKeyForm`)은 16px라 확대되지 않는다 — 즉 **테스트 기구에만 있는 조건**이 결과를 뒤집었다.

**교훈**: 테스트용으로 넣는 코드도 **실제 코드와 같은 조건**이어야 한다. 특히 스타일이 동작에 영향을 주는 플랫폼(iOS 자동 확대)에선 치명적.

### 5-3. 시뮬레이터에서 소프트웨어 키보드가 안 뜸

**증상**: iOS 시뮬레이터에서 입력창을 포커스해도 키보드가 안 나와 검증이 불가능.

**원인**: 맥 하드웨어 키보드가 연결돼 있으면 소프트웨어 키보드를 띄우지 않는다.

**시도했으나 실패**: `defaults write com.apple.iphonesimulator ConnectHardwareKeyboard -bool false`(전역·기기별 둘 다) + Simulator 재시작 → 효과 없음. AppleScript로 `Cmd+K` 전송 → **접근성 권한 거부**.

**결론**: Simulator 창에서 **수동으로 `Cmd+K`**(I/O → Keyboard → Toggle Software Keyboard)를 눌러야 한다. 자동화 세션에서는 iOS 키보드 검증을 **실기기에 의존**해야 한다.

### 5-4. iOS 실기기는 스크린샷 자동화가 안 됨

**증상**: `idb list-targets`에 실기기가 안 잡히고 `devicectl`엔 screenshot이 없어, 실기기 화면을 직접 측정할 수 없었다.

**대응**: 사용자가 찍어준 스크린샷에 의존. 반복 검증 비용이 크므로, **시뮬레이터에서 재현되는 문제는 시뮬레이터에서 끝내고** 실기기는 최종 확인용으로 쓰는 게 효율적이다(단 5-3처럼 시뮬레이터가 재현 못 하는 영역이 있다).

### 5-5. MIUI 제약은 여전

Xiaomi는 `input tap`이 차단돼(`Exception occurred while executing 'tap'`) 키보드 자동 검증이 불가. 바 색상처럼 **탭이 필요 없는 검증**은 스크린샷 픽셀로 처리하고, 탭이 필요한 건 Samsung/iOS로 돌렸다. 자세한 내용은 [[2026-07-15-live-update-testing]] 2-2~2-4.

## 요약 — 재발 방지 체크리스트

- **추론하지 말고 측정할 것.** 이번 세션의 틀린 진단 3건(글리프/스크림, `setNavigationBarColor`, "iOS는 탭바 문제 없음")은 전부 "코드를 읽고 추론"에서 나왔고, 전부 **픽셀·logcat·기하값을 찍는 순간** 해결됐다. `#000000`, `#fafafa`, `height 864 vs 880`, `color:"#fff"` — 숫자 하나가 며칠 걸릴 추측을 끝냈다.
- **`targetSdk`는 기기 OS가 아니다.** 동작 분기는 **실제 기기 OS·WebView 버전**으로 결정된다. Android 13 기기에서 "targetSdk 36이니 Android 15 동작일 것"이라 가정한 게 첫 오진의 원인.
- **Capacitor는 WebView 버전으로도 분기한다.** OS만 보고 결론 내리지 말 것. 같은 Android 15여도 WebView 131/150이 정반대로 동작했다.
- **새 코드를 기기에서 검증하기 전 반드시 capgo 리셋**: Android `versionCode` / iOS `CURRENT_PROJECT_VERSION`. "현재 버전"이 `1.0.0`인지 먼저 확인할 것.
- **테스트용 임시 코드도 실제 코드와 같은 조건으로.** 스타일 하나(`text-sm`)가 플랫폼 동작(iOS 자동 확대)을 바꿔 결론을 뒤집었다.
- **양 플랫폼은 증상이 같아도 원인이 다를 수 있다.** 키보드 문제가 Android(컨테이너 패딩)와 iOS(WKWebView 스크롤)에서 완전히 다른 메커니즘이었다. [[2026-07-15-live-update-testing]] 1-5와 같은 교훈이 반복됐다.
- **플러그인 소스를 읽을 것.** `SystemBars.java`의 140 게이트, `Keyboard.m`의 `+0.2` 하드코딩, `autoBackdropColor`의 "body 배경이 없으면 무시" 단서 — 셋 다 문서가 아니라 **소스에서** 나왔고, 각각이 결정적이었다.
