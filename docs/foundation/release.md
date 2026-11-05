# 스토어 릴리스

Play 와 App Store 에 올릴 바이너리를 만드는 절차다. 서명 · 버전 · 빌드 커맨드 · 산출물 확인 · 콘솔에 적을 값을
다룬다. 앱 안에서 받는 OTA 업데이트를 발행하는 절차는 `features/live-update.md` 에 있다.

관련 결정은 Android 서명 [[ADR-008]], 바이너리 크기 [[ADR-009]], 회전 잠금과 iOS 씬 [[ADR-010]], 지문과 버전
[[ADR-011]] 이다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `app.json` | 스토어 버전 `expo.version` · `ios.buildNumber` · `android.versionCode`. 두 플랫폼이 같이 쓰는 지문 재료 |
| `package.json` | OTA 버전 `version`. 스토어 버전과 따로 올린다([[ADR-011]]) |
| `android/app/build.gradle` | `versionCode` · `versionName`(빌드가 실제로 읽는 값) · 릴리스 서명 · 축소 설정 |
| `android/gradle.properties` | R8 · 리소스 축소 켜기 · 기본 ABI 넷 |
| `android/keystore.properties` | 업로드 키 경로와 비밀번호. 커밋하지 않는다 |
| `android/app/src/main/AndroidManifest.xml` | 세로 잠금 · 권한 |
| `ios/app/Info.plist` | `CFBundleShortVersionString` · `CFBundleVersion`(빌드가 실제로 읽는 값) · 씬 매니페스트 · 방향 · 백그라운드 모드(`processing` 과 허용 태스크 식별자, [[ADR-056]] 결정 20) |
| `ios/app.xcodeproj/project.pbxproj` | 서명 설정 · `Strip Embedded Frameworks` 빌드 단계 |
| `ios/app/AppDelegate.swift` · `SceneDelegate.swift` | 회전 제한 · 창 만들기 |
| `ios/app/app.entitlements` | `aps-environment` |
| `scripts/__tests__/ios-signing-settings.test.mjs` | iOS 서명 설정이 남아 있는지 검사 |
| `src/__tests__/orientation-policy.test.ts` · `ios-scene-policy.test.ts` | 회전 잠금과 씬 설정이 남아 있는지 검사 |

## 네이티브 프로젝트는 커밋돼 있고, `expo prebuild` 를 돌리지 않는다

`android/` 와 `ios/` 는 저장소에 커밋돼 있다. `expo prebuild` 를 돌리면 이 디렉터리를 다시 만들면서 손으로 넣은
값이 지워진다. Android 릴리스 서명 연결, iOS 서명 설정, `Strip Embedded Frameworks` 단계, 씬
대리자, 회전 잠금이 지워진다. 그래서 `app.json` 의 네이티브 설정(예: `orientation`)은 네이티브 파일과 다를 수 있다.
네이티브 설정을 바꿀 때는 `android/` · `ios/` 의 파일을 직접 고친다.

## 버전

| 값 | 어디 | 지금 | 규칙 |
|---|---|---|---|
| 스토어 버전 | `app.json` `expo.version` · `build.gradle` `versionName` · `Info.plist` `CFBundleShortVersionString` | 1.0.13 | `x.y.z` 세 자리 |
| Android `versionCode` | `build.gradle` · `app.json` | 25 · 25 | 올리기만 한다. 한 번 올린 번호는 다시 못 쓴다 |
| iOS 빌드 번호 | `Info.plist` `CFBundleVersion` · `app.json` `ios.buildNumber` | 17 · 17 | 올리기만 한다 |
| OTA 버전 | `package.json` `version` | `features/live-update.md` 참고 | 스토어 버전과 따로 올린다 |

빌드 번호는 두 파일에 있다. 빌드가 실제로 읽는 것은 `build.gradle` 과 `Info.plist` 이고, `app.json` 만 고치면
옛 번호로 나간다. `app.json` 은 두 플랫폼이 같이 쓰는 지문 재료라서, 한 플랫폼의 번호만 올려도 다른 플랫폼의
지문이 바뀐다.

## 빌드하기 전에

1. 버전과 빌드 번호를 먼저 올리고 커밋한다. 그 트리에서 두 플랫폼을 빌드한다. 빌드하고 나서 번호를
   올리면 지문이 바뀌어 두 바이너리를 모두 다시 빌드해야 한다.
2. 스토어 게시 뒤에는 `package.json` 의 `scripts` 에 줄을 더하지 않는다. `scripts` 도 지문 재료다. 스크립트는
   `node scripts/<이름>.mjs` 로 부른다.
3. 빌드하는 트리의 지문을 적어 둔다. 업로드 직전에 바이너리 안의 지문과 같은지 본다(아래 산출물 확인).

```bash
npx expo-updates runtimeversion:resolve --platform ios
npx expo-updates runtimeversion:resolve --platform android
```

