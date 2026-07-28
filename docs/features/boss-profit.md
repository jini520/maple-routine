# 보스 수익 (Boss Profit)

> **범위**: 처치 보스 수익 계산, 파티원 수 자동 기록, 주간/월간 탭·기간 네비게이터, 아코디언 레이아웃, 고가 드롭 강조 연출. 보스 목록의 출처·파티 설정은 [boss-scheduler.md](./boss-scheduler.md), 물욕 드롭 입력은 [item-drop.md](./item-drop.md).
> **관련 소스**: `app/boss-profit/`(`BossProfitScreen.tsx`) · `features/boss-profit/` · `storage/boss-profit`(SQLite `boss_profit_records`) · `storage/sqlite/db.ts` · `lib/boss-profit-period.ts` · `src/data/boss-crystal-prices.json`·`boss-portrait-icon-crops.json` · `index.css`(고가 드롭 클래스).
> **관련 ADR**: [[ADR-014]] [[ADR-017]] [[ADR-019]] [[ADR-023]] [[ADR-032]] [[ADR-033]] [[ADR-036]] [[ADR-037]] [[ADR-045]] [[ADR-010]]. **관련 문서**: [../foundation/game-data.md](../foundation/game-data.md), [../foundation/error-resilience.md](../foundation/error-resilience.md), [../persistence/sqlite.md](../persistence/sqlite.md).

## 정책
- 처치 보스 목록은 Nexon API 동기화 데이터를 그대로 사용(수동 입력 없음). 등록 여부가 아니라 **처치된(`complete_flag: true`) 보스만** 구독·표시·계산(등록만 하고 안 잡은 보스는 안 나타남). 실제 처치 난이도 우선 선택은 `selectBossProfitBosses`([[ADR-033]] — 등록 난이도 ≠ 처치 난이도 오류 수정, `ownComplete` 도입).
- **수익 계산**: `boss-crystal-prices.json` 정가 조회 → `partySizeScaling.formula`(`floor(priceMeso / partySize)`). `priceMeso` 없는 보스(벨로나)는 "가격 미확정". 물욕템 환산 가치는 확정 항목만 합산([[ADR-010]], [item-drop.md](./item-drop.md)).
- **파티원 수**: Nexon API가 모르는 정보라 캐릭터+보스+난이도 조합별 로컬 저장. 완료 감지 시 자동 기본값이 채워지므로 값이 실제와 다를 때만 수정. 과거 기록도 파티원 편집 가능([[ADR-032]] — 스테퍼는 과거/현재 무관 항상 활성, `mergeRecordsIntoRows` 가 과거 row `priceMeso` 를 그 시점 기록값으로 복원해 재계산 문제 없음).
- 추적 캐릭터는 `trackedCharacters:boss` 재사용(전용 추적 UI 없음).
- **멱등성**: `(characterId, boss, difficulty, weekOf)` 유니크 upsert. 참조 데이터 제거돼도 과거 기록 보존([../foundation/error-resilience.md](../foundation/error-resilience.md)).

## 자동 기록 ([[ADR-014]])
동기화로 새 처치가 확인된 보스는 사용자 입력을 기다리지 않고 즉시 `boss_profit_records` 에 upsert(화면 진입과 무관). 기본 파티원 수 = `storage/boss-party-settings` 에서 같은 (ocid, boss, difficulty)의 `boss_party_settings` 조회값, 없으면 1([[ADR-019]] — 보스 카드 배지·필터와 항상 같은 소스). 사용자가 특정 주(달)만 수정하면 그 주 기록만 갱신되고, 과거 주차의 `party_size` 는 스냅샷으로 남아 소급 변경 없음(주차별 override 유지). 등록됐지만 미완료인 보스는 "미완료" placeholder(0메소, DB 미기록)로 선등록([[ADR-032]]).

