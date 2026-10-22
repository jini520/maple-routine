# 실패 처리

넥슨 API · 기기 저장소 · 화면 렌더가 실패했을 때 앱이 무엇을 보이고 무엇을 하는지 정리한다. 실패를 알리는 방법과
기간 데이터 상태는 [[ADR-022]] 에, 앱이 중간에 닫혀도 이어서 끝나는 작업과 기록 판 알림은 [[ADR-023]] 에 이유가 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `nexon/http.ts` | 넥슨 요청. 10초 시간 제한, 상태 코드와 400 본문 코드로 에러 클래스를 고른다 |
| `features/schedule-sync/errors.ts` | `toScheduleSyncError` 가 에러를 아홉 종류(`ScheduleSyncError`)로 바꾼다 |
| `features/schedule-sync/format.ts` | 종류마다 토스트 문구 · `ErrorState` 문구 · 스탈 배너 문구를 고른다 |
| `features/schedule-sync/use-sync-error-toast.ts` | 동기화 실패 토스트. 일부 캐릭터만 실패하면 인원 수를 알린다 |
| `features/nexon-maintenance/` · `app/NexonMaintenanceBanner.tsx` | Open API 점검 상태와 화면 맨 위의 점검 배너 |
| `components/molecules/ErrorState/` | `ErrorState`(목록이 없을 때) · `StaleBanner`(목록이 남았을 때) |
| `lib/boss/boss-profit-period.ts` | 기간 데이터 상태 판정(`resolvePeriodDataState` · `resolvePagePeriodState`) |
| `app/boss-profit/CharacterIssue.tsx` | 동기화에 실패한 캐릭터 카드의 아이콘과 설명 팝오버 |
| `features/boss-profit/sqlite-guards.ts` | SQLite 호출의 5초 시간 제한(`withSqliteFallback` · `withSqliteTimeout`) |
| `components/organisms/ErrorBoundary/` | 렌더 중 예외가 나면 그리는 폴백. `App.tsx` 가 앱 전체를 감싼다 |
| `features/resumable-task/` · `app/resumable-task/` | 이어서 하는 작업의 러너 · 등록부 · 모달을 띄우는 `TaskHost` |
| `storage/pending-tasks.ts` | 끝나지 않은 작업 표시(Preferences `pendingTasks`) |
| `storage/record-revision-batch.ts` | 기록을 여러 건 쓰는 반복의 판 알림을 한 번으로 모은다 |

## 실패마다 하는 일

| 실패 | 종류 | 보이는 것 |
|---|---|---|
| 네트워크 없음 · 10초 초과 · 코드 없는 5xx · JSON 이 아닌 응답 · 코드를 모르는 400 | `network` | 마지막 캐시를 그대로 그린다. 토스트 `네트워크 오류가 발생했습니다` + `다시 시도` |
| 401 · 403 · 400 `OPENAPI00005` | `invalidApiKey` | 닫을 수 없는 안내 모달([[ADR-024]]). 토스트는 없다 |
| 429 `OPENAPI00007` | `rateLimited` | 닫을 수 없는 안내 모달([[ADR-024]]). 어디에도 `다시 시도` 가 없다 |
| 로그인으로 부르다 받은 401 · 403 | `signInRequired` | 다시 로그인하라는 안내 모달([[ADR-024]]) |
| 400 `OPENAPI00003` · 200 인데 캐릭터가 없음 | `characterUnavailable` | 영구 실패. 버튼 없이 알리고, 추적 해제 방법을 남긴다 |
| 400 `OPENAPI00004` | `periodOutOfRange` | 그 기간을 `조회 불가` 로 표시한다 |
| 400 `OPENAPI00009` | `notCollected` | 그 기간을 `집계 전` 으로 표시하고 다음 방문에 다시 받는다 |
| 400 `OPENAPI00010` · 503 `OPENAPI00011` | `gameMaintenance` · `apiMaintenance` | 마지막 캐시를 그대로 그린다. 넥슨 데이터를 읽는 화면 맨 위에 점검 배너 하나만 세우고 토스트는 없다. 로그인 · 키 입력 · 캐릭터 설정만 토스트와 문구로 알린다([[ADR-081]] 결정 8) |
| 관리 화면에서 추적 목록 저장 실패 | | 토스트 `추적 목록을 저장하지 못했습니다` |
| API 키를 기기에 저장하지 못함 | | 토스트 `기기에 저장하지 못했습니다. 다시 시도해주세요` |
| SQLite 가 5초 안에 답하지 않음 | | 읽기는 기본값으로 진행하고, 쓰기는 실패로 던져 다음에 다시 쓴다 |
| 렌더 중 예외 | | `화면을 표시하지 못했습니다` 폴백과 `다시 시작` 버튼 하나 |
| 데이터 작업 도중 앱이 닫힘 | | 다음에 열 때 `끝나지 않은 작업이 있어요` 모달로 이어서 한다 |