두 값이 다르면 그 바이너리는 OTA 를 받지 못하고, 다음 OTA 발행이 그 스토어 사용자에게 닫을 수 없는 스토어
업데이트 모달을 띄운다([[ADR-011]]). 심사에 올린 바이너리의 지문은 `IN_REVIEW_RUNTIME_VERSIONS` 에 넣는다.
그 절차는 `features/live-update.md` 의 `스토어 게시 뒤 옛 바이너리 잠그기` 에 있다.

4. 본 체크아웃 `.env` 의 `EXPO_PUBLIC_ENHANCEMENT_RECOMPUTE` 에 아래 표의 요청이 모두 있는지 본다. 이 값은 빌드할 때
   JS 번들에 구워진다. 빠진 채로 빌드하면 그 바이너리로 업데이트한 기기가 지난 날을 다시 받지 않는다. 이 값은 지문
   재료가 아니다(2026-11-05 에 넣기 전후로 두 플랫폼 지문을 재서 같았다).

   | id | 왜 거나 | 걷는 때 |
   |---|---|---|
   | `starforce-stars-876` | 스타포스 첫 성 · 끝 성 칸이 생기기 전에 받은 날을 채운다([[ADR-100]] 결정 8) | 정하지 않았다 |

   `to` 는 `2099-12-31` 이다. 기기가 오늘 날짜로 자르므로 배포일을 미리 정하지 않아도 배포 전에 받은 날까지 모두 받는다.
   id 를 바꾸면 이미 끝낸 기기도 다시 받으니 그대로 둔다. 요청이 남아 있는 동안은 새로 설치한 기기도 첫 조회 때 그
   기간을 한 번 받는다.

## 빌드 캐시

ccache · Gradle 빌드 캐시 · watchman 을 켜 둔다. 이유와 확인 방법은 [[ADR-006]] 결정 13 에 있다.

| 무엇 | 어디 | 켜는 법 |
|---|---|---|
| ccache(iOS) | `ios/Podfile.properties.json` 의 `apple.ccacheEnabled` | `brew install ccache` 뒤 `pod install`. 래퍼가 `/opt/homebrew/bin/ccache` 를 그대로 부르므로 ccache 가 없으면 빌드가 안 된다 |
| Gradle 빌드 캐시 | `~/.gradle/gradle.properties` 의 `org.gradle.caching=true` | 저장소 밖이라 지문이 안 움직인다 |
| watchman | `.watchmanconfig` | `brew install watchman`. Metro 와 jest 가 쓴다 |

개발용 Android 빌드는 ABI 하나만 굽는다. 릴리스는 아래 `릴리스마다` 의 ABI 둘을 그대로 쓴다.

```bash
ORG_GRADLE_PROJECT_reactNativeArchitectures=arm64-v8a npx expo run:android
```

## Android

### 처음 한 번: 업로드 키 만들기

이미 쓰는 업로드 키가 있다면 이 절은 건너뛴다. 키는 저장소 밖에 만든다([[ADR-008]] 결정 2). 비밀번호와 별칭은
다시 볼 수 없으므로 먼저 암호 관리자에 넣어 둔다.

```bash
mkdir -p ~/keys
keytool -genkeypair -v \
  -keystore ~/keys/maple-routine-upload.jks \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

- `-validity 10000`(약 27년). Play 는 2033-10-22 이후까지 유효한 키를 요구한다.
- 인증서 소유자 정보는 `CN=MapleRoutine, O=Maple Routine, L=Seoul, ST=Seoul, C=KR` 을 썼다. 한글은 넣지 않는다.
- 마지막 확인 질문의 기본값이 `아니오` 라서, 엔터만 치면 처음부터 다시 묻는다. `y` 를 입력한다.

그 다음 `android/keystore.properties` 를 만든다. `storeFile` 은 절대 경로이고, PKCS12 라 두 비밀번호는 같은 값이다.

```properties
storeFile=/Users/<user>/keys/maple-routine-upload.jks
storePassword=<비밀번호>
keyAlias=upload
keyPassword=<같은 비밀번호>
```

### 릴리스마다

```bash
# 1. expo-updates 의 임베드 에셋 목록을 지워 다시 만들게 한다.
#    이 Gradle 태스크는 입력을 선언하지 않아서, 한 번 만들어지면 UP-TO-DATE 로 건너뛴다.
#    목록이 오래되면 새 그림이 오류도 로그도 없이 빈칸으로 나온다.
rm -rf android/app/build/generated/assets/createReleaseUpdatesResources

# 2. AAB 를 빌드한다. ABI 플래그를 빼지 않는다(ADR-009 결정 5).
cd android && ./gradlew bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a

# 3. 산출물
#    android/app/build/outputs/bundle/release/app-release.aab
```

디버그 심볼과 R8 매핑은 따로 할 일이 없다. 둘 다 AAB 안에 들어 있어 Play 가 알아서 쓴다([[ADR-009]] 결정 6 · 7).

### 산출물 확인

```bash
# 서명. 키스토어 설정을 못 읽어도 빌드는 성공하므로 직접 본다(ADR-008 결정 4).
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab

