# Step 4: profit-gate

이 task 는 **페이지 이동 API 호출 정책**을 바꾼다([[ADR-097]], 이슈 #139).

**지금 무슨 일이 일어나는가**: 보스 수익 화면은 마운트 `useEffect` 에서 `loadTrackedOcids()` 를 부르고, 그것이 `refresh(ocids)` → `syncSchedules(ocids)` 를 돌린다. 컨텐츠·보스 스케줄러도 같은 `syncSchedules` 를 부르고 결과를 **같은 캐시**(`storage/scheduler-cache`)에 쓰므로, 탭을 한 바퀴 돌면 같은 응답을 3번 받는다.

이 step 은 **보스 수익 스토어 하나**에 게이트를 붙인다. 컨텐츠·보스 스토어에는 이전 step 들에서 같은 게이트가 들어가 있다 — **그 구현을 먼저 읽고 옵션 이름과 판정 규칙을 맞춰라.** 다만 이 스토어는 세대 가드·`refreshInPlace`·`lastSyncedAt` 때문에 마감 처리가 다르다. 아래를 그대로 따르라.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (프로젝트 규칙 — **TDD: 테스트 먼저**)
- `/docs/README.md` (문서 인덱스)
- `/docs/adr/ADR-097.md` (결정 원장 — 특히 **결정 4·5·6**)
- `/docs/features/boss-profit.md` (이 화면의 정책. 특히 "자동 기록" 절)
- `/docs/adr/ADR-076.md` (제자리 새로고침 — `refreshInPlace` 의 근거)
- `/src/lib/sync-freshness.ts` (`SYNC_TTL_MS` · `isSyncFresh(syncedAts, trackedCount, now)`)
- `/src/features/schedule-sync/sync-run-state.ts` (`hasSyncAttemptedThisRun()`)
- **`/src/features/content-scheduler/store.ts`** (앞선 step 의 참고 구현 — 옵션 이름·판정식을 맞춰라)
- `/src/features/boss-profit/store.ts` (이번 수정 대상. `refresh` 는 길다 — 캐시 우선 표시 단계와 동기화 완료 분기를 먼저 끝까지 읽어라)
- `/src/features/boss-profit/__tests__/store.test.ts` (기존 테스트 — `syncSchedules` 가 모킹돼 있다)
- `/src/app/boss-profit/BossProfitScreen.tsx` (호출부 — **읽기만 하라. 이 파일은 고치지 않는다**)

## 작업

### 1. `refresh` 에 내부 옵션을 더한다

이 스토어의 `refresh` 는 `onProgress` 를 받지 않는다(다른 두 스토어와 다르다 — 그 차이는 유지한다).

```ts
refresh(ocids: string[], options?: RefreshOptions): Promise<void>   // RefreshOptions = { auto?: boolean }
```

`loadTrackedOcids()` 만 `{ auto: true }` 를 넘긴다. 옵션 없는 호출(헤더 새로고침·당겨서 새로고침·에러 재시도·`useStaleCharactersToast` 재시도)은 지금처럼 **항상** 조회한다.

### 2. 판정값은 캐시 우선 표시 단계에서 수집한다

`refresh` 안에는 추적 캐릭터마다 `getCachedSchedulerState(ocid)` 를 읽어 `cachedRows` 를 만드는 단계가 있다. **그 자리에서 각 캐릭터의 `syncedAt` 을 함께 모아라**(행이 아니라 캐릭터 단위 배열이다 — 한 캐릭터가 여러 행을 만들므로 행 배열로 세면 개수가 틀어진다).

```
건너뛴다 = options?.auto === true
        AND hasSyncAttemptedThisRun()
        AND isSyncFresh(캐시가 있는 캐릭터들의 syncedAt, ocids.length, now)
```

`now` 는 `refresh` 가 이미 만들어 쓰는 값을 그대로 쓴다(새로 `new Date()` 를 만들지 마라 — 같은 호출 안에서 두 시각이 갈리면 기간 경계에서 어긋난다).

### 3. 건너뛸 때의 마감 — 두 분기를 모두 처리하라

캐시 우선 표시 단계는 이미 `refreshInPlace` 로 갈라져 있다.

**(a) `refreshInPlace === false` (평범한 진입)**: 그 분기의 큰 `set({ status: 'loading', … })` 이 이미 `rows`·`dropsByRowKey`·`weeklySubtotals`·`periodState`·`canGoPreviousPeriod`·`previousPeriodTotalMeso` 를 전부 채운다. **판정을 그 `set` 앞에서 끝내고 `status` 를 `'loaded'` 로 넣어 한 번만 `set` 한 뒤 반환하라.** `set` 을 두 번 하면 로딩이 한 프레임 번쩍인다.

여기에 **`lastSyncedAt` 을 함께 넣어라 — 값은 "판정에 쓴 가장 오래된 캐시 `syncedAt`" 이다.**

- 이 화면의 `lastSyncedAt` 은 스토어 메모리에만 있어(초기값 `null`) 다른 탭이 받아둔 덕에 건너뛴 진입에서는 `null` 로 남는다. 그러면 **신선한 데이터를 보여주면서 "동기화 기록 없음"이라고 말하게 된다.**
- **지금 시각(`new Date()`)으로 채우지 마라.** 이유: 하지 않은 동기화를 했다고 말하는 것이다. 사용자는 그 숫자를 보고 새로고침을 누를지 판단한다.

**(b) `refreshInPlace === true` (진행 중인 주를 품은 지난 달을 보는 중, [[ADR-076]])**: 이 분기는 화면 반영을 `loadPeriod` 에 넘긴다. 건너뛸 때도 같다 — 세대 가드를 확인한 뒤 `staleCharacterNames: []` · `characterIssues: {}` · `error: null` 을 `set` 하고 `loadPeriod(set, tab, viewedPeriodKey, ocids, now, myGeneration)` 를 `await` 한 다음 반환하라. `loadPeriod` 는 DB 만 읽으므로 네트워크가 없다. `status`·`rows`·`periodState` 는 그 함수가 정한다.

### 4. 자동 기록(upsert)은 건너뛴 진입에서 하지 않는다

이건 **추가 코드가 아니라 조기 반환의 자연스러운 결과**다. 자동 기록은 `syncSchedules` 결과를 받은 뒤에만 돌기 때문이다.

그 규칙을 깨지 마라 — "낡은 캐시를 기준으로 잘못된 파티원 수를 기록하지 않는다"가 [[ADR-017]]·[[ADR-067]] 결정 7의 방어다. **건너뛴 진입에서 캐시 행으로 upsert 하는 코드를 만들지 마라.** 행 표시는 캐시 우선 표시가 이미 그리고, 기록 생성만 다음 실제 동기화까지 미뤄지는 것이 의도된 트레이드오프다([[ADR-097]] 결정 6).

### 5. 세대 가드 규약을 지켜라

이 스토어는 `myGeneration !== requestGeneration` 이면 화면에 반영하지 않는다(연타·기간 이동 중 옛 응답이 덮어쓰는 것을 막는다). **새로 추가하는 모든 `set` 앞에도 같은 가드를 두어라.**

### 6. 테스트

`src/features/boss-profit/__tests__/store.test.ts` 에 `describe('화면 진입 재조회 게이트 (ADR-097)')` 를 더한다. `beforeEach` 에서 `resetSyncRunStateForTests()` 로 실행 플래그를 초기화하라.

반드시 포함할 케이스:

- **건너뛴다**: `auto: true` + 실행 플래그 있음 + 전원 캐시가 5분 전 → `syncSchedules` 호출 **0회**, `status === 'loaded'`, `rows` 가 캐시 기준으로 채워져 있다.
- **`lastSyncedAt`**: 위 조건에서 `lastSyncedAt` 이 **가장 오래된 캐시 `syncedAt`** 이다(현재 시각이 아니다).
- **자동 기록 없음**: 위 조건에서 기록 upsert 가 호출되지 않는다.
- **앱 재시작 모사**: 실행 플래그 없음 → 호출 1회.
- **캐시 결손 / 만료(11분 전)**: 각각 호출 1회.
- **명시적 재조회는 강제**: 옵션 없이 `refresh(ocids)` → 호출 1회.

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
3. 결과에 따라 `phases/sync-ttl-gate/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약(두 분기 마감 처리·lastSyncedAt 규칙 포함)"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- **`BossProfitScreen.tsx` 를 고치지 마라.** 이유: 이 설계의 요점이 "화면 호출부 무변경"이다.
- **`lastSyncedAt` 을 현재 시각으로 채우지 마라.** 이유: 위 3번 — 하지 않은 동기화를 했다고 말하게 된다.
- **건너뛴 진입에서 자동 기록(upsert)을 하지 마라.** 이유: 위 4번 — 낡은 캐시로 파티원 수·수익을 영구 기록하는 결함이 실제로 있었다([[ADR-067]] 결정 7).
- **`refresh` 에 `onProgress` 인자를 새로 만들지 마라.** 이유: 이 스토어가 그것을 받지 않는 것은 [[ADR-072]] 결정 3이 의존하는 기존 차이다.
- **세대 가드 없이 `set` 하지 마라.** 이유: 기간 이동·연타 중 옛 결과가 화면을 덮어쓴다.
- **`refresh` 를 리팩터링하지 마라**(함수 분리·순서 변경 등). 이유: 이 함수는 캐시 우선 표시·세대 가드·백필·자동 기록이 얽혀 있어, 이번 변경과 무관한 이동이 섞이면 회귀 원인을 가릴 수 없다.
- 기존 테스트를 깨뜨리지 마라.
