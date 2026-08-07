# Step 2: cache-autorecord

이 step 이 이슈 #160 의 본 수정이다. **테스트를 먼저 쓰고(TDD, CLAUDE.md CRITICAL) 통과하는 구현을 하라.**

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/boss-profit.md` 를 골라 읽어라)
- `/docs/ADR.md` (슬림 인덱스 — `ADR-111`·`ADR-097`·`ADR-017`·`ADR-050`·`ADR-067`·`ADR-069`·`ADR-076` 만 `/docs/adr/ADR-NNN.md` 로 열어라. **ADR 전체를 컨텍스트에 올리지 마라**)
- `/docs/adr/ADR-111.md` (**이번 작업의 설계 결정 원본. 여기 적힌 결정 A~F 를 그대로 구현한다**)
- `src/features/boss-profit/auto-record.ts` (직전 step 에서 신설한 `autoRecordRows` — 이 step 의 호출 대상)
- `src/features/boss-profit/__tests__/auto-record.test.ts` (직전 step 의 헬퍼 테스트 — 무엇이 이미 고정돼 있는지)
- `src/features/boss-profit/store.ts` (**이번 step 의 주 write 대상**. 특히 `refresh` 의 캐시 우선 표시 단계 ~ `if (skipSync) return` 까지)
- `src/features/boss-profit/rows.ts` (`buildBossProfitRow` 가 `periodKey` 를 `now` 로 계산하는 것 — 이번 가드의 근거)
- `src/lib/boss-profit-period.ts` (`getCurrentBossProfitPeriod`)
- `src/lib/sync-freshness.ts` (`isSyncFresh` · `SYNC_TTL_MS`)
- `src/lib/reset-clock.ts` (`getMostRecentWeeklyResetKst` — 주간 리셋 경계 테스트를 쓸 때 필요)
- `src/features/boss-profit/__tests__/store.test.ts` (**갱신 대상**. `describe('화면 진입 재조회 게이트 (ADR-097)')` 안의 테스트들과 그 위의 헬퍼 `cachedEntry` · `minutesAgo` · `syncResult` · 각종 mock 이름을 먼저 파악하라)

## 배경 — 고치는 결함

앱을 새로 켜고 `/content` → 보스 수익으로 이동하면 **수익이 계산되지 않은 채로 뜬다.** `/` 가 `/content` 로 리다이렉트되므로 거의 모든 콜드 스타트가 이 경로를 탄다.

`store.ts` 의 `refresh` 는 이렇게 판정한다.

```
skipSync = options?.auto === true && hasSyncAttemptedThisRun() && isSyncFresh(cachedSyncedAts, ocids.length, now)
```

`/content` 의 동기화가 실행 플래그를 세우고 방금 캐시를 새로 썼으므로 **보스 수익 첫 진입은 항상 `skipSync = true`** 다. 그런데 `if (skipSync) return` 아래에 `syncSchedules` **와 자동 기록 루프가 함께** 있다. 수익의 "계산"은 그 자동 기록 루프가 하므로(`partySize` 결정 → `payoutMeso = floor(priceMeso / partySize)` → SQLite `upsert`), 기록이 없는 완료 행은 `payoutMeso: null` 로 남고 화면은 0 으로 그린다.

## 작업

`src/features/boss-profit/store.ts` 의 `refresh` 안, **캐시 우선 표시 단계**만 고친다.

### 1. 캐시 단계의 기록 조회 폴백을 `[]` → `null` 로 바꾼다 (선행 조건)

현재 캐시 단계는 이렇게 조회한다.

```ts
const cachedRecords =
  cachedRows.length > 0 ? await withSqliteFallback(getBossProfitRecords(ocids, cachedPeriodKeys), []) : []