# 지문. 빌드하기 전에 적어 둔 android 값과 같아야 한다.
unzip -p android/app/build/outputs/bundle/release/app-release.aab base/assets/fingerprint
```

`소유자: CN=MapleRoutine, O=Maple Routine, L=Seoul, ST=Seoul, C=KR` 이 나오면 업로드 키로 서명된 것이다. 아무것도
안 나오면 `keystore.properties` 를 못 읽은 것이다.

Android 빌드를 한 번도 하지 않은 트리(새 워크트리 등)에서는 첫 빌드가 다른 지문을 넣는다. 지문은 빌드 초반에
계산되는데, 그 뒤 빌드가 `android/` 와 `node_modules/expo-updates/expo-updates-gradle-plugin/` 안에 산출물을
만들고, 그 산출물도 지문 재료다. 스토어 바이너리는 산출물이 이미 있는 트리에서 빌드됐다. 첫 빌드의 지문이 다르면
`createReleaseUpdatesResources` 를 지우고 한 번 더 빌드한다(1.0.12+6 에서 확인).

R8 이 켜져 있으므로 릴리스 빌드를 실기기에 깔고 주요 화면을 모두 눌러 본 뒤에 올린다([[ADR-009]] 결정 7).
debug 빌드에서는 R8 이 돌지 않아 문제가 재현되지 않는다. 이전 OTA 번들이 임베드 번들을 가릴 수 있으니,
확인할 때는 새 `versionCode` 로 깔아 OTA 상태를 초기화한다.

## iOS

### 서명 설정

Xcode 자동 서명을 쓴다. `project.pbxproj` 에 네 값이 있어야 한다.

| 값 | 어디 | 없거나 틀리면 |
|---|---|---|
| `DEVELOPMENT_TEAM = TQPKW249G7` | 타깃의 Debug · Release | `Signing for "app" requires a development team` 으로 아카이브가 실패한다 |
| `CODE_SIGN_STYLE = Automatic` | 타깃의 Debug · Release | |
| `"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "Apple Development"` | 프로젝트의 Debug · Release | 템플릿의 옛 문자열 `"iPhone Developer"` 가 남아 있으면 아카이브는 통과하고 export 에서 error 90034 로 실패한다 |
| `PRODUCT_NAME` | 타깃 | 지금 `app`. 한글로 두면 번들 경로가 NFD 로 저장되어 서명 경로와 어긋나고, 업로드가 error 90034 로 거부된다. 홈 화면 이름은 `CFBundleDisplayName`(`메이플 루틴`)이 정한다 |

Release 의 `CODE_SIGN_IDENTITY` 를 `"Apple Distribution"` 으로 바꾸면 안 된다. 자동 서명과 충돌해 빌드가
실패한다. 자동 서명에서는 아카이브를 개발 인증서로 서명하고, export 단계에서 Xcode 가 배포 인증서로 다시
서명한다.

이 값들은 `pbxproj` 에만 있어서 `expo prebuild` 가 지우고, 다음 아카이브 때까지 아무 증상이 없다.
`scripts/__tests__/ios-signing-settings.test.mjs` 가 팀과 자동 서명이 두 구성에 있는지, 옛 문자열이 돌아오지
않았는지 본다.

`ios/app/app.entitlements` 의 `aps-environment` 는 `development` 로 둔다. App Store 용 export 가 배포 프로파일로
다시 서명하면서 `production` 으로 바꿔 넣는다. 손으로 `production` 으로 고치면 개발 빌드가 깨진다.

### 아카이브

Xcode 화면이 아니라 CLI 로 빌드한다. 실패 지점이 로그에 남고, 같은 트리에서 GUI 아카이브가 CLI 와 다른 지문을
낸 적이 있다. `-archivePath` 를 `~/Library/Developer/Xcode/Archives/<날짜>/` 아래로 주면 Organizer 에도 그대로
나타난다.

```bash
# 1. 이미 쓴 빌드 번호를 로컬 아카이브에서 확인한다.
#    task = distribute 이고 uploadEvent.state = success 인 uploadedBuildNumber 는 다시 못 쓴다.
#    task = validate 만 있는 것은 검증만 한 것이라 그 번호를 아직 쓸 수 있다.
for a in ~/Library/Developer/Xcode/Archives/*/*.xcarchive; do
  plutil -p "$a/Info.plist" | grep -e uploadedBuildNumber -e '"title"' -e '"state"'
done

# 2. 아카이브
cd ios
xcodebuild -workspace app.xcworkspace -scheme app \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/MapleRoutine-<버전>-<빌드>.xcarchive" \
  archive
```

JS 번들은 `Bundle React Native code and images` 빌드 단계가 매 빌드 새로 만든다. 임베드 프레임워크는
`Strip Embedded Frameworks` 단계가 심볼을 제거하고 다시 서명한다([[ADR-009]] 결정 8).

### export 와 업로드

