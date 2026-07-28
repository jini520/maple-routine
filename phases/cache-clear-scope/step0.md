# Step 0: docs-policy

이 phase는 **이슈 #63 — "캐시 데이터 삭제 범위 보완 — `boss_drop_records` 누락 + 목록 하드코딩"** 을 구현한다. 이 step은 CLAUDE.md의 docs-first CRITICAL 규칙에 따라 **문서만** 갱신한다. 코드는 step 1~3에서 바꾼다.

## 배경 (이 step이 필요한 이유)

`src/storage/cache-data.ts`의 캐시 데이터 삭제는 SQLite 쪽만 **하드코딩된 화이트리스트**다.

```js
const CLEARED_TABLES = ['boss_profit_records', 'boss_party_settings', 'boss_profit_period_checks']
```

그런데 `src/storage/sqlite/db.ts`가 만드는 테이블은 **4개**다 — [[ADR-038]]에서 나중에 추가된 `boss_drop_records`(`db.ts:45-61`, 생성은 `:105`)가 목록에서 빠졌다. 결과:

- "캐시 데이터 삭제"를 해도 **드롭 기록이 남는다.**
- `getCacheDataSize()`도 같은 목록을 순회하므로 **표시 용량이 실제보다 작다.**
- 더 나쁜 조합 — 수익 기록(`boss_profit_records`)은 지워지고 드롭 기록만 살아남으면 **참조 대상 없는 고아 드롭 행**이 된다. 드롭은 `(ocid, boss, difficulty, period_key)`로 저장되므로 같은 캐릭터·보스를 다시 처치하면 예전 드롭이 되살아나 붙는다.

구조적 원인은 **Preferences 쪽은 "KEEP_KEYS 빼고 전부"라 새 키가 자동 포함되는데, SQLite 쪽만 화이트리스트**라는 비대칭이다. 테이블이 늘 때마다 사람이 `db.ts`와 `cache-data.ts` 두 파일을 함께 고쳐야 하는데 그 연결이 코드에 없다.

여기에 더해 **확인 모달 문구가 실제 범위와 어긋난다** — `trackingMode`·`dropEffect`가 `KEEP_KEYS`에 없어 실제로는 삭제되는데 안내에 없다.

## 사용자가 확정한 결정 (이 phase 전체의 전제)

