# Step 1: daily-scheduler

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — `daily-scheduler`가 "완전 읽기 전용"으로 캐시를 구독한다는 규칙([[ADR-007]])
- `/docs/ADR.md` — [[ADR-007]](일간 화면은 완전 읽기 전용, 앱 내 수동 체크 없음)
- `src/features/schedule-sync/` — 이전 step(`schedule-sync`)에서 만든 `syncAllSchedules(): Promise<CharacterScheduleSync[]>`와 `CharacterScheduleSync`/`ScheduleSyncError` 타입. 정확한 필드는 그 파일에서 직접 확인하라.
- `src/types/scheduler.ts` — `DailyContent`(`{ name: string; isRegistered: boolean; nowCount: number; maxCount: number }`)

## 배경

이번 step은 일간 스케줄러 화면이 쓸 상태만 만든다(화면 자체는 없음). `schedule-sync`의 `syncAllSchedules()` 결과에서 캐릭터별 `dailyContents`만 뽑아 보여주는 얇은 Zustand 스토어다. **로컬에 쓰기 위한 상태를 직접 소유하지 않는다** — 사용자가 앱 안에서 체크하는 UI는 없고, Nexon 게임 내 스케줄러 등록 상태를 그대로 읽기 전용으로 보여줄 뿐이다([[ADR-007]] 확정 사항).

## 작업

`src/features/daily-scheduler/store.ts`:

```ts
export interface DailyCharacterView {
  ocid: string
  characterName: string
  dailyContents: DailyContent[]
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type DailySchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface DailySchedulerState {
  status: DailySchedulerStatus
  characters: DailyCharacterView[]
  error: ScheduleSyncError | null // 캐릭터 목록 조회 자체가 실패한 경우(예: getRegisteredCharacters가 던진 에러) 여기 채움
}

export interface DailySchedulerStore extends DailySchedulerState {
  refresh(): Promise<void>
}

export const useDailySchedulerStore: /* zustand의 create<DailySchedulerStore>()(...) 결과 */
```

**`refresh()` 규칙**:
- 시작하면 `status: 'loading'`으로 바꾼다.
- `syncAllSchedules()`를 호출한다. 이 함수 자체가(예: 캐릭터 목록 조회 실패로) throw하면 `status: 'error'`, `error`에 적절한 `ScheduleSyncError`를 채운다(에러가 `Error` 인스턴스가 아니거나 종류를 알 수 없으면 `{ kind: 'network' }`로 취급해도 된다 — 과도하게 정교한 분류는 필요 없다).
- 성공하면 각 `CharacterScheduleSync`를 `DailyCharacterView`로 매핑한다(`state`가 `null`이면 `dailyContents: []`, 있으면 `state.dailyContents` 그대로). `status: 'loaded'`, `error: null`.
- **개별 캐릭터의 `error`/`isStale`은 그 캐릭터의 `DailyCharacterView`에만 남기고, 전체 `status`를 `'error'`로 만들지 마라** — 일부 캐릭터 동기화 실패가 다른 캐릭터의 정상 표시를 막으면 안 된다([[ADR-008]] "필드 단위 방어적 처리"와 같은 정신). `status: 'error'`는 오직 `syncAllSchedules()` 자체가 전부 실패(캐릭터 목록 조회 실패 등)했을 때만 쓴다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `features/daily-scheduler/`에만 파일을 추가했는가?
   - `src/nexon/`이나 `src/storage/`를 직접 import하지 않고 `schedule-sync`를 통해서만 접근하는가?
   - 일부 캐릭터 동기화 실패가 전체 `status`를 `'error'`로 만들지 않는가?
3. `src/features/daily-scheduler/__tests__/store.test.ts`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `src/features/schedule-sync`를 `vi.mock`으로 모킹하라.
   - 전부 성공하면 `status: 'loaded'`이고 각 캐릭터의 `dailyContents`가 그대로 반영된다.
   - 일부 캐릭터만 `isStale: true`/`error` 있음 상태로 와도 `status`는 여전히 `'loaded'`이고 그 캐릭터의 `DailyCharacterView`에만 에러가 반영된다.
   - `syncAllSchedules()` 자체가 throw하면 `status: 'error'`가 된다.

4. 결과에 따라 `phases/scheduler/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 생성한 파일과 핵심 로직을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `app/daily/` 화면을 만들지 마라. 이유: 이번 task는 `features/` 로직까지만 다루기로 확정했다(화면은 별도 task, `onboarding`→`onboarding-ui` 패턴과 동일).
- 사용자가 일간 콘텐츠를 앱 안에서 체크/등록할 수 있는 로직(로컬 상태 쓰기)을 넣지 마라. 이유: [[ADR-007]]이 완전 읽기 전용으로 확정했다 — 등록 여부는 게임 내 스케줄러가 유일한 기준이다.
- 캐릭터 하나의 동기화 실패로 전체 `status`를 `'error'`로 만들지 마라. 이유: 다른 캐릭터는 정상 데이터를 보여줄 수 있어야 한다.
- 기존 테스트를 깨뜨리지 마라.