업로드 전에 export 를 돌려 배포 서명을 확인한다. 아카이브는 개발 인증서로도 성공하고, 배포 인증서로는
export 단계에서 바뀐다.

```bash
xcodebuild -exportArchive -archivePath <위 경로> \
  -exportPath <저장소 밖 경로> -exportOptionsPlist <저장소 밖 경로>/ExportOptions.plist \
  -allowProvisioningUpdates
# ExportOptions: method app-store-connect · destination export · teamID TQPKW249G7 · signingStyle automatic
```

- `destination` 을 `upload` 로 바꿔 한 번 더 돌리면 Xcode 에 로그인된 계정으로 업로드된다.
- `ExportOptions.plist` 는 저장소 안에 두지 않는다. `ios/` 안의 추적되지 않는 파일도 지문 재료라서, 거기 두면
  바이너리의 지문과 트리 계산값이 달라진다.
- `-allowProvisioningUpdates` 가 없으면 오래된 프로파일 그대로 진행해 실패한다(Push Notifications capability 가 없다는
  오류). 이 플래그를 주면 xcodebuild 가 프로파일을 새로 받는다.

### 산출물 확인

```bash
A=<아카이브>/Products/Applications/app.app
plutil -p "$A/Info.plist" | grep -E 'CFBundleVersion|CFBundleShortVersionString'
codesign -dv --verbose=2 "$A" 2>&1 | grep -E 'Identifier|Authority|TeamIdentifier'
cat "$A/EXUpdates.bundle/fingerprint"                          # 빌드하기 전에 적어 둔 ios 값과 같아야 한다
find "$A/Frameworks" -name "React" -exec ls -lh {} \;          # 12 MB 에 가까우면 심볼이 제거되지 않았다
codesign -dvv <export 경로>/*.ipa 2>&1 | grep Authority        # Apple Distribution 이어야 한다
```

업로드할 때 `GoogleMobileAds.framework` · `UserMessagingPlatform.framework` 의 dSYM 이 없다는 경고가 나온다. 이
둘은 dSYM 없이 배포되는 프레임워크라서 생기는 경고이고, 업로드를 막지 않는다.

### Xcode Cloud 는 쓰지 않는다

iOS 는 로컬 아카이브로 낸다. Xcode Cloud 워크플로는 꺼 두었다(2026-08-04).

## 콘솔에 적을 값

### 개인정보 처리방침

- 처리방침 원본은 `PRIVACY.md` 이고 `https://mapleroutine.store/privacy` 에 게시한다. 앱 안에서는 설정의
  앱 정보 화면(`SettingsAboutScreen`)의 행이 인앱 브라우저로 연다.
- 문의 주소는 `https://mapleroutine.store/support` 다.

### 수집 신고(Play 데이터 안전 · App Store 개인정보 라벨)

앱은 우리 서버로 드롭 가격 기록을 보낸다(`features/server-sync/drop-price-sync.ts` 의 `dropPricePayloadOf`).
보내는 칸은 `dropRecordId` · `itemKey` · `status` · `priceMeso` · `periodKey` · `worldKey` · `ringLevel` · `boss` ·
`difficulty` 이고, 신원 헤더 하나가 함께 간다(`features/auth/server-identity.ts`). 전송은 `AppShell` 이 띄우는
`runServerSync` 와 가격을 저장하는 순간에 일어난다([[ADR-018]]).

사용 로그도 보낸다. 방문 · 화면 이름과 체류 시간 · 드롭과 가계부 저장 횟수를 플랫폼 · 앱 버전과 함께 묶어 보낸다
(`features/usage-log/`, [[ADR-158]]).

| 신고 항목 | 왜 |
|---|---|
| 사용자 ID | 넥슨 로그인 세션이나 API 키 해시를 보낸다. 되돌릴 수 없는 해시여도 한 사람의 기록을 묶는 값이다 |
| 기타 사용자 생성 콘텐츠 | 사용자가 적은 판매가와 아이템 · 기간 · 월드 · 반지 레벨 |
| 광고 ID | 앱에 `AD_ID` 권한이 들어 있다 |
| 기기 식별자 | Firebase 가 FCM 등록 토큰을 보관한다 |
| 앱 상호작용(Play) · 제품 상호작용(App Store) | 사용 로그. 어느 화면을 얼마나 봤는지, 드롭 · 가계부를 몇 번 저장했는지 |
| 진단(Play `앱 정보 및 성능` · App Store `기타 진단 데이터`) | 강화 합계에서 빠진 줄의 날짜 · 종류 · 사유 · 장비 이름 · 줄 수([[ADR-102]]). 앱의 계산 오류를 찾는 데 쓴다 |

