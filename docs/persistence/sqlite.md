# SQLite

기록은 SQLite DB 하나(이름 `boss_profit`, 파일 `boss_profitSQLite.db`)에 있다. `@op-engineering/op-sqlite` 로 열고,
파일은 Capacitor 앱이 쓰던 위치에 그대로 있다(`capacitor-storage.md`). 커넥션과 스키마 변경 규칙은 [[ADR-007]] 에
있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `storage/sqlite/db.ts` | 테이블 정의(`TABLE_DEFINITIONS`) · 기기 변환 단계에 맞는 보스 · 가계부 · 강화 표 정의 고르기(`tableDefinitionsAt`) · DB 열기와 닫기 · 칸 보강(`ensureColumn`) · 버전 23 전 DB 의 옛 표 준비(`prepareLegacyTables`) · `income_records` 재작성 |
| `storage/sqlite/legacy-tables.ts` | 버전 23 이 지우는 옛 표 여섯의 정의. 앞 버전 이관이 읽는 모양이라 고치지 않는다 |
| `storage/sqlite/boss-tables.ts` | 보스 기록 표의 정의 세 무리. 버전 14 전의 옛 표 셋(버전 4 · 12 가 이 정의로 다시 만든다), 버전 14 의 표 셋(기기 변환 전 DB), 기기 변환이 만드는 지금 표 셋이다. 앞의 둘은 앞 버전 이관이 읽는 모양이라 고치지 않는다 |
| `storage/sqlite/cashbook-tables.ts` | 가계부 기록 표 여섯과 인벤토리 표의 정의 두 무리 · 날짜 인덱스. 기기 변환 전의 표(`UNCONVERTED_…`, 앞 버전 이관이 읽는 모양)와 변환이 만드는 지금 표다. 인벤토리 한 줄 기준 인덱스는 변환 전 표에만 건다 |
| `storage/sqlite/remembered-level-tables.ts` | 강화 레벨 기억 표의 정의. 기기 변환 전 표와 지금 표다 |
| `storage/sqlite/record-key-tables.ts` | 버전 16 이 uuid 기본키로 다시 쓴 다섯 표(캐릭터 · 월드 리프 · 강화 조회 기록 · MVP 등급 · 메이플 ID 소속)의 정의. 월드 리프와 MVP 등급은 기기 변환 전 표(`UNCONVERTED_…`, 앞 버전 이관이 읽는 모양)와 변환이 만드는 지금 표 둘이다 |
| `storage/sqlite/enhancement-tables.ts` | 강화 합계와 강화 내역을 받는 데 딸린 표(다시 매기기 · 그날 이름 · 처음 값이 온 날 · 다시 받을 날)의 정의 · 날짜 인덱스. 강화 합계는 기기 변환 전 표(버전 18 의 모양)와 지금 표 둘이다 |
| `storage/sqlite/migrations.ts` | 값을 옮기는 버전 이관(`DB_VERSION` 23) |
| `storage/sqlite/device-conversion.ts` | 1.0.15 기기 변환의 단계 목록과 돌리는 함수(`runDeviceConversion`). 아직 안 돈 단계를 한 트랜잭션으로 돌리고 마친 번호를 `device_conversion` 에 적는다. 돌 단계가 있으면 먼저 `…-before-1.0.15.db` 사본을 뜬다([[ADR-286]] 결정 1) |
| `storage/sqlite/convert-boss-tables.ts` | 기기 변환의 보스 기록 단계(`convertBossTables`). 버전 14 의 표 셋을 지금 표 셋으로 옮기고 옛 표를 지운다([[ADR-286]] 결정 3) |
| `storage/sqlite/convert-cashbook-tables.ts` | 기기 변환의 가계부 단계(`convertCashbookTables`). 주인을 모르는 옛 손입력을 붙인 뒤 가계부 기록 표 여섯 · 인벤토리 · 강화 레벨 기억을 지금 표로 옮기고 옛 표를 지운다([[ADR-286]] 결정 4 · 5 · 9 · 10) |
| `storage/sqlite/legacy-cashbook-entries.ts` | 변환 전 가계부 표를 쓰는 SQL. 버전 15 가 옮긴 기록을 넣는 일과 가계부 단계가 주인을 모르는 옛 손입력을 붙이는 일이다 |
| `storage/sqlite/convert-enhancement-tables.ts` | 기기 변환의 강화 합계 · 월드 리프 · MVP 등급 단계(`convertEnhancementTables`). 세 표를 지금 표로 옮기고 옛 표를 지운다([[ADR-286]] 결정 6) |
| `storage/sqlite/transaction.ts` | 쓰기 여럿을 트랜잭션 하나로 묶는 `inTransaction`. 같은 연결의 트랜잭션은 차례로 돈다. 겹쳐 열면 SQLite 가 뒤의 것을 거절하기 때문이다(앱을 켤 때 계정 칸 채우기와 강화 합계 옮기기가 겹쳤다). 그래서 `work` 안에서 다시 부르면 멈춘다. 트랜잭션 안에서 못 도는 `VACUUM` 은 같은 줄 뒤에 세운다(`outsideTransaction`) |
| `storage/legacy-space.ts` | 옛 표를 다 지운 뒤 한 번 사본 파일을 지우고 `VACUUM` 하는 회수([[ADR-078]] 결정 11) |
| `storage/sqlite/uuid.ts` | 행 식별자를 SQLite 가 만드는 식(`NEW_UUID_SQL`) |
| `storage/adapters/rn-sqlite.ts` | `SqlitePort` 구현(op-sqlite). DB 옆 파일 지우기(`removeFile`)는 expo-file-system 으로 한다 |
| `storage/adapters/capacitor-sqlite-open.ts` | 파일 이름과 디렉터리 규칙 |
| `storage/sqlite/__tests__/node-sqlite-port.ts` | 테스트용 `SqlitePort`. Node 내장 `node:sqlite` 로 실제 엔진을 돌린다 |

