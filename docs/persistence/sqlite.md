# SQLite

기록은 SQLite DB 하나(이름 `boss_profit`, 파일 `boss_profitSQLite.db`)에 있다. `@op-engineering/op-sqlite` 로 열고,
파일은 Capacitor 앱이 쓰던 위치에 그대로 있다(`capacitor-storage.md`). 커넥션과 스키마 변경 규칙은 [[ADR-007]] 에
있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `storage/sqlite/db.ts` | 테이블 정의(`TABLE_DEFINITIONS`) · DB 열기와 닫기 · 칸 보강(`ensureColumn`) · `income_records` 재작성 |
| `storage/sqlite/boss-tables.ts` | 보스 표 셋의 정의를 한 곳에 둔다. 정상 생성과 버전 4 재작성에서 함께 쓴다 · 드롭 그룹 인덱스 |
| `storage/sqlite/cashbook-tables.ts` | 가계부 기록 표 셋의 정의 · 날짜 인덱스 |
| `storage/sqlite/record-key-tables.ts` | 버전 16 이 uuid 기본키로 다시 쓴 다섯 표(캐릭터 · 월드 리프 · 강화 조회 기록 · MVP 등급 · 메이플 ID 소속)의 정의 |
| `storage/sqlite/migrations.ts` | 값을 옮기는 버전 이관(`DB_VERSION` 17) |
| `storage/sqlite/transaction.ts` | 쓰기 여럿을 트랜잭션 하나로 묶는 `inTransaction`. 같은 연결의 트랜잭션은 차례로 돈다. 겹쳐 열면 SQLite 가 뒤의 것을 거절하기 때문이다(앱을 켤 때 계정 칸 채우기와 강화 합계 옮기기가 겹쳤다). 그래서 `work` 안에서 다시 부르면 멈춘다 |
| `storage/sqlite/uuid.ts` | 행 식별자를 SQLite 가 만드는 식(`NEW_UUID_SQL`) |
| `storage/adapters/rn-sqlite.ts` | `SqlitePort` 구현(op-sqlite) |
| `storage/adapters/capacitor-sqlite-open.ts` | 파일 이름과 디렉터리 규칙 |
| `storage/sqlite/__tests__/node-sqlite-port.ts` | 테스트용 `SqlitePort`. Node 내장 `node:sqlite` 로 실제 엔진을 돌린다 |

## 열 때 하는 일

`getBossProfitDb()` 를 처음 부르면 이 순서로 실행된다. 커넥션은 앱 전체에서 하나다.

1. 같은 이름의 커넥션이 남아 있으면 닫는다.
2. `PRAGMA foreign_keys = ON` 으로 외래키를 켠다. op-sqlite 는 기본이 꺼져 있어, 켜지 않으면 `ON DELETE CASCADE` 가
   안 돈다. 트랜잭션 안에서는 이 문장이 먹지 않아 맨 앞에서 켠다.
