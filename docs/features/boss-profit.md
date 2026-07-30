# 보스 수익 (Boss Profit)

> **범위**: 처치 보스 수익 계산, 파티원 수 자동 기록, 주간/월간 탭·기간 네비게이터, 아코디언 레이아웃, 고가 드롭 강조 연출. 보스 목록의 출처·파티 설정은 [boss-scheduler.md](./boss-scheduler.md), 물욕 드롭 입력은 [item-drop.md](./item-drop.md).
> **관련 소스**: `app/boss-profit/`(`BossProfitScreen.tsx`) · `features/boss-profit/` · `storage/boss-profit`(SQLite `boss_profit_records`) · `storage/sqlite/db.ts` · `lib/boss-profit-period.ts` · `lib/boss-matching.ts`(정규 순서·`WEEKLY_BOSS_CLEAR_LIMIT`·`WEEKLY_CRYSTAL_SALE_LIMIT`·`isSeasonBossName`) · `lib/world-emblem.ts`·`lib/item-icons.ts`(결정석/월드 아이콘) · `src/data/boss-crystal-prices.json`·`weekly-bosses.json`·`boss-portrait-icon-crops.json` · `index.css`(고가 드롭 클래스).
> **관련 ADR**: [[ADR-014]] [[ADR-017]] [[ADR-019]] [[ADR-023]] [[ADR-032]] [[ADR-033]] [[ADR-036]] [[ADR-037]] [[ADR-045]] [[ADR-049]] [[ADR-054]] [[ADR-059]] [[ADR-010]] [[ADR-067]] [[ADR-068]] [[ADR-069]]. **관련 문서**: [../foundation/game-data.md](../foundation/game-data.md), [../foundation/error-resilience.md](../foundation/error-resilience.md), [../persistence/sqlite.md](../persistence/sqlite.md).

## 정책
- 처치 보스 목록은 Nexon API 동기화 데이터를 그대로 사용(수동 입력 없음). 등록 여부가 아니라 **처치된(`complete_flag: true`) 보스만** 구독·표시·계산(등록만 하고 안 잡은 보스는 안 나타남). 실제 처치 난이도 우선 선택은 `selectBossProfitBosses`([[ADR-033]] — 등록 난이도 ≠ 처치 난이도 오류 수정, `ownComplete` 도입).
- **수익 계산**: `boss-crystal-prices.json` 정가 조회 → `partySizeScaling.formula`(`floor(priceMeso / partySize)`). `priceMeso` 없는 보스(벨로나)는 "가격 미확정". 물욕템 환산 가치는 확정 항목만 합산([[ADR-010]], [item-drop.md](./item-drop.md)).
- **파티원 수**: Nexon API가 모르는 정보라 캐릭터+보스+난이도 조합별 로컬 저장. 완료 감지 시 자동 기본값이 채워지므로 값이 실제와 다를 때만 수정. 과거 기록도 파티원 편집 가능([[ADR-032]] — 스테퍼는 과거/현재 무관 항상 활성, `mergeRecordsIntoRows` 가 과거 row `priceMeso` 를 그 시점 기록값으로 복원해 재계산 문제 없음).
- 추적 캐릭터는 `trackedCharacters:boss` 재사용(전용 추적 UI 없음).
- **주간 보스 처치 수**([[ADR-054]]): 캐릭터당 한도 12(`weeklyBossSelectionLimit`)와 **월드당** 주간 결정석 판매 한도 90(`weeklyCrystalSaleLimit`)은 **단위가 다른 별개 지표**다 — 90은 계정이 아니라 월드마다 각각이고, 주간 보스만 포함하며(월간 보스 결정석 제외), 시즌 보스(메이린)는 빠지고, 안 판 결정석은 **이월되지 않는다**(매주 초기화). 두 상수는 `lib/boss-matching`(`WEEKLY_BOSS_CLEAR_LIMIT`·`WEEKLY_CRYSTAL_SALE_LIMIT`)에서 나란히 export.
  - **처치 수는 store 필드가 아니라 화면에서 `rows` 로 파생**한다 — `distinct(bossRows.filter(r => r.isComplete && !isSeasonBossName(r.boss)).map(r => r.boss)).length`. 의미는 보스 스케줄러의 `countClearedWeeklyBosses`(등록 여부 무관·실제 처치·난이도 중복 1)와 동일하고, 캐릭터 배지(`n/12`)와 월드 합계(`n/90`)가 **이 값 하나를 공유**한다(계산 두 벌 금지).
  - **표시 범위는 두 탭 · 모든 기간**([[ADR-059]] — [[ADR-054]] 결정 4의 "주간 탭 · 현재 기간 한정" 폐기). 과거 주의 `34 / 90` 은 "그 주에 이 월드가 한도를 얼마나 썼는가"라는 완결된 사실이고, 이월되지 않는 성질이 오히려 주별 기록으로서의 의미를 보장한다. 과거 기간 `rows` 는 DB 기록에서 오지만 그 행은 전부 `isComplete: true` 라 파생식이 그대로 성립한다.
  - **월간 탭의 링은 "월간 보스 처치"다**([[ADR-059]] 결정 3) — 주간 처치 수를 월간으로 끌어오지 않는다. 월간 탭 `rows` 에는 `cycle === 'monthly'` 만 있어 주간 처치 수를 파생할 원본이 없고(주간분은 금액 합계 행으로만 존재), 12는 **주 단위로 초기화되는 한도**라 월 단위로 곱한 분모는 게임에 없는 수치다([[ADR-006]]). 분자는 그 달에 처치한 월간 보스 수(보스명 distinct), 분모는 `MONTHLY_BOSS_COUNT = weeklyBossesData.monthly.length`(현재 검은마법사 1종 → 1칸 링). 리터럴이 아니라 참조 데이터에서 파생하므로 월간 보스가 늘면 칸도 따라 는다.
  - **월드 정보**는 `imageUrl` 과 같은 경로로 배관한다 — `getSortedCharacterInfo` 가 이미 부르는 `getCachedCharacterBasic(ocid)` 의 같은 `profile` 에서 `world` 를 함께 꺼내 행까지 흘린다(추가 조회·새 저장소·새 API 호출 없음). `world` 는 옵셔널이라 **모르는 캐릭터는 월드 집계에서 조용히 제외**한다("미분류" 줄 없음) — 그만큼 월드 합계가 과소집계되지만 캐릭터 카드의 `n/12` 는 월드와 무관하게 그대로 표시된다.
  - **월드 리프 시**(사용자 확인 2026-07-31, [[ADR-069]]): **클리어 수(12)는 캐릭터 단위라 이어지고**, **판매 한도(90)는 월드마다 따로 산정된다**. 그래서 주 중간에 리프하면 그 주의 판매량이 두 월드에 각각 계상되고(그 주의 분모는 `90 × 2`), 캐릭터 카드의 `n/12` 는 월드와 무관하게 그 주 전체를 센다 — **링과 칩의 집계 단위가 의도적으로 다르다**(캐릭터 vs 월드). 코드를 한쪽으로 맞추면 게임 사실과 어긋난다.
  - **알려진 한계**(표시된 숫자가 실제 게임과 다를 수 있는 세 가지 — "왜 숫자가 안 맞냐"는 물음의 답):
    1. **추적 밖 캐릭터의 처치는 셀 수 없다.** 90은 월드 단위 한도인데 앱은 사용자가 고른 추적 캐릭터만 동기화한다([[ADR-042]]). 같은 월드의 추적 밖 캐릭터로 보스를 잡으면 실제 소진량보다 **적게** 표시된다. 이번 범위에서 UI 주석 문구는 넣지 않는다(헤드라인을 더 늘리지 않기 위함).
    2. **월드를 모르는 캐릭터는 월드 합계에서 빠진다.** 구버전 `character-basic-cache` 엔트리에는 `world` 가 없어 어느 월드 한도에도 귀속시킬 수 없다("미분류" 줄을 만들지 않는다). 다만 그 캐릭터 카드의 `n/12` 배지는 월드와 무관하게 정상 표시되므로 **개별 진행률 정보는 잃지 않고**, 캐시가 갱신되면 자동으로 합계에 합류한다.
    3. **과거 기간은 "기록된 것"만 센다.** 백필·자동 기록은 `boss-crystal-prices.json` 에 가격 항목이 없거나 `priceMeso === null` 인 보스를 건너뛰므로, 그런 보스는 그 기간의 링·칩에서도 빠진다([[ADR-059]] 트레이드오프). 현재 `priceMeso: null` 인 항목은 **벨로나(미출시)뿐**이라 실질 영향은 0이고, 신규 보스가 출시됐는데 가격표 갱신이 늦으면 같은 일이 생긴다. 참조 데이터를 갱신하면 그때부터의 기록에 반영되지만 롤링 조회 윈도우를 벗어난 주는 복구되지 않는다 — **다만 금액(총 수익)이 이미 똑같이 겪는 한계라, 화면의 세 숫자가 같은 기록에서 나와 서로 어긋나지는 않는다.**
    4. **월드 귀속은 "지금 캐시된 월드"이고 DB에 남지 않는다 — 그래서 월드 리프가 과거 집계를 소급 변경한다.** `summarizeWorldCrystals` 는 `group.bossRows[0]?.world` 를 쓰고, 그 값은 `getCachedCharacterBasic(ocid).profile.world`(라이브 캐시)에서 온다. `boss_profit_records` 스키마에는 **`world` 컬럼이 없다** — 기록되는 스냅샷은 `price_meso`·`party_size` 뿐이다([[ADR-023]]). 따라서 캐릭터가 월드를 옮기면 그 캐릭터의 **모든 과거 주** 결정석 수가 옛 월드에서 빠져 새 월드 합계로 옮겨 붙는다(캐시가 갱신되는 시점에 조용히 바뀐다). "당시 월드"를 알 원천이 API에도 없다 — 과거 `date` 응답의 `world_name` 도 현재 월드다(실측, [[ADR-067]]). 이월되지 않는 주별 한도라는 성질([[ADR-059]])과 정면으로 어긋난다 → **`world` 컬럼 스냅샷으로 해소하기로 결정**([[ADR-069]] 결정 1·2, 구현 전).
    5. **과거 기간의 월드 합계는 그 기간에 기록이 있는 캐릭터만 센다.** 기록이 하나도 없는 캐릭터는 `rows` 에 없어 그룹조차 생기지 않는다 — 화면에 보이지 않는 캐릭터가 합계에 기여하지 않는 것이므로 표시와 데이터는 일치한다.