1. **`trackingMode`·`dropEffect`를 `KEEP_KEYS`에 추가해 보존한다.** 둘 다 캐시가 아니라 사용자 취향 설정이고, `theme`은 이미 보존 대상인데 이 둘만 지워지는 것은 일관성이 없다. [[ADR-035]]가 "캐시 삭제 개편과 함께 정하겠다"며 보류했던 결정을 여기서 해소한다.
2. **테이블 목록의 단일 진실 공급원은 `db.ts`의 테이블 정의 배열 하나**로 한다. `db.ts`가 `[{ name, createSql }]` 배열 하나를 갖고 `openBossProfitDb`가 그걸 순회하며, 이름 배열을 export해 `cache-data.ts`가 import한다. 목록이 코드상 하나뿐이라 구조적으로 drift가 불가능해진다. (`sqlite_master` 동적 조회는 채택하지 않았다.)

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/README.md` (문서 인덱스 — **저장 스키마 변경은 `persistence/` 문서가 대상**이라는 안내를 확인하라)
- `/docs/ADR.md` (슬림 인덱스 — 새 ADR 한 줄을 여기 추가한다. **ADR 전문을 통째로 컨텍스트에 올리지 말 것**)
- `/docs/adr/ADR-035.md` — 마지막 트레이드오프 문단에 "`trackingMode`의 캐시 삭제 시 보존 여부는 **보류**한다"가 명시돼 있다. 이번에 해소된다.
- `/docs/persistence/README.md` — 저장 매체별 지도. "인증/설정" 분류 줄에 `apiKey`·`selectedAccountId`·`theme`만 적혀 있다.
- `/docs/persistence/lifecycle.md` — **주 갱신 대상.** "삭제 범위: 연결 해제 vs 캐시 데이터 삭제" 절의 mermaid 다이어그램(`KEEP_KEYS` 3개, `DELETE FROM 3개 테이블`)과 비교표, `getCacheDataSize()` 문단("저 3개 테이블").
- `/docs/persistence/preferences.md` — **주 갱신 대상.** "키 분류" mermaid의 `Auth` 그룹과 "전체 키 목록" 표에 `trackingMode`·`dropEffect` 행이 아예 없다.
- `/docs/persistence/sqlite.md` — **주 갱신 대상.** 첫 줄부터 "보스 수익 관련 **3개 테이블**만 여기에 있고"로 시작하고, ERD와 "테이블별 역할"에도 `boss_drop_records`가 **통째로 빠져 있다**(같은 누락이 문서에도 있다).
- 아래는 **읽기만** 하라(이 step에서 수정 금지):
  - `/src/storage/cache-data.ts` (`KEEP_KEYS` `:7-11`, `CLEARED_TABLES` `:13`, `clearCacheData` `:15-25`, `getCacheDataSize` `:29-50`)
  - `/src/storage/sqlite/db.ts` (4개 CREATE 문 `:7-61`, 실행 `:102-105`, 메이린 마이그레이션 `:67-72`·`:106-107`)
  - `/src/storage/keys.ts` (`trackingMode` `:5`, `dropEffect` `:6`)
  - `/src/storage/tracking-mode.ts`·`/src/storage/drop-effect.ts` (두 키의 기본값 — 값이 없으면 각각 `'auto'`, `true`)
  - `/src/app/settings/CacheClearConfirm.tsx` (`:20-31` 삭제됨/유지됨 문구)

이 phase의 첫 step이라 이전 step 산출물은 없다.

## 작업

### 1. `docs/adr/ADR-052.md` 신규 작성

기존 ADR 파일과 동일한 형식(`docs/adr/ADR-050.md` 참고 — `### ADR-NNN: 제목 (상태)` / `**배경**` / `**결정**` / `**이유**` / `**트레이드오프**`).

- 제목: `### ADR-052: 캐시 데이터 삭제 범위 — 사용자 설정 보존, SQLite 테이블 목록 단일 진실 공급원화 (설계, 구현 전)`
- **결정**은 아래 3가지:
  1. **`trackingMode`·`dropEffect`를 `KEEP_KEYS`에 추가해 보존한다.** 근거: 둘 다 "재조회로 복구 가능한 캐시"가 아니라 사용자가 명시적으로 고른 취향 설정이고, 같은 성격의 `theme`이 이미 보존 대상이다. 캐시 삭제는 `apiKey`·`selectedAccountId`를 남기므로 사용자가 온보딩으로 돌아가지도 않는다 — 수동 모드를 쓰던 사용자가 안내 없이 자동 모드로 되돌아가는 것은 "저장 공간 확보"라는 이 기능의 의도를 넘어선 부수효과다. [[ADR-035]]의 보류 결정을 여기서 해소한다.
  2. **삭제 대상 SQLite 테이블 목록의 단일 진실 공급원은 `storage/sqlite/db.ts`의 테이블 정의 배열이다.** `db.ts`가 `[{ name, createSql }]` 배열 하나를 갖고 스키마 생성도 그 배열을 순회하며, 이름 배열을 export해 `cache-data.ts`가 import한다. 하드코딩된 두 번째 목록을 없앤다. 새 테이블은 그 배열에만 추가하면 생성·삭제·용량 계산에 자동 반영된다.
  3. **확인 모달 문구는 실제 삭제 범위와 동기화한다.** 삭제되는 것에 드롭 기록을, 유지되는 것에 결정 1의 두 항목까지 적는다.
