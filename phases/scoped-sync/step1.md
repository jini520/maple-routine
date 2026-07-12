# Step 1: scoped-refresh-stores

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `src/features/schedule-sync/schedule-sync.ts` — 이전 step(`schedule-sync-scoped`)에서 바뀐 `syncSchedules(ocids: string[]): Promise<CharacterScheduleSync[]>`. 빈 배열이면 네트워크 호출 없이 `[]` 반환.
- `src/features/daily-scheduler/store.ts`, `src/features/daily-scheduler/__tests__/store.test.ts` — 지금 구현 전체를 읽어라. `refresh(): Promise<void>`가 인자 없이 `syncAllSchedules()`를 호출한다.
- `src/features/weekly-scheduler/store.ts`, `src/features/weekly-scheduler/__tests__/store.test.ts` — 마찬가지.

## 배경

이전 step이 `syncSchedules(ocids)`로 바꿨으니, 이 스토어들의 `refresh()`도 "어떤 캐릭터를 동기화할지"를 인자로 받아 그대로 전달하도록 바꿔야 한다. **일간·주간 스토어 둘 다 완전히 같은 패턴으로 바꾸면 된다** — 각 스토어의 콘텐츠 매핑 로직(일간은 `dailyContents`, 주간은 `weeklyContents`/`bosses`)만 그대로 유지하고, `refresh`의 시그니처와 빈 배열 처리만 공통으로 바꿔라.

## 작업

두 스토어 모두 다음과 같이 바꿔라(`DailySchedulerStore`/`WeeklySchedulerStore` 각각):

```ts
export interface DailySchedulerStore extends DailySchedulerState {
  refresh(ocids: string[]): Promise<void>
}
```
(주간은 `WeeklySchedulerStore`에 동일하게 적용)

`refresh(ocids)` 구현 규칙:
1. `ocids.length === 0`이면 `syncSchedules`를 호출하지 말고 곧바로 `set({ status: 'loaded', characters: [], error: null })`로 상태를 비운다.
2. 그 외엔 기존처럼 `status: 'loading'`으로 바꾼 뒤 `syncSchedules(ocids)`를 호출하고, 성공/실패 처리는 기존 로직(개별 캐릭터 에러는 캐릭터별로, `syncSchedules` 자체가 throw하면 전체 `status: 'error'`)을 그대로 유지한다.

`import { syncAllSchedules } from '../schedule-sync/schedule-sync'`를 `import { syncSchedules } from '../schedule-sync/schedule-sync'`로 바꾸는 것도 잊지 마라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 두 스토어의 테스트 파일을 이번 변경에 맞게 갱신한 뒤(TDD) 구현을 맞춰라. 최소한 다음을 각 스토어마다 검증하라:
   - `refresh([])` 호출 시 `syncSchedules`가 전혀 호출되지 않고 `characters: []`, `status: 'loaded'`가 된다.
   - `refresh(['ocid-1'])` 호출 시 `syncSchedules(['ocid-1'])`로 정확히 호출된다.
   - 기존에 검증하던 성공/부분실패/전체실패 매핑 로직이 그대로 동작한다.
3. 결과에 따라 `phases/scoped-sync/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `ocids.length === 0`일 때도 `syncSchedules`를 호출하지 마라. 이유: 빈 배열이면 애초에 네트워크 호출이 불필요하다(이전 step에서 이미 그렇게 만들었다).
- 일간과 주간 스토어의 콘텐츠 매핑 로직(어떤 필드를 뽑아 `DailyCharacterView`/`WeeklyCharacterView`로 만드는지) 자체는 바꾸지 마라. 이유: 이번 step은 `refresh` 시그니처만 바꾼다.
- 기존 테스트를 깨뜨리지 마라(단, 시그니처 변경에 맞게 고쳐야 하는 테스트는 함께 갱신).