## 열 때 하는 일

`getBossProfitDb()` 를 처음 부르면 이 순서로 실행된다. 커넥션은 앱 전체에서 하나다.

1. 같은 이름의 커넥션이 남아 있으면 닫는다.
2. `PRAGMA foreign_keys = ON` 으로 외래키를 켠다. op-sqlite 는 기본이 꺼져 있어, 켜지 않으면 `ON DELETE CASCADE` 가
   안 돈다. 트랜잭션 안에서는 이 문장이 먹지 않아 맨 앞에서 켠다.
3. 표가 하나도 없으면 새로 설치한 기기로 본다(9 단계가 쓴다).
4. `device_conversion` 표를 만들고, 거기 적힌 단계 번호로 보스 기록 표, 가계부 기록 표 · 인벤토리 · 강화 레벨 기억, 강화 합계 ·
   월드 리프 · MVP 등급을 어느 정의로 만들지 고른다. 그 단계까지 돈 DB 는 지금 표, 아니면 변환 전 표(보스는 버전 14 의 표 셋)다. 번호를 보지 않으면 변환이
   지운 표가 빈 표로 다시 생기거나 지금 표에 옛 칸을 더하려다 DB 가 열리지 않는다.
5. `user_version` 이 23 보다 작으면 옛 표 여섯(`LEGACY_TABLE_DEFINITIONS`)을 만들고, `income_records.meso_amount` 가
   `NOT NULL` 이면 그 표를 다시 쓰고, 옛 표에 나중에 생긴 칸을 더하고, 옛 `boss_drop_records` 의 빈 분배 칸을 채운다. 앞
   버전 이관이 이 모양을 읽는다. 23 이상이면 건너뛴다. 지운 옛 표가 빈 표로 다시 생기지 않게 하려는 것이다([[ADR-078]] 결정 9).
6. 고른 보스 · 가계부 표 정의와 `TABLE_DEFINITIONS` 의 `CREATE TABLE IF NOT EXISTS` 를 모두 실행한다.
7. `ensureColumn` 으로 나중에 생긴 칸을 지금 테이블에 더한다. 버전 14 표의 칸(`crystal_excluded` · `over_crystal_limit`), 변환 전
   가계부 표의 칸(`ensureUnconvertedCashbookColumns`), 변환 전 강화 합계의 칸(`from_star` · `to_star` · `superior_cost_meso`)은 그
   단계의 변환 전 DB 에만 더한다. 변환 뒤에는 그 표나 칸이 없거나 처음부터 있다.
8. `user_version` 보다 큰 버전 이관을 차례로 실행한다.
9. 새로 설치한 기기면 기기 변환을 곧바로 돌린다. 바꿀 줄이 없어 게임 데이터 없이 돌고 사본을 뜨지 않는다.
10. 인덱스 `enhancement_totals_date` 를 만든다. 변환 전 표와 지금 표 모두 같은 칸에 건다. 가계부 단계까지 돈 DB 는 `cashbook_entries_date` 를, 그 전 DB 는
    `cashbook_entries_entry_date` 와 유일 인덱스 `inventory_items_owner_item` 을 만든다. 보스 단계 전 DB 에는 `boss_drops_period`
    도 만든다. 변환 뒤의 표에는 옛 인덱스의 칸이 없다.

열기는 10초, 닫기(`closeBossProfitDb`)는 5초 상한이 있다. OTA 적용과 데이터 삭제는 리로드 전에 닫는다.

`getBossProfitDb()` 는 1.0.15 기기 변환이 끝날 때까지 기다린다(`storage/record-hold.ts`). 부팅(`boot.ts` 의 `loadGameData`)이
막기를 걸고, SQLite 변환과 Preferences 변환이 다 끝나면 푼다. 새 앱 코드가 옛 모양의 기록 표를 읽지 않게 하려는 것이다. 게임 데이터 사본 · 조회 캐시 · 사용 로그와 변환은 잠금 화면
동안에도 써야 해서 기다리지 않는 `getBossProfitDbUngated()` 를 쓴다([[ADR-286]] 결정 1). 서버 신원이 읽는 메인 키의 메이플 ID
(`character_accounts`)도 이 연결로 읽는다. 변환이 실패한 실행에서 사용 로그를 보낼 때도 신원이 필요하다.

## 테이블

외래키는 보스 기록 표 둘과 가계부 기록 표 여섯에만 있다. `boss_profit_entries` → `boss_drops`, 그리고
`cashbook_entries` → `cashbook_entry_items` · `cashbook_entry_hunt_inputs` · `cashbook_entry_fragment_uses` · `cashbook_entry_transfer_inputs` ·
`cashbook_entry_exchange_inputs` 차례로 부모를 가리키고, 부모를 지우면 자식도
지워진다(`ON DELETE CASCADE`). 보스 분배 설정(`boss_split_settings`)은 수익 건의 부모가 아니다. 가계부 품목의 `inventory_item_id` 도 `inventory_items` 를 가리키고, 그 줄을 지우면 비운다(`ON DELETE SET NULL`). 다른 표 사이의 관계는 앱 코드가 같은 키로 이어 읽는 것뿐이라서,
한쪽만 지우면 짝이 없는 행이 남는다. 그래서 데이터 삭제는 서로 이어 읽는 표를 한 그룹으로 함께 지운다(`lifecycle.md`).

