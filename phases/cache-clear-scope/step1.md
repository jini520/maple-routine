# Step 1: table-registry

`src/storage/sqlite/db.ts`의 테이블 정의를 **배열 하나로 모으고 이름 목록을 export**해, 삭제 대상 테이블 목록의 단일 진실 공급원을 만든다([[ADR-052]] 결정 2). 이 step은 **동작을 전혀 바꾸지 않는다** — `cache-data.ts`가 그 export를 쓰는 것은 step 2다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스)
- `/docs/ADR.md` (슬림 인덱스 — **전체를 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-052.md` — **step 0에서 작성된 이번 작업의 결정.** 결정 2가 이 step의 규칙이다.
- `/docs/persistence/sqlite.md` — step 0에서 갱신된 스키마 문서(4개 테이블 + "새 테이블은 정의 배열에만 추가" 운영 규칙).
- `/src/storage/sqlite/db.ts` — **유일한 수정 대상.** 현재 구조:
  - CREATE 문 4개가 각각 별도 상수(`CREATE_BOSS_PROFIT_RECORDS_TABLE` `:7-20`, `CREATE_BOSS_PARTY_SETTINGS_TABLE` `:22-31`, `CREATE_BOSS_PROFIT_PERIOD_CHECKS_TABLE` `:33-41`, `CREATE_BOSS_DROP_RECORDS_TABLE` `:45-61`)
  - 메이린 보스 키 마이그레이션 2개(`:67-72`)는 CREATE와 성격이 다른 별개 상수
  - `openBossProfitDb`(`:84-110`)가 `db.open()` 후 CREATE 4개 → 마이그레이션 2개 순서로 `db.execute` 한다(`:102-107`)
  - 그 아래에 `withOpenTimeout`·`getBossProfitDb`·`closeBossProfitDb` 등 커넥션 라이프사이클 코드가 있다([[ADR-050]])
- `/src/storage/sqlite/__tests__/db.test.ts` — 갱신 대상. `@capacitor/core`·`@capacitor-community/sqlite`를 모킹하고 `dbExecuteMock`으로 실행된 SQL을 검사하는 구조다.

## 작업

### 1. 테스트 먼저 (TDD — CLAUDE.md CRITICAL)

`src/storage/sqlite/__tests__/db.test.ts`에 **회귀 가드 테스트**를 추가한다(구현 전에 작성해 실패를 확인하라).

- **`db.ts` 소스 파일을 직접 읽어** 정규식으로 `CREATE TABLE IF NOT EXISTS <이름>` 을 전부 뽑고, 그 집합이 export된 테이블 이름 배열과 **정확히 일치**하는지 단언한다.
  - 소스는 `node:fs`의 `readFileSync`로 읽는다(경로는 이 테스트 파일 기준 상대 경로 또는 `process.cwd()` 기준 `src/storage/sqlite/db.ts`).
  - 이 테스트의 목적은 "누군가 CREATE 문을 추가하고 배열에 넣는 걸 잊는 것"을 잡는 것이다. 배열을 순회해 생성하도록 바꾸면 구조적으로 그런 일이 어려워지지만, 별도 `db.execute('CREATE TABLE ...')`를 직접 끼워 넣는 경우까지 막기 위한 안전망이다.
  - 실패 메시지에 **어느 테이블이 누락됐는지**가 드러나게 단언하라(집합 비교 시 `expect(sorted).toEqual(sorted)` 형태면 충분하다).
- 기존 테스트("스키마 생성 SQL이 실행된다" 류)가 개별 상수명을 참조하고 있으면 새 구조에 맞게 갱신하되, **어떤 SQL이 어떤 순서로 실행되는지에 대한 단언은 유지**하라.

### 2. `src/storage/sqlite/db.ts` 구조 변경

CREATE 문 4개를 정의 배열 하나로 모으고, 이름 배열을 export한다.

```ts
// 시그니처 예시 — 구현 세부는 재량이나 아래 형태를 벗어나지 마라
const TABLE_DEFINITIONS = [
  { name: 'boss_profit_records', createSql: `CREATE TABLE IF NOT EXISTS boss_profit_records (...)` },
  { name: 'boss_party_settings', createSql: `...` },
  { name: 'boss_profit_period_checks', createSql: `...` },
  { name: 'boss_drop_records', createSql: `...` },
] as const

// 캐시 데이터 삭제·용량 계산이 이 목록을 단일 진실 공급원으로 쓴다(ADR-052 결정 2).
export const BOSS_PROFIT_TABLE_NAMES: readonly string[] = TABLE_DEFINITIONS.map((table) => table.name)
```

`openBossProfitDb` 안에서는 CREATE 4줄을 배열 순회로 바꾼다:

```ts
for (const table of TABLE_DEFINITIONS) {
  await db.execute(table.createSql)
}
```

**이 step에서 반드시 지켜야 할 규칙:**

- **각 CREATE 문의 SQL 본문(컬럼·타입·NOT NULL·PRIMARY KEY)을 한 글자도 바꾸지 마라.** 기존 설치본의 DB 파일과 스키마가 달라지면 데이터 유실·쿼리 실패로 이어진다. 상수 위치만 옮기는 순수 이동이어야 한다.
- **실행 순서를 유지하라** — CREATE 4개(현재와 같은 순서: records → party_settings → period_checks → drop_records) 다음에 메이린 마이그레이션 2개.
- **메이린 마이그레이션 2개(`:67-72`)는 배열에 넣지 마라.** 성격이 다르다(테이블 생성이 아니라 데이터 이관 UPDATE). 지금처럼 별도 상수로 두고 CREATE 루프 뒤에 실행한다.
- `db.ts:43-44`의 `boss_drop_records` 설명 주석([[ADR-038]] 근거)은 배열 항목 옆으로 옮겨 보존하라.
- 커넥션 라이프사이클 코드(`withOpenTimeout`·`getBossProfitDb`·`closeBossProfitDb`, [[ADR-050]] 자가복구)는 **손대지 마라.**

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 전체 테스트 통과(회귀 가드 포함)
npm run lint    # 경고 0

# export가 생겼는지 확인
grep -n "BOSS_PROFIT_TABLE_NAMES" src/storage/sqlite/db.ts

# 스키마가 그대로인지 확인 — 4개 CREATE 문이 모두 남아 있어야 한다
grep -c "CREATE TABLE IF NOT EXISTS" src/storage/sqlite/db.ts   # 4가 나와야 한다
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 어댑터 레이어 안에서만 변경했는가? (CLAUDE.md CRITICAL — `features/*`가 SQLite에 직접 접근하지 않는 구조 유지)
   - 각 테이블의 컬럼·PK가 변경 전과 **완전히 동일**한가? (`git diff`로 SQL 본문에 실질 변경이 없는지 직접 확인하라)
   - CREATE → 마이그레이션 실행 순서가 유지됐는가?
   - [[ADR-050]] 커넥션 자가복구 로직을 건드리지 않았는가?
3. 결과에 따라 `phases/cache-clear-scope/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 **export한 심볼명(`BOSS_PROFIT_TABLE_NAMES`)과 그 import 경로(`src/storage/sqlite/db.ts`)**, 회귀 가드 테스트 위치, "동작 불변·`cache-data.ts`는 아직 하드코딩 목록 사용 중(step 2 범위)"를 명시하라.
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/storage/cache-data.ts`를 건드리지 마라. 이유: 이 export를 소비하는 것은 step 2의 범위다. 한 step에서 공급자와 소비자를 동시에 바꾸면 회귀 원인이 분리되지 않는다.
- CREATE 문의 SQL 본문을 "정리"·"포맷팅"하지 마라. 이유: 기존 설치본 DB와의 스키마 동일성이 유일한 안전장치다. 공백·줄바꿈 정도는 무해하지만 컬럼·제약·PK를 건드리면 실기기에서 데이터가 깨진다.
- 메이린 보스 키 마이그레이션(`MIGRATE_MEIRIN_*`)을 테이블 정의 배열에 넣지 마라. 이유: 테이블 생성이 아니라 데이터 UPDATE다. 배열에 섞이면 `BOSS_PROFIT_TABLE_NAMES`에 테이블이 아닌 것이 들어가 캐시 삭제가 `DELETE FROM <없는 테이블>`을 실행하게 된다.
- `DB_NAME`이나 `createConnection`의 버전 인자(`db.ts:99`의 `1`)를 바꾸지 마라. 이유: 기존 설치본이 열지 못하게 된다.
- 새 테이블을 추가하지 마라. 이유: 이 step은 기존 4개를 재구성하는 순수 리팩터링이다.
- 기존 테스트를 깨뜨리지 마라(단, 개별 CREATE 상수명을 직접 참조하던 단언은 새 구조에 맞춰 **의도적으로 갱신**한다).
