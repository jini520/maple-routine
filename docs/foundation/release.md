# 스토어 릴리스 (Play · App Store)

> **범위**: 스토어에 나가는 **바이너리**를 만드는 절차: 서명·버전·빌드 커맨드·산출물 검증, 그리고 콘솔에 채워 넣어야 하는 요건. 앱 안에서 도는 OTA 갱신은 [features/live-update.md](../features/live-update.md), 광고 관련 스토어 요건의 *배경*은 [features/ads.md](../features/ads.md).
> **관련 소스**(전부 저장소 루트 아래: [[ADR-155]] 결정 2): `android/app/build.gradle`(서명·`versionCode`) · `android/keystore.properties`(**커밋 금지**) · `ios/app.xcodeproj`(iOS 서명) · `ios/app/Info.plist`(`CFBundleVersion`) · `app.json`(**두 플랫폼 공통 지문 재료**. `expo.version`·`ios.buildNumber`·`android.versionCode`) · `package.json`(**버전 원천**. OTA 매니페스트와 설정 화면 표시가 같은 파일을 읽는다).
> **관련 ADR**: [[ADR-091]](Android 서명) ADR-090(광고: 스토어 요건이 늘어난 이유) ADR-024(버전 형식) [[ADR-119]](릴리스 노트) [[ADR-126]](핵심 목록·모달). **관련 문서**: [../features/ads.md](../features/ads.md), [../features/live-update.md](../features/live-update.md), [../features/site.md](../features/site.md), [../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md).

## 빌드는 Expo/네이티브 하나다 ([[ADR-155]])

스토어 바이너리는 **네이티브 빌드 산출물**이다. Android 는 `android/` 의 Gradle, iOS 는 `ios/` 의
Xcode 아카이브다. 저장소 루트가 곧 Expo 프로젝트라 둘 다 루트 기준 한 칸 아래에 있다.

> 종전에는 이 자리에 ‘웹 번들을 어느 스크립트로 굽는가’(`npm run build` / `build:beta` /
> `build:test-ads`) 표가 있었다. 그 스크립트들은 캐패시터 앱의 것이었고 앱과 함께 사라졌다.
> 아래 ‘폐기된 정책’ 참고.

## 다음 스토어 릴리스에서 같이 할 일

> **진행 중: 1.0.8 (2026-09-13)** — **iOS 는 게시 완료**(App Store 1.0.8, 2026-09-12T20:04Z).
> 안드로이드는 AAB 를 구워 비공개 테스트에 제출했다. `app.json` 을 다시 건드리면 두 바이너리의
> 지문이 함께 무효가 되므로 **안드로이드가 게시될 때까지 건드리지 말 것**.
>
> | 플랫폼 | 지문 | 상태 |
> |---|---|---|
> | iOS | `6bc20c979ffdbc05f07ea9b9ca6d0cad1f3b20b3` | **게시 완료.** `latest-ios.json` 이 이 값 하나를 든다(= 1.0.6 iOS 기기 잠김). 못박기·심사 목록에서 iOS 를 비웠다 |
> | Android | `eebd6802bff90e10333584aedafee0037c67e958` | 비공개 테스트 검토 중. `IN_REVIEW_RUNTIME_VERSIONS.android` 와 `latest-android.json` 에 등록됨 |
>
> **AAB 를 그대로 쓴다**(사용자 결정 2026-09-13). 광고 SDK 가 붙인 `com.google.android.gms.permission.AD_ID`
> 가 병합 매니페스트에 남아 있어 **데이터 안전 양식에서 광고 ID 수집을 신고해야 한다**. 1.0.6 이
> 그 상태로 나갔으므로 양식을 안 고쳐도 된다. 빼려면 `tools:node="remove"` 두 줄과 재빌드다.
>
> **iOS 는 ②③④ 를 했고 ① 을 안 했다**(2026-09-13). 번들을 발행하지 않은 이유는 아래
> `못박은 동안 HEAD 에서 발행하면 1.0.6 기기가 죽는다` 에 있다. 대가로 1.0.6 에서 올라온
> 사용자가 `업데이트를 마쳤어요` 를 한 번 볼 수 있다. 안드로이드도 게시되면 같은 순서다 -
> `latest-android.json` 갱신 → `IN_REVIEW.android` 비우기 → `PINNED.android` 제거, 그리고 그때
> `OTA_LEGACY_ASSET_MAP` 이름표와 `scripts/__tests__/share-image-native-modules.test.mjs` 도 함께
> 치운다(규칙 6).

> **네이티브 트리에서 AdMob 앱 ID를 걷는다.** 2026-08-31에 앱 ID를 환경 변수로 옮겼지만
> (`EXPO_PUBLIC_ADS_APP_ID_ANDROID`·`..._IOS`, `app.config.js`), 커밋된 prebuild 산출물에는
> 옛 값이 그대로 남아 있다.
>
> ```
> android/app/src/main/AndroidManifest.xml   com.google.android.gms.ads.APPLICATION_ID
> ios/app/Info.plist                         GADApplicationIdentifier
> ```
>
> **이 두 파일은 OTA 로 못 바꾼다.** OTA 는 JS 번들과 에셋만 갈아끼우고, 네이티브 설정 파일은
> 번들에 안 들어간다. 그래서 스토어 바이너리를 만들 때가 유일한 기회다.
>
> 할 일은 `.env` 를 채운 상태로 prebuild 를 돌려 네이티브 파일이 환경 변수 값으로 다시 써지는지
> 확인하고, 그 트리에서 바이너리를 굽는 것이다. 아래 규칙 1~4 를 그대로 따르면 된다. 자세한
> 배경은 [../features/ads.md](../features/ads.md).

