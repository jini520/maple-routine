# Step 1: autorecord-extract

**이 step 은 순수 리팩터링이다. 동작을 바꾸지 마라.** 자동 기록 루프를 재사용 가능한 헬퍼로 추출하기만 한다. 기존 테스트가 **한 개도 고치지 않고** 그대로 통과하는 것이 이 step 의 성공 기준이다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — `features/boss-profit.md` 를 골라 읽어라)
- `/docs/ADR.md` (슬림 인덱스 — `ADR-111`·`ADR-014`·`ADR-019`·`ADR-050`·`ADR-067`·`ADR-069` 만 `/docs/adr/ADR-NNN.md` 로 열어라. **ADR 전체를 컨텍스트에 올리지 마라**)
- `/docs/adr/ADR-111.md` (직전 step 에서 신설한 이번 작업의 설계 결정 — 이 헬퍼가 왜 필요한지가 여기 있다)
- `src/features/boss-profit/store.ts` (**이번 step 의 유일한 write 대상 중 하나**)
- `src/features/boss-profit/rows.ts` (`BossProfitRow` 타입, `mergeRecordsIntoRows`, `appendRecordOnlyRows`)
- `src/features/boss-profit/drops-loader.ts` (`migrateDropsToConfirmedDifficulty` 시그니처)
- `src/storage/boss-profit.ts` 또는 `getBossProfitRecords`·`upsertBossProfitRecord`·`getBossPartySize`·`getBossDropRecords` 가 사는 파일 (import 경로 확인용)
- `src/features/boss-profit/__tests__/store.test.ts` (기존 테스트가 무엇을 고정하고 있는지 — **이 step 에서는 읽기만 한다**)

## 배경

`src/features/boss-profit/store.ts` 의 `refresh` 는 `syncSchedules` 가 끝난 뒤 `mergedRows` 를 순회하며 두 가지를 한다.

1. **드롭 이관** — 완료 행의 다른 난이도에 남은 드롭을 확정 난이도로 옮긴다([[ADR-069]] 결정 4)
2. **자동 기록** — 기록이 없는 완료 행에 기본 파티원 수를 정해 `boss_profit_records` 에 `upsert` 한다([[ADR-014]]·[[ADR-019]])

다음 step 에서 이 루프를 **캐시 우선 표시 단계에서도** 부르게 된다([[ADR-111]]). 그러려면 먼저 호출 가능한 형태로 떼어내야 한다.

두 작업의 가드를 비교하면 이렇다.

| | 드롭 이관 | 자동 기록 |
|---|---|---|
| 공통 | `records !== null` · `!staleOcids.has(row.ocid)` | 같음 |
| 개별 | `row.isComplete` | `row.isComplete` **AND** `row.partySize === null` **AND** `row.priceMeso !== null` |

공통 가드 중 `!staleOcids.has(row.ocid)` 가 **"이 행의 출처가 지금의 사실인가"** 를 묻는 자리다([[ADR-067]] 결정 7 — `buildFallbackResult` 가 돌려준 낡은 캐시 행을 배제한다). 다음 step 의 캐시 경로는 같은 질문에 **기간 동일성**으로 답하게 된다. 그래서 이 자리를 **주입받는 술어(predicate)** 로 일반화한다.

## 작업

### 1. `src/features/boss-profit/auto-record.ts` 신설

`store.ts` 의 자동 기록 루프(드롭 이관 포함)를 이 파일로 옮긴다. 시그니처는 아래 그대로 쓴다.

```ts
export interface AutoRecordParams {
  rows: BossProfitRow[]
  /** null = getBossProfitRecords 조회 자체가 실패했다는 뜻. 이때는 아무것도 기록하지 않는다([[ADR-050]] 결정 3). */
  records: BossProfitRecord[] | null
  /** 드롭 이관 대상 조회 결과. records 가 null 이면 호출부가 [] 를 넘긴다. */
  dropRecords: BossDropRecord[]
  now: Date
  /**
   * 이 행의 출처가 "지금의 사실"인가. false 면 드롭 이관·자동 기록 **둘 다** 건너뛴다.
   * - 동기화 경로: 동기화가 실패해 낡은 캐시로 그려진 행을 배제한다([[ADR-067]] 결정 7)
   * - 캐시 경로: 캐시가 보스 리셋 경계를 넘어 지난 기간 처치를 이번 기간으로 굳히는 행을 배제한다([[ADR-111]])
   */
  isSourceCurrent: (row: BossProfitRow) => boolean
}

/** 입력 rows 와 **같은 순서**로, 자동 기록된 행은 partySize·payoutMeso 가 채워진 새 배열을 돌려준다. */
export async function autoRecordRows(params: AutoRecordParams): Promise<BossProfitRow[]>
```

**옮길 때 반드시 보존할 것** (하나라도 어기면 데이터 무결성 결함이다. 기존 코드의 해당 주석도 함께 옮겨라):

