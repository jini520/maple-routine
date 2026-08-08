# SQLite — `boss_profit.db`

`@capacitor-community/sqlite` 기반 단일 DB(`storage/sqlite/db.ts`). 보스 수익 관련 4개 테이블만 여기에 있고, 나머지 데이터는 모두 [Preferences](./preferences.md)다 — "복합키로 upsert/조회가 잦은 기록형 데이터"만 관계형으로 뒀다.

## 스키마

```mermaid
erDiagram
    boss_profit_records {
        TEXT ocid PK
        TEXT boss PK
        TEXT difficulty PK
        TEXT cycle
        TEXT period_key PK
        INTEGER party_size
        INTEGER price_meso
        INTEGER payout_meso
        TEXT recorded_at
        TEXT world
    }
    boss_party_settings {
        TEXT ocid PK
        TEXT boss PK
        TEXT difficulty PK
        INTEGER party_size
        TEXT updated_at
    }
    boss_profit_period_checks {
        TEXT ocid PK
        TEXT cycle PK
        TEXT period_key PK
        TEXT checked_at
    }
    boss_drop_records {
        TEXT ocid PK
        TEXT boss PK
        TEXT difficulty PK
        TEXT period_key PK
        INTEGER drop_index PK
        TEXT category
        TEXT item_name
        TEXT slot
        TEXT box_origin
        INTEGER ring_level
        INTEGER quantity
        TEXT recorded_at
    }
    boss_party_settings ||--o{ boss_profit_records : "파티원 수 기본값 시드"
    boss_profit_records ||--o{ boss_drop_records : "같은 (ocid, boss, difficulty, period_key)"
```

> FOREIGN KEY 제약은 실제로 걸려 있지 않다 — 위 관계는 앱 코드가 `(ocid, boss, difficulty)`(파티 설정) / `(ocid, boss, difficulty, period_key)`(드롭 기록)로 논리적으로 조인하는 것뿐이다(`features/boss-profit/store.ts`가 완료 감지 시 `boss_party_settings`를 먼저 조회해 `boss_profit_records`의 기본 파티원 수로 쓴다). 제약이 없으므로 **한쪽만 지우면 고아 행이 남는다** — 캐시 삭제가 네 테이블을 함께 비워야 하는 이유다([[ADR-052]]).

## 테이블별 역할

### `boss_profit_records` — 기간별 수익 기록
PK: `(ocid, boss, difficulty, period_key)`. 캐릭터가 특정 (보스, 난이도)를 특정 기간(`period_key`, 예: 주차)에 처치했을 때의 파티원 수·정가·실수령액 스냅샷.

- **자동 생성**: 사용자가 화면에 들어오지 않아도, 스케줄러 동기화 응답에서 `complete_flag: true`인 (ocid, boss, difficulty, periodKey) 조합을 처음 만나는 순간 즉시 upsert된다([[ADR-014]]).
- **로컬 전용**: Nexon API는 최근 14일치만 조회 가능하므로, 장기 히스토리는 이 테이블에만 존재한다 — 삭제하면 서버 재동기화로도 복구 불가.
- **파티원 수 기본값**: `boss_party_settings`에 같은 (ocid, boss, difficulty) 설정이 있으면 그 값을, 없으면 1(솔로)을 시딩한다([[ADR-019]]).
- **`world` = 기록 시점의 월드 스냅샷**([[ADR-069]] 결정 1, nullable). 월드 리프가 **과거 주의 결정석 귀속을 소급 이동**시키는 것을 막는다 — 전에는 화면이 라이브 캐시(`getCachedCharacterBasic`)의 월드를 썼다. `NULL`은 "월드 모름"이고 월드별 집계에서 조용히 빠진다([[ADR-054]] 결정 5). 나중에 추가된 컬럼이라 이미 만들어진 DB에는 `CREATE TABLE IF NOT EXISTS`가 손대지 않는다 — `db.ts`의 `ensureColumn`이 `PRAGMA table_info`로 확인하고 없을 때만 `ALTER TABLE ... ADD COLUMN` 한다(SQLite에 `ADD COLUMN IF NOT EXISTS`가 없다).
- **읽기 원천 규칙**: 기록이 있으면 `record.world`, 없으면(현재 기간의 미완료 placeholder) 캐시.

