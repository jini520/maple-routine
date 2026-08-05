# Step 3: boss-gate

이 task 는 **페이지 이동 API 호출 정책**을 바꾼다([[ADR-097]], 이슈 #139).

**지금 무슨 일이 일어나는가**: 보스 스케줄러 화면은 마운트 `useEffect` 에서 `loadTrackedOcids()` 를 부르고, 그것이 `refresh(ocids)` → `syncSchedules(ocids)` 를 돌린다. 탭은 라우트라 오갈 때마다 재마운트되므로 **탭 이동마다 같은 조회가 다시 나간다.** 컨텐츠·보스 수익 화면도 같은 `syncSchedules` 를 부르고 결과를 **같은 캐시**(`storage/scheduler-cache`)에 쓴다.

이 step 은 **보스 스케줄러 스토어 하나**에 게이트를 붙인다. 컨텐츠 스토어에는 이전 step 에서 같은 게이트가 이미 들어가 있다 — **그 구현을 먼저 읽고 같은 모양으로 맞춰라.** 보스 수익 스토어는 다음 step 의 몫이니 건드리지 마라.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트 먼저**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (결정 원장 — 특히 **결정 4·5**)
- `/docs/features/boss-scheduler.md` (이 화면의 정책)
- `/src/lib/sync-freshness.ts` (`SYNC_TTL_MS` · `isSyncFresh(syncedAts, trackedCount, now)`)
- `/src/features/schedule-sync/sync-run-state.ts` (`hasSyncAttemptedThisRun()`)
- **`/src/features/content-scheduler/store.ts`** (이전 step 에서 같은 게이트가 들어간 참고 구현 — 옵션 이름·판정 위치·`set` 한 번 규칙을 그대로 따르라)
- `/src/features/boss-scheduler/store.ts` (이번 수정 대상)
- `/src/features/boss-scheduler/__tests__/store.test.ts` (기존 테스트 — `syncSchedules` 가 모킹돼 있다)
- `/src/app/boss-scheduler/BossScreen.tsx` (호출부 — **읽기만 하라. 이 파일은 고치지 않는다**)

## 작업

### 1. `refresh` 에 내부 옵션을 더한다

컨텐츠 스토어와 **같은 이름·같은 모양**으로 맞춘다.

```ts
refresh(ocids: string[], onProgress?: (completed: number, total: number) => void, options?: RefreshOptions): Promise<void>
```

`loadTrackedOcids()` 만 `{ auto: true }` 를 넘긴다. 옵션 없는 호출(헤더 새로고침·당겨서 새로고침·재시도)은 지금처럼 **항상** 조회한다.

### 2. 게이트를 캐시 우선 표시 직후에 둔다

`refresh` 안의 캐시 우선 표시 단계(추적 캐릭터마다 `getCachedSchedulerState(ocid)` 를 읽어 `cachedCharacters` 를 만들고 `set({ status: 'loading', characters: …, manualTrackedByOcid })` 하는 부분)에서 **이미 읽은 `syncedAt`** 을 판정에 쓴다.

```
건너뛴다 = options?.auto === true
        AND hasSyncAttemptedThisRun()
        AND isSyncFresh(캐시가 있는 캐릭터들의 syncedAt, ocids.length, new Date())
```

건너뛰는 경우: `status: 'loaded'` · 뷰의 `isStale: false` · `error: null` 로 **한 번만** `set` 하고 반환한다(로딩을 한 프레임도 거치지 않게). `syncedAt` 값 자체는 캐시 값 그대로 둔다.

### 3. 이 화면만의 주의 — `loadPartySizes` 는 건너뛰면 안 된다

보스 스토어의 `refresh` 는 캐시 우선 표시 `set` **다음**에 `loadPartySizes(ocids)` 를 부른다(try/catch 로 감싸 실패해도 흐름을 막지 않는다).

**파티 설정은 스케줄 동기화와 무관한 로컬 조회다**(`storage/boss-party-settings`, SQLite). 네트워크가 아니므로 TTL 게이트의 대상이 아니고, 추적 목록이 바뀌었을 수 있으므로 진입할 때마다 갱신돼야 한다.

→ **게이트로 조기 반환하기 전에 `loadPartySizes(ocids)` 를 반드시 부르고, 지금과 똑같이 try/catch 로 감싸라.** 이것을 빠뜨리면 TTL 로 건너뛴 진입에서 파티원 수 배지·필터가 옛 값(또는 빈 값)으로 남는다.

### 4. 테스트

`src/features/boss-scheduler/__tests__/store.test.ts` 에 `describe('화면 진입 재조회 게이트 (ADR-097)')` 를 더한다. `beforeEach` 에서 `resetSyncRunStateForTests()` 로 실행 플래그를 초기화하라.

반드시 포함할 케이스:

- **건너뛴다**: `auto: true` + 실행 플래그 있음 + 전원 캐시가 5분 전 → `syncSchedules` 호출 **0회**, `status === 'loaded'`, `characters` 전원 `isStale === false`.
- **앱 재시작 모사**: 실행 플래그 없음 → 호출 1회.
- **캐시 결손**: 추적 2명 중 1명만 캐시 → 호출 1회.
- **만료**: 가장 오래된 캐시가 11분 전 → 호출 1회.
- **명시적 재조회는 강제**: 옵션 없이 `refresh(ocids)` → 호출 1회.
- **파티 설정은 건너뛰지 않는다**: 위 "건너뛴다" 조건에서도 파티 설정 조회가 호출된다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전량 통과 (신규 테스트 포함)
npm run lint    # ESLint 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 레이어 규칙을 따르는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`BossScreen.tsx` 를 고치지 마라.** 이유: 이 설계의 요점이 "화면 호출부 무변경"이다.
- **`loadPartySizes` 를 게이트 뒤로 밀지 마라.** 이유: 위 3번 — 로컬 조회라 TTL 대상이 아니고, 건너뛰면 파티원 수 배지·필터가 옛 값으로 남는다.
- **`refresh` 에 `force` 인자를 만들지 마라.** 이유: 강제가 기본값이어야 호출부 누락이 조용한 회귀가 되지 않는다.
- **게이트 판정을 위해 저장소를 다시 읽지 마라.** 이유: 캐시 우선 표시 단계가 이미 전원을 읽었다.
- **컨텐츠 스토어와 다른 방식으로 구현하지 마라.** 이유: 같은 정책이 두 모양으로 존재하면 다음에 값을 바꿀 때 한쪽만 고치게 된다.
- **보스 수익 스토어를 건드리지 마라.** 이유: step 4 의 범위다.
- 기존 테스트를 깨뜨리지 마라.