- **순차 실행.** `upsertBossProfitRecord` 는 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열므로 `Promise.all` 로 동시 실행하면 트랜잭션이 겹쳐 에러가 난다. `for … of` + `await` 를 유지하라.
- **드롭 이관은 자동 기록보다 조건이 넓다.** 가격 미확정(`priceMeso === null`)이거나 이미 기록된(`partySize !== null`) 조합도 난이도는 확정된 상태다. 이관을 자동 기록 가드 안으로 밀어 넣지 마라.
- **미완료 placeholder(`isComplete === false`)는 절대 기록하지 않는다**([[ADR-032]]). 기록해버리면 나중에 실제로 완료됐을 때 "이미 기록이 있다"고 오판해 0메소로 영구 고정된다.
- **`records === null` 이면 기록도 이관도 하지 않는다**([[ADR-050]] 결정 3). 조회 실패를 "기록 없음"으로 읽으면 사용자가 저장한 파티원 수를 `1` 로 덮어쓴다.
- **기본 파티원 수**는 `getBossPartySize(row.ocid, row.boss, row.difficulty)` 조회값, 없으면 `1`([[ADR-019]]). `payoutMeso = Math.floor(row.priceMeso / partySize)`.
- **모든 SQLite 호출은 `withSqliteFallback` 을 거친다**(기존 코드 그대로).
- 기록하지 않은 행도 **입력 그대로 결과 배열에 넣는다**(현재 `autoRecordedRows.push(row); continue` 가 하는 일).

### 2. `store.ts` 의 동기화 완료 분기가 이 헬퍼를 부르게 한다

기존 `for (const row of mergedRows)` 루프를 통째로 아래 한 번의 호출로 대체한다.

```ts
const autoRecordedRows = await autoRecordRows({
  rows: mergedRows,
  records,
  dropRecords: dropRecordsForMigration,
  now,
  isSourceCurrent: (row) => !staleOcids.has(row.ocid),
})
```

`dropRecordsForMigration` 을 구하는 기존 코드(`records === null ? [] : await withSqliteFallback(getBossDropRecords(...), [])`)와 그 뒤의 `appendRecordOnlyRows` · `sortRowsByOcidOrder` · `latestSyncSnapshot` 은 **그대로 둔다.**

### 3. 헬퍼 단위 테스트 추가

`src/features/boss-profit/__tests__/auto-record.test.ts` 를 새로 만들어 위 "보존할 것" 중 최소 아래를 고정하라:

- `isSourceCurrent` 가 `false` 인 행은 `upsertBossProfitRecord` 도 `migrateDropsToConfirmedDifficulty` 도 호출되지 않는다
- `records === null` 이면 아무 행도 기록되지 않는다
- 미완료 행(`isComplete: false`)은 기록되지 않는다
- 이미 기록된 행(`partySize !== null`)은 기록되지 않지만 **드롭 이관은 된다**
- `priceMeso === null` 인 행은 기록되지 않지만 **드롭 이관은 된다**
- 파티 설정이 없으면 `partySize = 1`, 있으면 그 값으로 `payoutMeso = floor(priceMeso / partySize)` 가 계산된다
- 반환 배열의 순서가 입력과 같다

`src/features/boss-profit/__tests__/store.test.ts` 의 기존 테스트는 **한 줄도 고치지 마라.** 그대로 통과해야 한다.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 전부 통과 (기존 테스트 수정 없이)
npm run lint    # lint clean
```

추가 확인:

```bash
# store.ts 에 자동 기록 루프의 흔적이 남지 않았다 (헬퍼로 옮겨졌다)
grep -c "upsertBossProfitRecord" src/features/boss-profit/store.ts   # 0 이어야 한다
grep -q "autoRecordRows" src/features/boss-profit/store.ts && echo "wired"
# 기존 store 테스트가 수정되지 않았다
git diff --stat src/features/boss-profit/__tests__/store.test.ts   # 출력이 비어 있어야 한다
```

## 검증 절차

1. 위 AC 커맨드를 전부 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `docs/foundation/architecture.md` 의 디렉토리 구조를 따르는가? (`features/boss-profit/` 안에 두었는가)
   - CLAUDE.md CRITICAL: `features/*` 가 로컬 저장소·네이티브 API 에 **직접** 접근하지 않고 `storage/` 어댑터를 거치는가? (기존 코드가 쓰던 `storage/` import 를 그대로 옮겨 쓰면 된다 — 새 직접 접근을 만들지 마라)
   - ADR 기술 스택을 벗어나지 않았는가?
3. 결과에 따라 `phases/boss-profit-autorecord-gate/index.json` 의 step 1 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 에 신설 파일 경로와 `autoRecordRows` 시그니처를 한 줄로
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- **동작을 바꾸지 마라.** 이유: 이 step 의 유일한 목적은 다음 step 이 부를 수 있는 형태를 만드는 것이다. 동작 변경이 섞이면 회귀가 났을 때 어느 step 때문인지 분간할 수 없다.
- **캐시 우선 표시 단계(`if (skipSync) return` 위쪽)를 건드리지 마라.** 이유: 그것이 step 2 의 범위다. 여기서 손대면 두 step 의 diff 가 겹친다.
- **`skipSync` 판정식을 고치지 마라.** 이유: 같음.
- **기존 `store.test.ts` 를 고치지 마라.** 이유: 이 step 이 동작을 바꾸지 않았다는 증거가 바로 "기존 테스트가 그대로 통과한다"이다.
- **`Promise.all` 로 자동 기록을 병렬화하지 마라.** 이유: `upsertBossProfitRecord` 가 단일 공유 SQLite 커넥션에 자체 트랜잭션을 열어 겹치면 에러가 난다.
- **`src/data/` 의 게임 레퍼런스 수치를 추정해 고치지 마라.** 이유: CLAUDE.md CRITICAL — 반드시 사용자 확인을 거쳐야 한다.
- 기존 테스트를 깨뜨리지 마라