`데이터 삭제` 칸은 데이터 삭제의 어느 그룹이 그 표를 지우는지다. `남긴다` 는 어떤 그룹도 지우지 않는 표다. `행 단위` 는
한 표에 두 그룹의 행이 섞여 있어 표를 통째로 지우지 않는 표다(`storage/cache-data.ts` 의 `CLEAR_BOSS_RECORDS` ·
`CLEAR_BOSS_SPLITS`).

옛 보스 기록 표 넷(`boss_profit_records` · `boss_party_settings` · `boss_party_period_overrides` · `boss_drop_records`)은
버전 14 가 새 표 셋으로, 옛 가계부 표 둘(`income_records` · `spend_records`)은 버전 15 가 기록 표 셋으로 옮겼다. 여섯은
버전 23 이 지운다([[ADR-078]] 결정 9). 옛 강화 원본(`enhancement_history`)은 합계로 옮긴 뒤 코드가 지운다. 다 지운 뒤 한 번
사본 파일(`…-before-v15.db`)을 지우고 `VACUUM` 한다([[ADR-078]] 결정 11). 버전 14 의 보스 기록 표 셋(`boss_parties` ·
`boss_party_periods` · `boss_drops`)은 1.0.15 기기 변환이 아래 표 셋으로 옮기고 지운다([[ADR-286]] 결정 3). `boss_drops` 는
칸이 바뀐 같은 이름의 표가 된다. 변환 전 DB 는 옛 표 셋을 그대로 쓴다. 그래서 아래 표에서 뺐다.