### `boss_party_settings` — 상시 파티 인원 설정
PK: `(ocid, boss, difficulty)`. "이 캐릭터는 이 보스를 항상 N인 파티로 잡는다"는 사용자 설정. 완료 여부·기간과 무관한 상시 값이며, 보스 스케줄러 화면의 파티 배지·솔로/파티 필터와 보스 수익 계산기가 공유한다.

- 삭제 API가 따로 없다 — 솔로로 되돌리려면 `party_size = 1`로 upsert한다("파티 관리" 설정과 솔로 취급이 값 레벨에서는 동일).

### `boss_profit_period_checks` — 기간 재조회 여부 마킹
PK: `(ocid, cycle, period_key)`. "이 캐릭터의 이 기간은 이미 (재)조회해서 로컬에 반영했다"는 마킹 전용 테이블 — 컬럼 자체에는 수익 정보가 없다.

- 보스 수익 화면의 기간 네비게이터가 과거로 이동할 때, 이 테이블에 체크 기록이 없는 기간만 `nexon/schedule`을 `date` 파라미터로 1회 재조회한다([[ADR-023]]). 한 번 체크되면 그 기간은 다시 재조회하지 않고 로컬 기록만 신뢰한다.

### `boss_drop_records` — 기간별 드롭 기록
PK: `(ocid, boss, difficulty, period_key, drop_index)`. [[ADR-038]]에서 도입했다. **PK에 난이도가 들어 있어 처치 난이도가 나중에 확정·변경되면 이관이 필요하다**([[ADR-069]] 결정 4 — 옛 난이도 키의 드롭을 확정 키로 옮기고 그 난이도에서 획득 불가한 항목은 삭제한다. 상세는 [../features/boss-profit.md](../features/boss-profit.md) "자동 기록"). 한 보스가 여러 드롭을 가지므로 `drop_index`로 **같은 (보스, 난이도, 기간)에 여러 행**이 들어간다 — 위 세 테이블처럼 조합당 1행이 아니다.

- **금액을 저장하지 않는다.** 나중에 재평가 가능한 구조(`category`·`item_name`·`slot`·`box_origin`·`ring_level`·`quantity`)만 담고, 시세가 바뀌어도 저장된 행을 고칠 필요가 없도록 표시 시점에 `src/data/`의 시세표로 환산한다. `slot`·`box_origin`·`ring_level`은 nullable — 해당 카테고리가 아닌 드롭에는 값이 없다.
- **⚠️ `recorded_at`은 "언제 먹었는가"가 아니다 — 감사 필드다**([[ADR-071]] 결정 2). `replaceBossDropRecords`가 DELETE→INSERT로 그룹을 통째로 교체하며 **그룹 전체 행에 호출 시점을 박고**, `pruneUnobtainableDrops` 정리와 난이도 확정 이관도 `now`로 덮는다. 그래서 같은 (보스, 난이도, 기간)에 드롭 하나를 더 추가하면 기존 드롭들의 `recorded_at`까지 오늘로 갱신된다. **드롭이 일어난 시점을 알아야 하면 `period_key`를 쓴다**(주간=리셋일 `YYYY-MM-DD`, 월간=`YYYY-MM`, 불변). 시간순 정렬도 `period_key DESC, drop_index`이고 `recorded_at DESC`는 과거 기간 재편집 한 번에 순서가 뒤집힌다.
- **고가 여부는 저장하지 않는다.** `isValuableDrop`(`lib/valuable-drops`)은 표시 시점 판정이라, 이 테이블에는 **선택 등록 가능한 모든 아이템**이 구분 없이 들어 있다 — 드롭 히스토리가 별도 테이블 없이 이 테이블만 읽는 근거다([[ADR-071]] 결정 1).
- **`boss_profit_records`와 짝을 이룬다**(같은 `(ocid, boss, difficulty, period_key)`). FK가 없으므로 수익 기록만 지우고 이걸 남기면 고아 행이 되고, 같은 보스를 같은 기간에 다시 처치하면 예전 드롭이 되살아나 붙는다([[ADR-052]]).