- **멱등성**: `(characterId, boss, difficulty, weekOf)` 유니크 upsert. 참조 데이터 제거돼도 과거 기록 보존([../foundation/error-resilience.md](../foundation/error-resilience.md)).

## 자동 기록 ([[ADR-014]])
동기화로 새 처치가 확인된 보스는 사용자 입력을 기다리지 않고 즉시 `boss_profit_records` 에 upsert(화면 진입과 무관). 기본 파티원 수 = `storage/boss-party-settings` 에서 같은 (ocid, boss, difficulty)의 `boss_party_settings` 조회값, 없으면 1([[ADR-019]] — 보스 카드 배지·필터와 항상 같은 소스). 사용자가 특정 주(달)만 수정하면 그 주 기록만 갱신되고, 과거 주차의 `party_size` 는 스냅샷으로 남아 소급 변경 없음(주차별 override 유지). 등록됐지만 미완료인 보스는 "미완료" placeholder(0메소, DB 미기록)로 선등록([[ADR-032]]).

**동기화가 실패한 캐릭터는 자동 기록하지 않는다**([[ADR-067]] 결정 7). `syncSchedules` 는 개별 실패 시 `buildFallbackResult` 로 **마지막 캐시 상태를 그대로** 돌려주는데(`isStale: true`), 자동 기록 루프에 `isStale` 게이트가 없어 그 낡은 완료 상태가 **현재 기간의 수익으로 영구 기록**됐다 — 캐시 우선 표시 분기는 같은 이유로 자동 기록을 일부러 하지 않는데(아래 [[ADR-017]] 항목) 폴백 경로가 그 방어를 우회한 것이다. 2주간 미접속한 캐릭터를 새로고침하면 4주 전 처치가 이번 주 수익으로 찍히고, 기록이 남은 뒤에는 `mergeRecordsIntoRows` 가 계속 복원하므로 스스로 사라지지 않는다.

**처치 난이도가 확정되면 드롭 기록을 그 난이도 키로 이관한다**([[ADR-069]] 결정 4). `boss_drop_records` 의 PK가 `(ocid, boss, difficulty, period_key, drop_index)` 라, 익스트림으로 등록해두고 드롭까지 기록한 뒤 백필이 하드로 확정하면 그 드롭이 **고아**가 된다(화면·고가 드롭 배지·환산 가치에서 사라지고 DB에 남는다 — `loadDropsByRowKey` 는 `rows` 에 등장하는 키만 읽는다). 확정 시점에 옛 난이도 키의 드롭을 `pruneUnobtainableDrops(boss, 확정난이도, …)` 로 걸러 확정 키로 옮기고 옛 키는 비운다. **그 난이도에서 획득 불가능한 항목은 삭제하고 되살리지 않는다** — 거짓 기록이 환산 가치·연출에 섞이는 것이 기록 한 줄을 잃는 것보다 나쁘다(사용자 판단). 확정 키에 이미 드롭이 있으면 이관분을 뒤에 이어 붙인다.

**기록 조회가 실패하면 자동 기록을 건너뛴다**([[ADR-050]] 결정 3). `getBossProfitRecords` 조회는 `withSqliteFallback` 폴백을 `[]` 가 아니라 `null` 로 두어 **"조회 실패"와 "기록 없음"을 구분**한다 — 실패를 "없음"으로 읽으면 자동 기록이 `party_size = 1` 로 사용자가 저장한 값을 덮어쓴다. 예기치 않은 리로드로 SQLite 커넥션이 stale해져 조회가 멈추는 경로가 실재하므로([../persistence/sqlite.md](../persistence/sqlite.md)) 가상의 방어가 아니다. 건너뛴 조합은 다음 새로고침에서 정상 커넥션으로 재시도되므로 유실이 아니라 지연이다.

## 기간 처리 ([[ADR-023]])
- **주간/월간 탭**: 주간 탭 `cycle: weekly` 만, 월간 탭 "주차별 합계 + `cycle: monthly` 보스 상세".
- **기간 네비게이터**: 탭 아래 ‹ 라벨 › 로 과거 탐색. 라벨은 최근 두 기간까지 상대("이번 주"/"지난 주", "이번 달"/"지난 달"), 그 이전은 "OO월 N주차"/"OO년 O월"(한 주가 두 달에 걸치면 시작 목요일이 속한 달 기준). 최신 기간에선 미래 화살표 비활성화.
- **로컬 우선 캐싱**: 기간 이동은 항상 `storage/boss-profit` 의 `boss_profit_records` 만 읽어 즉시 전환, API 재호출 없음. 저장 기록 없는 과거 기간 첫 이동 때만 스피너와 함께 `nexon/schedule` 을 그 기간 `date`(YYYY-MM-DD)로 자동 1회 재조회(조회 가능 구간 `[오늘−13, 오늘−1]` — [../foundation/nexon-api.md](../foundation/nexon-api.md) 참고) 후 즉시 영구 저장 → 다음 방문부터 재조회 안 함. 그 기간 미접속이면 재조회해도 비어 있을 수 있음.
- **기간 상태는 여섯 가지다**([[ADR-067]] 결정 2 + 정정 1) — 전에는 `periodUnavailable`(재시도 유도) / `isPeriodQueryable === false`(조회 불가) 둘로만 갈랐고, 그 둘이 "0건으로 확정" · "조회 가능한데 미조회" · "아직 집계 전" · "영구 조회 불가"를 뭉갰다. 표현은 [[ADR-068]].

