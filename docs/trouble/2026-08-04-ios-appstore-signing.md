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

## 처방

구성별로 맞는 identity를 명시한다.

```
[Debug  ] CODE_SIGN_IDENTITY = "Apple Development"
[Release] CODE_SIGN_IDENTITY = "Apple Distribution"
```

`npx cap sync ios` 는 `project.pbxproj` 의 서명 설정을 되돌리지 않는다(웹 자산 복사와 플러그인
참조 갱신만 한다). 다만 iOS 플랫폼을 **다시 추가**(`cap add ios`)하면 스캐폴드 기본값으로
돌아오므로, 그때는 이 파일을 다시 확인할 것.

배포 인증서가 여전히 없으면 Xcode가 자동 생성하게 두거나(Archive → Distribute 과정에서 생성)
수동으로 만든다: **Xcode → Settings → Accounts → 팀 선택 → Manage Certificates → `+` →
Apple Distribution**.

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
- 자동 서명을 켜도 **프로젝트 레벨에 하드코딩된 `CODE_SIGN_IDENTITY` 는 이긴다.** "Automatic이니
  알아서 되겠지"가 통하지 않는 자리다.
