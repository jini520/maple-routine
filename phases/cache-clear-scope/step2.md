# Step 2: cache-data-scope

캐시 데이터 삭제의 실제 범위를 고친다 — **`boss_drop_records` 누락(실제 버그)을 제거**하고, 하드코딩된 테이블 목록을 step 1에서 만든 단일 진실 공급원으로 교체하며, **`trackingMode`·`dropEffect`를 보존 대상으로 승격**한다([[ADR-052]] 결정 1·2).

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-052.md` — 이번 작업의 결정. **결정 1(사용자 설정 보존)·결정 2(테이블 목록 SSOT)** 가 이 step의 규칙이다.
- `/docs/persistence/lifecycle.md` — step 0에서 갱신된 삭제 범위 문서. 여기 적힌 범위와 구현이 일치해야 한다.
- `/docs/persistence/preferences.md` — step 0에서 `trackingMode`·`dropEffect` 행이 "보존"으로 추가돼 있다.
- **step 1에서 수정된 파일 — 반드시 먼저 읽어라**:
  - `/src/storage/sqlite/db.ts` — `TABLE_DEFINITIONS` 배열과 `BOSS_PROFIT_TABLE_NAMES` export가 있다. 이 step은 그걸 소비한다.
  - `/src/storage/sqlite/__tests__/db.test.ts` — step 1에서 추가된 회귀 가드(소스 정규식 ↔ export 일치).
- `/src/storage/cache-data.ts` — **주 수정 대상.** `KEEP_KEYS`(`:7-11`), `CLEARED_TABLES`(`:13`), `clearCacheData`(`:15-25`), `getCacheDataSize`(`:29-50`).
- `/src/storage/keys.ts` — `STORAGE_KEYS.trackingMode`(`:5`), `STORAGE_KEYS.dropEffect`(`:6`).
- `/src/storage/__tests__/cache-data.test.ts` — 갱신 대상. `@capacitor/preferences`를 Map으로 모킹하고 `vi.mock('../sqlite/db', ...)`로 `getBossProfitDb`만 모킹한다(`:28-30`). 현재 SQLite 단언은 3개 테이블 이름을 **직접 하드코딩**하고 있다(`:64-71`).
- **확인만 할 파일**(수정 금지, 아래 "작업 4" 용):
  - `/src/features/tracking-mode/store.ts`·`/src/features/tracking-mode/seed.ts`
  - `/src/features/content-scheduler/store.ts`의 `saveTrackedOcids`

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

`src/storage/__tests__/cache-data.test.ts`를 아래대로 고치고 실패를 확인한 뒤 구현하라.

**(a) SQLite 모킹을 실제 목록과 연결한다.** 지금은 `vi.mock('../sqlite/db')`가 `getBossProfitDb`만 제공하므로, `cache-data.ts`가 `BOSS_PROFIT_TABLE_NAMES`를 import하는 순간 `undefined`가 된다. 모킹 팩토리에서 `vi.importActual`로 **실제 모듈의 `BOSS_PROFIT_TABLE_NAMES`를 그대로 넘겨주고**, `getBossProfitDb`만 가짜로 바꿔라.

```ts
// 형태 예시 — 실제 export 이름·경로는 step 1 산출물(src/storage/sqlite/db.ts)을 확인해서 쓸 것
vi.mock('../sqlite/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sqlite/db')>()),
  getBossProfitDb: vi.fn(async () => ({ execute: dbExecuteMock, query: dbQueryMock })),
}))
```

**(b) 회귀 가드 — 실제 테이블 전부에 `DELETE`가 나가는지.** 하드코딩된 3개 이름을 개별 단언하는 대신, `BOSS_PROFIT_TABLE_NAMES`를 순회하며 각 테이블에 `DELETE FROM <name>;`이 호출됐는지 단언하라. **이것이 `boss_drop_records` 누락 회귀를 막는 핵심 테스트다.** 더불어 `dbExecuteMock`의 호출 횟수가 테이블 개수와 같은지도 단언해 "목록에 없는 테이블까지 지우지 않음"을 고정하라.

**(c) 보존 키 단언.** `trackingMode`·`dropEffect`를 seed한 뒤 `clearCacheData()`를 호출해도 값이 남아 있어야 한다. 기존의 `apiKey`·`selectedAccountId`·`theme` 보존 단언은 그대로 둔다.

**(d) `getCacheDataSize` 단언 갱신.** 보존 키는 용량 합산에서 제외되므로, `trackingMode`·`dropEffect`를 seed해도 합계가 늘지 않아야 한다. 기존 테스트(`:75-95`)의 기대 바이트 수 계산이 새 seed 때문에 틀어지지 않도록 정확히 맞춰라 — **기대값을 대충 바꾸지 말고, 어떤 키가 몇 바이트인지 주석으로 남겨라**(기존 테스트가 그렇게 하고 있다).

### 2. `src/storage/cache-data.ts` 수정

- `KEEP_KEYS`에 `STORAGE_KEYS.trackingMode`·`STORAGE_KEYS.dropEffect`를 추가한다.
- `CLEARED_TABLES` 상수를 **제거**하고, `./sqlite/db`에서 `BOSS_PROFIT_TABLE_NAMES`를 import해 `clearCacheData`·`getCacheDataSize` 양쪽에서 그걸 순회하게 한다.
- 파일 상단 주석(`:5-6`)과 `getCacheDataSize` 위 주석(`:27-28`)의 "이 세 SQLite 테이블" 같은 개수 고정 표현을 현행화하라 — 목록이 `db.ts`에서 온다는 사실과 `[[ADR-052]]` 참조가 드러나야 한다. `KEEP_KEYS` 주석에도 두 키가 왜 보존 대상인지(캐시가 아니라 사용자 설정) 한 줄 남겨라.

**이 step에서 반드시 지켜야 할 규칙:**
- **삭제 대상 테이블 이름을 `cache-data.ts`에 다시 적지 마라.** 목록은 `db.ts` 하나에서만 온다([[ADR-052]] 결정 2). 필터링·정렬·부분 선택 같은 어떤 가공도 하지 마라 — 하면 두 번째 목록이 다시 생기는 것과 같다.
- Preferences 쪽의 **"KEEP_KEYS 빼고 전부"** 라는 반전 규칙은 그대로 유지한다. 삭제할 키를 나열하는 방식으로 바꾸지 마라.
- `DELETE FROM`을 `DROP TABLE`로 바꾸지 마라 — 스키마는 남기고 행만 지운다(`docs/persistence/lifecycle.md`에 명시된 정책).

### 3. `getCacheDataSize`의 정합성 확인

`clearCacheData`와 `getCacheDataSize`가 **정확히 같은 범위**를 보는지 확인하라 — 같은 `KEEP_KEYS`, 같은 `BOSS_PROFIT_TABLE_NAMES`를 쓰면 자동으로 맞는다. 두 함수가 다른 목록을 보게 되는 구조를 만들지 마라.

### 4. 캐시 삭제 후 수동 모드 복구 경로 확인 (조사만, 코드 변경 금지)

`trackingMode`를 보존하기로 했으므로, **캐시 삭제 후 `trackingMode: 'manual'`만 남고 `manualTrackedContent:*`·`trackedCharacters`는 지워진 상태**가 생긴다. 이때 사용자가 캐릭터 관리에서 캐릭터를 다시 고르면 [[ADR-035]] 결정 14(b)의 시드가 돌아 멤버십이 복구되는지 **코드를 읽어 확인만** 하라(`features/tracking-mode/seed.ts`, `features/content-scheduler/store.ts`의 `saveTrackedOcids`).

- 복구 경로가 살아 있으면 → 그 사실을 step summary에 한 줄 적는다.
- 복구 경로가 **없거나 끊겨 있으면** → 코드를 고치지 말고, 그 사실을 summary에 명확히 적어라(별도 이슈 대상이다). 이 step에서 시드 로직을 새로 만들지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과
npm run lint    # 경고 0

# 하드코딩된 테이블 목록이 사라졌는지 — 결과가 없어야 한다
grep -n "CLEARED_TABLES\|'boss_profit_records'" src/storage/cache-data.ts

# 단일 진실 공급원을 import하는지
grep -n "BOSS_PROFIT_TABLE_NAMES" src/storage/cache-data.ts

# 보존 키가 추가됐는지
grep -n "trackingMode\|dropEffect" src/storage/cache-data.ts
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 어댑터 레이어 안에서만 변경했는가? (CLAUDE.md CRITICAL)
   - 삭제 대상 테이블 이름이 `cache-data.ts`에 **한 번도 문자열로 등장하지 않는가**?
   - `clearCacheData`와 `getCacheDataSize`가 같은 범위를 보는가?
   - `docs/persistence/lifecycle.md`(step 0)에 적힌 범위와 구현이 일치하는가?
   - TDD 순서를 지켰는가?
3. 결과에 따라 `phases/cache-clear-scope/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 최종 `KEEP_KEYS` 5개 목록·삭제 대상이 `db.ts`에서 온다는 사실·추가한 회귀 가드 테스트·**작업 4의 조사 결과(수동 모드 복구 경로 유무)** 를 명시하라. 다음 step(확인 모달 문구)이 이 요약만 보고 정확한 문구를 쓸 수 있어야 한다.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/storage/sqlite/db.ts`를 수정하지 마라. 이유: step 1에서 완료됐다. 여기서 다시 손대면 어느 step이 회귀를 냈는지 분리되지 않는다.
- `src/app/settings/CacheClearConfirm.tsx`를 수정하지 마라. 이유: 확인 모달 문구는 step 3의 범위다.
- `KEEP_KEYS`에 `trackingMode`·`dropEffect` 외의 키를 추가하지 마라. 이유: [[ADR-052]] 결정 1이 확정한 범위가 정확히 그 둘이다. 다른 키(예: `lastSelectedCharacter`)를 "설정처럼 보인다"는 이유로 넣으면 승인되지 않은 정책 변경이다.
- Preferences 삭제를 "KEEP_KEYS 제외 전부"에서 "삭제 목록 나열"로 바꾸지 마라. 이유: 새 키가 자동 포함되는 것이 이 쪽의 장점이고, 이번 이슈가 지적한 SQLite 쪽 문제가 정확히 그 반대(화이트리스트)로 생긴 것이다.
- 수동 모드 시드 로직(`features/tracking-mode/seed.ts` 등)을 새로 만들거나 고치지 마라. 이유: 작업 4는 **조사만** 하는 항목이다. 여기서 기능을 추가하면 이 step의 범위(저장소 삭제 범위)를 벗어난다.
- 기존 테스트를 깨뜨리지 마라(단, 3개 테이블 이름을 하드코딩하던 단언과 보존 키 관련 기대값은 새 정책에 맞춰 **의도적으로 갱신**한다).