| 테이블 | 기본키 | 담는 것 | 쓰는 곳 | 데이터 삭제 | 문서 |
|---|---|---|---|---|---|
| `boss_split_settings` | `id`(uuid, `(ocid, boss_difficulty_id)` 는 UNIQUE) | 캐릭터 · 보스 난이도마다의 보스 관리 파티 설정. 분배를 정한 줄만 있다 | `storage/boss-party-settings.ts` | 지운다 (수동 선택 항목) | [[ADR-078]] |
| `boss_profit_entries` | `id`(uuid, `(ocid, boss_difficulty_id, period_code)` 는 UNIQUE) | 한 캐릭터가 한 기간에 한 보스 난이도에서 거둔 수익 한 건. `clear_recorded_by` 가 차 있으면 처치 기록(결정석 가격 · 받은 메소 · 처치 날짜 · 분배)이고, 비어 있으면 그 기간만 고친 분배나 드롭만 있다. 월드도 여기 있다 | `storage/boss-profit.ts` · `storage/boss-party-period-overrides.ts` · `storage/boss-periods.ts` | 행 단위(처치는 보스 처치 · 드롭, 그 기간 값은 수동 선택 항목) | [[ADR-078]] |
| `boss_drops` | `id`(uuid, 서버의 `drop_record_id`, `(profit_entry_id, item_id)` 는 UNIQUE) | 수익 건에 붙는 드롭 한 개와 판매가 · 받는 메소 · 분배 · 수수료. 상태는 서버 `boss_drops` 와 같은 `price_status` | `storage/boss-drops.ts` | 지운다 (보스 처치 · 드롭) | [[ADR-078]] |
| `character_profiles` | `id`(uuid, `ocid` 는 UNIQUE) | 기록 옆에 보일 캐릭터 이름 · 초상 주소 · 월드 · 레벨 · 직업. 리프 자동 판정이 읽는 만든 날 | `storage/character-profiles.ts` | 남긴다 | `features/character.md` |
| `character_world_leaps` | `id`(uuid, `previous_ocid` 는 UNIQUE) | 월드 리프로 바뀐 옛 ocid 와 그 캐릭터의 지금 ocid 의 연결. 리프한 기간의 중복 기록을 정리하고 옛 ocid 의 기록을 새 ocid 로 옮기는 데 쓴다([[ADR-101]] 결정 22). 다시 리프하면 앞 연결의 `ocid` 도 새 ocid 로 옮긴다([[ADR-286]] 결정 6) | `storage/character-world-leaps.ts` | 남긴다 | `features/character.md` |
| `enhancement_totals` | `id`(uuid, `(ocid, history_date, category, item_name)` 는 UNIQUE) | 강화 내역을 날짜 · 캐릭터(ocid) · 분류 · 넥슨이 준 장비 이름별로 묶은 합계. 응답이 준 그날 이름을 그날 그 이름이었던 캐릭터에 붙여 적는다. 그 캐릭터의 메이플 ID 와 그날 이름은 읽을 때 `character_accounts` · `character_dated_names` 에서 찾는다. 비용은 MVP 할인 전 시도 비용과 할인을 받지 않는 파괴 방지 · 슈페리얼 비용이고, 스타포스는 그날 첫 성과 끝 성을 든다. 이벤트 월드 판정도 든다 | `storage/enhancement-totals.ts` | 지운다 (강화) | [[ADR-100]] · [[ADR-101]] |
| `enhancement_history` | `id` | 옛 강화 응답 원본. 새 기기에는 만들지 않는다. 옛 기기는 합계로 옮기는 부팅 단계만 읽고, 옮긴 뒤 지운다 | `storage/enhancement-history.ts` | 남긴다 | [[ADR-100]] · [[ADR-101]] |
| `enhancement_recomputes` | `id`(uuid, `(nexon_account_id, request_key)` 는 UNIQUE) | 강화 비용 다시 매기기 요청을 넥슨 계정마다 어디까지 받았는지와 끝났는지 | `storage/enhancement-recomputes.ts` | 지운다 (강화) | [[ADR-100]] |
| `enhancement_history_checks` | `id`(uuid, `(nexon_account_id, enhancement_type, history_date)` 는 UNIQUE) | 강화 내역을 넥슨 계정 · 날짜별로 조회했는지 기록 | `storage/enhancement-history.ts` | 지운다 (강화) | `features/cashbook.md` |
| `enhancement_refetches` | `id`(uuid, `(nexon_account_id, enhancement_type, history_date)` 는 UNIQUE) | 다시 받아야 하는 강화 내역의 날. 버전 18 이관과 옛 원본 옮기기가 캐릭터에 붙이지 못한 줄의 날을 적는다. 가계부 · 통계 화면의 회차가 끝난 뒤 수집기가 따로 받아 굳히면 지운다 | `storage/enhancement-refetches.ts` | 지운다 (강화) | [[ADR-101]] |
| `character_dated_names` | `id`(uuid, `(ocid, history_date)` 는 UNIQUE) | 캐릭터의 그날 이름과 월드 이름. 강화 줄의 이름을 캐릭터에 붙일 때 `character/basic` 에 날짜를 넣어 받은 값이다. 그날 값이 없으면 이름이 `NULL` 이다 | `storage/character-dated-names.ts` | 지운다 (강화) | [[ADR-101]] |
| `character_first_days` | `id`(uuid, `ocid` 는 UNIQUE) | 캐릭터의 만든 날과 처음 값이 온 날 · 그날 이름. 리프 전 기간을 가른다 | `storage/character-first-days.ts` | 지운다 (강화) | [[ADR-101]] |
| `cashbook_entries` | `id`(uuid) | 가계부에 손으로 적은 수입 · 지출 한 건. 날짜 · 분류 줄 · 캐릭터나 메이플 ID. 수입인지 지출인지는 분류 줄이 안다. 캐릭터 기록은 적을 때의 월드를, 인벤토리에서 판 기타 조각 기록은 판 조각의 월드를 든다. 아이템 구매 · 판매는 메모를 든다 | `storage/income.ts` · `storage/spend.ts` | 지운다 (가계부) | [[ADR-096]] · [[ADR-161]] · [[ADR-048]] |
| `cashbook_entry_items` | `id`(uuid, `(entry_id, spend_reward_type_id)` 는 UNIQUE) | 기록의 품목. 분류가 정한 표의 줄(대상) 또는 직접 친 이름, 수량 · 레벨, 금액 · 수수료 · 관세, 헥사 강화의 조각 칸 넷과 보관 체크 칸 둘, 인벤토리에서 판 판매가 가리키는 인벤토리 줄 | `storage/cashbook-entries.ts` | 지운다 (가계부) | [[ADR-096]] · [[ADR-209]] |
| `cashbook_entry_hunt_inputs` | `id`(uuid, `entry_id` 는 UNIQUE) | 사냥 기록의 계산기 입력 | `storage/cashbook-entries.ts` | 지운다 (가계부) | [[ADR-096]] |
| `cashbook_entry_transfer_inputs` | `id`(uuid, `entry_id` 는 UNIQUE) | `주간 보스 수입 이전` 시트 입력. 이 줄이 있는 `기타` 지출은 그 시트로 연다 | `storage/cashbook-entries.ts` | 지운다 (가계부) | [[ADR-047]] |
| `cashbook_entry_exchange_inputs` | `id`(uuid, `entry_id` 는 UNIQUE) | `메소마켓 환전 수수료` 시트 입력. 이 줄이 있는 `기타` 지출 · 수입은 그 시트로 연다 | `storage/cashbook-entries.ts` | 지운다 (가계부) | [[ADR-047]] |
| `cashbook_entry_fragment_uses` | `id`(uuid, `(entry_id, fragment_source, ocid)` 는 UNIQUE) | 기록이 보관에서 가져온 조각을 보관마다 한 줄. 사냥 조각(`hunt`)은 캐릭터, 인벤토리의 기타 조각(`inventory`)은 그 기록의 메이플 ID · 월드의 것이다. 보관 개수가 이것을 뺀다 | `storage/cashbook-entries.ts` | 지운다 (가계부) | [[ADR-137]] · [[ADR-209]] |
| `inventory_items` | `id`(uuid. 장비가 아닌 줄은 `(account_id, world_id, item_id)` 가 한 줄이고 저장 코드가 지킨다) | 인벤토리에 넣은 아이템. 메이플 ID · 월드의 아이템 하나가 한 줄이고 장비는 하나가 한 줄이다. 남은 개수는 판매 · 조각 사용을 빼서 센다 | `storage/inventory.ts` | 지운다 (가계부) | [[ADR-209]] |
| `remembered_levels` | `id`(uuid, `(ocid, type, target_id)` 는 UNIQUE) | 캐릭터의 심볼 · 헥사 코어 강화 레벨 기억. 추적을 시작할 때 넥슨 값으로 채우고 기록을 저장 · 고치기 · 지우기 할 때 옮긴다 | `storage/remembered-levels.ts` | 지운다 (가계부) | [[ADR-137]] |
| `mvp_grade_history` | `id`(uuid, `(account_id, from_date)` 는 UNIQUE) | 메이플 ID 마다 MVP 등급(등급 표의 줄 id)과 시작 날짜 | `storage/mvp-grades.ts` | 남긴다 | `features/mvp-grade.md` |
| `character_accounts` | `id`(uuid, `(ocid, name, account_id)` 는 UNIQUE) | 캐릭터가 어느 메이플 ID 에 속했는지, 그것을 어느 넥슨 계정의 목록에서 봤는지와 처음 · 마지막으로 본 날 | `storage/character-accounts.ts` | 남긴다 | `features/mvp-grade.md` |
| `server_sync_queue` | `id`(`record_id` 는 UNIQUE) | 서버로 못 보낸 기록. 지금은 넣는 코드가 없어 비어 있다. 옛 앱이 넣은 처치 · 가계부 · 강화 합계 · 드롭 판매가 줄은 1.0.15 기기 변환이 비우고, 남은 줄도 전송이 보내지 않고 지운다(`registry.ts` 에 없는 종류다) | `storage/server-sync-queue.ts` | 비운다 (어느 그룹을 골라도) | [[ADR-099]] 결정 10 · [[ADR-286]] 결정 8 |
| `game_data_sections` | `id`(uuid, `section` 은 UNIQUE) | 게임 데이터 사본의 칸 하나. 서버 응답의 그 칸 JSON 을 그대로 든다 | `storage/game-data-copy.ts` | 남긴다 | [[ADR-020]] |
| `game_data_meta` | `id`(uuid, `key` 는 UNIQUE) | 사본의 표식(계약 판 · ETag). 칸과 한 트랜잭션으로 쓰고, 있으면 다 받은 사본이다 | `storage/game-data-copy.ts` | 남긴다 | [[ADR-020]] |
| `usage_events` | `id`(uuid) | 서버로 보낼 사용 로그. 백그라운드로 갈 때와 다음 실행 때 통째로 꺼내 보내고, 꺼낸 줄은 지운다. 신원이 없는 기기에서 끝없이 자라지 않게 500줄까지만 둔다 | `storage/usage-events.ts` | 남긴다 | [[ADR-158]] |
| `device_conversion` | 없음(한 줄) | 1.0.15 기기 변환이 마친 단계의 번호. 지우면 바뀐 표를 다시 바꾸려다 던진다 | `storage/sqlite/device-conversion.ts` | 남긴다 | [[ADR-286]] |
| `query_cache` | `id`(uuid, `key` 는 UNIQUE) | TanStack Query 캐시의 사본. 저장 표식(`meta.persist`)이 있는 쿼리(넥슨의 스케줄 · 캐릭터 기본 정보 · 회차 · 메소 획득량 · 이벤트 월드 이름, 서버 · 넥슨의 공지 다섯 분류)만 키 하나의 JSON 으로 든다. 기기 DB 를 읽는 쿼리와 결산 · 직접 완료 · 캐릭터 목록 · 파티 약속은 저장하지 않는다 | `storage/query-cache.ts` | 지운다 (캐시) | [[ADR-142]] |

