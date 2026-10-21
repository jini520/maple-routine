# SQLite

기록은 SQLite DB 하나(이름 `boss_profit`, 파일 `boss_profitSQLite.db`)에 있다. `@op-engineering/op-sqlite` 로 열고,
파일은 Capacitor 앱이 쓰던 위치에 그대로 있다(`capacitor-storage.md`). 커넥션과 스키마 변경 규칙은 [[ADR-007]] 에
있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `storage/sqlite/db.ts` | 테이블 정의(`TABLE_DEFINITIONS`) · DB 열기와 닫기 · 칸 보강(`ensureColumn`) · `income_records` 재작성 |
| `storage/sqlite/boss-tables.ts` | 보스 표 셋의 정의를 한 곳에 둔다. 정상 생성과 버전 4 재작성에서 함께 쓴다 · 드롭 그룹 인덱스 |
| `storage/sqlite/migrations.ts` | 값을 옮기는 버전 이관(`DB_VERSION` 13) |
| `storage/sqlite/transaction.ts` | 쓰기 여럿을 트랜잭션 하나로 묶는 `inTransaction` |
| `storage/sqlite/uuid.ts` | 행 식별자를 SQLite 가 만드는 식(`NEW_UUID_SQL`) |
| `storage/adapters/rn-sqlite.ts` | `SqlitePort` 구현(op-sqlite) |
| `storage/adapters/capacitor-sqlite-open.ts` | 파일 이름과 디렉터리 규칙 |
| `storage/sqlite/__tests__/node-sqlite-port.ts` | 테스트용 `SqlitePort`. Node 내장 `node:sqlite` 로 실제 엔진을 돌린다 |

## 열 때 하는 일

`getBossProfitDb()` 를 처음 부르면 이 순서로 실행된다. 커넥션은 앱 전체에서 하나다.

1. 같은 이름의 커넥션이 남아 있으면 닫는다.
2. `TABLE_DEFINITIONS` 의 `CREATE TABLE IF NOT EXISTS` 를 모두 실행한다.
3. `income_records.meso_amount` 가 `NOT NULL` 이면 테이블을 다시 쓴다.
4. `ensureColumn` 으로 나중에 생긴 칸을 옛 테이블에 더한다.
5. `boss_drop_records` 의 `price_split_mode` 가 빈 행을 `even` 으로, `even` 행의 빈 `price_party_size` 를
   `price_share` 로 채운다. 매번 실행되지만 빈 행이 없으면 아무것도 바꾸지 않는다.
6. `user_version` 보다 큰 버전 이관을 차례로 실행한다.
7. 드롭 그룹 인덱스 `boss_drop_records_group` 을 만든다.

열기는 10초, 닫기(`closeBossProfitDb`)는 5초 상한이 있다. OTA 적용과 캐시 데이터 삭제는 리로드 전에 닫는다.

## 테이블

FOREIGN KEY 제약은 걸려 있지 않다. 표 사이의 관계는 앱 코드가 같은 키로 이어 읽는 것뿐이라서, 한쪽만 지우면 짝이
없는 행이 남는다. 그래서 캐시 데이터 삭제는 기록 표들을 한 그룹으로 함께 지운다(`lifecycle.md`).

`삭제 그룹` 의 `기록` 은 캐시 데이터 삭제의 `records` 그룹(`RECORD_TABLE_NAMES`)이고, `일반` 은 나머지다.

| 테이블 | 기본키 | 담는 것 | 쓰는 곳 | 삭제 그룹 | 문서 |
|---|---|---|---|---|---|
| `boss_profit_records` | `(ocid, boss_key, difficulty, period_key)` | 기간별 보스 처치 한 건의 파티 인원 · 결정석 가격 · 받은 몫 · 처치 날짜 · 월드 | `storage/boss-profit.ts` | 기록 | `features/boss-profit.md` |
| `boss_party_settings` | `(ocid, boss_key, difficulty)` | 캐릭터 · 보스마다 늘 쓰는 파티 인원과 분배 비율 | `storage/boss-party-settings.ts` | 일반 | `features/boss-scheduler.md` |
| `boss_party_period_overrides` | `(ocid, boss_key, difficulty, period_key)` | 미완료 보스 행에서 고친 그 기간만의 파티 인원과 비율 | `storage/boss-party-period-overrides.ts` | 일반 | `features/boss-profit.md` |
| `boss_drop_records` | `drop_record_id`(v4 uuid) | 기간별 드롭 아이템과 판매가 · 수수료 · 월드 | `storage/boss-drops.ts` | 기록 | `features/item-drop.md` |
| `character_profiles` | `ocid` | 기록 옆에 보일 캐릭터 이름 · 초상 주소 · 월드 · 레벨 · 직업 | `storage/character-profiles.ts` | 기록 | `features/character.md` |
| `character_world_leaps` | `from_ocid` | 월드 리프로 바뀐 옛 ocid 와 새 ocid 의 연결 | `storage/character-world-leaps.ts` | 기록 | `features/character.md` |
| `enhancement_history` | `id` | 계정 단위 스타포스 · 큐브 · 잠재 재설정 사용 내역(응답 원문 `payload` 포함) | `storage/enhancement-history.ts` | 기록 | `features/cashbook.md` |
| `enhancement_history_checks` | `(kind, date_key)` | 강화 내역을 날짜별로 조회했는지 기록 | `storage/enhancement-history.ts` | 기록 | `features/cashbook.md` |
| `income_records` | `id` | 가계부에 손으로 적은 수입(아이템 판매 · 사냥 · 기타) | `storage/income.ts` | 기록 | `features/cashbook.md` |
| `spend_records` | `id` | 가계부에 손으로 적은 지출 | `storage/spend.ts` | 기록 | `features/cashbook.md` |
| `mvp_grade_history` | `(account_id, start_date)` | 메이플 ID 마다 MVP 등급과 시작 날짜 | `storage/mvp-grades.ts` | 기록 | `features/mvp-grade.md` |
| `character_accounts` | `(ocid, name, account_id)` | 캐릭터가 어느 메이플 ID 에 속했는지와 처음 · 마지막으로 본 날 | `storage/character-accounts.ts` | 기록 | `features/mvp-grade.md` |
| `server_sync_queue` | `id`(`record_id` 는 UNIQUE) | 서버로 못 보낸 기록. 평소에는 비어 있다 | `storage/server-sync-queue.ts` | 일반 | [[ADR-018]] |