- **이유**: 위 "배경"의 논지 + 고아 드롭 행 문제(수익 기록만 지워지고 드롭이 남으면 같은 보스를 다시 잡을 때 예전 드롭이 되살아난다)를 명시하라.
- **트레이드오프**: 결정 1로 "캐시 데이터 삭제"가 완전한 초기화는 아니게 된다(설정은 남는다) — 다만 이 기능의 이름과 의도가 애초에 "캐시" 삭제다. 결정 2로 `db.ts`가 삭제 범위까지 책임지게 되어 저장소 레이어의 결합이 한 줄 늘어난다.

### 2. `docs/ADR.md` 인덱스에 한 줄 추가

기존 표 형식에 맞춰 마지막 줄 다음에 ADR-052를 추가한다.

> **주의**: 다른 phase(`account-selection-always`)가 ADR-051을 쓴다. 이 phase는 **ADR-052**를 쓴다. 인덱스에 ADR-051 줄이 이미 있든 없든 상관없이 ADR-052로 작성하라.

### 3. `docs/adr/ADR-035.md`에 정정 한 줄 추가

**본문의 "보류한다" 문장을 지우지 마라.** 그 문단 바로 아래에 정정을 덧붙인다:

- `**정정(2026-07-29) — 보류 해소 ([[ADR-052]])**: ~~"캐시 데이터 삭제" 시 trackingMode 보존 여부는 보류~~ → 보존하기로 확정. ...` 형식으로, 결정 1의 근거를 한두 문장으로 적어라.

### 4. `docs/persistence/lifecycle.md` 갱신

- "삭제 범위" 절의 mermaid `CacheClear` 서브그래프:
  - `K2` 보존 노드를 `apiKey · selectedAccountId · theme · trackingMode · dropEffect`로.
  - `Y2` 노드를 **4개 테이블**(`boss_drop_records` 추가)로 하고 `-->|DELETE FROM 3개 테이블|` 라벨도 고쳐라.
- 비교표의 "지우는 것" 칸: `KEEP_KEYS`(5개) 제외 모든 Preferences 키 + **`db.ts`가 정의한 모든 테이블**로.
- `getCacheDataSize()` 문단의 "저 3개 테이블의 모든 셀" 표현을 목록 고정이 아닌 표현으로 고쳐라.
- **삭제 대상 목록이 `db.ts`의 테이블 정의 배열 하나에서 나온다**는 사실과, 새 테이블을 추가할 때 별도로 삭제 목록을 손댈 필요가 없다는 규칙을 한 문단으로 적어라([[ADR-052]] 결정 2).

### 5. `docs/persistence/preferences.md` 갱신

- "키 분류" mermaid의 `Auth`(인증/설정 — 캐시 삭제에도 보존) 그룹에 `trackingMode`·`dropEffect`를 추가한다.
- "전체 키 목록" 표에 두 행을 추가한다(기존 열 구성 그대로: 키 / 값 형태 / 어댑터 / 캐시 삭제 시 / 비고):
  - `trackingMode` | `'auto' \| 'manual'` | `storage/tracking-mode.ts` | **보존** | 값이 없거나 알 수 없는 값이면 `'auto'`([[ADR-035]] 결정 2). 보존 결정은 [[ADR-052]]
  - `dropEffect` | `'on' \| 'off'` | `storage/drop-effect.ts` | **보존** | 고가 드롭 연출 표시 여부([[ADR-040]] 결정 6). 값이 없으면 표시(on). 보존 결정은 [[ADR-052]]

### 6. `docs/persistence/sqlite.md` 갱신

이 문서에도 `boss_drop_records`가 통째로 빠져 있다 — 이번 이슈가 지적하는 누락과 **정확히 같은 누락**이므로 함께 고친다.

- 첫 문단의 "보스 수익 관련 **3개 테이블**만"을 4개로 고친다.
- ERD(mermaid)에 `boss_drop_records` 엔티티를 추가한다. 컬럼은 `db.ts:45-61`을 그대로 옮겨라 — **임의로 추정하지 마라.** PK는 `(ocid, boss, difficulty, period_key, drop_index)`.
- "테이블별 역할"에 `### boss_drop_records — 기간별 드롭 기록` 절을 추가한다: [[ADR-038]]에서 도입, 한 보스가 여러 드롭을 가지므로 `drop_index`로 다중 행, **금액을 저장하지 않고 재평가 가능한 구조**(아이템명·카테고리·상자 출처·반지 등급·수량)만 담는다는 점.
- 문서 어딘가에 **"새 테이블을 추가할 때는 `db.ts`의 테이블 정의 배열에만 넣으면 스키마 생성·캐시 삭제 범위·용량 계산에 자동 반영된다"** 는 운영 규칙을 명시하라([[ADR-052]] 결정 2, [lifecycle.md](./lifecycle.md) 참조 링크 포함).