```

폴백이 `[]` 라 **"조회 실패"와 "기록 없음"을 구분하지 못한다.** 여기서 자동 기록을 하려면 이 구분이 선행 조건이다 — 실패를 "없음"으로 읽으면 사용자가 저장한 파티원 수가 `1` 로 덮어써진다([[ADR-050]] 결정 3). 동기화 완료 분기가 이미 `withSqliteFallback<BossProfitRecord[] | null>(…, null)` 로 하고 있으니 같은 형태로 맞춘다.

- 타입은 `BossProfitRecord[] | null` 이 된다.
- **조회를 아예 하지 않은 경우(`cachedRows.length === 0`)는 `null` 이 아니라 `[]` 다.** 이유: 그건 실패가 아니라 "조회할 것이 없음"이고, `null` 로 두면 아래 자동 기록이 실패로 오인한다.
- 표시 경로(`mergeRecordsIntoRows`)는 `cachedRecords ?? []` 로 넘겨 **기존 동작 그대로** 유지한다.

### 2. 기간 동일성 술어를 만든다 ([[ADR-111]] 결정 B·C)

캐시 우선 표시 단계는 이미 캐릭터별로 `{ syncedAt, rows }` 를 모으고 있다(`cachedByOcid`). 그 `syncedAt` 을 ocid 로 찾을 수 있게 맵을 만들고, 아래 술어를 정의한다.

```ts
// 캐시가 보스 리셋 경계를 넘었을 때만 지난 기간의 처치가 이번 기간 수익으로 굳는다 — 그 경우만 배제한다.
// row.periodKey 는 buildBossProfitRow 가 now 로 계산한 값이라, 같은 기기 시계인 syncedAt 과 같은 축에서 비교된다
// (API 응답의 asOf 는 서버 시계라 쓰지 않는다 — [[ADR-111]] 결정 C).
const isCachedRowCurrent = (row: BossProfitRow): boolean => { … }
```

규칙:

- `syncedAt` 이 없거나(`null`) 파싱 불가(`Number.isNaN`)면 **`false`** 를 돌려준다. 판정할 수 없으면 기록하지 않는다.
- `getCurrentBossProfitPeriod(row.cycle, new Date(syncedAt)).periodKey === row.periodKey` 로 판정한다. **`row.cycle` 을 써서 주간 행은 주간 경계로, 월간 행은 월간 경계로 본다** — 두 주기의 리셋 시점이 다르므로 한쪽으로 뭉뚱그리지 마라.

### 3. `skipSync` 인 진입에서 자동 기록·드롭 이관을 수행한다 ([[ADR-111]] 결정 A·D)

`cachedMergedRows` 를 만든 **직후**, 그리고 `latestSyncSnapshot` 을 캐시 데이터로 채우는 코드보다 **앞**에 둔다.

```ts
const cachedAutoRecordedRows = skipSync
  ? await autoRecordRows({
      rows: cachedMergedRows,
      records: cachedRecords,
      dropRecords: /* 아래 규칙대로 조회 */,
      now,
      isSourceCurrent: isCachedRowCurrent,
    })
  : cachedMergedRows
