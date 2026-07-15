# Step 0: version-format

## 읽어야 할 파일

먼저 아래 파일들을 읽고 이번 수정의 배경을 파악하라:

- `/docs/ADR.md`의 ADR-024 "배경"과 "결정 1" (Live Update 버전 형식 버그와 수정 내용)
- `android/app/build.gradle`
- `ios/App/App.xcodeproj/project.pbxproj`

## 작업

이 프로젝트의 Live Update(OTA) 버전 비교 로직(`src/native/live-update.ts`의 `isNewerVersion`)은 `MAJOR.MINOR.PATCH`(정확히 점 2개, 숫자만) 형식만 파싱한다. 그런데 네이티브 앱의 버전 문자열이 지금 2단(`1.0`)이라 파싱에 실패해, OTA가 어떤 기기에서도 한 번도 작동한 적이 없었다. 이 두 값을 3단 형식으로 맞춘다.

1. `android/app/build.gradle`에서 `versionName "1.0"`을 `versionName "1.0.0"`으로 바꿔라. **같은 블록의 `versionCode`는 건드리지 마라.**
2. `ios/App/App.xcodeproj/project.pbxproj`에서 `MARKETING_VERSION = 1.0;`을 `MARKETING_VERSION = 1.0.0;`으로 바꿔라. 이 값은 Debug/Release 두 빌드 설정에 각각 한 번씩, 총 2곳에 등장한다 — **둘 다** 바꿔라. **같은 블록의 `CURRENT_PROJECT_VERSION`은 건드리지 마라.**

## Acceptance Criteria

```bash
grep -q 'versionName "1.0.0"' android/app/build.gradle
[ "$(grep -c 'MARKETING_VERSION = 1.0.0;' ios/App/App.xcodeproj/project.pbxproj)" = "2" ]
```

## 검증 절차

1. 위 AC 커맨드 둘 다 실행해 통과를 확인한다(둘 다 셸 종료 코드 0).
2. 아키텍처 체크리스트를 확인한다:
   - 이 두 파일 외에 다른 파일을 건드리지 않았는가?
   - `versionCode`/`CURRENT_PROJECT_VERSION`은 그대로인가?
3. `npm run build`를 실행해 기존 웹 빌드가 깨지지 않았는지 확인한다(이 step은 네이티브 설정 파일만 바꾸므로 웹 빌드에는 영향이 없어야 정상이다).
4. 결과에 따라 `phases/live-update-beta/index.json`의 `step: 0`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `android/app/capacitor.build.gradle`(자동 생성 파일, 파일 맨 위에 "DO NOT EDIT"라고 적혀 있음)은 건드리지 마라.
- `versionCode`/`CURRENT_PROJECT_VERSION`(스토어 빌드 번호)은 이번 수정과 무관하다 — 바꾸지 마라.
- `src/native/live-update.ts`의 `isNewerVersion` 파싱 로직 자체는 이 step에서 건드리지 마라(다음 step에서 다른 목적으로 이 파일을 수정한다).
