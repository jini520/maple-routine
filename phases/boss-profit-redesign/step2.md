# Step 2: backfill-tracking

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md`의 "ADR-023" 결정 4번(로컬 우선 캐싱 — 저장된 기록이 없는 과거 기간으로 최초 이동했을 때만 예외적으로 1회 재조회하고, 이후로는 다시 조회하지 않는다)
- `/docs/ARCHITECTURE.md`의 "디렉토리 구조" 중 `storage/` 항목(로컬 저장소 접근 레이어 원칙)
- `src/storage/sqlite/db.ts` (이번 step에서 테이블을 추가할 파일 — `CREATE_BOSS_PROFIT_RECORDS_TABLE`/`CREATE_BOSS_PARTY_SETTINGS_TABLE` 상수와 `openBossProfitDb`에서 두 테이블을 함께 생성하는 패턴을 그대로 따른다. 같은 DB 커넥션을 공유한다 — 새 DB를 만들지 않는다)
- `src/storage/sqlite/__tests__/db.test.ts` (기존 테스트 스타일)
- `src/storage/boss-party-settings.ts` (이번 step에서 새로 만들 모듈의 참고 템플릿 — `(ocid, boss, difficulty)` PK 대신 `(ocid, cycle, period_key)` PK를 쓴다는 점만 다르고, `getBossProfitDb()`를 가져와 `db.run`/`db.query`로 접근하는 구조는 동일하게 따른다)
- `src/storage/__tests__/boss-party-settings.test.ts` (테스트 스타일 참고)

## 작업

### 1. `src/storage/sqlite/db.ts`에 테이블 추가

```ts
const CREATE_BOSS_PROFIT_PERIOD_CHECKS_TABLE = `
  CREATE TABLE IF NOT EXISTS boss_profit_period_checks (
    ocid TEXT NOT NULL,
    cycle TEXT NOT NULL,
    period_key TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    PRIMARY KEY (ocid, cycle, period_key)
  )
`
```

`openBossProfitDb` 안에서 기존 `db.execute(CREATE_BOSS_PROFIT_RECORDS_TABLE)`/`db.execute(CREATE_BOSS_PARTY_SETTINGS_TABLE)` 바로 아래에 `db.execute(CREATE_BOSS_PROFIT_PERIOD_CHECKS_TABLE)`를 추가한다.

이 테이블의 목적: 어떤 (캐릭터, 주기, 기간)을 스케줄러 API의 `date` 파라미터로 이미 조회해봤는지 기록한다. `boss_profit_records`는 "완료한 보스"만 행으로 남기 때문에, 조회했지만 그 기간에 완료한 보스가 0건인 경우와 애초에 한 번도 조회 안 한 경우를 구분할 수 없다 — 이 테이블이 그 구분을 담당한다.

### 2. `src/storage/boss-profit-period-checks.ts` 신규 생성

```ts
export async function isPeriodChecked(
  ocid: string,
  cycle: BossCycle,
  periodKey: string,
): Promise<boolean>

export async function markPeriodChecked(
  ocid: string,
  cycle: BossCycle,
  periodKey: string,
  checkedAt: string, // ISO 8601
): Promise<void>
```

- `boss-party-settings.ts`와 동일하게 `getBossProfitDb()`로 커넥션을 얻고 `db.run`(INSERT, `ON CONFLICT(...) DO UPDATE`로 `checked_at` 갱신)·`db.query`(SELECT 존재 여부)를 직접 쓴다. `boss-profit.ts`처럼 별도 도메인 레코드 타입을 export할 필요는 없다 — 이 모듈은 boolean 존재 여부만 다룬다.
- `isPeriodChecked`는 결과 행이 있으면 `true`, 없으면 `false`를 반환한다(값 자체는 안 쓴다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `storage/` 레이어에만 변경이 있는가?
   - 새 DB를 만들지 않고 기존 `boss_profit` DB(`getBossProfitDb()`)를 재사용했는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. `src/storage/sqlite/__tests__/db.test.ts`에 `dbExecuteMock`이 `'CREATE TABLE IF NOT EXISTS boss_profit_period_checks'`를 포함한 SQL로 호출됐는지 검증하는 케이스를 추가한다.
4. `src/storage/__tests__/boss-profit-period-checks.test.ts`를 신규 작성해 다음을 검증한다(`src/storage/__tests__/boss-party-settings.test.ts`의 모킹 패턴 그대로):
   - 저장 전 `isPeriodChecked('ocid-1', 'weekly', '2026-06-04')`는 `false`
   - `markPeriodChecked('ocid-1', 'weekly', '2026-06-04', '2026-07-14T00:00:00.000Z')` 호출 후 `isPeriodChecked`는 `true`
   - 같은 `ocid`라도 다른 `periodKey`나 다른 `cycle`은 서로 독립이다(하나 체크해도 다른 조합은 여전히 `false`)
   - 같은 키로 두 번 `markPeriodChecked`를 호출해도 에러 없이 `ON CONFLICT DO UPDATE`로 처리된다
5. 결과에 따라 `phases/boss-profit-redesign/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요(API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- `boss_profit_records`/`boss_party_settings` 테이블 스키마나 관련 파일(`boss-profit.ts`, `boss-party-settings.ts`)을 수정하지 마라 — 이 step은 새 테이블 추가만 한다.
- 새 SQLite DB(`getBossProfitDb` 외의 커넥션)를 만들지 마라.
- `features/`·`app/`·`nexon/`·`lib/` 어떤 파일도 건드리지 마라(다음 step들에서 다룬다).
- 기존 테스트를 깨뜨리지 마라.