### 칸

`NN` 은 `NOT NULL` 이다. 각 칸의 뜻은 표마다의 문서와 `db.ts` · `boss-tables.ts` · `record-key-tables.ts` · `enhancement-tables.ts` 의 DDL 주석에 있다. 칸 이름은 서버 규칙을 따른다([[ADR-098]] 결정 7). 보스 기록 표 셋 · 가계부 기록 표 · 인벤토리 · 강화 레벨 기억 · 강화 합계 · 월드 리프 · MVP 등급은 칸 이름이 서버 표와 같다([[ADR-286]] 결정 2).

`nexon_account_id` 는 인증 수단의 넥슨 계정 id 다. 빈 글자는 계정 칸이 생기기 전의 행이고, 앱을 켤 때 메인 계정 id 로 채운다(`fillLegacyAccountIds`). `NULL` 은 계정을 모르는 자격(저장 전에 검증하는 키)으로 본 소속이다. 가계부 기록 표에는 이 칸이 없다. 1.0.15 기기 변환이 주인을 모르는 옛 기록에 주인을 붙인 뒤 없앴다([[ADR-161]] 결정 4). 강화 합계에도 없다. 다시 받은 날을 갈아 끼울 때 지우는 범위는 `character_accounts` 에서 그 넥슨 계정으로 본 ocid 다([[ADR-286]] 결정 10). 넥슨 로그인이 메이플 ID 가 같은 키를 거두면 로그인은 그 키의 id 를 이어받고, 로그인의 옛 id 로 적힌 줄은 그 id 로 옮긴다. 겹치면 나중 줄이 남는다([[ADR-098]] 결정 5).
가계부 기록의 `account_id` 는 메이플 ID 기록의 메이플 ID 이고, `character_accounts.account_id` 와 같은 값이다. 캐릭터 기록은 `NULL` 이고, 기록은 `ocid` 와 `account_id` 가운데 하나가 반드시 차 있다(CHECK). 캐릭터 기록의 메이플 ID 가 필요하면 그 캐릭터를 가장 늦게 본 소속에서 찾는다([[ADR-161]] 결정 4 · 5).