| 상태 | 뜻 | 확인 기록 | 사용자 행동 | 표시([[ADR-068]]) |
|---|---|---|---|---|
| `recorded` | 기록이 있다 | — | — | 금액 |
| `confirmedEmpty` | 조회해서 **0건을 확인**했다 | `markPeriodChecked` 함 | 없음 | `EmptyState` · `0 메소` |
| `notChecked` | 조회 **가능**한데 아직 조회하지 않았다 | 아직 안 함 | **조회** | 조회 버튼 · `— 메소` |
| `notCollected` | 아직 집계 전(`OPENAPI00009`) | **하지 않는다** | 없음(나중에 자동) | pending 톤 고지 · `— 메소` |
| `outOfRange` | 조회 가능 구간 밖 — 윈도우 밖·월드 이전 이전 | 함(영구) | 없음 | `UnavailableNotice` · `— 메소` |
| `failed` | 그 외 실패(네트워크·타임아웃 등) | 하지 않는다 | **다시 시도** | `ErrorState` · 재시도 버튼 |

  - **`notChecked` 가 있어야 하는 이유**: 백필 대상은 **과거 달로 이동할 때만** 그 달의 주들을 포함하므로(`buildBackfillTargets`), **현재 달의 지난 주**는 사용자가 그 주로 직접 이동한 적이 없으면 조회되지 않는다. 그런데 `buildWeeklySubtotalsForMonth` 는 "기록 없음 + 조회 가능"을 `confirmed` 로 떨어뜨려 **조회한 적 없는 주를 `0 메소`(확정)로 표시**하고 있었다.
  - **`confirmedEmpty` 는 시간이 지나도 `outOfRange` 로 격하되지 않는다** — 표시 판정이 `isPeriodQueryable` 하나였던 탓에, 0건으로 확정한 주가 14일 뒤 "조회 불가"로 바뀌었다. 표시 단계도 `boss_profit_period_checks` 를 읽는다([[ADR-067]] 결정 3).
  - **현재 기간은 `checked` 로 표시되지 않는다 — 그래서 주가 닫히는 순간 반드시 재조회된다.** `markPeriodChecked` 는 `backfillTarget` 안에서만 호출되므로(`store.ts:496`·`564`), 그 주가 "현재 기간"이던 동안 `refresh()` 가 기록을 쌓아도 확인 표시는 남지 않는다. 목요일 00:00에 그 주가 과거가 되면 `isPeriodChecked` 가 false라 백필이 돌고, **그 조회일은 항상 그 주의 수요일 = 목요일 기준 오늘−1일**이라 `OPENAPI00009` 로 실패한다. 즉 **매주 목요일 새벽(어제 집계가 끝나기 전 — 실측 기준 대략 00:00~03시 KST) 지난 주를 열면 실패 문구가 뜬다** — 기록은 정상 표시되면서 함께 뜬다(재현 확인: rows 2건·총 수익 정상 + "이 기간을 불러오지 못했습니다").
    - 닫힌 주를 한 번 더 조회하는 설계 자체는 유효하다 — 리셋 직전에 잡은 보스가 마지막 동기화 이후였다면 기록에 없기 때문이다. 고칠 것은 **실패의 해석**(`오늘−1일` 의 `OPENAPI00009` 는 `notCollected` — 실패가 아니라 "아직")과 **기록이 있는 상태의 표현**이다.
  - **축약 응답을 `confirmedEmpty` 로 굳히지 않는다** — 200이어도 그 응답이 미접속 축약이면 "0건 확인"이 아니다. 특히 매주 목요일·매월 1일 **새벽**에는 조회일이 오늘−1일이면서 아직 집계 전이라 `OPENAPI00009` 가 나오므로(`notCollected`) 여기서 굳히면 그 기간이 영구히 0메소가 된다.
- **이전 기간 게이트**([[ADR-037]], [[ADR-067]] 결정 6): 스토어 파생 `canGoPreviousPeriod`. 전에는 **바로 이전 한 칸만** 봐서(`isPeriodQueryable` 또는 그 기간의 캐시 기록) 기록이 없는 기간에 도달하면 그 뒤의 기록까지 전부 막혔다 — 3·4주차에 접속하지 않은 캐릭터는 1·2주차 기록이 DB에 남아 있어도 화면으로 도달할 수 없었다. **기록이 있는 가장 과거 기간까지는 항상 도달할 수 있어야 한다.**
- **동기화 상태 영역**(마지막 동기화 시각·"조회 중" 로딩·새로고침 버튼)은 현재 기간(`isLatestPeriod`)에서만 노출(과거 기간은 cache-first·checked-once라 무의미).
- **실패는 토스트로 알린다**([[ADR-063]]): 동기화 전체 실패(원인별 문구 + `invalidApiKey`는 설정 열기 / `network`는 다시 시도) · 일부 캐릭터 실패(**이름 대신 인원 수** — Toast 본문이 `truncate`라 나열하면 잘린다) · 파티원 수 저장 실패("파티원 수를 저장하지 못했습니다", 보스 관리 화면과 같은 문구). 헤더 아래·카드 안 인라인 문단은 전부 걷어냈다 — 특히 파티원 수는 `err.message` 원문(`setPartySize: …`)을 그대로 렌더하던 자리였다. 기간 백필 실패("이 기간을 불러오지 못했습니다")만 인라인으로 남는다(기간 라벨 바로 아래라 맥락과 붙어 있다).
- **캐시 우선 표시**([[ADR-017]]): "지금" 기간에 한해 `syncSchedules` 재검증 전 `getCachedSchedulerState` 로 화면을 먼저 채움(위 기간별 캐싱과 별개).
- **현재 기간의 행은 API/캐시가 원천이고, 과거 기간의 행은 기록이 원천이다** — 이 비대칭 때문에 **API가 보스를 빼면 이미 저장된 수익이 현재 기간 화면에서 사라진다**([[ADR-067]] 결정 4). 월간 보스를 처치한 뒤 1주 이상 미접속하면 축약 응답에 `bossMonthly` 가 `reg=false`·`comp=false` 로만 남아 행이 만들어지지 않고, DB에 기록이 있어도 "이번 달 총 수익 0메소"가 된다(재현 확인 — 6.65억 기록 보유 상태에서 0메소 표시). `mergeRecordsIntoRows` 는 **있는 행을 채우기만** 하고 기록만 있는 행을 만들지 않기 때문이다. 현재 기간도 기록을 합집합으로 얹어야 한다.
- 보스 표시 순서([[ADR-036]]): `sortRowsByOcidOrder` 에 `weekly-bosses.json` 정규 순서(REFERENCE_ENTRIES: weekly→eventWeekly→monthly) 2차 정렬 키로 캐시·라이브·과거기록 세 경로를 같은 순서로 고정(`getBossReferenceOrder`, `boss-matching.ts`).

## UI