3. `TABLE_DEFINITIONS` 의 `CREATE TABLE IF NOT EXISTS` 를 모두 실행한다.
4. `income_records.meso_amount` 가 `NOT NULL` 이면 테이블을 다시 쓴다.
5. `ensureColumn` 으로 나중에 생긴 칸을 옛 테이블에 더한다.
6. 옛 `boss_drop_records` 의 빈 `price_split_mode` 를 `even` 으로, `even` 행의 빈 `price_party_size` 를
   `price_share` 로 채운다. 옛 표라 지금 코드는 읽지 않고, v1.0.14 에서 옛 표와 함께 걷는다(#685).
7. `user_version` 보다 큰 버전 이관을 차례로 실행한다.
8. 인덱스 `boss_drop_records_group`(옛 표) · `boss_drops_period` · `cashbook_entries_entry_date` 를 만든다.

열기는 10초, 닫기(`closeBossProfitDb`)는 5초 상한이 있다. OTA 적용과 캐시 데이터 삭제는 리로드 전에 닫는다.

## 테이블

외래키는 보스 기록 표 셋과 가계부 기록 표 셋에만 있다. `boss_parties` → `boss_party_periods` → `boss_drops`, 그리고
`cashbook_entries` → `cashbook_entry_items` · `cashbook_entry_hunt_inputs` 차례로 부모를 가리키고, 부모를 지우면 자식도
지워진다(`ON DELETE CASCADE`). 다른 표 사이의 관계는 앱 코드가 같은 키로 이어 읽는 것뿐이라서,
한쪽만 지우면 짝이 없는 행이 남는다. 그래서 캐시 데이터 삭제는 기록 표들을 한 그룹으로 함께 지운다(`lifecycle.md`).

`삭제 그룹` 의 `기록` 은 캐시 데이터 삭제의 `records` 그룹(`RECORD_TABLE_NAMES`)이고, `일반` 은 나머지다. `행 단위` 는
한 표에 두 그룹의 행이 섞여 있어 표를 통째로 지우지 않는 표다(`BOSS_TABLE_NAMES`).

옛 보스 기록 표 넷(`boss_profit_records` · `boss_party_settings` · `boss_party_period_overrides` · `boss_drop_records`)은
버전 14 가 새 표 셋으로 옮긴 뒤로 읽고 쓰는 코드가 없다. 옛 코드가 새 DB 를 열어도 열리도록 표를 남겨 두고, v1.0.14
에서 지운다(#685). 옛 가계부 표 둘(`income_records` · `spend_records`)도 같다. 버전 15 가 기록 표 셋으로 옮겼고
v1.0.14 에서 지운다([[ADR-096]] 결정 6). 그래서 아래 표에서 뺐다.

| 테이블 | 기본키 | 담는 것 | 쓰는 곳 | 삭제 그룹 | 문서 |
|---|---|---|---|---|---|
| `boss_parties` | `id`(uuid, `(ocid, boss_key, difficulty)` 는 UNIQUE) | 캐릭터 · 보스 · 난이도 조합. 분배 칸이 보스 관리의 파티 설정이고, 비어 있으면 정한 적이 없다 | `storage/boss-party-settings.ts` | 행 단위(설정은 일반) | [[ADR-078]] |
| `boss_party_periods` | `id`(uuid, `(party_id, period_key)` 는 UNIQUE) | 조합 하나의 한 기간. `cleared` 면 처치 기록(결정석 가격 · 받은 몫 · 처치 날짜 · 분배)이고, `open` 이면 그 기간만 고친 분배 값이나 드롭만 있다. 월드도 여기 있다 | `storage/boss-profit.ts` · `storage/boss-party-period-overrides.ts` | 행 단위(처치는 기록, 그 기간 값은 일반) | [[ADR-078]] |
| `boss_drops` | `id`(uuid, 서버의 `drop_record_id`) | 기간 행에 붙는 드롭 한 개와 판매가 · 분배 · 수수료. 상태는 서버와 같은 `record_status` | `storage/boss-drops.ts` | 행 단위(기록) | [[ADR-078]] |
| `character_profiles` | `id`(uuid, `ocid` 는 UNIQUE) | 기록 옆에 보일 캐릭터 이름 · 초상 주소 · 월드 · 레벨 · 직업 | `storage/character-profiles.ts` | 기록 | `features/character.md` |
| `character_world_leaps` | `id`(uuid, `from_ocid` 는 UNIQUE) | 월드 리프로 바뀐 옛 ocid 와 새 ocid 의 연결 | `storage/character-world-leaps.ts` | 기록 | `features/character.md` |
| `enhancement_totals` | `id`(uuid, `(nexon_account_id, history_date, character_name, enhancement_category, item_group)` 는 UNIQUE) | 강화 내역을 날짜 · 캐릭터 · 분류 · 장비별로 묶은 합계. 비용은 MVP 할인 전 두 몫이고 이벤트 월드 판정을 든다 | `storage/enhancement-totals.ts` | 기록 | [[ADR-100]] |
| `enhancement_history` | `id` | 옛 강화 응답 원본. 합계로 옮기는 부팅 단계만 읽고 v1.0.14 에서 지운다 | `storage/enhancement-history.ts` | 기록 | [[ADR-100]] |
| `enhancement_recomputes` | `id`(uuid, `(nexon_account_id, request_key)` 는 UNIQUE) | 강화 비용 다시 매기기 요청을 넥슨 계정마다 어디까지 받았는지와 끝났는지 | `storage/enhancement-recomputes.ts` | 기록 | [[ADR-100]] |
| `enhancement_history_checks` | `id`(uuid, `(nexon_account_id, enhancement_type, history_date)` 는 UNIQUE) | 강화 내역을 넥슨 계정 · 날짜별로 조회했는지 기록 | `storage/enhancement-history.ts` | 기록 | `features/cashbook.md` |
| `cashbook_entries` | `id`(uuid) | 가계부에 손으로 적은 수입 · 지출 한 건. 날짜 · 갈래 · 캐릭터 | `storage/income.ts` · `storage/spend.ts` | 기록 | [[ADR-096]] |
| `cashbook_entry_items` | `id`(uuid, `(entry_id, sort_order)` 는 UNIQUE) | 기록의 품목. 항목 key 또는 직접 친 이름, 수량 · 레벨, 금액 · 수수료 · 관세 | `storage/cashbook-entries.ts` | 기록 | [[ADR-096]] |
| `cashbook_entry_hunt_inputs` | `id`(uuid, `entry_id` 는 UNIQUE) | 사냥 기록의 계산기 입력 | `storage/cashbook-entries.ts` | 기록 | [[ADR-096]] |
| `mvp_grade_history` | `id`(uuid, `(account_id, from_date)` 는 UNIQUE) | 메이플 ID 마다 MVP 등급과 시작 날짜 | `storage/mvp-grades.ts` | 기록 | `features/mvp-grade.md` |
| `character_accounts` | `id`(uuid, `(ocid, name, account_id)` 는 UNIQUE) | 캐릭터가 어느 메이플 ID 에 속했는지, 그것을 어느 넥슨 계정의 목록에서 봤는지와 처음 · 마지막으로 본 날 | `storage/character-accounts.ts` | 기록 | `features/mvp-grade.md` |
| `server_sync_queue` | `id`(`record_id` 는 UNIQUE) | 서버로 보낼 기록. 처치 · 가계부는 쓰는 자리가 넣고 곧바로 보내며, 드롭은 못 보낸 것만 남는다. 평소에는 비어 있다 | `storage/server-sync-queue.ts` | 일반 | [[ADR-018]] |

### 칸

`NN` 은 `NOT NULL` 이다. 각 칸의 뜻은 표마다의 문서와 `db.ts` · `boss-tables.ts` · `record-key-tables.ts` 의 DDL 주석에 있다. 칸 이름은 서버 규칙을 따른다([[ADR-098]] 결정 7).

`nexon_account_id` 는 인증 수단의 넥슨 계정 id 다. 빈 글자는 계정 칸이 생기기 전의 행이고, 앱을 켤 때 메인 계정 id 로 채운다(`fillLegacyAccountIds`). `NULL` 은 계정을 모르는 자격(저장 전에 검증하는 키)으로 본 소속이거나, 캐릭터가 있는 가계부 기록이다.

| 테이블 | 칸 |
|---|---|
| `boss_parties` | `id` NN · `ocid` NN · `boss_key` NN · `difficulty` NN · 분배 조건 · `created_at` NN · `updated_at` NN |
| `boss_party_periods` | `id` NN · `party_id` NN · `period_key` NN · `cycle` NN · `world_key` · `clear_status` NN · `price_meso` · `payout_meso` · `defeated_date` · `source` · 분배 조건 · `created_at` NN · `updated_at` NN |
| `boss_drops` | `id` NN · `period_id` NN · `sort_order` NN · `category` NN · `item_key` NN · `box_origin_key` · `ring_level` · `record_status` NN · `price_meso` · `priced_at` · `sale_fee_percent` · `sale_fee_auto` · 분배 조건 · `created_at` NN · `updated_at` NN |
| `character_profiles` | `id` NN · `ocid` NN UNIQUE · `name` NN · `image_url` NN · `world` · `world_key` · `level` · `job_class` · `updated_at` NN |
| `character_world_leaps` | `id` NN · `from_ocid` NN UNIQUE · `to_ocid` NN · `linked_at` NN |
| `enhancement_totals` | `id` NN · `nexon_account_id` NN · `history_date` NN · `character_name` NN · `enhancement_type` NN · `enhancement_category` NN · `item_group` NN · `item_key` · `item_name` NN · `attempts` NN · `attempt_cost_meso` NN · `destroy_defence_cost_meso` NN · `event_world`(1 이벤트 월드 · 0 아님 · `NULL` 모름) · `updated_at` NN |
| `enhancement_history` | `id` NN · `kind` NN · `date_key` NN · `created_at` NN · `character_name` NN · `target_item` NN · `item_key` · `item_level` · `payload` NN · `cost_meso` |
| `enhancement_recomputes` | `id` NN · `nexon_account_id` NN · `request_key` NN · `done_through_date` · `completed_at` · `updated_at` NN |
| `enhancement_history_checks` | `id` NN · `nexon_account_id` · `enhancement_type` NN · `history_date` NN · `next_cursor` · `settled` NN(기본 0) · `checked_at` NN |
| `cashbook_entries` | `id` NN · `ocid` · `nexon_account_id` · `entry_type` NN(`income` · `spend`) · `category_key` NN · `entry_date` NN · `created_at` NN · `updated_at` NN |
| `cashbook_entry_items` | `id` NN · `entry_id` NN · `sort_order` NN · `item_key` · `item_name` · `form_key` · `item_kind_key` · `quantity` · `from_level` · `to_level` · `amount_meso` · `tariff_meso` · `sale_fee_percent` · `sale_fee_meso` · `sale_fee_auto` · `amount_point` · `point_per_100m_meso` · `amount_cash` |
| `cashbook_entry_hunt_inputs` | `id` NN · `entry_id` NN UNIQUE · `character_level` · `missed_mobs` · `boosts` · `fragments` · `fragment_price_meso` · `meso_rate` · `typed_meso` · `union_tier` |
| `mvp_grade_history` | `id` NN · `account_id` NN · `from_date` NN · `grade` · `updated_at` NN |
| `character_accounts` | `id` NN · `ocid` NN · `name` NN · `account_id` NN · `nexon_account_id` · `first_seen_date` NN · `last_seen_date` NN |
| `server_sync_queue` | `id` NN · `record_type` NN · `record_id` NN UNIQUE · `attempts` NN(기본 0) · `last_error` · `created_at` NN |

분배 조건은 세 표가 같이 쓰는 여섯 칸이다. `split_mode`(`even` · `ratio`) · `party_size` · `my_share` · `shares_total` ·
`split_fee_percent` · `split_fee_auto`. 정의는 `boss-tables.ts` 한 곳에 있다. 이름은 저장하지 않는다. 보스 · 아이템 · 월드
이름은 읽을 때 key 로 게임 데이터에서 찾는다([[ADR-078]] 결정 6).

`boss_drops` 의 `(period_id, sort_order)` 에는 인덱스 `boss_drops_period` 가 있다. 유일 인덱스가 아니다. 한 행씩 고치는
동안 `sort_order` 가 잠깐 겹치기 때문이다([[ADR-077]] 결정 8).

## 테이블이나 칸을 더할 때

1. `db.ts` 의 `TABLE_DEFINITIONS` 에 넣는다. 이 배열 밖에서 만들면 캐시 데이터 삭제와 용량 계산에서 빠진다.
2. 기본키는 uuid 한 칸으로 둔다. 같은 값의 행이 둘 있으면 안 되는 조합은 일반 인덱스가 아니라 `UNIQUE` 로 건다.
   조회 속도는 같고 중복 행만 거절한다. 일반 인덱스는 고치는 동안 값이 잠깐 겹치는 칸에만 쓴다([[ADR-077]] 결정 8).
3. 칸을 더할 때는 `CREATE TABLE` 문과 `ensureColumn` 을 둘 다 고친다([[ADR-007]] 결정 4).
4. 새 테이블이 다시 받을 수 없는 값이면 `storage/cache-data.ts` 의 `RECORD_TABLE_NAMES` 에 넣는다. 안 넣으면
   `일반` 그룹으로 들어가 캐시 삭제 때 지워진다.
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
| 14 | `moveBossTablesToParties` | 옛 보스 기록 표 넷의 행을 새 표 셋으로 옮긴다. 옛 표는 지우지 않는다([[ADR-078]] 결정 8) |
| 15 | `moveCashbookRecordsToEntries` | 옛 가계부 표 둘의 행을 기록 표 셋으로 옮긴다. 옮기기 전에 DB 를 파일째 떠 둔다([[ADR-096]] 결정 9) |
| 16 | `moveRecordKeysToUuid` | 기본키가 값의 조합이던 다섯 표를 uuid 기본키로 다시 쓰고, 칸 이름을 서버 규칙에 맞춘다. 계정 칸이 생기기 전의 행은 계정 칸에 빈 글자를 적는다([[ADR-098]]) |
| 17 | `dropCashbookMemo` | 입력 시트가 모두 비워 두던 가계부 메모 칸을 지운다([[ADR-099]] 결정 15) |

못 찾는 이름은 key 만 비우고 행과 이름은 남긴다.

## 행 식별자

보스 기록 표 셋의 `id` 같은 v4 uuid 는 JS 가 아니라 SQLite 가 `INSERT` 안에서 만든다
(`NEW_UUID_SQL`, `randomblob()` 식). JS 전역에는 `crypto` 가 없고, 새 네이티브 모듈을 추가하면 스토어 빌드를 기다려야
하기 때문이다. 같은 그룹을 다시 저장할 때 기존 값을 이어 쓰는 규칙은 [[ADR-018]] 에 있다.
