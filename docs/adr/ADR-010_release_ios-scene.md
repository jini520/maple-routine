# ADR-010 화면 회전 잠금과 iOS 씬

> 🟢 유효
> 옛 번호: ADR-323 · ADR-324
> 관련 소스: `android/app/src/main/AndroidManifest.xml` · `ios/app/AppDelegate.swift` · `ios/app/SceneDelegate.swift` · `ios/app/Info.plist` · `ios/app.xcodeproj/project.pbxproj`

## 배경

두 결정 모두 네이티브 파일에 있어 OTA 로는 바꿀 수 없고, 스토어 바이너리를 새로 내야 한다.

**회전.** 앱은 회전을 막지 않고 있었지만, `src/` 에는 가로 화면 설계가 없다. 창 크기에 따라 레이아웃을 바꾸는
코드가 없고, today 위젯 격자의 행 높이도 고정이다. 그래서 바형 폰을 눕히면 입력 카드 · 모달 · 팝오버가
잘렸다(이슈 #532). 막아야 하는 것은 바형 폰이고, 태블릿과 접는 폰의 펼친 화면은 돌 수 있어야 한다.

**iOS 씬.** iOS 27 SDK 로 빌드한 앱은 UIScene 생명주기를 쓰지 않으면 iOS 27 에서 UIKit 이 실행을 막는다
(이슈 #494). 앱은 Expo SDK 57 템플릿대로 `AppDelegate` 가 창을 직접 만들고 있었고, `Info.plist` 에 씬
매니페스트가 없었다. 그대로 빌드하면 iOS 27 사용자 전원이 켜자마자 앱이 꺼진다. Expo SDK 57 에는 씬 대리자가
없어서 이 저장소가 직접 만든다.

## 결정

### 결정 1. 짧은 변이 600 미만인 화면은 세로로 고정한다

짧은 변이 600dp(Android) · 600pt(iOS) 이상이면 회전을 허용하고, 아니면 세로로 묶는다.

600 은 Android 가 이미 쓰는 값이다. Android 16 부터 targetSdk 36 앱은 짧은 변이 600dp 이상인 화면에서
`screenOrientation` 을 무시하고, 이 앱은 targetSdk 36 이다. iOS 도 같은 값을 써서 두 플랫폼의 기준을 맞춘다.
이 기준이면 폴드 · 접는 아이폰의 펼친 화면은 돌고, 커버 화면과 바형 폰(360 ~ 410)은 세로로 묶인다.

### 결정 2. Android 는 `MainActivity` 를 `portrait` 로만 둔다

`AndroidManifest.xml` 의 `MainActivity` 에 `android:screenOrientation="portrait"` 를 적는다. 600dp 이상에서는 OS 가
알아서 이 값을 무시하므로, 앱이 조건을 따로 적을 필요가 없다. Android 16 의 임시 opt-out 은 켜지 않는다.
Android 17 이 그 opt-out 을 없애므로, 켜 두면 그때 큰 화면의 동작이 한 번 더 바뀐다.

### 결정 3. iOS 는 `AppDelegate` 가 방향을 좁히고, `Info.plist` 는 방향 넷을 그대로 연다

`AppDelegate.application(_:supportedInterfaceOrientationsFor:)` 가 화면의 짧은 변이 600pt 미만이면 `.portrait` 를,
아니면 부모(`ExpoAppDelegate`)의 값을 돌려준다.

`Info.plist` 로 잠그지 않는 이유는 `~ipad` 접미사가 아이패드만 구분하기 때문이다. 접는 아이폰은 아이폰으로
분류되어 plist 로 잠그면 펼친 화면까지 잠긴다. 델리게이트는 plist 가 연 방향 안에서만 좁힐 수 있으므로
plist 의 방향 넷을 지우면 안 된다.

짧은 변은 창이 아니라 화면에서 잰다. 아이패드 분할 화면에서 창이 좁아져도 기기는 돌 수 있어야 한다.

`app.json` 의 `"orientation": "default"` 는 고치지 않는다. 그 값은 `expo prebuild` 가 네이티브 파일로 옮기는
재료인데, 이 저장소는 prebuild 를 돌리지 않는다. 돌리면 손으로 쓴 네이티브 파일과 릴리스 서명 설정이
지워진다.

### 결정 4. iOS 는 씬 대리자가 창을 만들고 React Native 를 시작한다

`AppDelegate.didFinishLaunchingWithOptions` 는 React Native 팩토리를 만들고 Firebase 를 켜고 `launchOptions` 를
보관만 한다. 창은 `SceneDelegate.scene(_:willConnectTo:options:)` 가 그 씬으로 만들고, 거기서
`startReactNative` 를 부른다. `Info.plist` 의 `UIApplicationSceneManifest` 가 `$(PRODUCT_MODULE_NAME).SceneDelegate`
를 가리킨다.

### 결정 5. 씬이 만든 창을 `AppDelegate.window` 에도 넣는다

광고 SDK(`react-native-google-mobile-ads` 의 전면 광고 · 동의 창 · 광고 검사기)와 Firebase Messaging 은 창을
`UIApplication.shared.delegate.window` 에서 찾는다. 씬을 쓰면 이 값이 비어서, 앱은 켜지는데 광고와 동의 창만
아무 오류 없이 뜨지 않는다.

### 결정 6. 창은 하나다

`UIApplicationSupportsMultipleScenes` 는 `false` 다(사용자 결정). 결정 5 는 창이 하나일 때만 맞다.
창이 둘이면 광고를 어느 창에 띄울지 정할 수 없다. 아이패드 분할 화면은 창 하나로도 된다. 대신 아이패드에서
앱을 두 창으로 열 수는 없다.

### 결정 7. URL 은 씬 콜백에서 받아 `RCTLinkingManager` 에 넘긴다

씬을 쓰면 `application(_:open:options:)` 와 `application(_:continue:restorationHandler:)` 가 불리지 않는다.
대신 `scene(_:openURLContexts:)` 와 `scene(_:continue:)` 가 불린다. 앱을 새로 켠 URL 은 `launchOptions` 가
아니라 `connectionOptions` 로 들어오므로, 그 URL 을 `launchOptions[.url]` 에 넣어 `Linking.getInitialURL()` 이
계속 읽게 한다.

지금 앱은 들어오는 URL 을 쓰지 않는다. 넥슨 로그인은 `openAuthSessionAsync` 의 인증 세션으로 돌아와 이 경로를
타지 않는다. 이전 앱 대리자가 하던 일이 끊기지 않도록 옮겨 둔 것이다.

스플래시(루트 뷰에 붙는다) · 알림 탭(`UNUserNotificationCenter` 대리자) · 푸시 토큰 등록(앱 대리자에
남는다) · `expo-web-browser`(`keyWindow` 로 창을 찾는다) · RN `AppState`(`UIApplication` 알림을 듣는다)는
씬을 써도 그대로 동작한다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `src/__tests__/orientation-policy.test.ts` | 결정 2: `MainActivity` 가 `portrait` 인지 본다 |
| | 결정 3: `Info.plist` 의 아이폰 방향 목록에 가로 둘이 남아 있는지, `AppDelegate` 가 `supportedInterfaceOrientationsFor` 를 덮어써 600 미만에서 `.portrait` 를 돌려주는지 본다 |
| `src/__tests__/ios-scene-policy.test.ts` | 결정 4: `Info.plist` 의 씬 매니페스트가 `SceneDelegate` 를 가리키는지, `SceneDelegate.swift` 가 Xcode 타깃의 Sources 에 들어 있는지, 씬이 창을 만들어 `startReactNative` 를 부르고 `AppDelegate` 는 창을 만들지 않는지 본다 |
| | 결정 5 · 6 · 7: 씬의 창을 `appDelegate.window` 에 넣는지, `UIApplicationSupportsMultipleScenes` 가 `false` 인지, URL 콜백 둘이 `RCTLinkingManager` 로 넘기는지 본다 |

jest 는 UIKit 과 회전을 실행할 수 없어서, 네이티브 파일이 이 내용을 담고 있는지를 문자열로 본다. `expo prebuild`
가 네이티브 파일을 다시 쓰면 이 테스트들이 실패한다.

## 번호 기록

- ADR-010 (2026-10-19): 옛 ADR-323 · 324 를 합쳐 처음 작성