| 테이블 | 칸 |
|---|---|
| `boss_split_settings` | `id` NN · `ocid` NN · `boss_difficulty_id` NN · 분배 칸 · `created_at` NN · `updated_at` NN |
| `boss_profit_entries` | `id` NN · `ocid` NN · `boss_difficulty_id` NN · `period_code` NN · `world_id` · `crystal_price_meso` · `crystal_received_meso` · 분배 칸 · `cleared_date` · `clear_recorded_by` · `over_crystal_sale_limit` · `created_at` NN · `updated_at` NN |
| `boss_drops` | `id` NN · `profit_entry_id` NN · `item_id` NN · `category` NN · `price_status` NN · `sale_price_meso` · `sale_received_meso` · `priced_at` · `sale_fee_percent` · `sale_fee_follows_mvp_grade` NN · 분배 칸 · `created_at` NN · `updated_at` NN |
| `character_profiles` | `id` NN · `ocid` NN UNIQUE · `name` NN · `image_url` NN · `world` · `world_key` · `level` · `job_class` · `created_date` · `updated_at` NN |
| `character_world_leaps` | `id` NN · `previous_ocid` NN UNIQUE · `ocid` NN |
| `enhancement_totals` | `id` NN · `ocid` NN · `history_date` NN · `category` NN · `item_name` NN · `attempt_count` NN · `attempt_cost_meso` NN · `destroy_defence_cost_meso` NN · `world_id` · `superior_cost_meso` NN(기본 0) · `from_star` · `to_star`(스타포스만, 다른 분류와 칸이 생기기 전 줄은 `NULL`) · `is_event_world`(1 이벤트 월드 · 0 아님 · `NULL` 모름) · `updated_at` NN |
| `enhancement_history` | `id` NN · `kind` NN · `date_key` NN · `created_at` NN · `character_name` NN · `target_item` NN · `item_key` · `item_level` · `payload` NN · `cost_meso` |
| `enhancement_recomputes` | `id` NN · `nexon_account_id` NN · `request_key` NN · `done_through_date` · `completed_at` · `updated_at` NN |
| `enhancement_history_checks` | `id` NN · `nexon_account_id` NN · `enhancement_type` NN · `history_date` NN · `next_cursor` · `settled` NN(기본 0) · `checked_at` NN |
| `enhancement_refetches` | `id` NN · `nexon_account_id` NN · `enhancement_type` NN · `history_date` NN · `created_at` NN |
| `character_dated_names` | `id` NN · `ocid` NN · `history_date` NN · `name` · `world_name` · `checked_at` NN |
| `character_first_days` | `id` NN · `ocid` NN · `created_date` NN · `first_date` NN · `first_name` NN · `checked_at` NN |
| `cashbook_entries` | `id` NN · `ocid` · `account_id` · `world_id` · `category_id` NN · `date` NN · `memo` · `recorded_at` NN · `updated_at` NN |
| `cashbook_entry_items` | `id` NN · `entry_id` NN · `target_type`(`hunting_ground` · `item` · `spend_item` · `symbol` · `hexa_core` · `hexa_stat`) · `target_id` · `item_name` · `spend_reward_type_id` · `item_type_id` · `quantity` · `from_level` · `to_level` · `amount_meso` · `tariff_meso` · `sale_fee_percent` · `sale_fee_meso` · `sale_fee_follows_mvp_grade`(1 · 0) · `amount_maple_point` · `maple_point_per_100m_meso` · `meso_market_fee_percent` · `amount_cash` · `fragment_quantity` · `untradable_fragment_quantity` · `fragment_price_meso` · `includes_hexa_activation` · `uses_stored_fragments` · `counts_stored_fragments_as_spend` · `inventory_item_id` |
| `cashbook_entry_hunt_inputs` | `id` NN · `entry_id` NN UNIQUE · `character_level` · `missed_mob_quantity` · `uses_wealth_potion` · `uses_union_wealth` · `union_wealth_tier` · `fragment_quantity` · `fragment_price_meso` · `meso_acquisition_percent` · `typed_meso` |
| `cashbook_entry_transfer_inputs` | `id` NN · `entry_id` NN UNIQUE · `receiver_ocid` NN · `transfer_meso` NN · `fee_percent` NN · `fee_follows_mvp_grade` NN(1 자동 · 0 손으로 고름) |
| `cashbook_entry_exchange_inputs` | `id` NN · `entry_id` NN UNIQUE · `sold_meso` NN · `sell_maple_point_per_100m_meso` NN · `bought_meso`(판매만 적었으면 `NULL`) · `buy_maple_point_per_100m_meso`(같음) · `meso_market_fee_percent` NN |
| `cashbook_entry_fragment_uses` | `id` NN · `entry_id` NN · `fragment_source` NN(`hunt` · `inventory`) · `ocid`(`hunt` 만) · `fragment_quantity` NN |
| `inventory_items` | `id` NN · `account_id` NN · `world_id` NN · `item_id` NN(반지는 레벨 줄) · `cashbook_item_type_id` NN · `added_quantity` NN · `created_at` NN · `updated_at` NN |
| `remembered_levels` | `id` NN · `ocid` NN · `type` NN(`symbol` · `hexa`) · `target_id` NN(심볼 줄 · 헥사 코어 줄) · `level` NN · `updated_at` NN |
| `mvp_grade_history` | `id` NN · `account_id` NN · `from_date` NN · `grade_id`(등급 표의 줄 id. 앱은 빈 줄을 적지 않는다) · `updated_at` NN |
| `character_accounts` | `id` NN · `ocid` NN · `name` NN · `account_id` NN · `nexon_account_id` · `first_seen_date` NN · `last_seen_date` NN · `world_key` |
| `server_sync_queue` | `id` NN · `record_type` NN · `record_id` NN UNIQUE · `attempts` NN(기본 0) · `last_error` · `created_at` NN |
| `game_data_sections` | `id` NN · `section` NN UNIQUE · `body` NN |
| `game_data_meta` | `id` NN · `key` NN UNIQUE · `value` NN |
| `usage_events` | `id` NN · `type` NN · `name` NN · `duration_ms` · `occurred_at` NN |
| `device_conversion` | `version` NN |
| `query_cache` | `id` NN · `key` NN UNIQUE · `value` NN |

