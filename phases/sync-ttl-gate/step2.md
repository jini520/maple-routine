# Step 2: content-gate

이 task 는 **페이지 이동 API 호출 정책**을 바꾼다([[ADR-097]], 이슈 #139).

**지금 무슨 일이 일어나는가**: 컨텐츠 스케줄러 화면은 마운트 `useEffect` 에서 `loadTrackedOcids()` 를 부르고, 그것이 `refresh(ocids)` → `syncSchedules(ocids)` 를 돌린다. 탭은 라우트라 오갈 때마다 재마운트되므로 **탭 이동마다 같은 조회가 통째로 다시 나간다.** 보스·보스 수익 화면도 같은 `syncSchedules` 를 부르고 결과를 **같은 캐시**(`storage/scheduler-cache`)에 쓰므로, 앱을 켜고 세 탭을 돌면 같은 응답을 3번 받는다.

이 step 은 **컨텐츠 스케줄러 스토어 하나**에 게이트를 붙인다. 보스·수익 스토어는 다음 step 들의 몫이니 건드리지 마라.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트 먼저**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (결정 원장 — 특히 **결정 4·5**)
- `/docs/features/content-scheduler.md` (이 화면의 정책. "화면 진입은 조회 트리거가 아니다" 항목)
- `/src/lib/sync-freshness.ts` (step 0 산출물 — `SYNC_TTL_MS` · `isSyncFresh(syncedAts, trackedCount, now)`)
- `/src/features/schedule-sync/sync-run-state.ts` (step 1 산출물 — `hasSyncAttemptedThisRun()`)
- `/src/features/content-scheduler/store.ts` (이번 수정 대상)
- `/src/features/content-scheduler/__tests__/store.test.ts` (기존 테스트 — `syncSchedules` 가 이미 모킹돼 있어 "호출 0회"를 직접 단언할 수 있다)
- `/src/app/content-scheduler/ContentScreen.tsx` (호출부 — **읽기만 하라. 이 파일은 고치지 않는다**)

## 작업

### 1. `refresh` 에 내부 옵션을 더한다

```ts
export interface RefreshOptions {
  // 화면 진입 자동 재조회인가. loadTrackedOcids()만 true를 넘긴다.
  auto?: boolean
}

refresh(ocids: string[], onProgress?: (completed: number, total: number) => void, options?: RefreshOptions): Promise<void>
```

`loadTrackedOcids()` 가 `refresh` 를 부를 때만 `{ auto: true }` 를 넘긴다.

**"강제"가 기본값이고 게이트가 예외다.** `force` 인자를 만들지 않는 이유는, 강제해야 할 호출부를 하나라도 빠뜨리면 그 자리가 조용히 게이트에 걸리기 때문이다. 옵션을 안 넘기는 모든 호출(헤더 새로고침 버튼·당겨서 새로고침·에러 토스트 재시도)은 지금처럼 **항상** 조회한다 — **화면 코드는 한 줄도 고치지 않는다.**

### 2. 게이트를 캐시 우선 표시 직후에 둔다

`refresh` 안에는 이미 "캐시 우선 표시" 단계가 있다 — 추적 캐릭터마다 `getCachedSchedulerState(ocid)` 를 읽어 `cachedCharacters` 를 만들고 `set({ status: 'loading', characters: …, manualTrackedByOcid })` 하는 부분이다.

**그 단계가 이미 `syncedAt` 을 읽고 있으므로 판정에 저장소를 다시 읽을 필요가 없다.** 그 값을 그대로 써라.

판정식:

```
건너뛴다 = options?.auto === true
        AND hasSyncAttemptedThisRun()
        AND isSyncFresh(캐시가 있는 캐릭터들의 syncedAt, ocids.length, new Date())
```

건너뛰는 경우:

- **`set` 을 두 번 하지 마라.** `status: 'loading'` 으로 한 번 그린 뒤 곧바로 `'loaded'` 로 바꾸면 로딩 상태가 한 프레임 노출된다. 판정을 그 `set` **앞**에서 끝내고, `status` 를 `'loaded'` 로 넣어 **한 번만** `set` 한 뒤 `return` 하라.
- **뷰의 `isStale` 을 `false` 로 바꿔라.** 캐시로 만든 뷰는 지금 `isStale: true` 인데, 그건 "재검증이 곧 온다"는 뜻이다. 재검증하지 않기로 결정한 값에 그 표식을 달면 **탭을 옮길 때마다 "오래된 데이터" 토스트가 뜬다**(`useStaleCharactersToast`).
- `error: null` 로 둔다.
- `manualTrackedByOcid` 는 지금처럼 함께 넣는다(수동 모드 표시 목록의 원천이라 빠뜨리면 화면이 빈다).
- **`syncedAt` 값 자체는 캐시 값 그대로 둬라.** 헤더의 "n분 전"(`formatSyncedAt`)이 그것을 읽는다 — 건너뛴 진입을 방금 동기화한 것처럼 꾸미지 않는다.

건너뛰지 않는 경우: **기존 코드 그대로** 흘러간다(`status: 'loading'` → `syncSchedules` → 결과 반영).

### 3. 테스트

`src/features/content-scheduler/__tests__/store.test.ts` 에 `describe('화면 진입 재조회 게이트 (ADR-097)')` 를 더한다. 이 파일은 `syncSchedules` 와 `getCachedSchedulerState` 를 이미 모킹하고 있다. `beforeEach` 에서 실행 플래그를 초기화하고(`resetSyncRunStateForTests()`), 필요한 케이스에서만 `markSyncAttemptedThisRun()` 으로 세워라.

반드시 포함할 케이스:

- **건너뛴다**: `auto: true` + 실행 플래그 있음 + 전원 캐시가 5분 전 → `syncSchedules` 호출 **0회**, `status === 'loaded'`, `characters` 전원 `isStale === false`.
- **앱 재시작 모사**: `auto: true` + 실행 플래그 **없음** + 전원 5분 전 → 호출 1회.
- **캐시 결손**: `auto: true` + 실행 플래그 있음 + 추적 2명 중 1명만 캐시 있음 → 호출 1회.
- **만료**: `auto: true` + 실행 플래그 있음 + 가장 오래된 캐시가 11분 전 → 호출 1회.
- **명시적 재조회는 강제**: 옵션 없이 `refresh(ocids)` + 실행 플래그 있음 + 전원 5분 전 → 호출 1회.
- **진입 경로가 옵션을 넘긴다**: `loadTrackedOcids()` 가 위 "건너뛴다" 조건에서 호출 0회.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 레이어 규칙 — 스토어는 `storage/` 어댑터를 통해서만 저장소에 접근한다.
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(시그니처 변경·게이트 위치·테스트 건수)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`ContentScreen.tsx` 를 고치지 마라.** 이유: 이 설계의 요점이 "화면 호출부 무변경"이다. 화면을 고쳐야 통과하는 구현이라면 게이트 위치가 틀린 것이다.
- **`refresh` 에 `force` 인자를 만들지 마라.** 이유: 강제가 기본값이어야 호출부 누락이 조용한 회귀가 되지 않는다.
- **게이트 판정을 위해 `getCachedSchedulerState` 를 다시 읽지 마라.** 이유: 캐시 우선 표시 단계가 이미 전원을 읽었다 — 중복 조회다.
- **`status: 'loading'` 을 거쳤다가 `'loaded'` 로 바꾸지 마라.** 이유: 건너뛰는 진입에서 로딩이 한 프레임 번쩍인다.
- **보스 스케줄러·보스 수익 스토어를 건드리지 마라.** 이유: 각각 step 3·4 의 범위이고, 세 스토어를 한 번에 고치면 실패 지점을 가릴 수 없다.
- 기존 테스트를 깨뜨리지 마라.