## 새 테이블을 추가할 때

**`storage/sqlite/db.ts`의 테이블 정의 배열(`[{ name, createSql }]`)에만 넣으면 스키마 생성·캐시 삭제 범위·용량 계산에 자동 반영된다** — 삭제 목록을 따로 관리하는 곳은 없다([[ADR-052]] 결정 2). `openBossProfitDb()`의 `CREATE TABLE` 실행과 `storage/cache-data.ts`의 `DELETE FROM`/용량 합산이 모두 이 배열 하나를 본다. 자세한 삭제 범위는 [lifecycle.md](./lifecycle.md)의 "삭제 범위: 연결 해제 vs 캐시 데이터 삭제" 참고.

> 이 규칙이 생기기 전에는 `cache-data.ts`가 테이블 이름을 하드코딩한 별도 목록을 들고 있어, 나중에 추가된 `boss_drop_records`가 거기 빠진 채로 남았다(이 문서에도 같은 누락이 있었다).

## 커넥션 라이프사이클과 운영상 주의사항

`getBossProfitDb()`가 모듈 스코프에서 커넥션을 싱글턴으로 캐싱한다(`storage/sqlite/db.ts`). 아래 두 시점 모두 **JS 컨텍스트를 파괴하고 리로드**하는 이벤트라, 리로드 직전에 반드시 `closeBossProfitDb()`로 커넥션을 먼저 정상 종료해야 한다 — 그러지 않으면 네이티브 쪽에 stale 커넥션이 남아 리로드 후 첫 쿼리가 응답 없이 멈춘다(앱 업데이트 직후 과거 수익 데이터가 안 불러와지는 증상으로 2026-07-17 실사용자 보고, `storage/sqlite/db.ts`의 `closeBossProfitDb` 주석 참고).

```mermaid
sequenceDiagram
    participant UI as 화면(설정/OTA 프롬프트)
    participant DB as storage/sqlite/db.ts
    participant Native as 네이티브 SQLite 플러그인

    UI->>DB: closeBossProfitDb()
    DB->>Native: closeConnection(boss_profit)
    UI->>UI: CapacitorUpdater.set() 또는 window.location.reload()
    Note over UI: JS 컨텍스트 파괴·재로드
    UI->>DB: getBossProfitDb() (다음 쿼리가 최초 호출)
    DB->>Native: isConnection() 확인 후 없으면 createConnection + open
    DB->>Native: CREATE TABLE IF NOT EXISTS × 4 + 마이그레이션 UPDATE 실행
```

이 패턴을 쓰는 두 곳:
- `native/live-update.ts`의 `applyDownloadedLiveUpdate()` — OTA 번들 적용 직전
- `app/settings/CacheDataSection.tsx`의 `handleClear()` — 캐시 데이터 삭제 직후 리로드 직전

**닫기에는 5초 상한이 있고 여전히 던지지 않는다** ([[ADR-117]] 결정 5, 2026-08-08) — 여는 쪽 `withOpenTimeout`(10초)과 대칭이되 더 짧다(닫기는 파일 생성·마이그레이션이 없어 정상이면 수 ms). 상한이 없던 동안 이 호출은 **리로드 앞을 막는 유일한 맨몸 대기**였고, iOS 실기기 SQLite 무응답 전례가 둘이나 있는 상태에서(위 [[ADR-050]] 결정 2 · [[ADR-008]] 2026-07-17 정정) 그대로 매달리면 리로드에 도달하지 못한다. **타임아웃이 바꾸는 것은 *"실패로 끝난다"* 가 아니라 *"끝난다"*** 이고, 실패·타임아웃은 지금처럼 삼킨다(곧 리로드될 것이고 `openBossProfitDb` 의 stale 감지가 최후 폴백으로 남는다).