### 7. `docs/persistence/README.md` 갱신

"인증/설정" 분류 줄의 키 목록에 `trackingMode`·`dropEffect`를 추가한다("캐시 데이터 삭제에도 보존됨" 설명은 그대로 유효하다).

## Acceptance Criteria

```bash
npm run build   # 컴파일 에러 없음(코드 무변경이므로 그대로 통과해야 한다)
npm test        # 전체 테스트 통과(코드 무변경이므로 그대로 통과해야 한다)
npm run lint    # 경고 0

# 문서 반영 확인 — 아래가 모두 결과를 내야 한다
test -f docs/adr/ADR-052.md && echo "ADR-052 OK"
grep -q "ADR-052" docs/ADR.md && echo "index OK"
grep -q "ADR-052" docs/adr/ADR-035.md && echo "ADR-035 정정 OK"
grep -q "boss_drop_records" docs/persistence/sqlite.md && grep -q "boss_drop_records" docs/persistence/lifecycle.md && echo "sqlite/lifecycle OK"
grep -q "trackingMode" docs/persistence/preferences.md && grep -q "dropEffect" docs/persistence/preferences.md && echo "preferences OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - ADR 전문은 `docs/adr/ADR-052.md`에, 인덱스에는 한 줄만 들어갔는가?
   - [[ADR-035]] 본문의 "보류" 문장을 **삭제하지 않고** 정정으로 남겼는가?
   - `sqlite.md`의 `boss_drop_records` 스키마를 `db.ts` 원문에서 그대로 옮겼는가(추정 금지)?
   - `src/` 아래 파일을 하나도 수정하지 않았는가? (`git status`로 확인)
3. 결과에 따라 `phases/cache-clear-scope/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 **ADR-052의 결정 1·2·3을 한 줄로 압축해** 적어라(다음 step들이 이 요약만 보고 구현 규칙을 알 수 있어야 한다).
   - 수정 3회 시도 후에도 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## 금지사항

- `src/` 아래 어떤 파일도 수정하지 마라. 이유: CLAUDE.md의 docs-first CRITICAL 규칙에 따라 이 step은 문서 확정 전용이고, 구현은 step 1~3에서 TDD로 진행한다.
- `docs/adr/ADR-035.md` 본문의 기존 결정·트레이드오프 문장을 고쳐 쓰거나 삭제하지 마라. 이유: 옛 결정과 그 보류 사유를 추적할 수 있어야 한다.
- `docs/persistence/preferences.md`의 `trackedCharacters:content` / `trackedCharacters:boss` / `lastSelectedCharacter:*` 행을 고치지 마라. 이유: [[ADR-042]]로 단일 키(`trackedCharacters`·`lastSelectedCharacter`)로 통합됐는데 이 표가 아직 옛 상태인 **별개의 문서 드리프트**다. 이번 이슈와 무관하니 손대지 말고, 발견 사실만 step summary에 한 줄 남겨라.
- `sqlite.md`의 `boss_drop_records` 컬럼을 기억이나 추정으로 쓰지 마라. 이유: CLAUDE.md CRITICAL — 게임/스키마 수치 데이터를 임의 추정하면 안 된다. 반드시 `src/storage/sqlite/db.ts:45-61`을 열어 그대로 옮겨라.
- 새 ADR을 `docs/ADR.md` 본문에 통째로 쓰지 마라. 이유: `ADR.md`는 슬림 인덱스다.
- 기존 테스트를 깨뜨리지 마라.