```

그리고 그 아래의 캐시 단계 소비처를 전부 `cachedAutoRecordedRows` 로 바꾼다 — `latestSyncSnapshot`, `cachedWeeklySubtotals`(월간 탭 주차별 합계), `loadDropsByRowKey`, `periodState` 판정, `set({ rows: filterRowsForTab(...) })`.

세부 규칙:

- **드롭 레코드 조회는 `skipSync` 이고 `cachedRecords !== null` 일 때만 한다.** 그 외에는 `[]` 를 넘긴다. 이유: 건너뛰지 않는 진입에는 자동 기록이 없으므로 이 조회가 순수한 낭비다.
- **`loadDropsByRowKey` 보다 반드시 먼저 실행돼야 한다.** 이유: 드롭 이관이 DB 의 드롭 난이도 키를 옮기므로, 먼저 읽으면 이관 전 상태가 화면에 남는다.
- **`set()` 보다 앞에서 끝낸다**([[ADR-111]] 결정 D). 건너뛴 진입의 `set` 은 계속 **1회**여야 한다([[ADR-097]] 결정 5 정정 3 — `loading` 을 경유해 두 번 `set` 하면 로딩이 한 프레임 번쩍인다). 기록을 `set` 뒤로 미루면 총 수익이 0 으로 그려졌다가 실제값으로 점프한다.
- **`refreshInPlace` 분기([[ADR-076]] 결정 2)보다 앞에 둔다.** 그래야 "진행 중인 주를 품은 지난 달" 화면에서 건너뛴 진입도 함께 덮인다 — 그 분기는 화면 반영을 `loadPeriod` 에 넘기는데, `loadPeriod` 는 기록을 원천으로 읽으므로 기록이 먼저 만들어져 있어야 한다.
- **`skipSync` 가 아닌 경로는 자동 기록을 하지 않는다**([[ADR-111]] 결정 E-2). 그 경로의 캐시는 낡았을 수 있고 곧 실제 동기화가 온다 — [[ADR-017]] 의 방어가 서 있어야 할 곳이 정확히 거기다.

### 4. 테스트 갱신 (`src/features/boss-profit/__tests__/store.test.ts`)

`describe('화면 진입 재조회 게이트 (ADR-097)')` 안의 테스트 **`'건너뛴 진입에서는 자동 기록(upsert)을 하지 않는다'` 는 이 동작을 고정하고 있으므로 반드시 교체하라.** 그 자리에 [[ADR-111]] 의 새 규칙을 고정하는 `describe` 를 만들고(예: `describe('건너뛴 진입의 자동 기록 (ADR-111)')`) 최소 아래를 덮어라.

1. **건너뛴 진입에서 기록 없는 완료 행이 `upsert` 되고 `payoutMeso` 가 채워진다.** `upsertBossProfitRecord` 호출 인자와 스토어 `rows` 의 `payoutMeso` 를 둘 다 확인하라(둘 중 하나만 보면 화면 반영 누락을 못 잡는다).
2. **건너뛴 진입의 `syncSchedules` 호출 수는 0 그대로다.** 이 수정이 [[ADR-097]] 결정 1~4 의 네트워크 절감을 되돌리지 않는다는 회귀 가드다.
3. **캐시가 기간 리셋 경계를 넘었으면 기록하지 않는다.** 이 케이스는 "캐시가 TTL 안(10분)인데 경계를 넘었다"여야 성립하므로 **리셋 직후 몇 분**을 시각으로 잡아야 한다. 가장 다루기 쉬운 것은 **월간 경계**다(KST 매월 1일 00:00, [[ADR-030]]): `vi.useFakeTimers({ toFake: ['Date'] })` 로 `now = 2026-08-01T00:05:00+09:00`, 캐시 `syncedAt = 2026-07-31T23:58:00+09:00` 으로 두면 TTL 안이면서 월이 갈린다. 주간 경계로도 쓰려면 시각을 손으로 추측하지 말고 `getMostRecentWeeklyResetKst`(`src/lib/reset-clock.ts`)로 실제 리셋 시각을 구해 그 기준으로 잡아라.
4. **캐시 기록 조회가 실패하면(`getBossProfitRecords` 가 던지거나 타임아웃) 건너뛴 진입에서도 기록하지 않는다** ([[ADR-050]] 결정 3).
5. **건너뛴 진입에서 드롭 이관(`migrateDropsToConfirmedDifficulty`)이 수행된다** ([[ADR-069]] 결정 4).
6. **건너뛰지 않는 진입의 캐시 우선 표시 단계는 여전히 기록하지 않는다** ([[ADR-017]] 방어 유지). 검증 방법: `syncSchedulesMock` 이 reject 하게 해두고 옵션 없는 `refresh(ocids)` 를 부른 뒤 `upsertBossProfitRecord` 가 호출되지 않았음을 확인한다 — 동기화가 실패했으므로 기록이 있었다면 그건 캐시 단계가 한 것이다.
7. **건너뛴 진입의 `lastSyncedAt` 은 여전히 가장 오래된 캐시 `syncedAt` 이다** ([[ADR-097]] 결정 5 회귀 가드). 기존 테스트가 이미 있으면 그대로 통과해야 한다.

같은 `describe` 의 나머지 게이트 테스트(재조회 여부·TTL 경계·실행 플래그·명시적 새로고침·`refreshInPlace`)는 **고치지 마라.** 그것들이 이번 변경이 네트워크 정책을 건드리지 않았다는 증거다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전부 통과
npm run lint    # lint clean
```

