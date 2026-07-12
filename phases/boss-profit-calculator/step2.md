# Step 2: boss-profit-storage

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md`의 "멱등성" 서술(보스 수익 기록은 `(characterId, boss, difficulty, weekOf)` unique key로 upsert)
- `/docs/ADR.md`의 ADR-008(멱등성 원칙), ADR-003(SQLite 하이브리드)
- `src/storage/sqlite/db.ts` (이전 step에서 생성됨 — `getBossProfitDb()`와 `boss_profit_records` 스키마)
- `src/types/scheduler.ts`의 `BossCycle` 타입

## 작업

`src/storage/boss-profit.ts`를 작성하라. `boss_profit_records` 테이블에 대한 순수 CRUD 어댑터다 — 가격 계산(파티원 수 → 실수령액 공식)이나 어떤 보스가 처치됐는지 판단하는 로직은 여기 두지 않는다(그건 `features/boss-profit`의 몫).

```ts
export interface BossProfitRecord {
  ocid: string
  boss: string
  difficulty: string
  cycle: BossCycle
  periodKey: string
  partySize: number
  priceMeso: number
  payoutMeso: number
  recordedAt: string  // ISO 8601
}

export async function upsertBossProfitRecord(record: BossProfitRecord): Promise<void>
export async function getBossProfitRecords(ocids: string[], periodKeys: string[]): Promise<BossProfitRecord[]>
```

- `upsertBossProfitRecord`: `(ocid, boss, difficulty, periodKey)`를 unique key로 upsert한다(SQLite `INSERT ... ON CONFLICT(...) DO UPDATE SET ...` 문법 사용 — 같은 키로 여러 번 호출해도 레코드가 1건만 유지되고 최신 값으로 덮어써야 한다, ADR-008 멱등성). 정확한 커넥션 메서드 시그니처(`run`/`execute`/파라미터 바인딩 방식)는 `src/storage/sqlite/db.ts`가 반환하는 `SQLiteDBConnection` 타입 선언을 확인해 그대로 따르라.
- `getBossProfitRecords`: `ocid IN (...ocids)`이고 `period_key IN (...periodKeys)`인 레코드를 전부 조회해 `BossProfitRecord[]`로 반환한다. `ocids`나 `periodKeys`가 빈 배열이면 쿼리를 실행하지 않고 즉시 `[]`를 반환하라(불필요한 DB 호출 방지).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`storage/`에 배치, `features/*`는 이 모듈만 거쳐 접근)
   - ADR.md 기술 스택을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 단위 테스트에서 `src/storage/sqlite/db.ts`의 `getBossProfitDb`를 `vi.mock`으로 모킹해(실제 SQLite 없이) 다음을 검증하라: 동일 키로 두 번 upsert 시 두 번째 값으로 덮어써지는지(SQL 호출 파라미터로 검증), `getBossProfitRecords`가 빈 배열 입력 시 DB를 호출하지 않는지.
4. 결과에 따라 `phases/boss-profit-calculator/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 파일에 파티원 수→실수령액 계산 공식(`floor(priceMeso / partySize)`)을 넣지 마라. `priceMeso`·`payoutMeso`는 호출부(`features/boss-profit`)가 이미 계산해서 넘겨주는 값을 그대로 저장만 한다.
- `boss-crystal-prices.json`이나 `boss-matching.ts`를 이 파일에서 import하지 마라 — 레이어 분리 원칙(`storage/`는 게임 레퍼런스 데이터를 몰라야 함).
- 기존 테스트를 깨뜨리지 마라.
