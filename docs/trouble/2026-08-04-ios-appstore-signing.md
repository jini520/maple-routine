# 2026-08-04 — App Store 업로드 실패: 개발 인증서로 서명됨 (error 90034)

첫 App Store 제출을 시도하다 Organizer의 Distribute 단계에서 막혔다.

## 증상

```
Missing or invalid signature. The bundle 'com.mapleroutine.app' at bundle path
'Payload/메이플루틴.app' is not signed using an Apple submission certificate.
code = 90034
```

## 원인 — Capacitor 스캐폴드의 기본값

`project.pbxproj` **프로젝트 레벨** 빌드 구성에 개발용 서명이 못 박혀 있었다.

```
[Debug  ] CODE_SIGN_IDENTITY = "iPhone Developer"
[Release] CODE_SIGN_IDENTITY = "iPhone Developer"   ← 아카이브가 쓰는 구성
```

타겟 레벨에는 `CODE_SIGN_STYLE = Automatic` + `DEVELOPMENT_TEAM` 이 제대로 있었지만,
타겟이 `CODE_SIGN_IDENTITY` 를 덮지 않아 **프로젝트 레벨 값이 그대로 살아남는다.** 그래서
아카이브가 개발 인증서로 서명됐고, App Store는 배포(submission) 인증서만 받는다.

`"iPhone Developer"` 는 레거시 이름이라는 점도 혼동 요인이었다 — 지금 이름은
`"Apple Development"` / `"Apple Distribution"` 이다.

키체인에도 배포 인증서가 없었다(`security find-identity -v -p codesigning` → `Apple
Development` 하나). 자동 서명이 켜져 있으면 Xcode가 배포 인증서를 만들어 주는데, 위 설정이
"개발 서명을 하려는 것"으로 읽히게 만들어 그 경로가 돌지 않았다.

## 처방 — 레거시 이름을 현재 이름으로 바꾸는 것뿐이다

```
[Debug  ] CODE_SIGN_IDENTITY = "Apple Development"
[Release] CODE_SIGN_IDENTITY = "Apple Development"
```

**Release 를 `"Apple Distribution"` 으로 두면 안 된다.** 자동 서명(`CODE_SIGN_STYLE = Automatic`)과
충돌해 빌드가 아예 실패한다 — 처음에 그렇게 고쳤다가 되돌렸다.

```
error: App has conflicting provisioning settings. App is automatically signed for
development, but a conflicting code signing identity Apple Distribution has been
manually specified.
```

자동 서명에서는 **아카이브를 개발 인증서로 서명하고, 배포(export) 단계에서 Xcode가 배포
인증서로 재서명한다.** 그래서 빌드 설정에 배포 identity를 박을 자리가 없다. 실제로 확인했다 —
`"Apple Development"` 로 두고 `xcodebuild -exportArchive`(method `app-store-connect`)를 돌리면
산출 IPA의 서명이 이렇게 나온다.

```
Authority = Apple Distribution: JINMYEONG JE (TQPKW249G7)
```

### 틀린 가설이었던 것

- ~~배포 인증서가 없다~~ — `security find-identity -v -p codesigning` 에 `Apple Development`
  하나만 잡혀 그렇게 판단했으나, 배포 인증서는 존재하고 Xcode가 정상적으로 쓴다. 그 명령이
  Xcode 관리 인증서를 다 보여주지는 않는다. **키체인 조회 결과만으로 없다고 단정하지 말 것.**
- ~~프로젝트 레벨 `CODE_SIGN_IDENTITY` 가 타겟의 자동 서명을 이겨서 실패했다~~ — 방향은 맞았지만
  처방이 틀렸다. 문제는 "개발용이라서"가 아니라 **레거시 문자열이라서**였다.

## 검증 방법

GUI 없이 CLI로 끝까지 재현·검증할 수 있다. 서명 문제는 Organizer까지 가야 드러나는 줄 알았는데
아니었다.

```
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath <경로>/App.xcarchive archive

xcodebuild -exportArchive -archivePath <경로>/App.xcarchive \
  -exportOptionsPlist <경로>/ExportOptions.plist -exportPath <경로>/export

codesign -dvv <경로>/export/Payload/*.app   # Authority 줄로 서명 주체 확인
```

## 진짜 원인 — 번들 이름이 한글이었다