추가 확인:

```bash
# 캐시 단계가 헬퍼를 부른다
grep -q "autoRecordRows" src/features/boss-profit/store.ts && echo "wired"
# 옛 동작을 고정하던 테스트가 남아 있지 않다
! grep -q "건너뛴 진입에서는 자동 기록(upsert)을 하지 않는다" src/features/boss-profit/__tests__/store.test.ts && echo "old test replaced"
# 새 규칙 테스트가 있다
grep -q "ADR-111" src/features/boss-profit/__tests__/store.test.ts && echo "new tests present"
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 디렉토리 구조를 따르는가?
   - CLAUDE.md CRITICAL: `features/*` 가 로컬 저장소·네이티브 API 에 **직접** 접근하지 않고 `storage/`·`native/` 어댑터를 거치는가?
   - ADR 기술 스택을 벗어나지 않았는가?
   - 건너뛴 진입의 `set()` 이 **1회**로 유지되는가([[ADR-097]] 결정 5 정정 3)?
3. 결과에 따라 `phases/boss-profit-autorecord-gate/index.json` 의 step 2 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 바뀐 판정식과 추가한 테스트 수를 한 줄로
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- **`skipSync` 판정식 자체를 바꾸지 마라** (`options?.auto === true && hasSyncAttemptedThisRun() && isSyncFresh(...)`). 이유: 그 식은 **네트워크 재조회**를 판정하는 것이고 [[ADR-111]] 은 그 정책을 하나도 바꾸지 않는다. 자동 기록은 그 판정 **결과 위에** 기간 동일성 가드를 얹어 결정된다.
- **`if (skipSync) return` 을 지우거나 그 아래로 `syncSchedules` 를 부르게 만들지 마라.** 이유: 건너뛴 진입의 네트워크 호출 수는 0 이어야 한다. 이것이 [[ADR-097]] 이 없앤 "탭 한 바퀴에 같은 응답 3번"의 회귀 가드다.
- **`SYNC_TTL_MS`(10분)를 조정하지 마라.** 이유: 그 값은 [[ADR-097]] 이 사용자 실사용 판단에 맡긴 별개의 열린 질문이고, 이 결함의 원인이 아니다.
- **화면 컴포넌트(`src/app/boss-profit/`)를 고치지 마라.** 이유: 이 수정은 스토어 내부 규약이다. [[ADR-097]] 결정 4 가 "화면 호출부는 한 줄도 안 고친다"를 지켰고 그 성질을 유지한다.
- **`content-scheduler/store.ts` · `boss-scheduler/store.ts` 를 고치지 마라.** 이유: 두 스토어의 게이트 뒤에는 영속 쓰기가 없어(표시용 `set` 뿐) 이 결함이 없다. 같은 게이트를 공유하지만 수정 대상은 보스 수익 스토어 하나다.
- **`autoRecordRows` 헬퍼 안의 가드를 완화하지 마라** (미완료 placeholder 제외 · `records === null` 제외 · 순차 실행). 이유: 각각 [[ADR-032]]·[[ADR-050]] 결정 3·SQLite 단일 커넥션 트랜잭션 충돌을 막는 자리다.
- **`appendRecordOnlyRows` 를 캐시 단계에 넣지 마라.** 이유: 그것이 step 3 의 범위다. 여기서 섞으면 두 step 의 diff 가 겹쳐 회귀 원인을 분간할 수 없다.
- **`src/data/` 의 게임 레퍼런스 수치를 추정해 고치지 마라.** 이유: CLAUDE.md CRITICAL — 반드시 사용자 확인을 거쳐야 한다.
- 기존 테스트를 깨뜨리지 마라
