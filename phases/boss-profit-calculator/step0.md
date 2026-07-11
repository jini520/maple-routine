# Step 0: sqlite-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` (특히 "저장소 접근" 관련 서술, `storage/` 레이어 설명)
- `/docs/ADR.md`의 ADR-003 (SQLite vs Preferences 하이브리드 결정, 특히 "진행 상황 — SQLite 도입 시작 (2026-07-11)" 항목)
- `src/storage/keys.ts`, `src/storage/scheduler-cache.ts` — 기존 Preferences 기반 storage 어댑터가 어떤 패턴(export 함수 형태, 에러 전파 방식)을 쓰는지 참고
- `src/native/notifications.ts`, `src/native/hunting-timer/hunting-timer.ts`와 그 테스트(`__tests__`) — Capacitor 플러그인을 어떻게 `vi.mock`으로 모킹해 단위 테스트하는지 참고

## 작업

이번 phase는 "주간 보스 수익 계산기" 1차 구현이다. 처치 기록을 캐릭터+보스+난이도+기간 단위로 로컬에 저장해야 하는데, 이 데이터는 실제 쿼리(조건 조회·upsert)가 필요해 기존 Preferences 방식 대신 `@capacitor-community/sqlite`를 새로 도입한다(ADR-003 하이브리드 결정). 이번 step은 순수 인프라 셋업만 다룬다 — 보스 수익 기록의 CRUD 함수는 다음 step(`boss-profit-storage`)에서 작성한다.

1. **패키지 설치**: `@capacitor-community/sqlite`와 웹 환경(Vite dev server, 브라우저) 테스트를 위한 `jeep-sqlite`를 설치하라.

2. **웹 폴리필 연결**: `@capacitor-community/sqlite`는 네이티브(Android/iOS)에서는 실제 SQLite를, 웹에서는 `jeep-sqlite`(IndexedDB 기반 웹 컴포넌트)를 통해 동작한다. `jeep-sqlite`의 공식 웹 사용 가이드(설치된 `node_modules/jeep-sqlite`의 README·타입 선언 확인)에 따라:
   - `index.html`(또는 `src/main.tsx`)에 `jeep-sqlite` 커스텀 엘리먼트를 등록하고 DOM에 붙여라.
   - 빌드 시 필요한 정적 자산(wasm 등)이 `npm run build` 결과물에 포함되도록 처리하라(Vite `public/` 디렉터리 활용 또는 적절한 빌드 설정). `npm run dev`/`npm run build` 둘 다에서 자산 경로가 깨지지 않아야 한다.

3. **커넥션 모듈**: `src/storage/sqlite/db.ts`를 작성하라.
   ```ts
   export function getBossProfitDb(): Promise<SQLiteDBConnection>
   ```
   - 앱 전체에서 단 하나의 커넥션만 열고 재사용하는 싱글턴으로 구현하라(모듈 스코프 캐싱).
   - 웹 플랫폼(`Capacitor.getPlatform() === 'web'`)에서는 커넥션을 열기 전에 `jeep-sqlite` 웹 스토어 초기화를 먼저 완료해야 한다. 네이티브 플랫폼은 초기화 없이 바로 연다.
   - 커넥션을 연 뒤, 아래 스키마로 `boss_profit_records` 테이블을 `CREATE TABLE IF NOT EXISTS`로 생성하라(멱등 — 여러 번 호출해도 안전해야 함):
     ```sql
     CREATE TABLE IF NOT EXISTS boss_profit_records (
       ocid TEXT NOT NULL,
       boss TEXT NOT NULL,
       difficulty TEXT NOT NULL,
       cycle TEXT NOT NULL,
       period_key TEXT NOT NULL,
       party_size INTEGER NOT NULL,
       price_meso INTEGER NOT NULL,
       payout_meso INTEGER NOT NULL,
       recorded_at TEXT NOT NULL,
       PRIMARY KEY (ocid, boss, difficulty, period_key)
     )
     ```
   - 정확한 `@capacitor-community/sqlite` 메서드 시그니처(`createConnection`/`open`/`execute` 등)는 설치된 패키지의 타입 선언(`node_modules/@capacitor-community/sqlite/dist/esm/definitions.d.ts` 등)에서 확인하고 그대로 따르라 — 버전마다 API가 조금씩 다를 수 있으니 추측해서 쓰지 마라.

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음
npm test        # 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ARCHITECTURE.md 디렉토리 구조를 따르는가? (`storage/` 하위에 배치)
   - ADR.md ADR-003 결정(하이브리드 도입 시점·범위)을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가? (features/*가 아니라 storage/ 레이어에 배치했는가)
3. `npm run dev`를 실행해 브라우저에서 앱을 열고 콘솔에 `jeep-sqlite`/SQLite 관련 에러가 없는지 육안으로 확인한다(자동화된 AC로 잡을 수 없는 런타임 초기화 문제이므로 수동 확인 필수).
4. 결과에 따라 `phases/boss-profit-calculator/index.json`의 해당 step을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "산출물 한 줄 요약"`
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러 내용"`
   - 사용자 개입 필요 (API 키, 외부 인증, 수동 설정 등) → `"status": "blocked"`, `"blocked_reason": "구체적 사유"` 후 즉시 중단

## 금지사항

- 이 step에서 `boss_profit_records`에 대한 CRUD 쿼리 함수(insert/upsert/select)를 작성하지 마라. 테이블 생성까지만 다루고 나머지는 다음 step(`boss-profit-storage`) 몫이다.
- `getBossProfitDb()`를 호출할 때마다 새 커넥션을 여는 방식으로 구현하지 마라. 이유: `@capacitor-community/sqlite`는 같은 이름의 커넥션이 이미 열려 있는 상태에서 다시 열려고 하면 에러를 던진다.
- 기존 `storage/api-key.ts`·`storage/scheduler-cache.ts`·`storage/character-selection.ts`(Preferences 기반)를 SQLite로 마이그레이션하지 마라. ADR-003 하이브리드 결정에 따라 이 파일들은 계속 Preferences를 쓴다.
- 기존 테스트를 깨뜨리지 마라.