넥슨 에러 코드의 뜻과 호출 방법은 `foundation/nexon-api.md` 에 있다.

## 문구와 버튼을 고르는 기준

- 토스트는 한 줄에서 잘리므로 원인만 쓴다. 처방은 `ErrorState` 와 스탈 배너에 쓴다.
- 버튼은 눌러서 풀리는 실패에만 둔다. 429 · `characterUnavailable` · 점검에는 어디에도 버튼이 없다.
- 목록이 남아 있으면 목록을 지우지 않고 그 위에 스탈 배너를 얹는다.
- 실패 문구는 `~습니다` · `~주세요` 로 끝낸다([[ADR-061]]).

| 원인 | `ErrorState` | 스탈 배너 |
|---|---|---|
| `rateLimited` | `호출 한도를 초과했습니다` / `입력하신 API 키가 서비스 단계 키인지 확인해주세요` | `호출 한도를 초과했습니다. 서비스 단계 키인지 확인해주세요` |
| `characterUnavailable` | `캐릭터를 조회할 수 없습니다` / 계정을 바꾸라는 안내 | `이 계정의 캐릭터를 조회할 수 없습니다` |
| `network` 계열 | `캐릭터 목록을 불러오지 못했습니다` + `다시 시도` | `목록이 최신이 아닙니다` + `다시 시도` |

## 보스 수익의 기간 상태

캐릭터 한 명의 한 기간은 아래 다섯 중 하나다. 판정 차례와 화면 하나로 합치는 규칙은 [[ADR-022]] 결정 4 에 있다.

| 상태 | 주간 합계 줄 | 버튼 |
|---|---|---|
| `recorded` | 금액 | |
| `confirmedEmpty` | `0 메소` | |
| `notCollected` | `집계 전` | |
| `outOfRange` | `조회 불가` | |
| `failed` | | `다시 시도` |

지금 기간의 카드에서 동기화에 실패한 캐릭터는 금액 왼쪽 위에 아이콘이 붙는다. `조회 불가` 와 `실패` 두 가지이고,
누르면 설명 팝오버가 열린다.

## 이어서 하는 작업

이미 있는 기록을 많이 다시 쓰는 작업은 200개씩 트랜잭션 하나로 처리하고, 앱이 닫혀도 다음에 남은 것부터 한다.
지금 붙어 있는 작업은 MVP 등급의 `지난 기록 수수료 적용` 과 `자동 수수료 다시 계산` 이다(`features/mvp-grade/tasks.ts`).

| 순간 | 보이는 것 |
|---|---|
| 0.3초 넘게 걸림 | `TaskProgressModal`. 단계 목록 · 막대 · 건수 · 퍼센트. 닫을 수 없다 |
| 끝남 | 작업이 준 완료 토스트. 처리한 수가 0 이면 없다 |
| 실패 | 토스트 `작업을 마치지 못했어요`. 표시는 남는다 |
| 앱을 다시 엶 | `TaskResumeModal`. 버튼은 `이어서 진행하기` 하나다. MVP 등급 모달보다 먼저 뜬다 |

새 작업을 붙이는 방법은 다음과 같다.

1. `features/resumable-task/task.ts` 의 `ResumableTask` 로 정의한다. 단계마다 `remaining` 과 `runChunk` 를 둔다.
2. `app/resumable-task/registry.ts` 에 한 줄을 더한다. 빠뜨리면 그 작업의 표시는 다음에 열 때 묻지 않고 지워진다.
3. `useTaskRunnerStore.getState().run([task])` 로 돌린다.

## 기록 판 알림

보스 기록과 드롭 기록을 쓰면 판이 오르고, 판을 구독하는 화면이 다시 그려진다. 여러 건을 쓰는 반복 넷(자동 기록 ·
지난 기간 기록 · 드롭 정리 · 처치 날짜)은 `batchRecordWrites` 로 감싸서 반복이 끝날 때 한 번만 알린다.
위치는 [[ADR-023]] 결정 7 에 있다.