## 기간 처리 ([[ADR-023]])
- **주간/월간 탭**: 주간 탭 `cycle: weekly` 만, 월간 탭 "주차별 합계 + `cycle: monthly` 보스 상세".
- **기간 네비게이터**: 탭 아래 ‹ 라벨 › 로 과거 탐색. 라벨은 최근 두 기간까지 상대("이번 주"/"지난 주", "이번 달"/"지난 달"), 그 이전은 "OO월 N주차"/"OO년 O월"(한 주가 두 달에 걸치면 시작 목요일이 속한 달 기준). 최신 기간에선 미래 화살표 비활성화.
- **로컬 우선 캐싱**: 기간 이동은 항상 `storage/boss-profit` 의 `boss_profit_records` 만 읽어 즉시 전환, API 재호출 없음. 저장 기록 없는 과거 기간 첫 이동 때만 스피너와 함께 `nexon/schedule` 을 그 기간 `date`(YYYY-MM-DD)로 자동 1회 재조회(하한 [../foundation/nexon-api.md](../foundation/nexon-api.md) 참고) 후 즉시 영구 저장 → 다음 방문부터 재조회 안 함. 그 기간 미접속이면 재조회해도 비어 있을 수 있음.
- **이전 기간 게이트**([[ADR-037]]): 스토어 파생 `canGoPreviousPeriod`(`canReachPreviousPeriod`: MIN 하한 미만 불가 / `isPeriodQueryable` 면 가능 / 롤링 밖이어도 캐시 기록 있으면 가능)를 이전 버튼과 `goToPreviousPeriod` 가드가 공유.
- **동기화 상태 영역**(마지막 동기화 시각·"조회 중" 로딩·새로고침 버튼)은 현재 기간(`isLatestPeriod`)에서만 노출(과거 기간은 cache-first·checked-once라 무의미).
- **캐시 우선 표시**([[ADR-017]]): "지금" 기간에 한해 `syncSchedules` 재검증 전 `getCachedSchedulerState` 로 화면을 먼저 채움(위 기간별 캐싱과 별개).
- 보스 표시 순서([[ADR-036]]): `sortRowsByOcidOrder` 에 `weekly-bosses.json` 정규 순서(REFERENCE_ENTRIES: weekly→eventWeekly→monthly) 2차 정렬 키로 캐시·라이브·과거기록 세 경로를 같은 순서로 고정(`getBossReferenceOrder`, `boss-matching.ts`).

## UI

### 아코디언 (캐릭터별 드롭다운) — [[ADR-014]], [[ADR-023]] 재설계
- 아바타(원형 이니셜 또는 캐릭터 이미지 — 미확정) + 이름 + 우측 금액 + Chevron.
- **접힘/펼침 셸이 다르다**: 접힘 = 단독 카드(`rounded-[14px] bg-surface border border-border p-4`). 펼침 = 헤더+본문을 하나의 셸로(바깥 wrapper `rounded-[14px] bg-surface border border-border`, 헤더는 자체 border/rounded 없이 `p-4 flex items-center gap-3`, 본문은 `border-t border-border` 하나로 경계). 접힘 상태(다른 캐릭터 미펼침)는 완결된 단독 카드. **셸에 `overflow-hidden`을 두지 않는다**([[ADR-047]]) — sticky 헤더를 무력화하므로, 하단 모서리 클리핑은 footer의 `rounded-b-[14px]`가 대신한다.
- **헤더**: 아바타 `h-8 w-8 rounded-full bg-surface-2 ... text-xs font-bold text-text` + 이름 `flex-1 text-sm font-semibold text-text truncate` + 금액 `text-sm font-bold text-text tabular-nums`(우측 세로 정렬) + Chevron(`ChevronDown`/`ChevronUp`).
- **펼침 헤더는 sticky** — [[ADR-047]]: 펼쳤을 때만 `sticky z-[5] rounded-t-[14px] bg-surface` + `top` = **페이지 sticky 헤더의 실측 높이**(`ResizeObserver`, 헤더 높이가 탭·경고 문구에 따라 가변이라 상수 불가). `bg-surface`는 아래로 지나가는 보스 행을 가리기 위해 필수이고, 그 때문에 `rounded-t-[14px]`로 셸 상단 라운딩을 따라가야 한다(사각 배경이 둥근 모서리를 덮음).
  - **카드 내부 z 레이어**(`isolate` 안): 드롭 아이콘 `1~3` < sticky 헤더 `5`(하단 페이드 포함) < 골드 회전 샤인 링(`.valuable-drop-card::before`) `6` < 고가 드롭 배지 `10`. 링이 헤더보다 낮으면 테두리 상단·좌우가 헤더 배경에 끊긴다.
  - **고가 드롭 배지도 함께 고정 — 펼침 상태에만**([[ADR-047]] 후속): 배지를 헤더 안에 넣으면 헤더의 `z-[5]` 컨텍스트에 갇혀 골드 링(`z-6`)이 위를 지나간다. 그래서 셸 바깥에 남기고 **높이 0 sticky 레일**(`sticky z-10 h-0`, `top` = `stickyTop + 8`)에 얹는다 — `+8`은 배지의 `-top-2`를 상쇄해 stuck 시 헤더 상단선에 걸치게 하는 값. **접힘 상태는 레일 없이** [[ADR-045]] 원래 구조(`absolute -right-1.5 -top-2 z-10`)를 쓴다 — 접힌 카드는 고정할 헤더가 없고 containing block이 헤더 높이뿐이라 배지만 떠서 어긋난다.