Play 는 `수집함 · 공유하지 않음 · 필수 · 앱 기능과 분석`(사용 로그와 진단은 `분석`), `전송 중 암호화`, `삭제 요청 가능` 으로
적는다. 삭제는 앱 설정의 `계정 삭제` 가 한다. 서버는 30일 유예 뒤 사람과 열쇠를 지우고 보낸 기록을 익명으로 남긴다([[ADR-017]] 결정 6).
메일로는 받지 않는다. 운영자가 메일만으로 사람을 찾을 수 없어서다. 넥슨 로그인이 바이너리에 있으므로 계정 생성 방법은
`OAuth` 이고, 잠근 채로 내도 그렇게 적는다. OTA 로 풀면 심사 없이 계정이 생기기 때문이다. 계정 삭제 URL 과 데이터 삭제 URL 은
`https://mapleroutine.store/support` 다. 그 페이지의 `계정을 삭제하고 싶습니다` 절이 앱에서 지우는 순서와 지우는 데이터 · 남는
데이터를 적는다. App Store 는 `사용자에게 연결됨`, `추적 아님` 으로 적고, 사용 로그의 목적은 `분석` 이다. 제3자에게 넘기지 않고, 광고
식별자와 엮지 않고, 맞춤 광고에 쓰지 않기 때문이다. 이 셋 중 하나라도 바뀌면 ATT 동의 창이 필요하다.

수집하는 내용을 바꿀 때는 처리방침 게시 → 앱 발행 → 콘솔 양식 갱신 순서를 지킨다. 아직 수집하지 않는 것을
신고하면 양식과 실제 동작이 달라 정책 위반이 된다.

### 앱 액세스 권한(Play)

Play 에는 심사 메모 칸이 없다. 심사자에게 주는 안내는 `정책 및 프로그램 > 앱 콘텐츠 > 앱 액세스 권한` 에 적는다. 넥슨 로그인도
API 키도 없으면 로그인 화면밖에 볼 수 없어 `일부 기능이 제한됨` 으로 두고, 안내 항목 하나에 테스트 키와 들어가는 순서를 적는다.
사용자 이름 · 비밀번호 칸은 비운다. 심사자에게 넥슨 계정을 줄 수 없고, 키 하나로 모든 기능을 볼 수 있기 때문이다(아래 `심사에서
넥슨 로그인`). 순서는 아래 심사 메모의 `[SIGN-IN ...]` 과 `[HOW TO REVIEW]` 를 옮긴다. 나머지 절(개인정보 · 비제휴)은 옮기지
않는다. Play 에서는 데이터 보안 양식과 자세한 설명이 그 일을 한다. 테스트 키는 App Store 와 같이 저장소에 적지 않는다.

### 심사에서 넥슨 로그인

심사자에게 넥슨 계정을 줄 수 없다. 넥슨 계정은 개인 계정이라 심사용으로 내줄 수 없다(사용자 확인 2026-11-05). 그래서
아래처럼 한다.

- 테스트 API 키를 데모 계정 대신 준다. 가이드라인 2.1 은 로그인이 있는 앱에 데모 계정을 요구한다. 이 앱에는 넥슨 로그인으로만
  쓰는 기능이 없어서 키 하나로 모든 기능을 볼 수 있다. 그것을 심사 메모 첫 절 `[SIGN-IN ...]` 에 먼저 적는다.
- 넥슨 로그인 흐름은 실기기 화면 녹화로 보인다. 넥슨 버튼을 누르고 넥슨 동의 화면을 지나 앱으로 돌아오는 데까지 찍어, 심사 메모의
  링크나 App Review 정보의 첨부로 준다. 영상만으로는 심사자가 직접 해 보는 것을 대신하지 못해서 키 경로와 함께 준다.
- 넥슨 로그인은 이용자 본인의 메이플스토리 데이터를 넥슨에서 읽으려는 로그인이다. 그래서 가이드라인 4.8 의 예외(특정 제3자
  서비스의 클라이언트이고, 사용자가 그 서비스 계정으로 로그인해 자기 콘텐츠를 보는 앱)에 든다. Sign in with Apple 같은 다른
  로그인을 따로 두지 않는 이유이고, 심사 메모의 `[LOGIN SERVICES]` 에 적는다.
- 테스트 키는 App Store Connect 의 로그인 정보 칸이 아니라 심사 메모에 붙인다. 계정이 아니라 키 하나를 붙여 넣는 방식이라서다.
- 넥슨 로그인으로만 쓰는 기능이 생기면 키로 볼 수 없는 기능이 생겨 이 방법이 통하지 않는다. 그때는 이 절을 다시 정한다.

### 스토어 아이콘

Play 스토어 아이콘(512×512)은 `assets/icon.png` 를 정확히 절반으로 줄인 32비트 PNG 로 만든다. Android 런처
아이콘은 전경에 여백이 들어가 있어 스토어 아이콘으로 쓰면 안 된다. 모서리는 Play 가 마스크를 씌우므로 미리
둥글리지 않는다.

```bash
python3 -c "from PIL import Image; Image.open('assets/icon.png').convert('RGBA').resize((512,512), Image.LANCZOS).save('play-store-icon-512.png')"
```

## 스토어 등록정보 문구