서명 설정을 고친 뒤에도 업로드가 **같은 90034** 로 계속 막혔다. 로컬 검증은 전부 통과하는데
Apple 서버만 거부하는 상황이었다.

전수 검사에서 **서명 쪽은 모두 정상**으로 나왔다.

| 검사 | 결과 |
|---|---|
| 인증서 체인 | `Apple Distribution`(2027-08-03 만료) → WWDR **G3**(2030) → Apple Root CA(2035) 전부 유효 |
| `get-task-allow` | `false` |
| 프로비저닝 프로파일 | `iOS Team Store Provisioning Profile`, `ProvisionedDevices` 없음 |
| `codesign --verify --deep --strict` | valid on disk / satisfies its Designated Requirement |

남은 변수는 하나였다 — **`PRODUCT_NAME = "메이플루틴"`**.

```
PRODUCT_NAME 이 한글
  → .app 번들명·실행 파일명이 한글
  → macOS 파일시스템이 NFD(분해형)로 저장
  → IPA zip 엔트리 경로도 NFD
  → 서명이 계산된 경로와 아카이브에 담긴 경로의 바이트가 어긋남
  → Apple 서버가 해당 경로의 서명을 찾지 못함 → 90034
```

에러 메시지가 경로를 `Payload/\Uba54\Uc774\Ud50c\Ub8e8\Ud2f4.app` 로 이스케이프해 보여준
것이 힌트였다. `unzip -l` 로 본 엔트리도 깨져 있었다.

이 저장소는 같은 NFC/NFD 함정을 이미 겪었다 — `lib/boss-icons.ts` 가 한글 파일명을 NFC로
정규화하는 이유가 그것이다. 이번엔 그게 파일시스템이 아니라 **코드 서명** 층에서 터졌다.

### 처방

**`PRODUCT_NAME` 은 ASCII 로 둔다.** 사용자에게 보이는 이름은 `CFBundleDisplayName` 이 담당하므로
바뀌는 것이 없다.

```
PRODUCT_NAME        = MapleRoutine        (번들명·실행 파일명 — 경로가 되는 값)
CFBundleName        = 메이플 루틴          ($(PRODUCT_NAME) 을 따라가지 않게 직접 박음)
CFBundleDisplayName = 메이플 루틴          (홈 화면에 보이는 이름, 무변경)
```

`cap add ios` 는 `capacitor.config.ts` 의 `appName`(한글)을 그대로 `PRODUCT_NAME` 에 넣는다.
플랫폼을 다시 추가하면 되살아나므로 그때 다시 ASCII 로 바꿀 것.

## 함께 나온 경고 — 무시해도 된다

```
Upload Symbols Failed
  The archive did not include a dSYM for the GoogleMobileAds.framework
  The archive did not include a dSYM for the UserMessagingPlatform.framework
```

두 프레임워크는 **dSYM 없이 배포되는 사전 컴파일 XCFramework** 라 아카이브에 심볼이 들어갈 수
없다. **업로드를 막지 않는다** — 그 프레임워크 내부에서 발생한 크래시의 심볼화만 안 될 뿐이고,
우리 코드의 크래시 리포트는 정상이다. AdMob을 쓰는 앱에서 항상 나오는 경고다.

## 교훈

- 에러 목록에서 **빨간 것과 노란 것을 먼저 가를 것.** 여기서는 dSYM 경고 2개가 눈에 띄지만
  제출을 막는 것은 서명 오류 하나뿐이었다.
- 자동 서명을 켜도 **프로젝트 레벨에 하드코딩된 `CODE_SIGN_IDENTITY` 는 이긴다.** 다만 고칠 방향은
  "배포용으로 바꾸기"가 아니라 **"현재 이름으로 바꾸기"** 였다.
- **키체인 조회로 인증서 부재를 단정하지 말 것.** `security find-identity` 에 안 보여도 Xcode는
  갖고 있다. 이 오판으로 한 번 헛짚었다.
- **GUI 없이 CLI로 끝까지 검증된다.** 추측으로 고치고 사용자에게 Xcode를 다시 돌리게 하는 대신,
  `xcodebuild archive` → `-exportArchive` → `codesign -dvv` 로 서명 주체까지 직접 확인하는 편이
  왕복이 훨씬 적다.