- **본문 — 보스 행(개별 카드 아닌 통합 리스트)**:
```
행: flex items-start gap-3 p-4 border-b border-border last:border-b-0 (자체 rounded/bg/border 없음)
아이콘: BossPortrait(h-10 w-10, 원형)
1줄(이름): flex items-baseline gap-1.5 flex-wrap — 보스명(text-sm font-semibold text-text, 줄바꿈) + 난이도 뱃지
2줄(조작): flex items-center justify-between gap-2 mt-2 — 파티원 스테퍼(좌) / 정산 금액(우, tabular-nums)
```
캐릭터명은 헤더에만(행에서 제거). "가격 미확정" 행도 같은 2줄 구조 유지 — 금액 자리에 배지(`rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary`), 스테퍼는 `opacity-40` 비활성.
- **파티원 스테퍼(−/+)**: `inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5`, 버튼 `h-[18px] w-[18px] rounded-full bg-surface-2`, 값 `text-xs tabular-nums`. 파티 관리 모달과 동일 조작(경계 비활성화).
- **소계 footer**: `flex items-center justify-between px-4 py-3 bg-surface-2 text-sm rounded-b-[14px]`, 왼쪽 "{캐릭터명} 합계" `text-text-muted`, 오른쪽 금액 `font-semibold tabular-nums text-text`. 하단 라운딩은 셸의 `overflow-hidden`을 뺀 대체 수단([[ADR-047]]) — 셸 하단에 닿는 배경 요소를 새로 추가할 땐 같은 처리가 필요하다.
- 기본 **전부 접힘** 시작(추적 캐릭터 많을 때 과도한 길이 방지). 리스트 key `${tab}-${periodKey}-${ocid}` 로 탭/기간 이동 시 remount(펼침 상태 리셋, [[ADR-037]]).

### sticky 헤더 — 공용 패턴 + 경계 페이드는 카드 헤더로 이동
제목~총 수익 헤드라인까지 `sticky top-0 z-10 bg-bg`로 고정하고 그 아래 캐릭터 목록만 스크롤한다([foundation/design-system.md](../foundation/design-system.md) "스크롤 영역" 레시피 재사용). 단 **페이지 헤더에는 경계 페이드 오버레이를 쓰지 않는다**([[ADR-047]] 결정 6) — 그 오버레이는 헤더 바로 아래 32px를 `bg-bg`로 덮는데, 펼친 캐릭터 카드의 sticky 헤더가 멈추는 자리가 바로 그 밴드라 stuck 헤더가 가려진다(카드는 `isolate`로 `z-10` 아래). 페이지 헤더의 경계는 총 수익 헤드라인 하단의 `h-px bg-border` 헤어라인이 담당한다. 다른 4개 화면은 페이드를 유지하므로 공용 레시피를 복사할 때 페이지 헤더에 되붙이지 말 것(회귀 가드 테스트 있음).

**대신 페이드는 stuck 카드 헤더 하단으로 옮겼다**([[ADR-047]] 후속) — 중첩 sticky에서는 콘텐츠가 지나가는 경계가 그쪽이기 때문. 펼침 헤더 버튼 안에 `<span>`으로 `pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-surface to-transparent backdrop-blur-sm` + mask 인라인 스타일(공용 레시피와 동일, 배경색만 `from-surface`). 버튼 자식이라 `div`가 아닌 `span`이어야 한다. CSS로 stuck 여부를 알 수 없어 평상시에도 존재한다.