> **SNS 공유용 이미지 내보내기의 의존성이 심겨 있다**(#388, [[ADR-267]]). 이번 바이너리가 그것을
> 처음 싣는다. 새로 들어가는 것은 `react-native-view-shot`·`expo-sharing`·`expo-media-library`
> 셋이다. `expo-file-system` 은 `expo` 자신의 의존성이라 전부터 들어 있었고 **버전을 안 올렸다.**
>
> **앨범 저장까지 한다**(사용자 결정). 그래서 권한 자리 셋이 함께 들어 있다. `ios/app/Info.plist`
> 의 `NSPhotoLibraryAddUsageDescription`, 안드로이드 매니페스트의
> `READ_MEDIA_VISUAL_USER_SELECTED` 와 `<application>` 의 `android:requestLegacyExternalStorage`.
> **전부 OTA 로 못 바꾸는 자리다.**
>
> 구운 뒤에 **둘을 함께 치운다.** 규칙 5 의 `PINNED_RUNTIME_VERSIONS` 와
> `scripts/__tests__/share-image-native-modules.test.mjs`. 그 가드가 막고 있는 것은 «모듈이 없는
> 1.0.6 기기에 그 모듈을 부르는 JS 가 OTA 로 배달되는 것»이고, 못박기가 사라지면 지문 불일치가
> 다시 그것을 막는다. 그때부터 시안·화면 구현은 전부 OTA 로 나간다.

## 릴리스는 노트를 쓰는 것으로 시작한다 ([[ADR-119]])

**버전을 올리기 전이 아니라, 올리면서 `src/data/release-notes.ts` 에 그 버전의 항목을
먼저 쓴다.** OTA 배포든 스토어 바이너리든 순서는 같다.

```
1. package.json 의 version 을 올린다        (x.y.z: 2단이면 OTA가 깨진다, ADR-024)
     ↑ 저장소 루트 package.json 이 아니다. 루트는 워크스페이스 오케스트레이션용이라 version 이 없다
2. src/data/release-notes.ts 에 그 버전 항목을 쓴다            ← 이 단계를 건너뛰면 3에서 막힌다
     · items:      변경 전부. 개발 노트 화면이 읽는다
     · highlights: 핵심 3~4줄. **업데이트 모달**이 받기 전에 읽는다([[ADR-126]] 결정 2·3)
     · 네이티브 변경 항목에는 ‘스토어 업데이트 필요’ 표식(항목 단위)
3. npm run build / node scripts/publish-live-update.mjs
```

> ⚠️ **캐패시터 앱의 `1.0.6` 이 그 앱의 마지막 번들이다**([[ADR-154]]). 소스는 이미 지웠고([[ADR-155]]) 남은 재료는 `ota/latest.json` 뿐이다.
> [[ADR-128]] 의 RN 전환분이 스토어에 올라가면서 capacitor 앱은 갱신이 끝났고, 이 배포는 ‘적용될
> 번들’을 나르는 것이 아니라 **사용자를 스토어로 보내는** 것이 목적이다. **버전은 여기서 더 올리지
> 않는다**. iOS 스토어 심사 버전이 1.0.6 이라 OTA 가 그 위로 가면 안 되고([[ADR-154]] 맥락),
> 판정이 버전이 아니라 플랫폼 목록이라 올릴 필요도 없다.
>
> **3단계로 나눠 친다**. 플랫폼마다 ‘스토어에 받을 것이 생기는’ 시점이 다르기 때문이다.
> 2026-08-21 실측으로 **두 스토어 모두 아직 새 바이너리가 없다**(Play 404 · App Store 1.0.0).
>
> ```
> 1단계  node scripts/publish-live-update.mjs --bundle-only --highlight '<문구>' ...   ✅ 완료
>          ← zip 만 올리고 latest.json 은 안 건드린다(모달 안 뜸). 초안이 ota/latest.json 에 남는다.
>            캐패시터 소스가 필요한 마지막 순간이다.
> 2단계  ota/latest.json 에 "storeRequiredPlatforms": ["android"] 를 넣어 발행 (Play 게시 확인 후)
> 3단계  같은 필드를 ["android","ios"] 로                            (App Store 게시 확인 후)
>          gh release upload live-update-latest ota/latest.json --repo jini520/maple-routine --clobber
>          ← 둘 다 빌드 없음·다운로드 없음. 그래서 1단계 직후 캐패시터 소스를 지웠다([[ADR-155]]).
> ```
>
> - **먼저 쏘지 말 것**. 스토어에 받을 것이 없는 플랫폼을 목록에 넣으면 막다른 길로 보낸다.
>   게시 확인은 콘솔 상태가 아니라 **조회**로 한다(Play 상세 페이지 HTTP 코드 · iTunes Lookup 의 `version`).
> - **되돌릴 수 있다**. 목록에서 플랫폼을 빼고 다시 덮어쓰면 원복된다([[ADR-154]] 결정 5).
>   종전 `--min-native` 계획은 되돌릴 수 없는 지점이었다.
> - **`--highlight` 로 덮어쓰는 이유**. 1.0.6 노트는 **RN 의 것**이라 넷 중 셋이 캐패시터 번들에
>   없는 기능이다. 원천(`release-notes.ts`)과 아래 가드는 그대로 돌고 매니페스트에 실리는 값만
>   갈린다([[ADR-154]] 결정 7).
> - **1단계 번들에 `APP_STORE_ID` 수정이 실려 있어야 한다**. 게이트가 켜지면 새 번들은 다운로드
>   자체가 안 되므로 그 뒤엔 못 고친다([[ADR-154]] 결정 6, 이미 반영됨).
>
> 노트를 안 쓴 채 스크립트를 돌리면 가드에 걸려 중단되는 것이 정상이고
> ([[ADR-119]] 결정 6 + [[ADR-126]] 결정 8), 위 1·2 를 먼저 하면 풀린다. **`highlights` 를 빠뜨리는
> 것도 같은 중단**이다. 문구가 어느 쪽이 비었는지 말해 준다.

> [!NOTE]
> **이 절은 캐패시터 기준이다.** RN 앱의 OTA 는 프로토콜도 스크립트도 다르다
> (`scripts/publish-rn-ota.mjs` · [[ADR-137]]). **RN 스토어 릴리스 절차는 아직 이 문서에 없다**. 1.0.6
> 을 내보내며 확인된 것부터 여기 채울 것.

- **노트나 핵심 목록이 없으면 `publish-live-update.mjs` 가 중단한다**(`process.exit(1)`, 문구가 어느
  쪽이 비었는지 말한다). 앱 `package.json` version 형식 검사와 **같은 자리**에서, `npm run build` 보다
  **앞에서** 죽으므로 몇 분짜리 빌드를 버리지 않는다.
- **`highlights` 를 `items` 에서 베끼지 말 것**([[ADR-126]] 결정 3). *"무엇이 바뀌었나"* 가 아니라
  *"받으면 무엇이 생기나"* 를 쓰고, 자잘한 것은 `일부 버그 및 사용성 개선` 처럼 한 줄로 뭉친다.
- **스크립트가 `.ts` 를 읽는 방법은 Node 내장 타입 스트리핑이다**. `.mjs` 가
  `src/data/release-notes.ts` 를 **그대로 `import`** 한다(Node 22.18+/23.6+ 부터 플래그 없이 켜져 있고
  이 저장소는 24.x 에서 확인했다). **이 자리를 만질 때 `tsx`·`ts-node` 를 들이지 말 것**. 배포
  스크립트는 릴리스 경로의 일부라 의존성이 늘수록 릴리스가 깨질 표면이 넓어진다. 정규식으로 파일을
  긁는 것도 안 된다(원천 형식이 바뀌는 순간 조용히 틀린 값을 낸다). `release-notes.ts` 는 순수
  데이터라 타입 선언 말고는 스트리핑할 것도 없다.
- **경고가 아니라 중단인 이유**: 노트가 빠진 채 배포되면 그 버전은 **영영 빈 채로 남는다**.
  [[ADR-119]] 결정 4 가 사후 재구성을 금지했으므로(릴리스 노트는 사실 기록이다) 나중에 채울 방법이
  없다. 사후 복구가 불가능한 실수는 사전에 막는다.
- 같은 파일이 두 곳으로 나간다. 앱 내장 **개발 노트 화면**(`/settings/release-notes`, 과거 전체)과
  배포 스크립트가 파생시키는 **`latest.json` 의 `highlights`**(업데이트 모달, 그 버전의 핵심 3~4줄).
  상세는 [../features/live-update.md](../features/live-update.md)·[../features/settings.md](../features/settings.md).
- 스토어 등록정보의 **출시 노트**(아래 "스토어 등록정보 문구")는 **별개 칸**이다. 콘솔에 직접 쓰고
  이 파일에서 파생되지 않는다. 같은 릴리스라도 담는 말이 다를 수 있다(스토어는 그 버전 한정 소개,
  개발 노트는 누적 기록).

## Android

### 사전 1회: 업로드 키스토어 만들기 ([[ADR-091]])

**저장소 밖**에 만든다. 여기서 정한 비밀번호 두 개와 별칭은 다시 볼 수 없으니 암호 관리자에
먼저 넣어둘 것.

```bash
mkdir -p ~/keys
keytool -genkeypair -v \
  -keystore ~/keys/maple-routine-upload.jks \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

- `-validity 10000`(약 27년). Play는 **2033-10-22 이후까지** 유효한 키를 요구한다.
- `-storetype PKCS12`. JKS는 레거시 포맷이라 `keytool` 이 변환 경고를 낸다.

**인증서 소유자 정보(DN)** 를 대화형으로 묻는다. **업로드 키의 DN은 사용자에게 어디에도 보이지
않는** 인증서 메타데이터라 값은 자유롭지만, 나중에 바꾸려면 키를 새로 만들어야 한다. 실제로
쓴 값은 이렇다.

```
CN=MapleRoutine, O=Maple Routine, L=Seoul, ST=Seoul, C=KR
```

- **한글을 넣지 않는다.** 이 저장소는 한글 번들 이름의 NFD 인코딩 때문에 App Store 서명 검증이
  깨진 전례가 있다([../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md)).
- 마지막 확인(`… 이(가) 맞습니까? [아니오]:`)에서 **`y` 를 입력**한다. 기본값이 "아니오"라
  그냥 엔터를 치면 처음부터 다시 묻는다.

그 다음 `android/keystore.properties` 를 만든다(**gitignore 대상 · 절대경로**).

```properties
storeFile=/Users/<user>/keys/maple-routine-upload.jks
storePassword=<비밀번호>
keyAlias=upload
keyPassword=<같은 비밀번호>
```

⚠️ **`storePassword` 와 `keyPassword` 는 같은 값이다.** PKCS12는 키 비밀번호가 키스토어
비밀번호와 같아야 해서 `keytool` 이 키 비밀번호를 **따로 묻지 않는다**(JKS 시절의 "키 저장소
암호와 동일한 경우 RETURN" 프롬프트가 없다). 다른 값을 적으면 빌드가 서명 단계에서 실패한다.

> 업로드 키는 **분실보다 유출이 위험하다**. Play 앱 서명을 쓰므로 잃어버리면 Google에 재설정을
> 요청할 수 있다([[ADR-091]] 결정 1).

### 매 릴리스

**릴리스 노트가 선행한다**(위 "릴리스는 노트를 쓰는 것으로 시작한다"). 아래는 그 뒤의 빌드 절차다.

**네이티브 프로젝트는 저장소 루트의 `android/` 다**([[ADR-155]] 결정 2). 웹 번들을 굽고
`npx cap sync` 로 넣던 단계는 없다. JS 는 Gradle 이 Metro 를 불러 AAB 안에 직접 넣는다.

```bash
# 1. versionCode 를 **두 파일에** 올린다: 소진된 번호는 재사용 불가
#      android/app/build.gradle  ← 빌드가 실제로 읽는 값
#      app.json                  ← 지문(runtimeVersion) 재료. 한쪽만 고치면 AAB 는 옛 번호로 나온다(실측, c9ce4697)
# 2. expo-updates 의 임베드 에셋 목록을 **지워서** 다시 만들게 한다
#      그 Gradle 태스크가 소스를 입력으로 선언하지 않아 한 번 만들어지면 UP-TO-DATE 로 건너뛴다.
#      스탈해지면 새 그림이 **에러도 로그도 없이** 빈 자리로 나온다(c9ce4697: 카링·벨로나 5장).
rm -rf android/app/build/generated/assets/createReleaseUpdatesResources
# 3. AAB (APK 아님: Play는 AAB만 받는다)
#      **플래그를 빼지 말 것**([[ADR-269]] 결정 1). x86·x86_64 는 에뮬레이터 전용이라 스토어
#      빌드에 담을 이유가 없고, 빼면 그 ABI 의 네이티브 16.0 MB 와 **그 ABI 의 디버그 심볼
#      14.3 MB 가 함께** 빠진다(합 30.3 MB). 기본값(`gradle.properties`)은 에뮬레이터 개발
#      빌드를 위해 넷 그대로 두므로, 좁히는 것은 이 커맨드뿐이다.
cd android && ./gradlew bundleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
# 4. 산출물: android/app/build/outputs/bundle/release/app-release.aab
```

**디버그 심볼은 따로 할 일이 없다**([[ADR-269]] 결정 2). AAB 에 실린 채로 나가고 Play 가 거기서
자동으로 꺼내 쓴다. `debugSymbolLevel` 을 손대지 말 것 - `'none'` 은 심볼을 AAB 에서 빼는 것이
아니라 **추출 자체를 멈춰** Play 에 올릴 파일도 안 남긴다(실측). 기본값이 이미 `symbol_table` 이라
낮출 여지도 없다.

**난독화 매핑도 따로 할 일이 없다**([[ADR-269]] 정정 1). R8 이 켜져 있어 `mapping.txt` 가 생기지만
AGP 가 그 사본을 AAB 안(`BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`)에
넣으므로 Play 가 자동으로 쓴다. 스택트레이스가 난독화된 채 보이면 그때 이 파일을 의심할 것.

> ⚠️ **R8 이 켜진 릴리스는 실기기 스모크가 게이트다**([[ADR-269]] 정정 1). R8 은 리플렉션으로만
> 닿는 코드를 지울 수 있고, 그것은 **빌드도 설치도 성공한 뒤 그 화면을 눌렀을 때** 드러난다.
> debug 빌드에서는 R8 이 안 돌아 재현되지 않는다. 릴리스 APK 를 실기기에 올려 주요 화면을 전부
> 밟을 것. 확인할 때 OTA 번들이 임베드 번들을 가릴 수 있으므로 버전을 올려 리셋한 뒤 본다.

**서명 확인**. 서명이 안 붙어도 빌드는 성공하므로([[ADR-091]] 결정 4) 산출물을 직접 본다.

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab
```

`소유자: CN=...` 이 나오면 서명된 것이고, 아무것도 안 나오면 `keystore.properties` 를 못 읽은
것이다. **실제 업로드 키로 끝까지 한 번 돌려 검증했다**(2026-08-04).

```
소유자: CN=MapleRoutine, O=Maple Routine, L=Seoul, ST=Seoul, C=KR
종료 날짜: Sat Dec 20 18:39:09 KST 2053     ← Play 요건(2033-10-22 이후) 충족
주체 공용 키 알고리즘: 2048비트 RSA 키       ← Play 요건(RSA 2048 이상) 충족
```

### 버전 규칙 (ADR-024, [[ADR-091]] 결정 5)

| 값 | 현재 | 규칙 |
|---|---|---|
| `versionCode` | 21 | 업로드마다 +1. **되돌리지 않는다**. 내부 테스트에 한 번 올린 번호는 프로덕션에 다시 못 쓴다 |
| `versionName` | `1.0.0` | 3단 고정. OTA 매니페스트와 같은 축이라 2단(`1.0`)이면 OTA가 깨진다 |

내장 번들과 OTA 채널의 버전 관계는 [features/live-update.md](../features/live-update.md) 참조.

## Play Console 요건

바이너리와 별개로 콘솔에서 채워야 하는 것들. **코드로 해결되지 않는 항목이 대부분이다.**

| 항목 | 상태 | 메모 |
|---|---|---|
| 개발자 계정 | ⏳ 개인 계정 보유 | — |
| **비공개 테스트 12명 × 14일 연속** | ❌ | 2023-11 이후 **개인** 계정의 프로덕션 출시 전제조건. 조직 계정은 면제. **전체 일정을 지배하는 항목** |
| 개인정보 처리방침 URL | ✅ | `https://mapleroutine.store/privacy`. 게시 확인 완료(2026-08-04) |
| 개인정보 처리방침 **앱 내 링크** | ✅ | 설정 footer 맨 위(2026-08-04). Play 사용자 데이터 정책은 스토어 등록정보 **와 앱 안** 양쪽을 요구한다([features/settings.md](../features/settings.md)) |
| **앱 액세스 권한** | ❌ | 로그인이 넥슨 API 키 하드 게이트라([features/auth.md](../features/auth.md)) **심사자용 테스트 키 + 캐릭터 있는 계정 + 입력 절차**를 적어주지 않으면 리뷰어가 앱을 실행조차 못 한다 |
| 데이터 안전 | ❌ | `AD_ID` 권한을 선언했으므로 **광고 ID 수집 신고 필수**. 넥슨 API 키의 취급 분류도 함께. **알림을 넣는 릴리스부터 한 항목 더**. FCM 등록 토큰은 앱이 서버로 안 보내도(토픽 방식, [[ADR-146]] 결정 2) **Firebase 가 갖는 기기 식별자**라 신고 대상이다. **[[ADR-227]] 결정 4 의 2차 가공 데이터 수집부터 또 한 항목** - 식별자를 떼고 옵트인으로 보내도 **모으는 것 자체가 신고 대상**이다 |
| **개인정보 처리방침 갱신 (푸시)** | ❌ | [[ADR-146]] 을 구현하는 릴리스 전에 `PRIVACY.md`(→ `mapleroutine.store/privacy`)에 푸시 알림·Firebase 데이터 처리를 추가해야 한다. **바이너리가 아니라 문서 쪽 준비물이라 잊기 쉽다** |
| "광고 포함" 선언 | ❌ | ADR-090 |
| 콘텐츠 등급 설문 · 타겟 연령 | ❌ | — |
| 배포 국가 | 한국 한정 | EU 사용자가 없어 GDPR 동의(UMP) 구현이 불필요하다는 전제다. 국가를 넓히려면 그 흐름부터 |
| 계정 삭제 정책 | 해당 없음 (조건부) | 계정 생성 기능이 없다. [[ADR-227]] 이 서버를 들였지만 결정 4 가 올리는 것을 **식별자를 뗀 2차 가공 데이터**로 한정하고 계정·백업을 **넥슨 OAuth 승인 뒤로 미뤘다**. 지울 계정이 없어 이 항목은 아직 안 생긴다. **승인이 나 계정을 만드는 릴리스부터는 필수**이고 Play·App Store 둘 다 앱 안과 웹 양쪽을 요구한다 |
| 스크린샷 | ✅ | `resources/screenshots/listing/play-store-1320x2640/` 6장 |
| 피처 그래픽 1024×500 | ✅ | `resources/play-feature-graphic-1024x500.png`(2026-08-04). **알파 채널을 뺀 24-bit PNG**. Play는 알파를 받지 않는다. 16:9로 크롭돼도(좌우 68px씩) 카피·로고가 모두 살아남는 것을 확인했다 |
| 아이콘 512×512 | ✅ | `resources/play-store-icon-512.png`(2026-08-04). iOS 마케팅 아이콘 1024를 **정확히 2:1로 축소**해 만든다. Android 런처 아이콘(adaptive)은 전경에 16.7% inset이 들어가 스토어 아이콘으로 쓰면 안 된다. **모서리를 미리 둥글리지 않는다**(Play가 마스크를 씌운다) |

게시 **후**에 AdMob 콘솔에서 앱을 연결해 검토(2~3일)를 통과해야 광고가 정상 노출된다.
미게시 앱은 *limited ad serving* 이다.

## 스토어 등록정보 문구

**칸은 스토어마다 다르다.** Play 는 짧은 설명 · 자세한 설명 · 출시 노트 셋이고, App Store 는 여기에
프로모션 텍스트 · 키워드 · 심사 메모가 더 붙는다. 짧은 설명 · 자세한 설명 · 키워드는 **상시 노출**,
출시 노트는 **그 버전 한정**, 프로모션 텍스트는 **심사 없이 언제든 바꾸는 칸**이다.

아래는 **1.0.8 기준으로 다시 쓴 원문**이다(2026-09-13). 1.0.0 원문은 문서 끝 폐기된 정책에 있다.

**공통 정책**. 가격("무료")·순위("1위")·설치 유도("지금 다운로드") 문구를 넣지 않는다. 다른
앱이나 플랫폼도 언급하지 않는다. HTML 태그가 먹지 않아 불릿은 문자(`■` `▶` `•`)로 쓴다.

**앱에 없는 기능을 적지 않는다.** 1.0.6 까지 게시된 설명은 **사냥 타이머**(한 줄도 구현된 적 없다,
[[ADR-005]] ⛔)와 **숙제 미완료 알림**(`native/notifications.ts` 의 `scheduleLocalNotification` 을
부르는 코드가 앱에 없다)을 광고하고 있었고, 심사 메모는 **전면광고**를 고지하고 있었다(코드는
[[ADR-156]] 에서 지워졌다). 1.0.8 문구에서 셋 다 걷었다. 다음에 문구를 고칠 때도 **화면에서 눌러
확인한 것만** 적을 것.

> **App Store 는 교체했다**(2026-09-13, 1.0.8 심사 제출과 함께). **Play 는 아직 1.0.6 문구다** -
> 안드로이드 1.0.8 을 올릴 때 짧은 설명 · 자세한 설명 · 출시 노트 셋을 위 문구로 교체할 것.

### 짧은 설명 (Play, 80자 제한)

```
메이플스토리 일간·주간 숙제와 보스 수익, 물욕템 드랍을 캐릭터별로 관리
```

40자. **여유를 일부러 남긴다**. 검색 결과에서 앱 이름 아래 한 줄로 붙는 자리라, 키워드를
채우면 읽히지 않고 스팸으로 보인다.

**앱 안에서는 "컨텐츠"라 부르지만 여기서만 "숙제"를 쓴다.** 스토어에서 찾는 사람은 "메이플
숙제"로 검색하고, 이 앱 유입의 대부분이 검색이다. 이 자리만 플레이어의 말을 쓴다.

### 프로모션 텍스트 (App Store, 170자 제한)

```
가계부가 커졌습니다. 스타포스·큐브·잠재 재설정에 쓴 메소가 지출로 자동으로 잡히고, 사냥터를 고르면 사냥 수입이 계산됩니다. 넥슨 공지도 앱에서 바로 받아보세요. 9월 17일 패치 결정석 가격까지 반영했습니다.
```

118자. **심사 없이 바꿀 수 있는 유일한 칸**이라 이번 버전에서 새로 생긴 것을 넣는다. 설명 맨 위에
붙어 첫 화면에서 읽히므로, 여기서 파는 것은 앱 소개가 아니라 **지금 바뀐 것**이다. 다음 릴리스
때는 그 버전의 새 기능으로 갈아 끼운다.

### 자세한 설명 (4000자 제한)

```
메이플스토리 플레이어를 위한 루틴 관리 앱입니다. 오늘 숙제가 남은 캐릭터는 누구인지, 이번 주 보스로 얼마를 벌고 강화에 얼마를 썼는지, 본캐부터 부캐까지 한 곳에서 확인하세요. 여러 메이플 ID의 캐릭터를 함께 관리할 수 있습니다.

이용하려면 넥슨 오픈 API 키가 필요합니다. 발급 방법은 아래 ‘이용 전 준비 사항’에 적었습니다.


■ today

앱을 켜면 위젯 화면이 먼저 섭니다. 대표 캐릭터, 오늘 남은 숙제, 이번 주 보스 수익, 결정석 판매 한도, 리셋까지 남은 시간을 한눈에 봅니다. 시세를 아직 적지 않은 드랍과 물욕템이 끊긴 기간도 여기서 알려드립니다.


■ 컨텐츠 스케줄러

일간·주간 컨텐츠의 진행 상태를 캐릭터별로 보여줍니다. 몬스터파크 7/14처럼 남은 횟수까지 그대로 표시됩니다. 게임 스케줄러에 등록해 둔 것을 그대로 따라가는 자동 모드와, 추적할 컨텐츠를 직접 고르는 수동 모드 중에서 선택할 수 있습니다.


■ 보스 스케줄러

주간·월간 보스 처치 현황을 캐릭터별로 정리합니다. 캐릭터마다 주간 12마리 한도를 몇 칸이나 썼는지 배지로 보이고, 보스별 파티 구성도 함께 관리할 수 있습니다.


■ 보스 수익

처치한 보스의 결정석 수익을 자동으로 계산합니다. 파티원 수만큼 나눈 실제 수령액으로 집계되고, 캐릭터별·기간별 합계와 월드당 주간 결정석 판매 한도(90개) 소진량을 한 화면에 모아 봅니다. 지난 기록도 그대로 남아 날짜별로 되짚어볼 수 있습니다.


■ 물욕 아이템 드랍

보스별 물욕템을 아이콘에서 탭 한 번으로 기록합니다. 보스 반지 상자·칠흑 장신구 상자처럼 개봉 결과가 갈리는 아이템은 실제로 나온 것을 골라 저장하고, 기록한 아이템은 시세로 환산돼 보스 수익 합계에 더해집니다. 전 기간 히스토리에서 언제 무엇이 떴는지 한 번에 볼 수 있습니다.


■ 가계부

수익과 지출을 한 달 또는 한 주 달력으로 봅니다. 보스 수익과 물욕템 기록은 다시 적지 않아도 처치한 날짜에 그대로 들어옵니다.

지출은 세 갈래로 적습니다. 스타포스·큐브·잠재 재설정에 쓴 메소는 강화 사용 내역에서 읽어 자동으로 잡히고, 주문서와 컨텐츠 입장료·버프 아이템은 목록에서 골라 적고, 그 밖의 지출은 직접 적습니다.

사냥 수입은 계산기로 냅니다. 사냥터와 시간, 사용한 버프를 고르면 캐릭터에 붙어 있는 메소 획득량까지 반영해 금액을 계산합니다. 직접 입력도 됩니다.


■ 유틸리티

판매 분배금 계산기로 함께 잡은 아이템을 판 값을 인원수로 나눠 봅니다.


■ 넥슨 공지 알림

게임 공지 사항과 업데이트 안내, 썬데이 메이플, 캐시 아이템 소식을 앱에서 받아봅니다. 받을 종류는 설정에서 하나씩 켜고 끌 수 있습니다.


■ 테마

머쉬맘·혼테일·레테·렌·엔젤릭버스터·검은마법사 여섯 가지 테마로 앱 전체 색을 바꿀 수 있습니다. 처음 실행할 땐 기기의 다크 모드 설정을 따라갑니다.


▶ 이용 전 준비 사항

이 앱은 넥슨이 공개한 오픈 API로 게임 데이터를 읽어 옵니다. 사용하시려면 openapi.nexon.com에서 본인의 개인 API 키를 발급받아 앱에 입력해 주세요. 발급 방법은 앱 첫 화면에서 안내합니다.

자동 모드에서는 게임 클라이언트의 ‘스케줄러’에 등록한 항목만 보입니다. 등록하지 않은 것은 API로 조회되지 않기 때문입니다. 직접 고르고 싶다면 설정에서 수동 모드로 바꿔 주세요.


▶ 개인정보

회원가입이 없습니다. 발급받은 API 키와 앱에서 만든 모든 기록은 이용자의 기기에만 저장되며 운영자에게 전송되지 않습니다. 공지를 받아오는 요청에는 이용자를 식별할 정보가 들어가지 않습니다.

개인정보 처리방침: https://mapleroutine.store/privacy
문의: https://mapleroutine.store/support


※ 본 앱은 NEXON Korea Corp.의 공식 서비스가 아닌 개인 개발 앱입니다.
Maple Routine is not associated with NEXON Korea
Data based on NEXON Open API
```

1,993자. 제한의 절반도 안 쓴다. 설명은 길이가 순위를 올려주지 않고, 첫 3줄 뒤는 "더보기"에
접힌다.

- **기능 목록이 준비 사항보다 앞이다.** 1.0.0 은 반대였다. 접히기 전 3줄에 무엇을 하는 앱인지가
  없으면 설치 자체가 안 일어나서 순서를 뒤집었고, **API 키가 필요하다는 사실은 인트로 바로 아래
  한 줄로 올려** 1.0.0 이 막으려던 별점 1점(키가 필요한 줄 모르고 설치)을 그대로 막는다.
- **자동·수동 두 모드를 둘 다 적는다.** "게임 스케줄러에 등록 안 한 항목은 안 보인다"는 자동
  모드의 사실이고, 수동 모드는 직접 고른다. 한쪽만 적으면 문의가 그쪽으로 온다.
- **비제휴 고지는 앱 설정 footer·안내 사이트·`PRIVACY.md` 와 같은 영문 문구를 쓴다**
  ([features/settings.md](../features/settings.md)). 한 곳만 고치면 네 곳이 달라진다.

### 키워드 (App Store, 100자 제한)

```
메이플스토리,일일퀘,일퀘,주간보스,결정석,물욕템,숙제,주간숙제,체크리스트,스케줄러,몬스터파크,메소,가계부,강화비용,스타포스,큐브,사냥터,메획,보스파티,분배금,넥슨,반지상자
```

95자. 쉼표도 글자 수에 든다. **없는 기능의 검색어를 빼고**(`타이머`·`솔야누스`) 1.0.8 이
가진 것을 넣었다(`가계부`·`강화비용`·`스타포스`·`큐브`·`사냥터`·`메획`·`분배금`).

앱 이름의 낱말(`메이플`·`루틴`)은 이미 색인되므로 키워드에 다시 적지 않는다. `메이플스토리` 는
한 낱말로 검색되는 말이라 남긴다.

### 출시 노트 (500자 제한, 언어별)

```
• 가계부가 커졌습니다. 스타포스·큐브·잠재 재설정에 쓴 메소가 강화 사용 내역에서 자동으로 지출에 잡히고, 주문서 지출도 골라서 적을 수 있습니다.
• 사냥 수입은 계산기로 냅니다. 사냥터와 시간, 사용한 버프를 고르면 캐릭터에 붙어 있는 메소 획득량까지 반영해 금액을 계산합니다. 직접 입력도 됩니다.
• 9월 17일 패치를 반영했습니다. 바뀐 결정석 가격은 처치한 주에 맞춰 적용되어 패치 전 기록은 그대로 남습니다.
• 넥슨 공지를 앱에서 받아봅니다. 새 공지는 알림과 today 배너로 알려드리고, 받을 종류는 설정에서 고를 수 있습니다.
• 앱을 최적화해 설치 용량을 줄였습니다.
• 그 밖에 여러 버그를 고치고 사용성을 다듬었습니다.
```

361자. 한국어만 배포하므로 언어는 하나면 된다.

- **순서는 `src/data/release-notes.ts` 의 `highlights` 를 따른다.** 그 네 줄은 사용자가 직접 골랐고
  가계부가 첫 줄이다. 첫 초안이 넥슨 공지를 맨 위에 뒀다가 내렸다. 노트의 첫 줄은 **이 버전에서
  사람들이 가장 많이 쓸 것**이지, 가장 새로운 기술이 아니다.
- **묶음 제목(`■ 새로 생긴 것` 같은 것)을 안 쓴다.** 여섯 줄짜리 목록에 제목을 얹으면 읽을 것이
  늘기만 한다. 앱 안 노트 화면은 `category` 로 묶지만 그건 데이터가 이미 갈라져 있어서다.
- **같은 사실만 적는다.** 앱 안 릴리스 노트 화면과 스토어가 다른 말을 하면 어느 쪽이 참인지 알
  방법이 없다. 글자 수가 남아도 항목을 늘리지 않는다.
- 짧은 판(184자)도 만들어 뒀다가 안 썼다. 가계부 두 줄을 한 줄로 접으면 **강화가 자동이라는 것**이
  사라지는데, 그것이 이 버전에서 가장 많이 받을 질문이다.

### 심사 메모 (App Store, App Review 전용)

**테스트 키는 저장소에 적지 않는다.** 자격 증명이고, 만료되면 여기 남은 값이 거짓이 된다.
App Store Connect 에서 직접 붙이고, 붙이기 전에 **그 키로 앱이 실제로 열리는지** 확인할 것.
키가 개발 단계면 `DevelopmentStageKeyModal` 이 막아 심사가 첫 화면에서 끝난다.

```
[NO LOGIN - API KEY REQUIRED INSTEAD]
There is no sign-up or sign-in. Each user enters a personal API key they issue for themselves at openapi.nexon.com. Without a key the app shows only the onboarding screen and no game data at all, so please use the test key below. It is a service-stage key; the app rejects development-stage keys by design.

TEST API KEY:
<App Store Connect 에 직접 붙인다>

[HOW TO REVIEW - about 2 minutes]
1. Launch the app. The onboarding screen asks for a NEXON Open API key.
2. Paste the test key above and submit. The key is long, so please paste rather than type.
3. On the character screen, select one or more characters and tap "계속하기" (Continue).
4. A progress bar loads that account's data. This may take several seconds.
5. You land on the "today" tab, a grid of summary widgets. The bottom bar has five groups: today, 스케줄러 (Scheduler: daily and weekly content, boss clear status, boss management), 수익·지출 (Income and expense: boss crystal income, cashbook calendar), 유틸리티 (Utility: a sale-split calculator), 더보기 (More: API key, notices, theme, guides).
6. Item drop records open by selecting a boss on the 보스 (Boss) page. Cashbook entries are added with the floating + button on the 가계부 (Cashbook) page.

[EXPECTED BEHAVIOR, NOT BUGS]
- In the default "자동" (auto) mode, only content the player registered in the game client's in-game Scheduler can appear, because NEXON's API returns nothing else. This is stated in onboarding and in the App Store description. "수동" (manual) mode in settings lets the user pick content instead.
- NEXON's API serves data as of the previous day, not in real time.
- Weekly data resets Thursday 00:00 KST, so reviewing right after a reset may legitimately show zero or low values.

[PERMISSIONS / THIRD PARTIES]
- Notifications: optional, used only for NEXON notice alerts (game notices, update notices, Sunday Maple, cash shop). The app works fully if denied.
- Network: NEXON Open API for game data, and our own server at mapleroutine.store for the notice list and detail (read-only GET, no user identifier in the request). Push delivery uses Firebase Cloud Messaging topics, so no device token or account is tied to a user on our side.
- No ads in this version.
- No user accounts and no analytics service. The API key and every record the user creates stay on the device.

[AFFILIATION] Not affiliated with, endorsed by, or sponsored by NEXON Korea Corp. Uses only publicly documented read-only endpoints of NEXON Open API. The required attribution "Data based on NEXON Open API" is shown at the bottom of the 더보기 (More) tab.

[CONTACT] If the test key stops working during review, please email support.mapleroutine@gmail.com and we will send a replacement immediately.
```

**1.0.6 메모에서 걷은 것 둘.** 전면광고 고지(광고가 없다)와 "no servers of our own"(공지 조회가
`mapleroutine.store/v1` 로 나간다). 탭 이름도 다섯 그룹으로 갈렸다.

## iOS

Xcode 자동 서명을 쓰므로 키 관리가 없다. 대신 두 가지 함정을 이미 밟았고 둘 다 고쳐져 있다.
`CODE_SIGN_IDENTITY` 의 레거시 문자열과 **한글 `PRODUCT_NAME`**(NFD 경로가 코드 서명을 깬다).
전말과 CLI 검증 절차는 [../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md).

`cap add ios` 를 다시 하면 `PRODUCT_NAME` 이 `capacitor.config.ts` 의 한글 `appName` 으로
되살아난다. **플랫폼을 재생성했다면 ASCII 로 다시 바꿀 것.**

### 아카이브 (2026-08-19, v1.0.6 build 13 으로 확인)

Xcode GUI 가 아니라 **CLI 로 돈다.** Organizer 는 아카이브가 `~/Library/Developer/Xcode/Archives/<오늘
날짜>/` 밑에 있으면 그대로 집어 가므로, `-archivePath` 를 거기로 주면 GUI 의 `Product ▸ Archive` 와
결과가 같다. CLI 를 쓰는 이유는 실패 지점이 로그에 남기 때문이다. 서명 문제는 GUI 로 하면
Organizer 의 Distribute 까지 가야 드러난다([../trouble/2026-08-04-ios-appstore-signing.md](../trouble/2026-08-04-ios-appstore-signing.md)).

#### 1. 빌드 번호는 **두 파일**이다: Android 와 같은 함정

| 파일 | 값 |
|---|---|
| `app.json` | `ios.buildNumber` |
| `ios/app/Info.plist` | `CFBundleVersion` ← **빌드가 실제로 읽는 값** |

이 저장소는 네이티브 트리를 커밋해 두므로 `app.json` 은 원천이 아니다(prebuild 를 돌려야 반영된다,
[[ADR-138]]). `app.json` 만 고치면 **옛 번호로 나간다**. Android 가 `versionCode` 20 으로 그렇게 한 번
나갔다(`c9ce4697`). 타겟의 `MARKETING_VERSION`(`1.0`)·`CURRENT_PROJECT_VERSION`(`1`) 은 스캐폴드
기본값 그대로 둬도 된다. `INFOPLIST_FILE` 의 리터럴이 이긴다.

#### 2. 소진된 번호는 **로컬 아카이브가 알고 있다**

App Store Connect 를 열 필요가 없다. Xcode 는 업로드 이력을 아카이브 안에 적어 둔다.

```bash
for a in ~/Library/Developer/Xcode/Archives/*/*.xcarchive; do
  plutil -p "$a/Info.plist" | grep -e uploadedBuildNumber -e '"title"' -e '"state"'
done
```

`task = distribute` 항목의 `uploadEvent.state = success` 가 보이면 그 `uploadedBuildNumber` 는 **다시 못
쓴다.** build 12 가 그랬다(업로드 2026-08-19 05:23). `task = validate` 만 있는 것은 검증만 한 것이라
번호가 살아 있다. 둘을 구별할 것.

#### 3. 아카이브

```bash
cd ios
xcodebuild -workspace app.xcworkspace -scheme app \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/MapleRoutine-1.0.6-13.xcarchive" \
  archive
```

`npm run build`·`npx cap sync` 는 **필요 없다**(그건 capacitor 쪽 절차다). RN 은 `Bundle React Native
code and images` 빌드 단계가 `expo export:embed` 를 돌려 JS 번들과 에셋을 매 빌드 새로 만든다.

**임베드 프레임워크는 빌드 단계가 벗긴다**([[ADR-269]] 결정 3). `Strip Embedded Frameworks` 단계가
`[CP] Embed Pods Frameworks` 뒤에서 `strip -x -S` 를 걸고 **같은 신원으로 다시 서명한다.** 재서명이
빠지면 CocoaPods 가 복사 직후 붙여 둔 서명이 무효가 되어 업로드가 튕긴다. 실측으로 24.1 MB →
12.1 MB 이고 이것은 사용자가 받는 크기다.

아카이브 뒤 실제로 벗겨졌는지는 산출물에서 본다. `React.framework` 가 12 MB 에 가까우면 안 벗겨진
것이다.

```bash
find <아카이브>/Products/Applications/app.app/Frameworks -name "React" -exec ls -lh {} \;
```

#### 4. 업로드 전에 export 까지 돌려 배포 서명을 확인한다

아카이브는 **개발 인증서로 서명된 채 성공한다**(`SigningIdentity = Apple Development …`). 배포
인증서로 바뀌는 것은 export 단계이고, 거기서 깨지면 error 90034 다. 그래서 업로드 전에 한 번 돌린다.

```bash
xcodebuild -exportArchive -archivePath <위 경로> \
  -exportPath /tmp/export -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates
# method: app-store-connect · destination: export · teamID: TQPKW249G7 · signingStyle: automatic
```

`destination` 을 `export` 로 두면 IPA 만 만들고 업로드하지 않는다. **업로드까지 CLI 로 하려면 같은
plist 의 `destination` 만 `upload` 로 바꿔 한 번 더 돌린다** — Xcode 에 로그인된 계정으로 올라가고
아카이브에 `uploadedBuildNumber` 가 기록된다(2026-09-13, build 15 로 확인).

**`ExportOptions.plist` 는 저장소에 두지 말 것.** `ios/` 안의 추적되지 않는 파일도 지문 재료라
거기 두면 **바이너리에 박힌 지문과 트리 계산값이 갈린다**(규칙 2 가 그것을 잡는다). 스크래치패드
같은 저장소 밖에 두고 경로로 넘긴다.

**`-allowProvisioningUpdates` 가 필요하다.** 없으면 프로파일이 낡은 채로 실패한다.

```
error: Provisioning profile "iOS Team Store Provisioning Profile: com.mapleroutine.app"
       doesn't include the Push Notifications capability.
```

1.0.8 이 그랬다. 아카이브는 통과하고 여기서 떨어진다. 플래그를 주면 xcodebuild 가 App ID 의
capability 를 맞춰 **프로파일을 새로 발급**받는다. 손으로 하려면 developer.apple.com 의
Identifiers 에서 Push Notifications 를 켜고 프로파일을 재발급한다.

**`ios/app/app.entitlements` 의 `aps-environment` 는 `development` 로 둔다.** App Store export 가
배포 프로파일로 다시 서명하면서 `production` 으로 바꿔 넣는다(1.0.8 IPA 에서 확인). 손으로
`production` 으로 고치면 개발 빌드가 깨진다.

#### 5. 산출물 확인: 무엇을 보는가

```bash
A=~/Library/Developer/Xcode/Archives/<날짜>/<이름>.xcarchive/Products/Applications/app.app
plutil -p "$A/Info.plist" | grep -E 'CFBundleVersion|CFBundleShortVersionString'
codesign -dv --verbose=2 "$A" 2>&1 | grep -E 'Identifier|Authority|TeamIdentifier'
```

**Android 의 `app.manifest` 스탈 문제(`c9ce4697`)는 iOS 에 없다.** `Bundle React Native code and images`
와 `[CP-User] Generate updates resources for expo-updates` 가 둘 다 *"Based on dependency analysis"* 를 끈
채라 **매 빌드 돈다**(아카이브 로그의 `note:` 로 확인된다). Gradle 처럼 UP-TO-DATE 로 건너뛰는 자리가
없다. 그래도 스토어행 바이너리는 눈으로 확인하고 보낸다. build 13 에서는 `EXUpdates.bundle/app.manifest`
의 288개 항목이 전부 `app.app/assets/` 의 실제 파일로 풀렸고, 카링·벨로나의 `packagerHash` 가
`src/assets/bosses/*.webp` 의 md5 와 같았다.

**같은 자리에서 `EXUpdates.bundle/fingerprint` 도 함께 본다**. 아래 ‘스토어 바이너리와 OTA 의
runtimeVersion’ 절이 그 이유다(1.0.6 에서 실제로 어긋난 채 올라갔다).

### 알림을 넣는 릴리스의 iOS 준비물 ([[ADR-146]], 설계 완료·구현 전)

**바이너리에 안 들어가면 다음 심사까지 못 쓴다**. Push Notifications capability · Background Modes
(`remote-notification`·`fetch`) · `GoogleService-Info.plist` · **APNs 인증 키(.p8)를 Firebase 콘솔에
업로드**. 마지막 것은 코드가 아니라 콘솔 작업이라 빌드가 통과해도 조용히 빠진다(그러면 iOS 에서만
푸시가 안 온다). 전체 체크리스트는 [../features/notifications.md](../features/notifications.md).

### 저장소만 클론해서는 iOS를 빌드할 수 없다 (Xcode Cloud 비활성, 2026-08-04)

Xcode Cloud 워크플로(`메이플루틴 | Default | Archive - iOS`)가 **main 푸시마다** 아카이브를
시도해 머지할 때마다 실패 메일이 왔다. 간헐적 실패가 아니라 **구조적으로 성공할 수 없는
상태**였다.

```
ios/App/CapApp-SPM/Package.swift  (저장소에 추적됨)
  → .package(path: "../../../node_modules/@capacitor-community/admob") …
  → node_modules 는 gitignore 대상이라 클론본에 없음
  → SPM 의존성 해석이 컴파일 전에 실패
```

웹 번들(`ios/App/App/public`)과 `App/App/capacitor.config.json` 도 gitignore 대상이라, SPM이
풀렸더라도 내용 없는 앱이 나온다. **`npm ci` → `npm run build` → `npx cap sync ios` 가 선행돼야
Xcode가 이 프로젝트를 열 수 있다**. 로컬 아카이브가 되는 것은 그 세 단계가 이미 실행된 워킹
디렉토리에서 빌드하기 때문이다. Android 도 같은 구조다(`app/src/main/assets/public` 이 gitignore).

**결정: 워크플로를 비활성화하고 iOS 는 로컬 아카이브로 제출한다**(사용자 결정 2026-08-04).
로컬 경로가 이미 성공적으로 돌고 있고, 지금은 Play 배포가 우선이다.

다시 붙이려면 두 가지가 필요하다.

- `ios/App/ci_scripts/ci_post_clone.sh`. **`.xcodeproj` 와 같은 디렉토리**여야 하며(저장소 루트가
  아니다), 스크립트의 실행 위치가 `ci_scripts` 라 `cd $CI_WORKSPACE` 로 저장소 루트로 옮긴 뒤
  위 세 단계를 돌려야 한다.
- **트리거를 좁힐 것.** 무료 한도가 월 25 컴퓨팅 시간인데, main 푸시마다 아카이브가 돌면
  머지가 잦은 날 하루에 한도의 상당분을 쓴다. 태그나 수동 실행이 맞다.

## 스토어 바이너리와 OTA 의 runtimeVersion (RN, [[ADR-137]])

**RN 앱의 OTA 는 버전 번호가 아니라 `runtimeVersion`(네이티브 트리의 fingerprint 해시)으로
매칭된다.** 그 값은 **빌드 시각에 바이너리 안에 박히고**(`EXUpdates.bundle/fingerprint` ·
AAB `base/assets/fingerprint`), `publish-rn-ota.mjs` 는 **발행 시점 트리의 계산값**을 쓴다. 둘이
갈리면 매니페스트는 아무도 묻지 않는 이름으로 남고, `latest-<platform>.json` 은 최신 사용자에게
**‘스토어 업데이트가 필요해요’ 거짓 모달**을 띄운다([[ADR-137]] 결정 4의 판정 경로).

1.0.6 이 그 상태로 두 스토어에 올라갔다. 전말은
[../trouble/2026-08-19-rn-runtimeversion-drift.md](../trouble/2026-08-19-rn-runtimeversion-drift.md).

### 규칙 1: 버전·빌드 번호를 **먼저 커밋**하고, 그 트리에서 굽는다

`app.json` 은 **두 플랫폼 공통** 지문 재료다(`expoConfig` 가 통째로 들어가고 거기에
`ios.buildNumber` 와 `android.versionCode` 가 함께 있다). 그래서 **iOS 빌드 번호만 올려도 이미
구워 둔 Android AAB 의 지문이 무효화된다.** 1.0.6 에서 정확히 그렇게 됐다.

굽고 나서 번호를 올리면(소진 여부를 로컬 아카이브에서 확인한 뒤 올리므로 그렇게 되기 쉽다)
**두 바이너리를 모두 다시 구워야 한다.**

### 규칙 2: 업로드 직전에 ‘바이너리 안 지문 == 트리 계산값’을 대조한다

```bash
cd .   # 저장소 루트가 곧 Expo 프로젝트다
npx expo-updates runtimeversion:resolve --platform ios      # {"runtimeVersion":"…", …}
npx expo-updates runtimeversion:resolve --platform android

cat <archive>/Products/Applications/app.app/EXUpdates.bundle/fingerprint
unzip -p android/app/build/outputs/bundle/release/app-release.aab base/assets/fingerprint
```

**두 플랫폼 모두 같아야 업로드한다.** 다르면 그 바이너리는 OTA 를 영영 못 받고, 발행하는 순간
거짓 모달의 원인이 된다. Android 는 `app.manifest` 스탈 문제(`c9ce4697`)도 같은 자리에서 함께 본다.

### 규칙 3: 아카이브는 CLI 로 굽는다

같은 트리에서 `xcodebuild archive`(CLI)와 Xcode GUI `Product ▸ Archive` 가 **서로 다른
fingerprint** 를 낸 사례가 있다(1.0.6, 재현 불가). 위 ‘RN 앱의 아카이브’ 절의 CLI 경로를 쓰고,
**업로드하는 바로 그 아카이브**의 지문을 대조한다.

### 규칙 4: 발행은 ‘구운 트리’에서, 스토어 업로드 뒤에

`node scripts/publish-rn-ota.mjs` 는 두 바이너리를 구운 트리 그대로에서 돌린다. 심사 반려로
네이티브를 고쳐 재빌드하면 지문이 다시 바뀌므로 **발행도 다시** 한다.

### 규칙 5: 규칙 1~4 가 **이미 어긋난 뒤**에는 지문을 못박는다 ([[ADR-190]])

트리가 스토어 바이너리의 지문을 **재현하지 못하는 상태**가 있다. 1.0.6 이 그렇다. GUI 아카이브가
낸 값이 사후에 재현되지 않고(규칙 3 의 사례), 그 위에 [[ADR-155]] 가 네이티브 트리를 루트로 옮겨
격차가 영구화됐다.

| | 지문 |
|---|---|
| App Store 1.0.6 | `d304704ee9eeedd73d61383372e00849f830f8fb` |
| Play 1.0.6 (versionCode 21) | `3df849c014ea95bb7b0b9dd506094148b0fdc508` |
| 트리 계산값 (2026-08-30) | ios `a52ce256dea7a8316d27c3c5e07466c751abc440` · android `7e2fec5dcde4539a077aa014b8cba5eeef456267` |

그 상태에서 **그냥 발행하면 안 된다.** 스크립트는 매니페스트와 `latest-*.json` 을 함께 쓰는데,
`latest-*.json` 은 배달이 아니라 **‘스토어 업데이트가 필요해요’ 판정 파일**이다([[ADR-137]]
결정 4). 트리 계산값으로 덮이는 순간 스토어 사용자 **전원**이 부팅할 때마다 거짓 모달을 본다.

```js
// scripts/publish-rn-ota.mjs
const PINNED_RUNTIME_VERSIONS = {
  ios: { runtimeVersion: 'd304704e…', binaryAppVersion: '1.0.6' },
  android: { runtimeVersion: '3df849c0…', binaryAppVersion: '1.0.6' },
}
```

- 값은 **바이너리에서 읽어 온 사실**이다(규칙 2 의 `EXUpdates.bundle/fingerprint` ·
  AAB `base/assets/fingerprint`). 지어내는 값이 아니다.
- 스크립트가 발행 **전에** ‘못박은 값 == 지금 발행된 `/latest` 의 판정값’을 대조하고, 다르면
  **중단한다**. `expo export` 앞이라 빌드를 안 태운다.
- 못박은 플랫폼마다 콘솔에 줄을 찍는다. 조용히 못박으면 다음 사람이 트리 계산값으로 나가고
  있다고 믿는다.

> ⚠️ **이 상수가 살아 있는 동안 네이티브 변경은 OTA 로 못 나간다.** 못박은 지문은 ‘옛 네이티브’를
> 가리키므로, 네이티브를 고쳤으면 **스토어 빌드**로 가야 한다. 그리고 새 스토어 바이너리를
> 규칙 1~3 을 지켜 구운 뒤에는 **이 상수를 지운다**. 그때부터 트리 계산값이 곧 바이너리의 값이다.

### 규칙 5-1: 못박은 동안 **HEAD 에서 발행하면 1.0.6 기기가 부팅에서 죽는다**

2026-09-13 에 확인했다. 진입점이 Firebase 를 **최상단에서 import** 한다.

```ts
// index.ts
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging'
```

1.0.6 바이너리에는 그 네이티브 모듈이 없다(FCM 은 2026-09 에 들어왔다). 못박기가 살아 있는 동안은
**못박은 지문이 트리 계산값을 이겨서** 네이티브 그래프가 달라져도 발행이 그냥 성공하고, 그 번들이
1.0.6 기기로 간다. 최상단 import 라 화면을 누를 것도 없이 **첫 렌더 전에 죽는다.** 업데이트 모달도
그 안에 있어서 OTA 로는 못 푼다([[ADR-117]] 이 1.0.5 에서 겪은 그 자리다).

`share-image-native-modules.test.mjs` 가 막는 것은 **모듈 셋뿐**이라 이것을 못 잡는다.

**그래서 1.0.8 은 iOS 번들을 발행하지 않았다.** 잠금만 켰다. 대가는 1.0.6 에서 올라온 사용자가
`업데이트를 마쳤어요` 를 한 번 보는 것이고, 그것은 화면 하나짜리 대가다.

**꼭 발행해야 한다면** 기준점 워크트리에서 낸다. 발행된 번들의 기준 커밋에서 워크트리를 따고
버전만 올려, **새 네이티브를 부르는 JS 가 안 들어간 번들**을 만든다. 그 절차는 저장소에 없고
1.0.7 을 그렇게 냈다.

### 규칙 6: 못박았으면 **에셋 이름표도** 함께 준다 ([[ADR-191]])

지문을 못박는다는 것은 ‘번들이 지금 트리로는 못 만드는 바이너리를 겨냥한다’는 뜻이다. 그러면
지문 말고 하나가 더 갈린다. **안드로이드 이미지의 리소스 이름**.

안드로이드는 APK 에 박힌 이미지를 파일이 아니라 드로어블 **리소스**로 들고, 그 이름을 에셋의
소스 경로(`httpServerLocation`)에서 파생한다. [[ADR-155]] 가 `packages/core` 를 `src` 로 옮기면서
그 이름이 `_core_src_assets_…` → `src_assets_…` 로 바뀌었고, 1.0.7 을 그대로 내보냈다가 **앱
이미지 273개가 전부 빈칸**이 됐다(iOS 는 파일 경로로 풀어 멀쩡했다).

**이름표는 기기에서 뽑는다**. 저장소가 만들 수 있는 값이 아니다.

```bash
adb -s <기기> logcat -c && adb -s <기기> logcat -v time > logcat.txt &
adb -s <기기> shell am force-stop com.mapleroutine.app
adb -s <기기> shell monkey -p com.mapleroutine.app -c android.intent.category.LAUNCHER 1
# 부팅 로그의 `embeddedAssetFileMap: <md5>,<ext> => file:///android_res/<폴더>/<이름>.<ext>` 를
# {"<md5>": {"ext": "...", "name": "..."}} 로 접는다
```

그 표를 주고 발행한다. **주지 않으면 스크립트가 발행을 거부한다.**

```bash
OTA_LEGACY_ASSET_MAP=apk-embedded-map.json OTA_ASSET_REPORT=asset-report.jsonl \
  node scripts/publish-rn-ota.mjs
```

`metro.config.js` 가 그때만 역산 플러그인을 걸고(`scripts/ota-legacy-asset-paths.cjs`), export 뒤
스크립트가 이름표 **전 항목**을 대조해 하나라도 어긋나면 멈춘다.

> ⚠️ **플러그인과 못박기는 함께 죽는다.** 새 스토어 바이너리의 드로어블은 `src_assets_…` 라,
> 상수를 비우는 날 이름표도 함께 치우지 않으면 **같은 사고가 거울처럼 뒤집혀** 일어난다.
>
> ⚠️ **정적 대조가 실기기 확인을 대신하지 않는다.** 1.0.7 은 에셋 누락 0 · 해시 손상 0 · 키 집합
> 정상이었고 화면만 빈칸이었다. 발행 뒤 **실기기에서 그림이 뜨는 것을 눈으로 본다.**

JS 만 바뀌었는지는 지문이 안 말해 주므로 **사람이 확인한다.** 1.0.7 발행 때 본 것: 새 네이티브
의존성 0(늘어난 `@gorhom/portal`·`zustand` 는 순수 JS) · 로컬 Expo 모듈 셋의 JS API diff 0줄 ·
`app.json` 이 1.0.6 과 바이트 동일 · 폰트 0개 · `react-native`·`expo` 버전 동일(Hermes 바이트코드
호환).

## 폐기된 정책 (history)

- ~~스토어 문구는 1.0.0 원문이고 준비 사항이 기능 목록보다 앞이다~~ → **1.0.8 기준으로 다시
  썼다**(2026-09-13). 순서를 뒤집고 API 키가 필요하다는 한 줄만 인트로 아래로 올렸다. 1.0.0
  원문은 `git log -p -- docs/foundation/release.md` 에 있다.
- ~~설명이 사냥 타이머와 숙제 미완료 알림을, 심사 메모가 전면광고를 적는다~~ → **셋 다 앱에
  없다**([[ADR-005]] ⛔ · [[ADR-156]]). 1.0.8 문구에서 걷었다.
- ~~웹 번들을 `npm run build`(+`build:beta`·`build:test-ads`·`build:screenshot`)로 굽고
  `npx cap sync` 로 네이티브에 넣는다~~ → **네이티브 빌드가 JS 를 직접 만든다**([[ADR-155]]).
  그 스크립트들은 캐패시터 앱의 것이었고 앱과 함께 사라졌다. 광고 테스트 모드는 빌드 스크립트가
  아니라 `EXPO_PUBLIC_*` 환경 변수로 가른다(`src/native/adapters/rn-ads.ts`).
- ~~네이티브 프로젝트는 `packages/app-capacitor/` 안에 있다~~ → **저장소 루트의 `android/`·`ios/`**
  ([[ADR-155]] 결정 2: 모노레포 해체).
