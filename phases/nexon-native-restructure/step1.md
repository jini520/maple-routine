# Step 1: native-restructure

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — "디렉토리 구조" 섹션의 `native/` 항목:
  ```
  ├── native/                  # Capacitor 플러그인 래퍼 + 커스텀 네이티브 플러그인 JS 인터페이스
  │   ├── hunting-timer/       # 상시 알림(Android Chronometer / iOS Live Activity) 커스텀 플러그인 래퍼
  │   └── notification-sync/   # 알림 발송 직전 백그라운드에서 Nexon API 재확인 후 조건부 발송 (WorkManager / BGAppRefreshTask, [[ADR-004]])
  ```
- `src/native/hunting-timer.ts`, `src/native/hunting-timer.web.ts`, `src/native/notifications.ts` — 지금 구현 전체를 읽어라.

## 배경

지금 `src/native/`는 `hunting-timer.ts`/`hunting-timer.web.ts`/`notifications.ts`가 전부 `native/` 루트에 flat하게 있다. 문서는 사냥 타이머를 `native/hunting-timer/` 하위 폴더로 두라고 정의한다. 이번 step은 사냥 타이머 관련 두 파일만 그 하위 폴더로 옮긴다.

**`notifications.ts`(일반 로컬 알림 예약/취소 래퍼)는 옮기지 않고 `native/` 루트에 그대로 둔다** — 문서의 `notification-sync/`는 "알림 발송 직전 백그라운드 재확인" 기능(아직 구현 안 됨, [[ADR-004]])을 가리키는 것이지, 지금 있는 범용 로컬 알림 스케줄링 래퍼(`notifications.ts`)와는 다른 것이다. `notification-sync/` 폴더 자체도 만들지 마라 — 실제 코드가 생기기 전에 빈 폴더를 미리 만들 필요는 없다.

## 작업

1. `src/native/hunting-timer.ts` → `src/native/hunting-timer/hunting-timer.ts`로 옮긴다.
2. `src/native/hunting-timer.web.ts` → `src/native/hunting-timer/hunting-timer.web.ts`로 옮긴다.
3. `hunting-timer.ts` 안의 동적 import 문자열(`import('./hunting-timer.web')`)은 같은 폴더 안에서 상대 경로이므로 그대로 둬도 된다(둘 다 같이 옮겨지므로).
4. 테스트 파일(`src/native/__tests__/hunting-timer.web.test.ts`)을 `src/native/hunting-timer/__tests__/hunting-timer.web.test.ts`로 옮긴다.
5. `notifications.ts`와 그 테스트(`src/native/__tests__/notifications.test.ts`)는 그대로 `native/` 루트에 둔다.
6. 이 두 파일을 외부에서 import하는 곳이 있는지 확인하라(`grep -rn "native/hunting-timer" src/` — 이 step 작성 시점 기준으로는 없지만, 재확인하라). 있다면 새 경로로 고쳐라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. `src/native/`가 `ARCHITECTURE.md`의 트리(`hunting-timer/` 하위 폴더 + 루트의 `notifications.ts`)와 일치하는지 확인한다.
3. 기존 테스트를 새 위치로 옮기되 assertion 내용은 바꾸지 마라. `npm test`가 기존과 동일한 테스트 개수로 전부 통과해야 한다.
4. 결과에 따라 `phases/nexon-native-restructure/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 옮긴 파일 목록을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `notifications.ts`를 옮기거나 `notification-sync/` 폴더를 새로 만들지 마라. 이유: 그 기능은 아직 구현되지 않았고, 지금 있는 `notifications.ts`는 그 기능과 다른 범용 알림 래퍼다.
- 런타임 로직을 바꾸지 마라. 이유: 이번 step은 순수 파일 재구성이다.
- 테스트 케이스를 줄이거나 assertion 내용을 바꾸지 마라.
- `docs/ARCHITECTURE.md`를 수정하지 마라.