분배 칸은 세 표가 같이 쓰는 다섯 칸이다. `split_type`(`even` · `ratio` · `excluded`, 드롭에는 `excluded` 가 없다) · `party_size` ·
`split_share_millipercent`(내 % 에 1000 을 곱한 정수) · `split_fee_percent` · `split_fee_follows_mvp_grade` NN(1 · 0). 정의는
`boss-tables.ts` 한 곳에 있다([[ADR-078]] 결정 2). 분배 설정 표는 `split_type` 을 비울 수 없다(CHECK). 분배를 정한 줄만 두기
때문이다. `split_type` 이 `excluded` 면 분배 방식 `제외` 다. 인원 · 내 몫 · 요율이 비어 있고 솔로로 읽는다([[ADR-038]] 결정 12).

게임 데이터는 줄 id(`boss_difficulty_id` · `item_id` · `world_id`)로 가리키고 이름은 저장하지 않는다. 저장 함수가 읽을 때 줄 id
를 key 로 바꾸고, 이름은 그 key 로 게임 데이터에서 찾는다. 반지는 레벨 줄이고 상자에서 나온 연마석은 상자용 줄이다. 나온
상자는 적지 않고 읽을 때 드롭 표에서 다시 찾는다(`lib/boss/drop-item-ids.ts`). 기간은 기간 값(`period_code`, 주간 `W202647` ·
월간 `M202611`)이고 `lib/boss/period-code.ts` 가 기간 key 와 오간다([[ADR-078]] 결정 1 · 6).

처치했는지는 `boss_profit_entries.clear_recorded_by` 가 찼는지로 안다. 처치한 줄은 `crystal_price_meso` · `crystal_received_meso` ·
`clear_recorded_by` 가 모두 차 있고 처치 전 줄은 셋 다 비어 있다(CHECK). `over_crystal_sale_limit` 는 주간 결정석 판매 한도를
넘겨 0 메소로 읽는 처치다. `crystal_received_meso` 는 그대로 두고 읽을 때 0 으로 읽는다([[ADR-042]] 결정 15). 서버에는 없는
기기만의 칸이다.

`boss_drops.sale_received_meso` 는 판매 수수료와 분배를 반영해 내가 받는 메소다. 가격 · 분배 · 수수료를 고칠 때만 다시 센다
([[ADR-044]] 결정 10). 드롭의 차례는 저장하지 않고 읽을 때 드롭 표의 차례로 늘어놓는다([[ADR-078]] 결정 5).

기기 변환 전 DB 의 `boss_drops` 에는 `(period_id, sort_order)` 인덱스 `boss_drops_period` 가 있다. 유일 인덱스가 아니다. 그 표를
쓰던 저장 함수가 한 행씩 고치는 동안 `sort_order` 가 잠깐 겹쳤기 때문이다([[ADR-077]] 결정 8).

## 테이블이나 칸을 더할 때

1. `db.ts` 의 `TABLE_DEFINITIONS` 에 넣는다. 이 배열 밖에서 만들면 열 때 만들어지지 않는다. 보스 기록 표와 가계부 기록 표 ·
   인벤토리 · 강화 레벨 기억은 기기 변환 단계에 따라 정의가 달라서 `bossTableDefinitions` · `cashbookTableDefinitions` 에 있다.
2. 기본키는 uuid 한 칸으로 둔다. 같은 값의 행이 둘 있으면 안 되는 조합은 일반 인덱스가 아니라 `UNIQUE` 로 건다.
   조회 속도는 같고 중복 행만 거절한다. 일반 인덱스는 고치는 동안 값이 잠깐 겹치는 칸에만 쓴다([[ADR-077]] 결정 8).
3. 칸을 더할 때는 `CREATE TABLE` 문과 `ensureColumn` 을 둘 다 고친다([[ADR-007]] 결정 4).
4. 사용자가 데이터 삭제 화면에서 지울 수 있어야 하는 기록이면 `storage/cache-data.ts` 의 그 그룹 목록에 넣는다. 안 넣으면
   데이터 삭제가 어떤 선택에서도 남긴다.
5. 기존 행의 값을 옮겨야 하면 `migrations.ts` 의 `STEPS` 끝에 단계를 더하고 `DB_VERSION` 을 올린다.
6. 기록을 앱 타입으로 바꾸는 함수(`RecordedDrop` 을 만드는 곳 등)에 새 칸을 빠뜨리면 타입 오류 없이 값만 사라진다.
   이름이 아니라 그 타입을 만드는 곳을 모두 찾아 고친다.

## 버전 이관