### 총 수익 헤드라인 (sticky 헤더 최하단) — [[ADR-046]]
`characterGroups` 합계를 보여주는 기간 요약. **카드가 아니다** — 아래 캐릭터 카드가 전부 같은 카드 셸(`rounded-[14px] bg-surface border border-border`)이라, 요약도 카드면 "동일한 흰 카드의 반복"으로 묻힌다([[ADR-046]] 배경). 카드 셸 없이 배경 위 타이포로 두고 색·크기로만 위계를 준다.
```
라벨행: flex items-center justify-between gap-2
  라벨 text-xs font-semibold tracking-wide text-text-muted — "{periodLabel.primary} 총 수익"
  우측: 기간 전체 고가 드롭 뱃지(있을 때만)
금액행: mt-1.5 flex items-center gap-2.5
  코인 엠블럼 h-8 w-8 rounded-full bg-primary/12 text-primary + lucide Coins h-[18px] w-[18px]
  금액 text-xl font-extrabold leading-none tabular-nums text-primary + 단위 "메소" text-xs font-bold text-text-muted
헤어라인: mt-3 h-px bg-border (sticky 헤더 바닥 경계 = 카드 테두리 대체)
```
새 색 신설 금지 — `primary`(금액·엠블럼)와 `text-muted`(라벨·단위)만. 보스 처치 수·캐릭터 수는 **표시하지 않는다**(중요 정보 아님, [[ADR-046]] 결정 5). 단위 "메소"는 별도 span이지만 숫자와 사이에 실제 공백 문자를 남긴다(마진만으론 `textContent`가 "N메소"로 붙어 스크린리더가 붙여 읽음).

### 주간/월간 탭 + 기간 네비게이터 — [[ADR-023]]
탭은 탭 토글 레시피 재사용(주간/월간, 카운트 배지 없음). 네비게이터:
```
네비게이터: flex items-center justify-center gap-4 (탭 다음 줄)
이전/다음 버튼: h-7 w-7 rounded-full border border-border ... text-text disabled:opacity-30
라벨: 1줄 text-sm font-semibold text-text(상대/절대), 2줄 text-xs text-text-muted tabular-nums mt-0.5(정확 날짜, 항상)
```
최신 기간에서 다음 버튼 `disabled`.
- **기간 미보유 자동 재조회 스피너**: 빈 상태 박스 스타일 재사용 — `rounded-[14px] border border-dashed border-border p-6 flex flex-col items-center gap-3 text-center`, 스피너 `h-6 w-6 rounded-full border-[3px] border-border border-t-primary animate-spin motion-reduce:animate-none`, 안내 `text-xs text-text-muted`(예 "5월 2주차 기록을 불러오는 중..."). `border-t-primary` = 진행 중 의미. 미접속 기간 문구는 미정.
- **월간 탭 — 주차별 합계 + 월간 보스**: 보스 나열 대신 그 달 `cycle: weekly` 를 주차(시작 목요일 속한 달 기준 N주차)로 묶어 합산 후 `cycle: monthly` 상세를 이어 붙임. 아코디언 본문 셸 안 두 서브섹션:
```
서브섹션 라벨: px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2
주차 행: flex items-center gap-3 p-4 border-b border-border (보스 아이콘 없음 — 합계라 이미지 없음)
  라벨 "N주차" + 날짜 범위, 진행 중 배지(bg-primary/15 text-primary text-[10px]) "진행 중", 금액 우측 tabular-nums
아직 시작 안 한 주 행 전체: opacity-40 ("예정")
월간 보스 상세 행: 위 아코디언 본문 레시피 그대로
```
월간 탭의 주차별 합계 집계와 임의 과거 기간 이동은 구현됨(`BossProfitScreen` monthly 탭 "주간 보스 수익 · 주차별 합계", `boss-profit-period.ts` 의 periodKey ±이동).

