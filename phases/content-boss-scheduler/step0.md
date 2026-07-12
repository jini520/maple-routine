# Step 0: content-scheduler-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — [[ADR-013]] (화면 구조를 "일간/주간 스케줄러"에서 "컨텐츠/보스 스케줄러"로 개편하는 결정 전체를 읽어라)
- `/docs/ARCHITECTURE.md` — "디렉토리 구조"의 `features/content-scheduler` 항목, "패턴" 섹션, "데이터 흐름" 섹션
- `src/features/daily-scheduler/store.ts` — 지금 이 파일이 하는 일(구조 패턴 참고용, **수정하지 마라** — 아직 `app/daily`가 쓰고 있다)
- `src/features/weekly-scheduler/store.ts` — 동일하게 참고용, **수정하지 마라**
- `src/features/schedule-sync/schedule-sync.ts` — `syncSchedules(ocids: string[]): Promise<CharacterScheduleSync[]>`의 정확한 시그니처와 `CharacterScheduleSync`(`{ ocid, characterName, state: SchedulerCharacterState | null, syncedAt, isStale, error }`) 형태
- `src/types/scheduler.ts` — `DailyContent`, `WeeklyContent`, `SchedulerCharacterState` 타입

## 배경

컨텐츠 스케줄러 화면(다음 step들에서 만들 `ContentScreen`)은 기존에 따로 있던 "일간 콘텐츠"와 "주간 콘텐츠"를 한 화면 안 두 탭(일간/주간)으로 합쳐서 보여준다. 이 화면이 구독할 상태 저장소를 이번 step에서 만든다. 아직 화면(`app/`)이나 storage 키 변경은 하지 않는다 — 이번 step은 순수하게 새 파일을 추가하는 것으로, 기존 `daily-scheduler`/`weekly-scheduler`/`app/daily`/`app/weekly`는 전혀 건드리지 않는다(그래서 이 step만으로 빌드가 깨질 일이 없다).

## 작업

`src/features/content-scheduler/store.ts`를 새로 작성하라. `daily-scheduler`와 `weekly-scheduler`의 기존 `refresh` 로직(둘 다 거의 동일한 패턴 — `ocids.length === 0`면 네트워크 호출 없이 빈 상태로, 아니면 `syncSchedules(ocids)` 호출 후 매핑)을 참고해 다음 시그니처로 구현하라:

```ts
export interface ContentCharacterView {
  ocid: string
  characterName: string
  dailyContents: DailyContent[]
  weeklyContents: WeeklyContent[]
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type ContentSchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface ContentSchedulerState {
  status: ContentSchedulerStatus
  characters: ContentCharacterView[]
  error: ScheduleSyncError | null
}

export interface ContentSchedulerStore extends ContentSchedulerState {
  refresh(ocids: string[]): Promise<void>
}

export const useContentSchedulerStore = create<ContentSchedulerStore>()(/* ... */)
```

**동작 규칙** (기존 두 store와 동일한 정책을 그대로 따른다):
1. `ocids`가 빈 배열이면 `status: 'loaded', characters: [], error: null`로 세팅하고 끝낸다(네트워크 호출 없음).
2. 그 외에는 `status: 'loading'` 세팅 후 `syncSchedules(ocids)`를 호출한다. `syncSchedules` 자체가 던지는 에러(온보딩 미완료 등)는 캐릭터별 에러가 아니라 전체 조회 실패이므로 `status: 'error', error: { kind: 'network' }`로 처리한다(기존 두 store의 주석 그대로 따라라).
3. 성공하면 각 결과를 `ContentCharacterView`로 매핑한다 — `dailyContents: result.state?.dailyContents ?? []`, `weeklyContents: result.state?.weeklyContents ?? []`, 나머지 필드(`ocid`, `characterName`, `isStale`, `syncedAt`, `error`)는 그대로 복사.

`ScheduleSyncError` 타입은 `../schedule-sync/schedule-sync`에서 그대로 가져다 써라(새로 정의하지 마라).

TDD 원칙에 따라 `src/features/content-scheduler/__tests__/store.test.ts`를 먼저 작성한 뒤 구현을 맞춰라. `src/features/daily-scheduler/__tests__/store.test.ts`와 `src/features/weekly-scheduler/__tests__/store.test.ts`의 모킹 방식(`vi.mock('../schedule-sync/schedule-sync', ...)` 등)을 그대로 참고해도 된다. 최소한 다음을 검증하라:
- 빈 배열을 넘기면 `syncSchedules`가 호출되지 않고 `status: 'loaded', characters: []`가 된다.
- 정상 응답이면 `characters`에 `dailyContents`와 `weeklyContents`가 둘 다 채워진다(하나의 `SchedulerCharacterState`에서 두 필드를 동시에 뽑아오는지 확인).
- `syncSchedules`가 던지면 `status: 'error', error: { kind: 'network' }`가 된다.
- `state`가 `null`인 결과(캐시 폴백 등)는 `dailyContents`/`weeklyContents`가 빈 배열로 처리된다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `src/features/content-scheduler/store.ts`가 `nexon/`이나 `storage/`를 직접 import하지 않고 `features/schedule-sync/schedule-sync`만 거치는가? (ARCHITECTURE.md "패턴" 섹션의 레이어 분리 원칙)
   - `src/features/daily-scheduler/`, `src/features/weekly-scheduler/`, `src/app/daily/`, `src/app/weekly/`를 전혀 수정하지 않았는가?
3. 결과에 따라 `phases/content-boss-scheduler/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `src/features/daily-scheduler/`, `src/features/weekly-scheduler/`를 수정하거나 삭제하지 마라. 이유: `app/daily`, `app/weekly`가 아직 이 store들을 쓰고 있다 — 삭제는 마지막 step(`app-routing-cutover`)에서 한다.
- `src/app/` 아래 아무 파일도 만들거나 수정하지 마라. 이유: 화면은 이후 step(`content-scheduler-screen`)에서 만든다 — 이번 step은 상태 저장소만 추가한다.
- `storage/character-selection.ts`, `storage/keys.ts`를 건드리지 마라. 이유: storage 키 마이그레이션은 별도 step(`tracked-character-storage-migration`)의 책임이다.
- 기존 테스트를 깨뜨리지 마라.