**두 곳 모두 커버(스플래시)보다 닫기가 먼저다** ([[ADR-117]] 결정 1·8) — 커버를 먼저 올리면 닫기가 매달리는 동안 사용자가 브랜드색 화면에 갇히고 iOS 에서는 터치까지 죽는다(이슈 #175).

### 예기치 않은 리로드 — 손으로 배선한 두 곳으로는 못 막는다 ([[ADR-050]])

위 두 곳은 **우리가 리로드를 일으키는** 경우다. 그 밖에 앱이 통제할 수 없는 리로드 경로가 있고, 거기엔 `closeBossProfitDb()`를 끼워 넣을 자리가 없다.

- **탭 링크의 기본 동작 누출** — iOS WKWebView가 두 손가락 동시 탭에서 드물게 합성하는 클릭이 React 이벤트 시스템을 타지 않아 `<a href>`가 실제 문서 네비게이션이 됐다(2026-07-28 실기기 계측: `click` → `PAGEHIDE`). `App.tsx`의 탭바 캡처 인터셉터로 차단했다([[ADR-050]] 결정 1).
- **WebKit 콘텐츠 프로세스 사망** — Capacitor iOS(`WebViewDelegationHandler.swift`)가 **자동으로 `webView.reload()`** 한다. 앱 코드로 개입할 수 없다.

그래서 커넥션 쪽에도 방어가 있어야 한다 — `openBossProfitDb()`는 **타임아웃과 경쟁**시켜, 커넥션이 에러 없이 멈춰도 `dbPromise`를 비우고 다음 호출이 처음부터 다시 열게 한다([[ADR-050]] 결정 2). 이 방어가 없으면 죽은 커넥션이 `dbPromise`에 영구 캐시되어 **앱을 재시작할 때까지** 모든 조회가 실패한다. 단 네이티브 브릿지 큐 자체가 막힌 경우엔 재시도 호출도 같은 큐에 서므로 회복되지 않는다.

**조회 실패를 "기록 없음"으로 오인하지 말 것** — `features/boss-profit/store.ts`의 `withSqliteFallback`은 타임아웃을 빈 결과로 바꾸는데, 그 값을 "기록이 없다"로 읽으면 자동 기록이 `party_size = 1`로 **사용자가 저장한 값을 덮어쓴다**. `getBossProfitRecords` 조회는 폴백을 `null`로 두어 실패와 빈 결과를 구분하고, 실패면 자동 기록을 건너뛴다([[ADR-050]] 결정 3).

## 마이그레이션

`openBossProfitDb()`가 커넥션을 열 때마다(앱 실행마다) 다음 두 UPDATE 문을 함께 실행한다. 조건에 걸리는 행이 이미 없으면 매번 실행해도 안전한 no-op이다.

```sql
UPDATE boss_party_settings SET boss = '시즌 보스 메이린' WHERE boss = '메이린';
UPDATE boss_profit_records SET boss = '시즌 보스 메이린' WHERE boss = '메이린';
```

메이린의 표시명을 Nexon API 응답(`content_name: "시즌 보스 메이린"`)과 통일하며 보스 식별 키가 바뀐 데이터를 옛 키에서 새 키로 옮겨, 기존에 저장된 파티 설정·수익 기록이 고아 데이터가 되지 않게 한다(2026-07-22).

## 웹 플랫폼

`Capacitor.getPlatform() === 'web'`이면 `connection.initWebStore()`를 먼저 호출해 웹 스토리지 백엔드를 초기화한다(개발 서버 `npm run dev`에서 SQLite를 흉내 내는 경로). 실기기(iOS/Android)에서는 이 호출을 건너뛰고 네이티브 SQLite를 바로 연다.