### 고가 드롭 강조 — [[ADR-045]]
그 주차에 고가 아이템(`isValuableDrop`)을 먹은 항목을 네온 골드(`#f7d00d`)로 강조. `index.css` plain 클래스 3종, 모든 모션은 `prefers-reduced-motion: no-preference` 에서만(정적 폴백).
- `.valuable-drop-card`(접힘 캐릭터 카드): `::before` `conic-gradient`+`mask(xor)` 2px 링을 `@property --vd-angle` 로 회전(회전 샤인 테두리) + `box-shadow` 글로우 맥동. 우상단 획득 아이템 배지(`Sparkles`+아이템 아이콘). `@property` 미지원 WebView는 정적 골드 테두리로 degrade.
- `.valuable-drop-card--expanded`(펼침): 요소 자신 glow 맥동만 정지(회전 샤인 유지). 복합 선택자로 `@media` 규칙보다 명시도 우선. 링 `::before`는 `z-index: 6` — 펼침 sticky 헤더(`z-[5]`)의 불투명 배경에 테두리가 끊기지 않도록([[ADR-047]]).
- `.valuable-drop-row`(펼침 시 고가 획득 보스 행): 테두리/글로우 아닌 **배경** — 아이템 쪽(`radial-gradient at 82% 50%`) 골드 글로우 + 미세 틴트 맥동. `<li>` 자체 `background`.
- **총 수익 헤드라인 뱃지**([[ADR-046]]): 같은 배지 컴포넌트를 기간 전체 집계(`collectAllValuableDrops` = 캐릭터 그룹별 `collectGroupValuableDrops` 합집합)로 라벨행 우측에 재사용. 배치·라벨만 호출부가 정하고(카드 = `absolute -right-1.5 -top-2 z-10`·`aria-label="고가 드롭"`, 헤드라인 = 인라인·`aria-label="이 기간 고가 드롭"`) 외형·아이콘 스택(최대 3 + `+N`) 규칙은 단일 구현. 드롭 없으면 미렌더.

## SQLite 안정성
`applyDownloadedLiveUpdate()`(`CapacitorUpdater.set()`)가 JS 컨텍스트를 파괴하는 리로드 전에 SQLite 커넥션을 정상 종료하지 않으면 stale 커넥션이 남아 과거 수익 데이터 로드가 조용히 멈춘다 → `storage/sqlite/db.ts` 의 `closeBossProfitDb()` 로 리로드 전 미리 닫음([[ADR-008]] 세 번째 정정). 읽기 조회는 `withSqliteFallback`(타임아웃 폴백), 쓰기는 `withSqliteTimeout`(타임아웃을 실패로 전파 — 성공 위장 시 영구 유실 위험).

## 열린 질문
- 아코디언 아바타를 이니셜로 둘지 `character/basic` 이미지로 바꿀지 미정.
- 결정 시세 시점별 이력화 필요 여부([../foundation/game-data.md](../foundation/game-data.md)).

## 폐기된 정책 (history)
- ~~파티원 수를 캐릭터별로 계속 수동 입력~~ → 캐릭터+보스+난이도 조합별 로컬 저장 + 자동 기록([[ADR-014]]).
- ~~기본 파티원 수 = 가장 최근 기록값 이어받기~~ → `boss_party_settings` 설정 조회로 완전 대체([[ADR-019]]).
- ~~월간 보스(검은마법사)를 이 화면에서 제외~~ → 주간/월간 탭 도입으로 월간 탭에서 부활([[ADR-023]], [[ADR-017]] 미확정 해소).
- ~~아코디언 헤더 합계 + 섹션 타이틀 "이번 주 합계 N 메소" 중복 표시~~ → 섹션 타이틀 합계 제거(합계는 헤더에만)([[ADR-017]]).
- ~~아코디언 헤더 = "{캐릭터명} · {합계} 메소" 한 줄, 보스 행 = 개별 카드~~ → 아바타+이름+금액 분리, 보스 행 통합 리스트([[ADR-023]]).
- ~~과거 기록 파티원 수 읽기 전용(잠정)~~ → 항상 편집 가능([[ADR-032]], PRD #46).
- ~~보스 표시 순서가 로드/렌더마다 달라짐~~ → 정규 순서 2차 정렬로 고정([[ADR-036]]).
- ~~이전 기간 게이트를 `isEarliestNavigablePeriod` 로 직접 판정(경계 이원화)~~ → `canGoPreviousPeriod` 파생 상태로 통일([[ADR-037]], [[ADR-032]] 잔여 해소).
- ~~`BossPortrait` 원형 아이콘은 크롭 미지원(cover/center 고정)~~ → `size`/`crop` prop 지원, `boss-portrait-icon-crops.json` 조회(2026-07-14).
