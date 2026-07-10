# Step 1: boss-scheduler-store

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — [[ADR-013]] 전체, 특히 "보스 cycle 분리 표시" 단락(주간/월간 보스를 cycle로 나눠 표시하고, `weeklyBossClearCount`/`weeklyBossClearLimitCount`는 주간에만 의미 있다는 규칙)
- `/docs/ARCHITECTURE.md` — "디렉토리 구조"의 `features/boss-scheduler` 항목, "패턴"·"데이터 흐름" 섹션
- `src/features/weekly-scheduler/store.ts` — 지금 이 파일의 보스 처리 부분(`bosses: result.state?.bossContents.map(matchBossContent) ?? []`)을 구조 패턴으로 참고하라(구조만 참고, **수정하지 마라** — 아직 `app/weekly`가 쓰고 있다)
- `src/lib/boss-matching.ts` — `matchBossContent(content: BossContent): MatchedBoss`, `MatchedBoss`가 이미 `cycle: BossCycle`(`'weekly' | 'monthly'`) 필드를 갖고 있다는 점을 확인하라
- `src/features/schedule-sync/schedule-sync.ts` — `syncSchedules` 시그니처

## 배경

보스 스케줄러 화면(다음 step들에서 만들 `BossScreen`)은 주간 탭과 월간 탭 두 개로 보스를 나눠 보여준다. `matchBossContent`가 반환하는 `MatchedBoss`에 이미 `cycle` 필드가 있으므로, 이 store는 그 필드로 필터링만 하면 된다 — 새로운 매칭 로직은 필요 없다. 이번 step도 순수 추가다: `app/`, `storage/`, 기존 `weekly-scheduler`는 건드리지 않는다.

## 작업

`src/features/boss-scheduler/store.ts`를 새로 작성하라:

```ts
export interface BossCharacterView {
  ocid: string
  characterName: string
  weeklyBosses: MatchedBoss[]
  monthlyBosses: MatchedBoss[]
  weeklyBossClearCount: number | null
  weeklyBossClearLimitCount: number | null
  isStale: boolean
  syncedAt: string | null
  error: ScheduleSyncError | null
}

export type BossSchedulerStatus = 'idle' | 'loading' | 'loaded' | 'error'

export interface BossSchedulerState {
  status: BossSchedulerStatus
  characters: BossCharacterView[]
  error: ScheduleSyncError | null
}

export interface BossSchedulerStore extends BossSchedulerState {
  refresh(ocids: string[]): Promise<void>
}

export const useBossSchedulerStore = create<BossSchedulerStore>()(/* ... */)
```

**동작 규칙** (기존 `weekly-scheduler` store와 동일한 정책, cycle 분리만 추가):
1. `ocids`가 빈 배열이면 `status: 'loaded', characters: [], error: null`로 세팅하고 끝낸다.
2. 그 외에는 `status: 'loading'` → `syncSchedules(ocids)` 호출. `syncSchedules`가 던지면 `status: 'error', error: { kind: 'network' }`.
3. 성공하면 각 결과에서 `const bosses = result.state?.bossContents.map(matchBossContent) ?? []`을 만든 뒤 `weeklyBosses = bosses.filter((b) => b.cycle === 'weekly')`, `monthlyBosses = bosses.filter((b) => b.cycle === 'monthly')`로 나눠 `BossCharacterView`에 채운다. `weeklyBossClearCount`/`weeklyBossClearLimitCount`는 `result.state?.weeklyBossClearCount ?? null` / `result.state?.weeklyBossClearLimitCount ?? null` 그대로(월간 보스와는 무관한 값이므로 별도 가공 없이 캐릭터 뷰에 한 번만 둔다 — 월간 탭에서는 이 값을 아예 표시하지 않는 건 화면 쪽 책임이다).

TDD 원칙에 따라 `src/features/boss-scheduler/__tests__/store.test.ts`를 먼저 작성하라. `src/features/weekly-scheduler/__tests__/store.test.ts`의 모킹 방식을 참고해도 된다. 최소한 다음을 검증하라:
- `bossContents`에 `cycle: 'weekly'`와 `cycle: 'monthly'`가 섞여 있으면 각각 `weeklyBosses`/`monthlyBosses`로 정확히 분리된다.
- 월간 보스만 있는 응답이면 `weeklyBosses`는 빈 배열, `monthlyBosses`에만 항목이 들어간다(그 반대 케이스도).
- 빈 배열을 넘기면 `syncSchedules`가 호출되지 않는다.
- `syncSchedules`가 던지면 `status: 'error'`가 된다.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - cycle 분리 로직이 `matchBossContent`가 이미 계산해 둔 `cycle` 필드를 그대로 쓰는가(보스명 재매칭 등 중복 로직을 새로 만들지 않았는가)?
   - `src/features/weekly-scheduler/`, `src/app/weekly/`를 전혀 수정하지 않았는가?
3. 결과에 따라 `phases/content-boss-scheduler/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 변경 내용을 한 줄로 요약
   - 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`에 구체적 에러
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 기록 후 즉시 중단

## 금지사항

- `src/features/weekly-scheduler/`, `src/app/weekly/`를 수정하거나 삭제하지 마라. 이유: 아직 쓰이고 있다 — 삭제는 마지막 step(`app-routing-cutover`)에서 한다.
- `src/lib/boss-matching.ts`를 수정하지 마라. 이유: 이미 `cycle` 필드를 제공하고 있어 변경할 이유가 없다.
- `src/app/`, `storage/character-selection.ts`, `storage/keys.ts`를 건드리지 마라.
- 기존 테스트를 깨뜨리지 마라.