| 버전 | 함수 | 하는 일 |
|---|---|---|
| 1 | `LEGACY_NAME_MIGRATIONS` | 이름이 바뀐 지출 분류 · 항목과 메이린 보스 이름을 새 이름으로 바꾼다 |
| 2 | `fillCashbookKeys` | 가계부 기록에 분류 · 항목 · 종류 · 사냥터 key 를 채운다 |
| 3 | `fillDropKeys` | 드롭 기록에 아이템 key · 상자 key 를 채운다 |
| 4 | `rekeyBossTables` | 보스 표 셋의 기본키를 보스 key 로 다시 만든다 |
| 5 | `fillEnhancementItemKeys` | 강화 내역에 장비 key 를 채운다 |
| 6 | `fillWorldKeys` | 수익 기록 · 캐릭터 프로필에 월드 key 를 채운다 |
| 7 | `rewind0917PrePatchPrices` | 09-17 패치 값으로 저장된 그 주의 결정석 가격을 옛 가격으로 되돌린다 |
| 8 | `fixSwapped0917Prices` | 서로 바뀐 채 나간 두 새 가격을 고친다 |
| 9 | `clearZeroHuntFragmentPrices` | 사냥 기록의 조각 가격 0 을 `NULL` 로 바꾼다 |
| 10 | `dropDropShareColumns` | 파티 설정 · 수익 기록의 드롭 비율 칸 둘을 지운다 |
| 11 | `fillUnreachableDefeatDates` | 날짜를 다시 알아낼 수 없는 보스 기록에 기간 첫날을 적는다 |
| 12 | `rekeyDropRecordsByUuid` | 드롭 기록에 `drop_record_id` 를 채우고 그것을 기본키로 다시 만든다 |
| 13 | `dropBossProfitPeriodChecks` | 읽는 코드가 없는 `boss_profit_period_checks` 표를 지운다. 조회했는지는 조회 원장이 답한다 |
| 14 | `moveBossTablesToParties` | 옛 보스 기록 표 넷의 행을 버전 14 의 표 셋(`boss_parties` · `boss_party_periods` · `boss_drops`)으로 옮긴다. 옛 표는 지우지 않는다([[ADR-078]] 결정 8). 이 표 셋은 1.0.15 기기 변환이 지금 표로 다시 옮긴다([[ADR-286]] 결정 3) |
| 15 | `moveCashbookRecordsToEntries` | 옛 가계부 표 둘의 행을 기록 표 셋으로 옮긴다. 옮기기 전에 DB 를 파일째 떠 둔다([[ADR-096]] 결정 9) |
| 16 | `moveRecordKeysToUuid` | 기본키가 값의 조합이던 다섯 표를 uuid 기본키로 다시 쓰고, 칸 이름을 서버 규칙에 맞춘다. 계정 칸이 생기기 전의 행은 계정 칸에 빈 글자를 적는다([[ADR-098]]) |
| 17 | `dropCashbookMemo` | 입력 시트가 모두 비워 두던 가계부 메모 칸을 지운다. 버전 22 가 다시 더한다 |
| 18 | `attachEnhancementOcids` | 강화 합계 줄에 앱이 그 이름으로 본 기간(`character_accounts`)으로 ocid · 메이플 ID · 월드를 붙이고 판정 열쇠를 ocid 로 다시 쓴다. 붙이지 못한 줄은 그 날의 조회 기록과 함께 지우고 다시 받을 날로 적는다. 조회 기록의 계정 칸을 `NOT NULL` 로 다시 쓰고 `event_world_characters` 를 지운다([[ADR-101]] 결정 18 · 20) |
| 19 | `fillCashbookEntryWorlds` | 캐릭터에 붙은 가계부 기록의 월드 칸(`world_key`)을 그 ocid 의 프로필 월드로 채운다. 리프한 캐릭터의 기록을 새 ocid 로 옮기기 전에 옛 월드를 남긴다([[ADR-101]] 결정 22) |
| 20 | `fillMesoMarketFees` | 수수료율 칸이 생기기 전에 적은 메포 지출 품목에 메소마켓 수수료율 1 을 채운다. 수입과 메소 · 캐시 품목은 비워 둔다([[ADR-047]] 결정 17) |
| 21 | `addFragmentUseSources` | 조각 사용 표에 경로 칸(`fragment_source`)과 기타 조각의 주인 칸을 더하고 `ocid` 의 `NOT NULL` 을 떼려고 표를 다시 쓴다. 옛 줄은 모두 사냥 조각이다([[ADR-209]] 결정 12) |
| 22 | `addCashbookMemo` | 가계부 기록 표에 메모 칸(`memo`)이 없으면 더한다. 새 기기도 버전 17 이 표 정의의 칸을 지우므로 여기서 다시 더한다. 옛 행은 `NULL` 이다([[ADR-048]] 결정 19) |
| 23 | `dropLegacyTables` | 옛 보스 기록 표 넷과 옛 가계부 표 둘을 지운다. 버전 14 · 15 가 옮긴 뒤로 읽는 코드가 없다([[ADR-078]] 결정 9) |

못 찾는 이름은 key 만 비우고 행과 이름은 남긴다.

## 행 식별자

보스 기록 표 셋의 `id` 같은 v4 uuid 는 JS 가 아니라 SQLite 가 `INSERT` 안에서 만든다
(`NEW_UUID_SQL`, `randomblob()` 식). JS 전역에는 `crypto` 가 없고, 새 네이티브 모듈을 추가하면 스토어 빌드를 기다려야
하기 때문이다. 같은 그룹을 다시 저장할 때 기존 값을 이어 쓰는 규칙은 [[ADR-018]] 결정 2 에 있다.
