# Step 0: sqlite-boss-party-settings

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `storage/` 디렉토리 설명과 ADR-019 관련 서술
- `/docs/ADR.md` — ADR-019 "파티 관리" 전체(결정 1~8, 이유, 트레이드오프, 미확정 항목) 읽을 것
- `/src/storage/sqlite/db.ts` — 기존 `boss_profit_records` 테이블을 어떻게 생성·연결하는지 그대로 따라야 할 패턴
- `/src/storage/sqlite/__tests__/db.test.ts` — 기존 테스트 컨벤션(모킹 방식) 참고

이전 step에서 만들어진 코드는 없다(이 phase의 첫 step). 위 파일을 꼼꼼히 읽고 기존 SQLite 연결 방식과 테이블 생성 컨벤션을 이해한 뒤 작업하라.

## 작업

ADR-019 결정 1: 신규 SQLite 테이블 `boss_party_settings`를 `storage/boss-profit`(`boss_profit_records`)과 **동일한 DB(`boss_profit`), 동일한 커넥션**에 추가한다. 완료(clear) 여부·주차와 무관한 **상시 설정**이며 `boss_profit_records`(주차별 완료 기록)와는 별도 테이블이다.

`src/storage/sqlite/db.ts`를 수정한다:

1. 기존 `CREATE_BOSS_PROFIT_RECORDS_TABLE` 상수 옆에 새 상수를 추가한다:
   ```sql
   CREATE TABLE IF NOT EXISTS boss_party_settings (
     ocid TEXT NOT NULL,
     boss TEXT NOT NULL,
     difficulty TEXT NOT NULL,
     party_size INTEGER NOT NULL,
     updated_at TEXT NOT NULL,
     PRIMARY KEY (ocid, boss, difficulty)
   )
   ```
   - `party_size`: ADR-019 결정 3에 따라 이 테이블에 행이 없으면 솔로(1인)로 취급한다. 즉 "미설정" 상태는 행이 아예 없는 것으로 표현하고, 이 테이블에는 항상 실제 파티원 수(1 이상)만 저장된다.
   - `PRIMARY KEY (ocid, boss, difficulty)` — 캐릭터+보스+난이도 단위로 유일해야 한다(ADR-019 결정 2, 기존 `boss_profit_records`·`boss-crystal-prices.json`과 동일한 키 구성).
2. `openBossProfitDb()` 함수 안에서 기존 `await db.execute(CREATE_BOSS_PROFIT_RECORDS_TABLE)` 호출 바로 다음 줄에 `await db.execute(CREATE_BOSS_PARTY_SETTINGS_TABLE)`을 추가한다. 별도 커넥션이나 별도 DB 이름을 만들지 않는다 — 기존 `getBossProfitDb()` 싱글턴 하나로 두 테이블을 모두 커버해야 한다.
3. 이 step에서는 CRUD 어댑터(`storage/boss-party-settings.ts`)를 만들지 않는다 — 다음 step(`boss-party-settings-storage`)의 범위다. 이 step은 오직 테이블 스키마 생성까지만 다룬다.

### 테스트 (TDD)

`src/storage/sqlite/__tests__/db.test.ts`에 기존 `describe('getBossProfitDb', ...)` 블록 안에 테스트를 추가(또는 새 `it` 블록)해서 `dbExecuteMock`이 `boss_party_settings` 테이블 생성 SQL로도 호출되는지 검증한다. 기존 테스트의 패턴(`expect(dbExecuteMock).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS boss_profit_records'))`)을 그대로 따라 `boss_party_settings`에 대해서도 동일하게 검증하는 assertion을 추가한다. 테스트를 먼저 작성하고 실패를 확인한 뒤, 구현으로 통과시켜라(CLAUDE.md TDD 규칙).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과 (기존 db.test.ts 포함)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/sqlite/db.ts` 안에서만 스키마 변경이 이루어졌는가(다른 레이어 파일을 건드리지 않았는가)?
   - ADR-006 CRITICAL 규칙(게임 레퍼런스 수치 데이터 임의 하드코딩 금지)을 위반하지 않았는가 — 이 step은 스키마만 다루므로 해당 사항 없음을 확인만 한다.
   - 기존 `boss_profit_records` 테이블 생성/커넥션 로직을 건드리지 않았는가?
3. 결과에 따라 `phases/boss-party-management/index.json`의 `step: 0`을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `boss_profit_records` 테이블 스키마나 기존 CRUD 어댑터(`storage/boss-profit.ts`)를 수정하지 마라. 이유: 이 step은 순수 추가(additive) 스키마 변경만 다루며, 기존 보스 수익 기록 기능에 영향을 주면 안 된다.
- 새 DB 이름이나 새 커넥션을 만들지 마라. 이유: ADR-019는 명시적으로 기존 `boss_profit` DB를 재사용하도록 결정했다 — DB를 분리하면 트랜잭션 경계가 늘어나고 앱 시작 시 커넥션 오픈 비용도 늘어난다.
- `storage/boss-party-settings.ts` CRUD 어댑터를 이 step에서 만들지 마라. 이유: 다음 step의 범위이며, 한 step에서 한 레이어만 다루는 원칙을 지키기 위함이다.
- 기존 테스트를 깨뜨리지 마라.