칸은 스토어마다 다르다. Play 는 짧은 설명 · 자세한 설명 · 출시 노트 셋이고, App Store 는 여기에 프로모션
텍스트 · 키워드 · 심사 메모가 더 있다. 프로모션 텍스트는 심사 없이 언제든 바꿀 수 있다.

쓰는 규칙은 이렇다.

- 앱에 없는 기능을 적지 않는다. 화면에서 눌러 확인한 것만 적는다.
- 가격(`무료`) · 순위(`1위`) · 설치 유도(`지금 다운로드`) 문구를 넣지 않고, 다른 앱이나 플랫폼을 언급하지 않는다.
  HTML 이 적용되지 않으므로 불릿은 문자(`■` `▶` `•`)로 쓴다.
- 넥슨 로그인 입구(`features/auth/nexon-login-enabled.ts` 의 `NEXON_LOGIN_ENABLED`)는 1.0.13 부터 열려 있다. 그래서 문구는
  넥슨 로그인과 API 키 두 방법으로 시작한다고 적는다. 입구를 잠근 채로 내는 빌드가 생기면 문구에 넥슨 로그인을 쓰지 않고,
  심사 메모에 잠가 둔 것과 OTA 로 연다는 것을 밝힌다. 밝히지 않으면 숨긴 기능(App Store 가이드라인 2.3.1)으로 보일 수 있다.
  계정 삭제는 잠금과 관계없이 모든 사용자에게 열려 있다([[ADR-017]] 결정 8).
- 앱 안에서는 컨텐츠라고 부르지만 짧은 설명에서만 `숙제` 를 쓴다. 스토어에서는 `메이플 숙제` 로 검색하기
  때문이다.
- 비제휴 고지는 앱 설정 화면 · 안내 사이트 · `PRIVACY.md` 와 같은 영문 문구를 쓴다.
- 출시 노트는 `■ 새로운 기능` · `■ 개선 사항` 두 묶음이고, 버그 수정은 개선 사항 마지막 줄에 둔다. 순서와 내용은
  `src/data/release-notes.ts` 의 그 버전 노트를 따른다.
- 심사용 테스트 키는 저장소에 적지 않는다. App Store Connect 에 직접 붙이고, 붙이기 전에 그 키로 앱이 열리는지
  본다. 개발 단계 키면 `DevelopmentStageKeyModal` 이 막아 심사가 첫 화면에서 끝난다.

아래는 1.0.13 원문이다.

### 짧은 설명 (Play, 80자)

```
메이플스토리 일간·주간 숙제와 보스 수익, 아이템 드롭을 캐릭터별로 관리
```

### 프로모션 텍스트 (App Store, 170자)

```
이제 넥슨 ID로 로그인할 수 있습니다. API 키를 발급받지 않아도 바로 시작하세요. 매일 21:00에는 완료하지 않은 스케줄을 알림으로 알려드리고, 앱 전체 디자인도 새로 다듬었습니다.
```

### 자세한 설명 (4000자)