### 아코디언 (캐릭터별 드롭다운) — [[ADR-014]], [[ADR-023]] 재설계
- 아바타(원형 이니셜 또는 캐릭터 이미지 — 미확정) + 이름 + 우측 금액 + Chevron.
- **접힘/펼침 셸이 다르다**: 접힘 = 단독 카드(`rounded-[14px] bg-surface border border-border px-4 py-3`). 펼침 = 헤더+본문을 하나의 셸로(바깥 wrapper `rounded-[14px] bg-surface border border-border`, 헤더는 자체 border/rounded 없이 `px-4 py-3 flex items-center gap-3`, 본문은 `border-t border-border` 하나로 경계). 접힘 상태(다른 캐릭터 미펼침)는 완결된 단독 카드.
- **셸 클리핑은 `overflow: clip`**([[ADR-049]], [[ADR-047]] 결정 2 갱신): `overflow-hidden`은 **금지**다 — 스크롤 컨테이너를 만들어 sticky 헤더를 무력화한다. 반면 `overflow: clip`은 스크롤 컨테이너를 만들지 않아 sticky를 지키면서 자식을 카드 모양대로 잘라낸다. 이 클리핑이 (a) stuck 헤더의 둥근 모서리로 보스 행이 비치는 문제와 (b) 헤더가 카드 끝에서 릴리스될 때 하단 모서리가 뾰족해지는 문제를 **상태별 라운딩 분기 없이** 동시에 해결한다 — 단 **헤더 자신은 사각이어야 한다**(위 sticky 항목). 클리핑은 **패딩 박스**(반경 13px = 14 − 테두리 1px)에서 일어나므로, 셸 안쪽에 붙는 장식은 그 곡선을 기준으로 맞춘다 — 골드 링은 펼침 상태에만 반경 13px(아래 "고가 드롭 강조"). 셸 **바깥**(카드 `isolate` 직속)의 배지·경계 페이드는 클리핑 대상이 아니다.
- **헤더**: 아바타 `h-8 w-8 rounded-full bg-surface-2 ... text-xs font-bold text-text` + 이름 `flex-1 text-sm font-semibold text-text truncate` + 금액 `text-sm font-bold text-text tabular-nums`(우측 세로 정렬) + Chevron(`ChevronDown`/`ChevronUp`).
- **보스 처치 수 = 아바타 진행 링**([[ADR-054]] 결정 3·정정 1·7, #52 / 범위는 [[ADR-059]]) — **두 탭 · 모든 기간**에 렌더하고, 탭이 분자·분모를 정한다. 주간 탭 = `countGroupClearedWeeklyBosses / WEEKLY_BOSS_CLEAR_LIMIT`(12칸), 월간 탭 = `countGroupClearedMonthlyBosses / MONTHLY_BOSS_COUNT`(현재 1칸, 채워지면 "이 달 검은마법사 처치"). 기간 조건이 사라져 `CharacterAccordion` 의 `isCurrentPeriod` prop도 함께 제거됐다([[ADR-059]] 결정 6 — 화면은 새로고침·다음 기간 버튼 게이트용으로 `isLatestPeriod` 를 계속 계산한다). 진행률은 **가로폭을 쓰지 않는 아바타 테두리**만으로 표현한다 — 카드의 `n/12` 숫자 표기는 **보류**다(정정 7). 아이콘+배경 칩(≈62px) → 텍스트(≈30px)로 줄여도 헤더 가로폭을 캐릭터명과 다투는 문제가 남아, 만족스러운 배치를 찾을 때까지 뺐다. 되살릴 때 파생 함수와 링은 그대로 쓸 수 있다.
```
아바타 슬롯: relative flex h-10 w-10 shrink-0 items-center justify-center  (40px — 초상화보다 크다)
  └ 슬롯이 8px 커진 만큼 헤더 상하 패딩을 p-4 → py-3으로 줄여 헤더 높이를 64px로 되돌린다(ADR-054 정정 6)
  └ 안에 초상화 span relative h-8 w-8 overflow-hidden rounded-full bg-surface-2 (32px, 중앙)
    relative를 이 span에 유지할 것 — 40px 슬롯이 크롭 기준이 되면 얼굴이 4px씩 밀린다(ADR-015 기법)
  └ 슬롯 크기는 링 칸 수(주간 12 · 월간 1)와 무관하게 항상 40px 고정 — 탭 전환 때마다 카드가 튀는 것을 막는다
  └ 링은 두 탭·모든 기간에 항상 그리므로 CharacterAvatar의 clearProgress는 널이 아니다(ADR-059)
진행 링(AvatarClearRing): 초상화 "바깥"에 2px 여백을 두고 도는 SVG. 칸 수 = total (주간 12 · 월간 1 = 온전한 원)
  circle × total, r = (40 − stroke)/2 = 19, strokeWidth 2, strokeLinecap round → 안쪽 끝 18 vs 초상화 반지름 16 = 2px 여백
  칸 = strokeDasharray(`${dash} ${둘레 − dash}`) + strokeDashoffset(−(i × seg + stroke/2)), seg = 둘레/total, gap 2.4
      dash = seg − gap − stroke  (round 캡이 양끝을 stroke/2씩 더 그리므로 미리 빼둔다, ADR-054 정정 5)
      └ 안 빼면 갭이 2.4 → 0.4로 뭉개져 12칸이 하나의 원처럼 보인다. dashoffset의 +stroke/2는
        캡이 시작점 뒤로 튀어나온 만큼 밀어 칸을 원래 자리에 앉히는 보정이다(보이는 호 7.55 · 갭 2.4로 butt와 동일)
      └ total = 1(월간)이면 dasharray/dashoffset을 아예 걸지 않고 온전한 원(ADR-059 정정 1) — 간격은
        "칸과 칸을 나누는" 장치라 나눌 상대가 없으면 나눔이 아니라 결손으로 읽힌다. 값 0이 아니라
        속성 생략인 이유는 dash 양끝 둥근 캡이 겹치며 이음매가 비치는 것을 피하기 위함
  채운 칸 stroke-primary / 빈 칸 stroke-border, svg에 rotate-90 + -scale-x-100(12시부터 반시계방향, ADR-059 정정 2)
      └ 좌우 반전이 경로 진행 방향(circle은 3시에서 시작해 시계방향)을 뒤집고 시작점을 9시로 옮기므로,
        반대 방향 90도 회전으로 시작점을 12시에 되돌린다. dash·dashoffset 식은 그대로 둔다 — 부호를
        뒤집으면 round 캡 보정(ADR-054 정정 5)까지 다시 유도해야 한다
  링은 초상화 span의 형제로 두고 슬롯에 absolute — 초상화 span은 overflow-hidden이라 안에 넣으면 stroke 바깥 절반이 잘린다
숫자(n/12): 보류 — 카드에 렌더하지 않는다(정정 7). 회귀 가드 테스트 있음
a11y: 링 자체가 role="img" aria-label="{주간|월간} 보스 처치 8 / 12" — 링이 유일한 표현이라 여기에 레이블이 없으면
      스크린리더 사용자에게는 진행률이 아예 존재하지 않게 된다(숫자를 되살리면 중복 낭독을 재검토할 것)
      레이블의 주기는 탭을 따라간다(ADR-059 결정 7) — 두 탭이 같은 컴포넌트를 쓰므로 "주간" 고정이면 월간 탭에서 거짓말이 된다
```
- **펼침 헤더는 sticky** — [[ADR-047]]: 펼쳤을 때만 `sticky z-[5] bg-surface` + `top` = **페이지 sticky 헤더의 실측 높이**(`ResizeObserver`, 헤더 높이가 탭·경고 문구에 따라 가변이라 상수 불가). `bg-surface`는 아래로 지나가는 보스 행을 가리기 위해 필수다.
  - **헤더에 `rounded-t-*`를 주지 말 것**([[ADR-049]]) — stuck 상태에서 모서리 안쪽이 투명이라 **그 아래를 지나가는 보스 행이 비친다**. 상단 라운딩은 셸의 `overflow: clip`이 담당한다: 클리핑 곡선은 카드 자신의 모서리에만 있어서 카드 한가운데 멈춘 헤더의 노치는 못 덮지만, 헤더가 **사각**이면 stuck 중엔 불투명하고 정지 위치(= 카드 최상단 = 곡선과 일치)에서는 클리핑이 라운딩을 만들어준다. 라운딩의 책임은 헤더가 아니라 카드에 있다.
  - **카드 내부 z 레이어**(`isolate` 안): 드롭 아이콘 `1~3` < sticky 헤더 `5`(하단 페이드 포함) < 골드 회전 샤인 링(`.valuable-drop-card::before`) `6` < 고가 드롭 배지 `10`. 링이 헤더보다 낮으면 테두리 상단·좌우가 헤더 배경에 끊긴다.
  - **고가 드롭 배지도 함께 고정 — 펼침 상태에만**([[ADR-047]] 후속): 배지를 헤더 안에 넣으면 헤더의 `z-[5]` 컨텍스트에 갇혀 골드 링(`z-6`)이 위를 지나간다. 그래서 셸 바깥에 남기고 **높이 0 sticky 레일**(`sticky z-10 h-0`, `top` = `stickyTop + 8`)에 얹는다 — `+8`은 배지의 `-top-2`를 상쇄해 stuck 시 헤더 상단선에 걸치게 하는 값. **접힘 상태는 레일 없이** [[ADR-045]] 원래 구조(`absolute -right-1.5 -top-2 z-10`)를 쓴다 — 접힌 카드는 고정할 헤더가 없고 containing block이 헤더 높이뿐이라 배지만 떠서 어긋난다. 레일은 `absolute inset-x-0 top-0` + `bottom` = **헤더 실측 높이**인 제약 박스 안에 둔다 — 높이 0 레일은 카드 끝까지 붙어 헤더(자기 높이만큼 일찍 떨어짐)와 어긋나므로 범위를 맞춘 것(`absolute`라 레이아웃 영향 없음, `pointer-events-none`/배지만 `auto`).
- **본문 — 보스 행(개별 카드 아닌 통합 리스트)**. 행 높이는 **89px로 고정**한다([[ADR-049]]) — 자식 중 가장 큰 것이 높이를 정하게 두면 드롭 유무·마지막 행 여부로 91.5/89/90.5px처럼 갈린다:
```
행: flex items-start gap-3 p-4 border-b border-border last:border-b-transparent (자체 rounded/bg/border 없음)
    └ last:border-b-0이 아니라 -transparent — 테두리 박스를 남겨야 마지막 행만 1px 짧아지지 않는다
아이콘: BossPortrait(h-10 w-10, 원형)
1줄(이름): flex h-6 w-full items-center gap-1.5 — 난이도 뱃지(20px) + 보스명(text-sm font-semibold text-text, truncate) + DropIndicator
    └ h-6(24px) 고정: 자식(칩 vs 아이콘 스택)에 높이를 맡기지 않는다
2줄(조작): flex items-center justify-between gap-2 mt-2 — 파티원 스테퍼(좌, 24px) / 정산 금액(우, tabular-nums)
합계: p-4(32) + 24 + mt-2(8) + 24 + border(1) = 89px
```
- **DropIndicator**(이름 줄 우측, [[ADR-038]]): 드롭 있으면 아이콘 스택(`h-6` 이미지 최대 3개 + `+N`), 없으면 "＋ 드롭 추가" 칩. 칩도 `inline-flex h-6 items-center`(세로 패딩 없음)로 **아이콘 스택과 같은 24px** — 같은 슬롯을 쓰므로 드롭을 추가해도 줄 높이가 튀지 않는다.
  - **반지 등급 뱃지**(2026-07-30, 사용자 요청): 특수 스킬 반지(=`ringLevel`이 기록된 드롭 — 반지 상자 드릴다운 결과 [[ADR-041]])는 아이콘 **우측 하단에 `lvN` 뱃지**를 얹는다. 드롭 시트 `ItemThumb`의 뱃지와 같은 규칙(`absolute -bottom-1 -right-0.5 rounded-full bg-primary text-[8px] font-bold text-white ring-1 ring-bg`)이되 아이콘이 24px(시트는 36px)라 좌우 패딩만 `px-1`→`px-0.5`로 줄인다. 뱃지는 `absolute`라 **줄 높이(h-6)에 영향 없음**(위 고정 높이 규칙 유지). 스택 겹침(`marginLeft:-2`)·z 순서는 그대로 — 앞 아이콘이 z가 높아 자기 뱃지가 뒤 아이콘 위에 얹힌다.
캐릭터명은 헤더에만(행에서 제거). "가격 미확정" 행도 같은 2줄 구조 유지 — 금액 자리에 배지(`rounded-full bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary-ink`), 스테퍼는 `opacity-40` 비활성.
- **파티원 스테퍼(−/+)**: `inline-flex items-center gap-2 rounded-full border border-border px-1 py-0.5`, 버튼 `h-[18px] w-[18px] rounded-full bg-surface-2`, 값 `text-xs tabular-nums`. 파티 관리 모달과 동일 조작(경계 비활성화).
- **소계 footer 없음**([[ADR-047]] 후속) — 헤더가 sticky라 캐릭터 합계가 스크롤 내내 보이므로 하단 중복 표시를 제거했다. 셸 하단에 닿는 배경 요소를 새로 추가해도 이제는 셸의 `overflow: clip`([[ADR-049]])이 잘라주므로 요소별 `rounded-b-*` 보정은 필요 없다.
- 기본 **전부 접힘** 시작(추적 캐릭터 많을 때 과도한 길이 방지). 리스트 key `${tab}-${periodKey}-${ocid}` 로 탭/기간 이동 시 remount(펼침 상태 리셋, [[ADR-037]]).

### sticky 헤더 — 공용 패턴 + 경계 페이드는 카드 헤더로 이동
제목~총 수익 헤드라인까지 `sticky top-0 z-10 bg-bg`로 고정하고 그 아래 캐릭터 목록만 스크롤한다([foundation/design-system.md](../foundation/design-system.md) "스크롤 영역" 레시피 재사용). 단 **페이지 헤더에는 경계 페이드 오버레이를 쓰지 않는다**([[ADR-047]] 결정 6) — 그 오버레이는 헤더 바로 아래 32px를 `bg-bg`로 덮는데, 펼친 캐릭터 카드의 sticky 헤더가 멈추는 자리가 바로 그 밴드라 stuck 헤더가 가려진다(카드는 `isolate`로 `z-10` 아래). 페이지 헤더의 경계는 총 수익 헤드라인 하단의 `h-px bg-border` 헤어라인이 담당한다. 다른 4개 화면은 페이드를 유지하므로 공용 레시피를 복사할 때 페이지 헤더에 되붙이지 말 것(회귀 가드 테스트 있음).

**대신 페이드는 stuck 카드 헤더 하단으로 옮겼다**([[ADR-047]] 후속) — 중첩 sticky에서는 콘텐츠가 지나가는 경계가 그쪽이기 때문. 레시피는 공용과 동일하고 배경색만 `from-surface`. 단 **헤더의 자식(`top-full`)으로 두면 안 된다** — 헤더가 카드 끝에서 릴리스될 때 페이드가 카드 밖으로 새어나오고, 페이드는 셸 바깥에 있어 셸의 `overflow: clip`([[ADR-049]])도 잡아주지 않는다. 대신 `absolute inset-x-px bottom-px` + `top` = 헤더 실측 높이인 제약 박스 안의 **sticky 요소**(`top` = `stickyTop + 헤더 높이`)로 둔다 — sticky가 자기 박스를 카드 안에 붙잡아준다. 좌우·하단 `px`(1px)는 **셸 테두리 두께만큼 들인 값** — 이 박스는 wrapper(= 셸 border-box) 기준이라 `inset-x-0`이면 페이드가 카드 테두리를 덮는다. CSS로 stuck 여부를 알 수 없어 평상시에도 존재한다.

### 총 수익 헤드라인 (sticky 헤더 최하단) — [[ADR-046]]
`characterGroups` 합계를 보여주는 기간 요약. **카드가 아니다** — 아래 캐릭터 카드가 전부 같은 카드 셸(`rounded-[14px] bg-surface border border-border`)이라, 요약도 카드면 "동일한 흰 카드의 반복"으로 묻힌다([[ADR-046]] 배경). 카드 셸 없이 배경 위 타이포로 두고 색·크기로만 위계를 준다.
```
라벨행: relative flex h-6 items-center — 24px 명시 고정(ADR-054 정정 4)
      └ 라벨의 우연한 높이(16px)에 기대지 않는다 — 못 박아두면 뱃지·칩 유무와 무관하게 줄이 항상 같다
  라벨 text-xs font-semibold tracking-wide text-text-muted — "{periodLabel.primary} 총 수익"
  라벨 옆: 결정석 판매 현황 칩(두 탭·모든 기간) — 흐름 안이지만 h-5라 줄 높이(h-6)를 밀지 않는다(아래 상세)
  우측: 기간 전체 고가 드롭 뱃지(있을 때만) — absolute right-0 top-1/2 -translate-y-1/2
금액행: mt-1.5 flex items-center gap-2.5
  코인 엠블럼 h-8 w-8 rounded-full bg-primary-tint text-primary-ink + ProfitIcon h-[18px] w-[18px] (ADR-066 — 옛 lucide Coins)
  금액 text-xl font-extrabold leading-none tabular-nums text-primary + 단위 "메소" text-xs font-bold text-text-muted
헤어라인: mt-3 h-px bg-border (sticky 헤더 바닥 경계 = 카드 테두리 대체)
```

**결정석 판매 현황 칩**([[ADR-054]] 결정 9·정정 2·3, #53) — **라벨행의 "{기간} 총 수익" 텍스트 옆**에 붙는다(`CrystalSummaryChip`). 새 줄로 두면 sticky 헤더가 그만큼 높아져 목록을 잠식한다(정정 2 — 헤더를 줄여둔 [[ADR-049]] 작업을 되돌리는 셈이었다). **라벨행 높이는 `h-6`(24px)으로 명시 고정하고**(정정 4) 칩은 그 안에 들어가는 `h-5` 다. 전에는 라벨(`text-xs` = 16px)이 우연히 높이를 정해, 그보다 큰 요소를 흐름에 넣는 순간 줄이 커졌다 — 그게 고가 드롭 뱃지(24px)를 `absolute` 로 빼낸 이유다([[ADR-049]] 결정 2). 높이를 못 박으면 그 의존이 끊긴다. 그 뱃지가 여전히 우측 끝을 `absolute` 로 쓰므로 칩은 **좌측(라벨 옆)**에 붙는다. **두 탭 · 모든 기간**에 렌더하고([[ADR-059]] 결정 1 — `isCurrentPeriod` 게이트 제거), 주간 탭은 월드당 한도 90 대비(복수 월드면 `90 × 월드 수`), 월간 탭은 **분모 없이 개수만**(90은 주간 전용 한도라 월간 보스 결정석은 포함되지 않는다 — [[ADR-054]] 결정 8은 그대로 유효하고 적용 기간만 넓어졌다).
```
칩: ml-2 flex h-5 flex-none items-center gap-1 rounded-full bg-primary-tint px-1.5
      └ 라벨행이 h-6(24px) 고정이므로 그 안에 들어가기만 하면 된다. py-*로 높이를 만들지 말 것 —
        글꼴 line-height가 실려 칩이 24px를 넘고, 그러면 h-6 고정이 무의미해진다(leading-none과 함께 쓴다)
  아이콘 img h-4 w-4 flex-none object-contain(alt="")
      주간 intense_power_crystal_weekly.webp / 월간 intense_power_crystal_monthly.webp — null이면 아이콘만 생략
  주간 탭: <span text-xs font-bold leading-none tabular-nums text-primary>{n} <span font-semibold opacity-70>/ {한도}</span></span>
      └ 숫자와 "/" 사이는 실제 공백 문자(마진만으론 textContent가 "34/90"으로 붙어 스크린리더가 이어 읽음)
  월간 탭: 같은 구조에 분모 대신 "개" — 한국어 표기상 숫자에 붙으므로 이쪽은 공백 없음
  복수 월드면 칩이 button(type="button" + aria-expanded + relative z-20) + ChevronDown/Up h-3 w-3 text-primary
      단일 월드·월간 탭이면 button 아님(펼칠 것이 없음) → role="img"
  칩에는 수치만 — "N개 월드"·월드명 같은 부가 정보는 팝오버로 넘긴다("화면에는 간단히", 정정 2)
  a11y: 칩 전체에 aria-label("주간 결정석 판매 34 / 90" · "월간 결정석 3개"), 아이콘은 장식(alt="")
팝오버(복수 월드에서 열었을 때만) — 흐름 밖이라 월드가 몇 개든 헤더 높이 불변:
  absolute left-0 top-full z-20 mt-1.5 min-w-[168px] rounded-[12px] border border-border bg-surface p-2 shadow-lg
      기준 박스는 라벨행(relative)이고 칩이 좌측이라 left-0에 맞춘다(우측은 고가 드롭 뱃지 자리).
      페이지 sticky 헤더가 z-10 스택 컨텍스트라 z-20은 그 안에서만 겨루고,
      헤더 자체가 목록 위에 있어 팝오버는 캐릭터 카드 위로 그려진다([[ADR-047]] 결정 6과 같은 층위)
  제목 p px-1 pb-1.5 text-[11px] font-bold tracking-wide text-text-muted "월드별 판매 현황"
  줄: flex items-center gap-1.5 px-1
      엠블럼 img h-4 w-4 flex-none (worldEmblemUrl, null이면 엠블럼만 생략)
      월드명 text-xs text-text-muted / ml-auto pl-3 "34 / 90" text-xs font-semibold tabular-nums text-text
  바깥 탭 닫기: fixed inset-0 z-10 투명 button(aria-label "월드별 결정석 판매 현황 닫기")
```
접힘 상태는 **월드가 몇 개든 칩 하나**로 고정한다([[ADR-054]] 결정 7·정정 2·3) — 헤더 높이는 `ResizeObserver` 실측이라 변해도 sticky 오프셋은 따라오지만, 헤더가 커지면 목록 영역을 잠식한다. 결정석 아이콘은 `item-icons.json` 에 등록하지 않고 `getItemIconUrlByFile(fileName)` 로 파일명 직접 조회한다(주간/월간 각 1장) — 결정석은 드랍 테이블 항목이 아니라 UI 표시 전용이라 등록하면 `item-icons.test.ts` 의 "드랍 테이블 실재" 정합성 검사를 깬다.

수치 파생: 주간 = `summarizeWorldCrystals(groups)`(그룹 월드 = `bossRows[0]?.world`, `null` 그룹 제외, `Map` 삽입 순서로 결정적) 의 월드별 합, 월간 = `countMonthlyCrystals(groups)`(그룹별 `cycle === 'monthly' && isComplete` 보스명 distinct 합 — 90 한도와 무관한 별개 수치). **주간 탭인데 월드를 아는 캐릭터가 0명이면 칩 자체를 렌더하지 않는다**(대비할 한도가 없음). 월드는 알고 처치가 0이면 `0 / 90` 을 그대로 보여준다. 월간 탭은 처치가 0이어도 `0개` 를 그대로 둔다(사용자 확정 2026-07-29 — 한 달 대부분이 0이지만 "아직 안 잡았다"도 정보다).
뱃지는 **레이아웃 흐름 밖**(`absolute`)에 둔다([[ADR-049]]) — 흐름에 있으면 뱃지 유무로 라벨행이 16 ↔ 24px로 튀고, 뱃지에 붙일 탭 확대 애니메이션이 주변을 밀게 된다.
새 색 신설 금지 — 기존 토큰만 쓴다(금액·엠블럼 `primary`, 라벨·단위 `text-muted`, 결정석 수치 `text`). **캐릭터 수는 표시하지 않는다**(중요 정보 아님, [[ADR-046]] 결정 5). 보스 처치 수는 같은 결정으로 한 번 배제됐다가 결정석 판매 현황 줄로 되살아났다([[ADR-054]] 결정 9 — 통계가 아니라 한도 대비 소진량이라는 새 의미를 얻었기 때문. 아래 history 참고). 단위 "메소"는 별도 span이지만 숫자와 사이에 실제 공백 문자를 남긴다(마진만으론 `textContent`가 "N메소"로 붙어 스크린리더가 붙여 읽음).

### 주간/월간 탭 + 기간 네비게이터 — [[ADR-023]]
탭은 탭 토글 레시피 재사용(주간/월간, 카운트 배지 없음). **동기화 상태 영역은 제목 줄이 아니라 탭과 같은 줄** 우측(`ml-auto`)에 붙인다([[ADR-049]]). 이 줄의 높이는 활성 탭 pill 기준 **30px**이므로 새로고침 버튼도 `h-[30px] w-[30px]`로 맞춘다 — 기본 `p-2`(32px)면 새로고침이 없는 과거 기간과 2px 어긋난다.
네비게이터:
```
네비게이터: flex items-center justify-center gap-4 (탭 다음 줄)
이전/다음 버튼: h-7 w-7 rounded-full border border-border ... text-text disabled:opacity-30
라벨: 1줄 text-sm font-semibold text-text(상대/절대), 2줄 text-xs text-text-muted tabular-nums mt-0.5(정확 날짜, 항상)
```
최신 기간에서 다음 버튼 `disabled`.
- **빈 상태·조회 불가**([[ADR-060]]): 처치 기록 0건은 공용 `EmptyState`(inline, `ProfitIcon` — 탭바·헤드라인과 같은 아이콘([[ADR-066]]), "아직 처치한 보스가 없습니다", **CTA 없음** — 앱 안에 할 일이 없다). 롤링 조회 윈도우 밖([[ADR-032]])은 빈 상태가 아니라 `UnavailableNotice`(정보 톤) — 기간 목록은 기본형, 캐릭터 카드 안은 `compact`. 레시피는 [design-system.md](../foundation/design-system.md).
  - **여섯 상태의 표현은 [[ADR-068]]에서 확정**(`/debug/period-states` 시안 비교, 2026-07-31). 프리미티브 3종을 그대로 쓰고 `notCollected` 만 **넷째 얼굴**(단독 `Clock` + `bg-surface-2` 중립 톤 + 액션 없음)을 받는다 — 고칠 수 없는 제약이지만 시간이 지나면 스스로 풀리므로 "영구히 확인할 수 없다"와 같은 말을 하면 거짓말이 된다. 이 톤은 새 컴포넌트가 아니라 `UnavailableNotice` 의 변형으로 흡수한다.
  - **문구**: `notCollected` = "아직 집계되지 않았습니다 / 이 기간 기록이 준비되면 자동으로 채워집니다"(시각을 암시하는 표현 금지 — 집계 시각 미계측). `outOfRange` 의 기간은 **"최근 14일"** — 코드 상수는 13이지만 그것은 정산 시각으로 마지막 날이 몇 시간 일찍 닫힌 결과이고 넥슨 한도 자체는 14일이다([[ADR-068]] 결정 1, [nexon-api.md](../foundation/nexon-api.md)).
  - **총 수익 헤드라인**은 금액을 모르는 네 상태에서 `0 메소` 대신 **대시(`—`)** 를 쓴다 — `0` 은 "0원 벌었다"로 읽힌다. `confirmedEmpty` 만 `0 메소` 다.
- **기간 미보유 자동 재조회 스피너**: 공용 셸 승계 카드 `LoadingState size="inline"`([[ADR-061]] 결정 2·3·4) — `MapleSweepSpinner size={24}` + "5월 2주차 기록을 불러오고 있어요". 백필이 끝나면 같은 자리·같은 껍데기(`rounded-[14px] border border-border bg-surface`)에 캐릭터 카드가 들어온다. 미접속 기간 문구는 미정.
- **월간 탭 — 주차별 합계 + 월간 보스**: 보스 나열 대신 그 달 `cycle: weekly` 를 주차(시작 목요일 속한 달 기준 N주차)로 묶어 합산 후 `cycle: monthly` 상세를 이어 붙임. 아코디언 본문 셸 안 두 서브섹션:
```
서브섹션 라벨: px-4 pt-3 pb-1 text-[11px] font-bold tracking-wide text-text-muted bg-surface-2
주차 행: flex items-center gap-3 p-4 border-b border-border (보스 아이콘 없음 — 합계라 이미지 없음)
  라벨 "N주차" + 날짜 범위, 진행 중 배지(bg-primary-tint text-primary-ink text-[10px]) "진행 중", 금액 우측 tabular-nums
아직 시작 안 한 주 행 전체: opacity-40 ("예정")
월간 보스 상세 행: 위 아코디언 본문 레시피 그대로
```
월간 탭의 주차별 합계 집계와 임의 과거 기간 이동은 구현됨(`BossProfitScreen` monthly 탭 "주간 보스 수익 · 주차별 합계", `boss-profit-period.ts` 의 periodKey ±이동).

### 고가 드롭 강조 — [[ADR-045]]
그 주차에 고가 아이템(`isValuableDrop`)을 먹은 항목을 네온 골드(`#f7d00d`)로 강조. `index.css` plain 클래스 3종, 모든 모션은 `prefers-reduced-motion: no-preference` 에서만(정적 폴백).
- `.valuable-drop-card`(접힘 캐릭터 카드): `::before` `conic-gradient`+`mask(xor)` 2px 링을 `@property --vd-angle` 로 회전(회전 샤인 테두리) + `box-shadow` 글로우 맥동. 우상단 획득 아이템 배지(`Sparkles`+아이템 아이콘). `@property` 미지원 WebView는 정적 골드 테두리로 degrade.
- `.valuable-drop-card--expanded`(펼침): 요소 자신 glow 맥동만 정지(회전 샤인 유지). 복합 선택자로 `@media` 규칙보다 명시도 우선. 링 `::before`는 `z-index: 6` — 펼침 sticky 헤더(`z-[5]`)의 불투명 배경에 테두리가 끊기지 않도록([[ADR-047]]). 펼침에선 링 반경을 **13px**로 낮춘다([[ADR-049]]) — 셸 `overflow: clip`이 패딩 박스(반경 13px)에서 자르므로 14px면 모서리 바깥이 깎인다. 글로우는 요소 자신의 `box-shadow`라 클리핑 대상이 아니다.
- `.valuable-drop-row`(펼침 시 고가 획득 보스 행): 테두리/글로우 아닌 **배경** — 아이템 쪽(`radial-gradient at 82% 50%`) 골드 글로우 + 미세 틴트 맥동. `<li>` 자체 `background`.
- **총 수익 헤드라인 뱃지**([[ADR-046]]): 같은 배지 컴포넌트를 기간 전체 집계(`collectAllValuableDrops` = 캐릭터 그룹별 `collectGroupValuableDrops` 합집합)로 라벨행 우측에 재사용. 배치·라벨만 호출부가 정하고(카드 = `absolute -right-1.5 -top-2 z-10`·`aria-label="고가 드롭"`, 헤드라인 = 인라인·`aria-label="이 기간 고가 드롭"`) 외형·아이콘 스택(최대 3 + `+N`) 규칙은 단일 구현. 드롭 없으면 미렌더.

## SQLite 안정성
`applyDownloadedLiveUpdate()`(`CapacitorUpdater.set()`)가 JS 컨텍스트를 파괴하는 리로드 전에 SQLite 커넥션을 정상 종료하지 않으면 stale 커넥션이 남아 과거 수익 데이터 로드가 조용히 멈춘다 → `storage/sqlite/db.ts` 의 `closeBossProfitDb()` 로 리로드 전 미리 닫음([[ADR-008]] 세 번째 정정). 읽기 조회는 `withSqliteFallback`(타임아웃 폴백), 쓰기는 `withSqliteTimeout`(타임아웃을 실패로 전파 — 성공 위장 시 영구 유실 위험).

## 열린 질문
- **`notChecked` 조회 버튼을 누른 뒤 실패하면** 그 행이 `failed`로 바뀌는지, 토스트로 알리고 상태를 유지하는지([[ADR-068]] 적용 범위 밖).
- **빈 기간이 여러 개일 때의 번거로움** — 이전 게이트만 넓히는 안([[ADR-068]] 결정 5)은 빈 기간 수만큼 ‹ 를 눌러야 기록에 닿는다. 실제로 불편하면 기간 목록 시트(시안 B)를 후속으로 검토한다.
- **조회 불가 계정을 고른 뒤의 되돌리기** — 온보딩이 계정 재선택으로 안내할지([[ADR-068]] 결정 4는 경고 표시까지만 정했다).
- 결정 시세 시점별 이력화 필요 여부([../foundation/game-data.md](../foundation/game-data.md)).
- 월드 결정석 한도(`n/90`)가 추적 밖 캐릭터의 처치를 못 세는 한계를 **UI 주석 문구로도 알릴지** 여부([[ADR-054]] 트레이드오프 — 헤드라인을 더 늘리지 않으려 구현 범위에서는 제외했고, 문서에는 위 "알려진 한계"로 남겼다. 사용자 문의가 실제로 생기면 후속 결정으로 다룬다).

## 폐기된 정책 (history)
- ~~기간 백필 로딩을 점선 박스 + CSS 링 스피너로 표시~~ → 공용 셸 승계 카드 `LoadingState size="inline"` + `MapleSweepSpinner`. 점선은 빈 상태 전용이라 로딩과 구분이 안 됐다([[ADR-061]], 2026-07-30).
- ~~아코디언 아바타를 이니셜로 둘지 `character/basic` 이미지로 바꿀지 미정~~ → `character-basic-cache` 의 `imageUrl`(없으면 이니셜 폴백)로 확정·구현 완료(`CharacterAvatar`, `getSortedCharacterInfo`가 정렬용 캐시 조회 김에 함께 반환) — [[ADR-023]] "미확정" 해소.
- ~~파티원 수를 캐릭터별로 계속 수동 입력~~ → 캐릭터+보스+난이도 조합별 로컬 저장 + 자동 기록([[ADR-014]]).
- ~~기본 파티원 수 = 가장 최근 기록값 이어받기~~ → `boss_party_settings` 설정 조회로 완전 대체([[ADR-019]]).
- ~~월간 보스(검은마법사)를 이 화면에서 제외~~ → 주간/월간 탭 도입으로 월간 탭에서 부활([[ADR-023]], [[ADR-017]] 미확정 해소).
- ~~아코디언 헤더 합계 + 섹션 타이틀 "이번 주 합계 N 메소" 중복 표시~~ → 섹션 타이틀 합계 제거(합계는 헤더에만)([[ADR-017]]).
- ~~펼침 본문 하단 소계 footer("{캐릭터명} 합계" + 금액, `bg-surface-2 rounded-b-[14px]`)~~ → 헤더 sticky로 합계가 상시 보이므로 제거([[ADR-047]] 후속, 2026-07-28). [[ADR-023]]의 소계 footer 결정을 폐기하며, [[ADR-017]]의 "합계는 헤더에만" 원칙으로 되돌아간 셈.
- ~~아코디언 헤더 = "{캐릭터명} · {합계} 메소" 한 줄, 보스 행 = 개별 카드~~ → 아바타+이름+금액 분리, 보스 행 통합 리스트([[ADR-023]]).
- ~~과거 기록 파티원 수 읽기 전용(잠정)~~ → 항상 편집 가능([[ADR-032]], PRD #46).
- ~~보스 표시 순서가 로드/렌더마다 달라짐~~ → 정규 순서 2차 정렬로 고정([[ADR-036]]).
- ~~이전 기간 게이트를 `isEarliestNavigablePeriod` 로 직접 판정(경계 이원화)~~ → `canGoPreviousPeriod` 파생 상태로 통일([[ADR-037]], [[ADR-032]] 잔여 해소).
- ~~동기화 상태 영역(시각 텍스트 + 새로고침 버튼)이 제목 줄 우측~~ → 주간/월간 탭과 같은 줄, 버튼 30px([[ADR-049]], 2026-07-28).
- ~~총 수익 라벨행이 `justify-between` flex — 고가 뱃지가 줄 높이(16→24px)에 참여~~ → 뱃지 `absolute`로 흐름 이탈([[ADR-049]]).
- ~~셸에는 어떤 `overflow` 클리핑도 걸 수 없다([[ADR-047]] 결정 2)~~ → `overflow: clip`은 스크롤 컨테이너를 만들지 않아 sticky와 공존한다([[ADR-049]]). 금지 대상은 `overflow-hidden`뿐.
- ~~보스 행 높이가 자식 중 최대값으로 결정(91.5/89/90.5px 혼재)~~ → 이름 줄 `h-6`·칩 `h-6`·`last:border-b-transparent`로 89px 고정([[ADR-049]]).
- ~~`BossPortrait` 원형 아이콘은 크롭 미지원(cover/center 고정)~~ → `size`/`crop` prop 지원, `boss-portrait-icon-crops.json` 조회(2026-07-14).
- ~~SQLite 기록 조회가 타임아웃되면 "기록 없음"으로 보고 그대로 자동 기록(`party_size = 1`)~~ → 조회 실패와 기록 없음을 구분해, 실패면 자동 기록을 건너뜀([[ADR-050]] 결정 3, 2026-07-29). 폴백이 실패를 성공으로 위장해 사용자가 저장한 파티원 수를 덮어쓰는 데이터 손상 경로였다.
- ~~총 수익 헤드라인에 **보스 처치 수**를 표시하지 않는다(중요 정보 아님, [[ADR-046]] 결정 5)~~ → 주간 결정석 판매 현황 줄로 부활([[ADR-054]] 결정 9, 2026-07-29). 같은 숫자지만 의미가 달라졌다 — "몇 마리 잡았나"라는 통계가 아니라 **월드당 판매 한도 90 대비 소진량**이라 이번 주에 결정을 더 팔 수 있는지를 사용자가 바로 판단한다. **캐릭터 수 미표시는 그대로 유효하다**(의미가 달라지지 않았다).
- ~~결정석 칩·처치 진행 링은 주간 탭 · 현재 기간에만 표시([[ADR-054]] 결정 4)~~ → 두 탭 · 모든 기간으로 확장([[ADR-059]], 2026-07-29). 근거 두 개 중 "과거 기간 과소집계"는 `priceMeso: null` 인 항목이 **벨로나(미출시)뿐**이라 실질 영향이 0이었고, "월간 탭엔 주간 원본 없음"은 표시 여부가 아니라 **월간 탭에 무엇을 표시할지**의 문제였다 — 월간 링을 주간 합산이 아니라 **월간 보스 기준**(`MONTHLY_BOSS_COUNT`)으로 정의해 store 변경 없이 해결했다.