### 칸

`NN` 은 `NOT NULL` 이다. 각 칸의 뜻은 표마다의 문서와 `db.ts` · `boss-tables.ts` 의 DDL 주석에 있다.

| 테이블 | 칸 |
|---|---|
| `boss_profit_records` | `ocid` NN · `boss_key` NN · `boss` NN · `difficulty` NN · `cycle` NN · `period_key` NN · `party_size` NN · `price_meso` NN · `payout_meso` NN · `crystal_my_share` · `crystal_shares_total` · `split_fee_percent` · `split_fee_auto` · `recorded_at` NN · `world` · `world_key` · `defeated_on` · `source` |
| `boss_party_settings` | `ocid` NN · `boss_key` NN · `boss` NN · `difficulty` NN · `party_size` NN · `crystal_my_share` · `crystal_shares_total` · `split_fee_percent` · `split_fee_auto` · `updated_at` NN |
| `boss_party_period_overrides` | `ocid` NN · `boss_key` NN · `difficulty` NN · `period_key` NN · `party_size` NN · `crystal_my_share` · `crystal_shares_total` · `split_fee_percent` · `split_fee_auto` · `updated_at` NN |
| `boss_drop_records` | `drop_record_id` NN · `ocid` NN · `boss_key` NN · `boss` NN · `difficulty` NN · `period_key` NN · `drop_index` NN · `category` NN · `item_key` · `item_name` NN · `slot` · `box_origin_key` · `box_origin` · `ring_level` · `quantity` NN · `recorded_at` NN · `world` · `world_key` · `price_state` · `price_meso` · `price_split_mode` · `price_party_size` · `price_share` · `price_my_share` · `sale_fee_percent` · `split_fee_percent` · `sale_fee_auto` · `split_fee_auto` |
| `character_profiles` | `ocid` NN · `name` NN · `image_url` NN · `world` · `world_key` · `level` · `job_class` · `updated_at` NN |
| `character_world_leaps` | `from_ocid` NN · `to_ocid` NN · `linked_at` NN |
| `enhancement_history` | `id` NN · `kind` NN · `date_key` NN · `created_at` NN · `character_name` NN · `target_item` NN · `item_key` · `item_level` · `payload` NN · `cost_meso` |
| `enhancement_history_checks` | `kind` NN · `date_key` NN · `next_cursor` · `settled` NN(기본 0) · `checked_at` NN |
| `income_records` | `id` NN · `ocid` · `earned_on` NN · `category` NN · `category_key` · `item` · `item_key` · `meso_amount` · `sale_fee_percent` · `sale_fee_meso` · `sale_fee_auto` · `point_amount` · `point_per_100m_meso` · `cash_amount` · `quantity` · `item_kind_key` · `hunt_character_level` · `hunt_missed_mobs` · `hunt_boosts` · `hunt_sojae` · `hunt_fragments` · `hunt_fragment_price` · `hunt_meso_rate` · `hunt_typed_meso` · `hunt_fragments_deferred` · `hunt_union_tier` · `memo` · `recorded_at` NN |
| `spend_records` | `id` NN · `ocid` · `spent_on` NN · `category` NN · `category_key` · `item` · `item_key` · `form` · `form_item_keys` · `item_kind` · `item_kind_key` · `level_from` · `level_to` · `quantity` · `meso_amount` · `tariff_meso` · `point_amount` · `point_per_100m_meso` · `cash_amount` · `memo` · `recorded_at` NN |
| `mvp_grade_history` | `account_id` NN · `start_date` NN · `grade` · `updated_at` NN |
| `character_accounts` | `ocid` NN · `name` NN · `account_id` NN · `first_seen_on` NN · `last_seen_on` NN |
| `server_sync_queue` | `id` NN · `kind` NN · `record_id` NN UNIQUE · `attempts` NN(기본 0) · `last_error` · `created_at` NN |

`boss_drop_records` 의 옛 기본키 다섯 칸 `(ocid, boss_key, difficulty, period_key, drop_index)` 에는 인덱스
`boss_drop_records_group` 이 있다. 유일 인덱스가 아니다. 한 행씩 고치는 동안 `drop_index` 가 잠깐 겹치기 때문이다([[ADR-077]] 결정 8).

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

못 찾는 이름은 key 만 비우고 행과 이름은 남긴다.

## 행 식별자

`boss_drop_records.drop_record_id` 같은 v4 uuid 는 JS 가 아니라 SQLite 가 `INSERT` 안에서 만든다
(`NEW_UUID_SQL`, `randomblob()` 식). JS 전역에는 `crypto` 가 없고, 새 네이티브 모듈을 추가하면 스토어 빌드를 기다려야
하기 때문이다. 같은 그룹을 다시 저장할 때 기존 값을 이어 쓰는 규칙은 [[ADR-018]] 에 있다.