```
메이플스토리 플레이어를 위한 루틴 관리 앱입니다. 오늘 숙제가 남은 캐릭터는 누구인지, 이번 주 보스로 얼마를 벌고 강화에 얼마를 썼는지, 본캐부터 부캐까지 한 곳에서 확인하세요. 여러 메이플 ID의 캐릭터를 함께 관리할 수 있습니다.

넥슨 ID로 로그인하거나 넥슨 오픈 API 키를 입력해 시작합니다. 자세한 내용은 아래 ‘이용 전 준비 사항’에 적었습니다.


■ today

앱을 켜면 위젯 화면이 먼저 섭니다. 대표 캐릭터, 오늘 남은 숙제, 이번 주 보스 수익, 결정석 판매 한도, 리셋까지 남은 시간, 다음 파티 스케줄을 한눈에 봅니다. 시세를 아직 적지 않은 드롭 아이템과 아이템 드롭이 끊긴 기간도 여기서 알려드립니다.


■ 파티 스케줄

파티 보스 일정을 요일별 목록으로 관리합니다. 한 번만 있는 일정과 매주 반복하는 일정을 나눠 등록하고, 일정마다 캐릭터와 보스를 묶어 둡니다. 시작 전에 알림을 받을 수 있고, 알림을 누르면 그 일정이 바로 열립니다.


■ 컨텐츠 스케줄러

일간·주간 컨텐츠의 진행 상태를 캐릭터별로 보여줍니다. 몬스터파크 7/14처럼 남은 횟수까지 그대로 표시됩니다. 게임 스케줄러에 등록해 둔 것을 그대로 따라가는 자동 모드와, 추적할 컨텐츠를 직접 고르는 수동 모드 중에서 선택할 수 있습니다.


■ 보스 스케줄러

주간·월간 보스 처치 현황을 캐릭터별로 정리합니다. 캐릭터마다 주간 12마리 한도를 몇 칸이나 썼는지 배지로 보이고, 보스별 파티 구성도 함께 관리할 수 있습니다.


■ 보스 수익

처치한 보스의 결정석 수익을 자동으로 계산합니다. 파티원 수만큼 나눈 실제 수령액으로 집계되고, 캐릭터별·기간별 합계와 월드당 주간 결정석 판매 한도(90개) 소진량을 한 화면에 모아 봅니다. 지난 기록도 그대로 남아 날짜별로 되짚어볼 수 있습니다.


■ 아이템 드롭

보스별 드롭 아이템을 아이콘에서 탭 한 번으로 기록합니다. 보스 반지 상자·칠흑 장신구 상자처럼 개봉 결과가 갈리는 아이템은 실제로 나온 것을 골라 저장하고, 기록한 아이템은 시세로 환산돼 보스 수익 합계에 더해집니다. 전 기간 히스토리에서 언제 무엇이 떴는지 한 번에 볼 수 있습니다.


■ 가계부

수익과 지출을 한 달 또는 한 주 달력으로 봅니다. 보스 수익과 아이템 드롭 기록은 다시 적지 않아도 처치한 날짜에 그대로 들어옵니다.

지출은 세 갈래로 적습니다. 스타포스·큐브·잠재 재설정에 쓴 메소는 강화 사용 내역에서 읽어 자동으로 잡히고, 주문서와 컨텐츠 입장료·버프 아이템은 목록에서 골라 적고, 그 밖의 지출은 직접 적습니다.

사냥 수입은 계산기로 냅니다. 사냥터와 시간, 사용한 버프를 고르면 캐릭터에 붙어 있는 메소 획득량까지 반영해 금액을 계산합니다. 직접 입력도 됩니다.


■ 통계

수입과 지출을 주간·월간으로 모아 봅니다. 순 수익과 그 추이, 캐릭터별 수익, 수입·지출 내역, 보스별 수익, 시작 날짜부터 쌓인 누적 순수익을 카드로 보여줍니다.


■ 유틸리티

판매 분배금 계산기로 함께 잡은 아이템을 판 값을 인원수로 나눠 봅니다. 주간 보스 수입 계산기로는 캐릭터별로 보스를 골라 한 주 결정석 수입을 계산하고, 결과를 기록으로 남겨 둘 수 있습니다.


■ 넥슨 공지 알림

게임 공지 사항과 업데이트 안내, 썬데이 메이플, 캐시 아이템 소식을 앱에서 받아봅니다. 받을 종류는 설정에서 하나씩 켜고 끌 수 있습니다.


■ 테마

머쉬맘·혼테일·레테·렌·엔젤릭버스터·검은마법사 여섯 가지 테마로 앱 전체 색을 바꿀 수 있습니다. 처음 실행할 땐 기기의 다크 모드 설정을 따라갑니다.


▶ 이용 전 준비 사항

이 앱은 넥슨이 공개한 오픈 API로 게임 데이터를 읽어 옵니다. 넥슨 ID로 로그인하면 바로 시작할 수 있습니다. 로그인 대신 openapi.nexon.com에서 발급한 본인의 개인 API 키를 입력해도 됩니다. 키 발급 방법은 앱의 키 입력 화면에서 안내합니다.

자동 모드에서는 게임 클라이언트의 ‘스케줄러’에 등록한 항목만 보입니다. 등록하지 않은 것은 API로 조회되지 않기 때문입니다. 직접 고르고 싶다면 설정에서 수동 모드로 바꿔 주세요.


▶ 개인정보

별도 회원가입이 없고, 아이디·비밀번호를 받지 않습니다. 앱에서 만든 기록은 이용자의 기기에 저장되며, API 키 원문은 운영자에게 전송되지 않습니다. 넥슨 ID로 로그인하면 넥슨의 보안 지침에 따라 로그인 토큰을 운영자 서버가 보관하고, 서버가 이용자 대신 넥슨에 요청해 받은 내용을 저장하지 않고 기기로 넘깁니다. 아이템 시세 추이를 보기 위해 드롭 기록에 적은 판매가는 운영자 서버로 전송됩니다. 앱을 고치는 데 참고하려고 어느 화면을 얼마나 보는지 같은 사용 기록도 함께 전송됩니다. 공지를 받아오는 요청에는 이용자를 식별할 정보가 들어가지 않습니다. 계정은 설정에서 언제든 삭제할 수 있습니다.

개인정보 처리방침: https://mapleroutine.store/privacy
문의: https://mapleroutine.store/support


※ 본 앱은 NEXON Korea Corp.의 공식 서비스가 아닌 개인 개발 앱입니다.
Maple Routine is not associated with NEXON Korea
Data based on NEXON Open API
```

### 키워드 (App Store, 100자)

```
메이플스토리,일일퀘,일퀘,주간보스,결정석,아이템드롭,숙제,주간숙제,체크리스트,스케줄러,몬스터파크,메소,가계부,강화비용,스타포스,큐브,사냥터,메획,보스파티,분배금,넥슨,반지상자
```

앱 이름의 낱말(`메이플` · `루틴`)은 이미 색인되므로 키워드에 다시 넣지 않는다. 쉼표도 글자 수에 들어간다.

### 출시 노트 (500자)

```
■ 새로운 기능
• 넥슨 ID 로그인이 추가되었습니다. API 키를 발급받지 않아도 넥슨 ID로 로그인할 수 있습니다.
• 계정 삭제가 추가되고, ‘연결 해제’는 ‘로그아웃’으로 바뀌었습니다.
• 매일 21:00에 완료하지 않은 스케줄을 알려주는 미완료 스케줄 알림이 추가되었습니다.
• 주요 화면에 FAQ가 추가되고, 문의·버그 제보에 카카오톡 오픈채팅이 추가되었습니다.
• 유틸리티에 주간 보스 수입 계산기가 추가되었습니다.
• 가계부 지출에 헥사 스킬·헥사 스탯 강화가 추가되고, 조각 정산이 사냥 전리품 판매로 옮겨졌습니다.
• 파티 스케줄에 목록·보드 보기와 메모가, today에 빠른 이동 위젯이 추가되었습니다.
• 글자 크기와 하단 탭 순서를 설정에서 바꿀 수 있습니다.

■ 개선 사항
• 앱 전체 디자인이 하나로 통일되었습니다.
• 통계 주간 보스별 수입에 검은 마법사가 포함됩니다.
• 여러 버그를 수정했습니다.
```

### 심사 메모 (App Store)

```
[SIGN-IN - PLEASE USE THE TEST API KEY]
No sign-up of our own; the app never asks for an ID or password. Users start in one of two ways that open exactly the same features: "넥슨ID 로그인" (Sign in with NEXON, NEXON's OAuth for reading the user's own MapleStory data) or a personal NEXON Open API key issued at openapi.nexon.com. NEXON accounts are personal, so we cannot provide one. Nothing in this version requires NEXON sign-in; the test key below opens every feature. It is a service-stage key (the app rejects development-stage keys by design).

TEST API KEY:
<App Store Connect 에 직접 붙인다>

NEXON SIGN-IN SCREEN RECORDING:
<영상 링크. App Review 정보에 첨부했으면 "Attached." 로 바꾼다>

[HOW TO REVIEW - about 3 minutes]
1. On the sign-in screen, tap "API 키로 시작하기" (Start with API key) at the very bottom, below the blue NEXON button.
2. In the dialog, tap "그래도 API 키로 시작하기" (Continue with API key).
3. Paste the test key into the sheet and tap "확인" (Confirm). Please paste rather than type.
4. Select one or more characters and tap "계속하기" (Continue). Data loads for several seconds.
5. If asked for the MVP grade, tap "다음" (Next), then "시작하기" (Start).
6. You land on "today". Bottom bar: today, 스케줄러 (Scheduler), 수입·지출 (Income and expense), 유틸리티 (Utility: two calculators), 더보기 (More; the gear icon opens settings).
7. Item drops: tap a boss row on 보스 수입 (Boss income). Cashbook entries: the floating + button on 가계부 (Cashbook).

[EXPECTED BEHAVIOR, NOT BUGS]
- In the default "자동" (auto) mode, only content registered in the game's in-game Scheduler appears, because NEXON's API returns nothing else. "수동" (manual) mode in settings lets the user pick content.
- NEXON's API serves data as of the previous day.
- Weekly data resets Thursday 00:00 KST, so values may legitimately be zero right after a reset.

[PERMISSIONS / THIRD PARTIES]
- Notifications (optional): NEXON notice alerts, party schedule reminders, and a daily 21:00 reminder of unfinished schedules (can be turned off). Reminders are scheduled on the device; a background task rechecks remaining schedules.
- Network: NEXON Open API. For NEXON sign-in users, NEXON's guidelines keep the login token on our server (mapleroutine.store), which calls NEXON on the user's behalf and passes results to the device without storing them. Our server also serves app notices and receives the drop sale prices users enter and a first-party usage log (screens viewed, save counts, platform, app version), keyed by our session or a SHA-256 hash of the API key. No third-party analytics. Push uses Firebase Cloud Messaging topics. No ads.
- The API key stays on the device and is never sent in plain text.

[LOGIN SERVICES]
Sign in with NEXON is used only to read the user's own MapleStory data from NEXON; the app is a client for NEXON's game-data service (Guideline 4.8). An API key can be used instead.

[ACCOUNT DELETION]
더보기 (More) > gear icon > 앱 정보 및 계정 (App info and account) > 계정 삭제 (Delete account), for every user. The session is removed and the user is signed out at once; after 30 days our server deletes the user's identifiers (signing in again before then offers to cancel). Records already sent remain without the link to the user.

[AFFILIATION] Not affiliated with or endorsed by NEXON Korea Corp. "Data based on NEXON Open API" is shown at the bottom of Settings.

[CONTACT] If the test key stops working, email support.mapleroutine@gmail.com for a replacement.
```
