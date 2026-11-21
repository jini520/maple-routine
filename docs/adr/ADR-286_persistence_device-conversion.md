# ADR-286 1.0.15 기기 변환: 기기의 기록을 서버 표와 같은 모양으로 한 번 바꾼다

> ⚪ 미구현
> 관련 소스: `storage/sqlite/db.ts` · `storage/sqlite/boss-tables.ts` · `storage/sqlite/cashbook-tables.ts` · `storage/sqlite/record-key-tables.ts` · `storage/sqlite/enhancement-tables.ts` · `storage/sqlite/remembered-level-tables.ts` · `storage/sqlite/migrations.ts` · `storage/keys.ts` · `features/game-data/sync.ts` · `app/game-data/GameDataLock.tsx`

## 배경

1.0.14 까지 기기의 기록은 게임 데이터를 글자 key 로 가리킨다. 루시드 하드 처치는 `boss_key = 'lucid'` 와 `difficulty = 'hard'` 두
칸이고, 드롭은 `item_key` · `box_origin_key` · `ring_level` 세 칸이다. 1.0.15 의 서버 표는 같은 것을 줄 id 한 칸으로 가리키고 칸
이름도 여럿 바꿨다([[ADR-099]] 결정 19 ~ 63). 기기 간 동기화([[ADR-099]] 결정 7 ~ 18)는 기기와 서버가 기록 줄을 그대로 주고받으므로,
기기 표도 서버 표와 같은 모양이어야 한다(사용자 지정 2026-11-18, [[ADR-099]] 결정 19). 이 문서는 기기 표마다 무엇을 어떻게 바꾸는지와
변환을 돌리는 차례를 정한다.

기준으로 삼은 것은 [[ADR-099]] 의 결정들, #947 설계 원본(`~/.maple-routine/sync-947-design/sync-schema.html` 의 `기기 변환 (1.0.15)`),
서버 develop 의 `src/database/schema.ts`, 2026-11-20 아이폰 기기 백업(`~/.maple-routine/backups/iphone-container-20261120-before-1093`,
DB 버전 23)이다. 백업의 숫자는 이 문서의 표에 함께 적는다.

## 결정

### 결정 1. 변환은 1.0.15 로 올린 뒤 처음 켤 때 잠금 화면이 가린 동안 한 번 돈다

- 게임 데이터 잠금 화면(`GameDataLock`)이 새 계약의 게임 데이터를 다 받은 뒤에 돈다. 줄 id 가 그 데이터에 있기 때문이다. 그래서 DB
  버전 단계(`DB_VERSION`)에서는 돌릴 수 없다. DB 버전 단계는 서버 값을 읽지 못한다.
- 점검 잠금이 풀린 뒤에 돈다([[ADR-099]] 결정 64). 첫 받기와 기기 기록의 첫 올리기([[ADR-099]] 결정 13)보다 앞이다.
- SQLite 표는 한 트랜잭션으로 바꾸고, 같은 트랜잭션 안에서 변환을 마친 표식을 적는다. 도중에 앱이 꺼지면 아무것도 바뀌지 않은
  채로 남고 다음에 켤 때 처음부터 돈다. 반만 바뀐 표가 남으면 key 로 읽는 코드와 id 로 읽는 코드 어느 쪽도 맞지 않는다.
- Preferences 는 SQLite 트랜잭션 밖이다. 그래서 Preferences 를 바꾸는 단계는 몇 번 돌아도 같은 결과가 나오게 만들고(이미 새 모양이면
  건너뛴다), 표식을 따로 둔다. SQLite 표식 뒤에 돈다.
- 바꾸기 전에 DB 파일 사본을 하나 떠 둔다(`…-before-1.0.15.db`). 변환은 줄을 지우고 되돌릴 수 없으며, 사본이 있으면 변환 코드에
  잘못이 있을 때 사용자의 기록을 되살릴 수 있다. 버전 15 이관이 같은 방법을 썼다([[ADR-078]] 결정 11). 사본을 언제 지울지는 1.0.15
  출시 뒤 정한다.
- 새로 설치한 기기는 바꿀 기록이 없으므로 처음부터 새 표를 만들고 표식을 적는다.
- 변환을 마치기 전에는 기록을 쓰는 일이 돌지 않게 막는다. 앱을 켜면 화면보다 먼저 배경 갱신(`runBackgroundRefresh`)이 돌아 보스
  처치를 적는데, 잠금 화면은 화면만 가린다. 표식이 없으면 기록 쓰기가 기다린다.
- DB 를 열 때마다 도는 칸 보강(`ensureColumn`)과 인덱스 만들기는 옛 표 · 옛 칸 이름을 쓴다. 변환 뒤에는 그 표와 칸이 없어 DB 열기가
  실패하므로, 변환 표식에 따라 옛 쪽과 새 쪽 가운데 하나만 돌린다. 옛 DB 버전 이관(버전 4 · 12 · 14 · 16)이 읽는 옛 표 정의는 이관
  전용으로 묶어 두고, 새 표 정의는 변환에서만 만든다.
- 켤 때 돌던 옛 이관 셋은 변환보다 먼저 끝낸다. 옛 강화 원본을 합계로 옮기기(`features/enhancement-history/legacy-totals.ts`),
  옛 월드 공유 진행 나누기(`splitWorldSharedProgress`), 주인을 모르는 옛 손입력 붙이기(`features/cashbook/legacy-entry-accounts.ts`)다.
  셋 다 옛 모양의 칸을 쓰므로 변환 뒤에는 돌 수 없다.

### 결정 2. 표와 칸의 이름은 서버와 같다. 캐릭터와 메이플 ID 를 가리키는 칸만 다르다

- 올리는 기록 표는 표 이름과 칸 이름을 서버 표와 같게 바꾼다([[ADR-099]] 의 머리 규칙, 결정 23). 다른 것은 가리키는 방식뿐이다.
  서버는 캐릭터를 `characters.id`(`character_id`)로 가리키고 기기는 `ocid` 원문으로 가리킨다([[ADR-099]] 결정 20). 다른 캐릭터를
  가리키는 칸도 같다(서버 `receiver_character_id` ↔ 기기 `receiver_ocid`, 서버 `previous_ocid` 해시 ↔ 기기 원문).
- 메이플 ID 는 기기 표와 앱 코드를 바꾸지 않는다([[ADR-099]] 결정 48). 기기는 지금처럼 `account_id` 칸에 메이플 ID 를 적고, 올릴 때
  해시로 바꾼다. 서버가 해시로 `maple_ids` 줄을 찾는다.
- 기기는 줄을 지울 때 실제로 지우고, 지운 것을 대기 표로 올린다([[ADR-099]] 결정 10). 그래서 서버의 동기화 칸(`change_seq` ·
  `deleted_at`)은 기기 표에 두지 않는다. `created_at` · `updated_at` 은 서버 표에도 있어 기기 표에 있는 것은 그대로 둔다.
  `updated_at` 만 있는 기기 표 셋(`mvp_grade_history` · `remembered_levels` · `enhancement_totals`)에 `created_at` 을 더하지 않는다.
  서버의 `created_at` 은 서버가 줄을 만든 시각이라([[ADR-099]] 결정 49) 기기 값을 올리지 않는다.
- 올리지 않는 기기 표([[ADR-099]] 결정 8 의 표)와 Preferences 의 기기 전용 값(마지막 입력 기억 · 앱 설정, 결정 15)은 이름을 바꾸지 않는다.
  `enhancement_history_checks` 는 서버의 굳은 날 표(`enhancement_settled_days`)와 역할이 달라 이름과 `enhancement_type` 칸을 그대로 둔다.
- 기기 표에만 남는 칸은 `boss_profit_entries.over_crystal_sale_limit` 하나다(#947 설계 원본). 결정석 판매 한도를 넘었는지를 그 기기가
  셀 때 쓰는 값이라 올리지 않는다. 기기에만 있던 나머지 칸 넷은 없앤다(결정 10).

### 결정 3. 보스 기록 표 셋

`boss_parties` → `boss_split_settings`, `boss_party_periods` → `boss_profit_entries`, `boss_drops` → `boss_drops`(이름 그대로)다.
부모 · 자식은 `boss_profit_entries` → `boss_drops` 하나만 남는다. 설정 표는 수익 건의 부모가 아니다([[ADR-099]] 결정 23).

**`boss_split_settings`**(분배를 정한 줄만 옮긴다. 백업 119줄 가운데 30줄)

| 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|
| `id` · `ocid` · `created_at` · `updated_at` | 같은 이름 | 그대로 |
| `boss_key` + `difficulty` | `boss_difficulty_id` | `bossDifficultyIdOf`. 못 찾으면 그 줄을 지운다. 그 보스 · 난이도의 수익 건 · 드롭도 같은 이유로 지운다(결정 19) |
| `split_mode` + `crystal_excluded` | `split_type` | `crystal_excluded` 가 1 이면 `excluded`, 아니면 `split_mode` 값(결정 22) |
| `party_size` | `party_size` | `excluded` 면 비운다 |
| `my_share` · `shares_total` | `split_share_millipercent` | `ratio` 면 `round(my × 100000 ÷ total)` 을 0 ~ 100000 안으로 자른다. `even` · `excluded` 는 비운다(결정 21) |
| `split_fee_percent` · `split_fee_auto` | `split_fee_percent` · `split_fee_follows_mvp_grade` | 자동(1)이거나 요율이 비었으면 자동으로 보고 요율을 비운다. 요율이 빈 옛 줄은 수동으로 고른 적이 없기 때문이다. 자동이 아니고 요율이 있으면 수동이다(결정 25). 백업의 30줄은 모두 `even` 이고 요율이 비어 자동이 된다 |

**`boss_profit_entries`**(백업 1,339줄. 모두 처치한 줄이고 `even` 1,337 · `ratio` 2)

| 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|
| `party_id` | `ocid` · `boss_difficulty_id` | 부모 줄의 값을 직접 든다. 보스 줄 id(`boss_id`)는 기기에 두지 않는다. 서버가 난이도 줄에서 채운다 |
| `period_key` + `cycle` | `period_code` | 주간은 목요일 날짜를 `W` + ISO 주차(`W202647`), 월간은 `M` + 년월(`M202611`)로(결정 24). `cycle` 칸은 없앤다 |
| `world_key` | `world_id` | 월드 표의 줄 id. 못 찾으면 비운다. 월드는 기록의 대상이 아니라 속성이라 줄을 지우지 않는다. 백업에는 빈 줄이 없다 |
| `clear_status` | 없앤다 | 처치했는지는 `clear_recorded_by` 가 찼는지로 가린다(결정 27) |
| `price_meso` · `payout_meso` · `defeated_date` · `source` | `crystal_price_meso` · `crystal_received_meso` · `cleared_date` · `clear_recorded_by` | 이름만 바꾼다. 처치 전 줄은 비어 있다 |
| `split_mode` · `crystal_excluded` · `party_size` · `my_share` · `shares_total` | `split_type` · `party_size` · `split_share_millipercent` | 설정 표와 같은 규칙 |
| `split_fee_auto` | `split_fee_follows_mvp_grade` | 설정 표와 같다. 자동(1)이거나 요율이 비었으면 참이다 |
| `split_fee_percent` | `split_fee_percent` | 처치 전 줄은 설정 표와 같다(자동이면 비운다). 처치한 줄은 그 처치를 계산한 요율이라 그대로 둔다. 처치한 `ratio` 줄의 요율이 비었으면 그 기록 날짜(처치 날짜, 없으면 기간 첫날)의 MVP 등급 요율을 적고, 받은 메소를 그 요율과 새 % 로 다시 계산한다(결정 21 · 25). 결정석 수수료는 비율로 나눌 때만 쓰므로 처치한 `even` · `excluded` 줄은 비어 있어도 채우지 않는다. 백업의 `ratio` 2줄은 요율이 있고 `even` 1,337줄은 비어 있다 |
| `over_crystal_limit` | `over_crystal_sale_limit` | 이름만 바꾼다. 기기에만 남는 칸이다(결정 2) |

- 드롭을 지운 뒤 처치도 그 기간 값도 드롭도 없는 처치 전 줄은 지금 규칙(`storage/boss-periods.ts` 의 `deletePeriodIfEmpty`)대로 지운다.

**`boss_drops`**(백업 97줄)

| 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|
| `period_id` | `profit_entry_id` | 같은 값. 기간 줄의 id 가 수익 건의 id 다 |
| `sort_order` | 없앤다 | 드롭 표의 차례로 늘어놓는다(결정 27) |
| `item_key` + `box_origin_key` + `ring_level` | `item_id` | 아래 셋째 표 |
| `record_status` | `price_status` | `completed` → `entered`. `pending` · `skipped` 는 그대로 |
| `price_meso` | `sale_price_meso` | 이름만 바꾼다 |
| 없음 | `sale_received_meso` | 가격을 적은 줄마다 **바꾸기 전의 칸**으로 받는 메소(`dropPayoutMeso`)를 한 번 계산해 적는다(결정 26) |
| `sale_fee_auto` · `split_fee_auto` | `sale_fee_follows_mvp_grade` · `split_fee_follows_mvp_grade` | 1 이면 참, 비었으면 거짓. 지금 앱도 빈 값을 자동이 아닌 것으로 읽는다(`features/boss-profit/drop-fees.ts`). 드롭의 빈 요율은 수수료 없음이라 채우지 않는다(결정 25) |
| 분배 칸 | 분배 칸 | `ratio` 는 % 로 반올림한다. `even` 줄의 `my_share` 는 비운다(받는 메소는 위 칸이 지킨다). 드롭에는 `excluded` 가 없다 |
| 그 밖 | | 백업 97줄은 가격을 적은 줄 62 · 기다리는 줄 4 · 건너뛴 줄 31 이고, 가격을 적은 줄은 모두 `priced_at` 이 있어 서버의 가격 검사(`boss_drops_price_check`)를 지킨다 |

드롭이 얻은 아이템 줄(`item_id`)은 이렇게 정한다(결정 28).

| 경우 | `item_id` |
|---|---|
| 레벨이 있는 특수스킬 반지 | `ring_level_items` 에서 원래 반지와 레벨로 찾은 레벨 줄. 반지가 아닌데 레벨이 있으면 레벨을 버린다 |
| 레벨이 없는 반지 | 원래 반지 줄 |
| 생명의 연마석 | 상자에서 나왔거나(`box_origin_key` 가 참) 그 기간의 그 난이도 드롭 표가 상자로만 연마석을 주면 상자 연마석 줄, 아니면 원래 줄. 서버 이관과 같은 규칙이다 |
| 그 밖 | key 로 찾은 줄. 못 찾으면 그 드롭을 지운다(`기타` 반지 `other_ring` 이 그렇다. 백업에는 없다) |

- 같은 수익 건에 같은 아이템 줄이 둘이면 서버의 유일 기준(`profit_entry_id` · `item_id`)과 같게 먼저 만든 줄만 남긴다. 백업에는 없다.

### 결정 4. 가계부 기록 표 여섯

표 이름은 서버와 같아 그대로다.

**`cashbook_entries`**

| 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|
| `entry_type` + `category_key` | `category_id` | 가계부 분류 표에서 (수입 · 지출, key)로 찾은 줄 id. `entry_type` 칸은 없앤다(결정 45). 못 찾으면 그 기록을 지운다 |
| `world_key` | `world_id` | 월드 줄 id. 못 찾으면 비운다 |
| `entry_date` · `created_at` | `date` · `recorded_at` | 이름만 바꾼다(결정 49) |
| `nexon_account_id` | 없앤다 | 결정 10 |
| `ocid` · `account_id` · `memo` · `updated_at` | 같은 이름 | 그대로(결정 2) |

**`cashbook_entry_items`**

| 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|
| `sort_order` | 없앤다 | 품목은 추가 리워드 종류의 차례로 늘어놓는다(결정 53) |
| `item_key` (+ `ring_level`) | `target_type` · `target_id` | 기록의 분류로 종류를 정하고 그 표의 줄 id 를 적는다(결정 44, 아래 표). 레벨이 있는 반지는 레벨 줄이다 |
| `form_key` · `item_kind_key` | `spend_reward_type_id` · `item_type_id` | 그 표의 줄 id(결정 39 · 46) |
| `sale_fee_auto` | `sale_fee_follows_mvp_grade` | 1 이면 참, 비었으면 거짓 |
| `amount_point` · `point_per_100m_meso` | `amount_maple_point` · `maple_point_per_100m_meso` | 이름만(결정 53) |
| `fragment_count` · `untradable_fragment_count` | `fragment_quantity` · `untradable_fragment_quantity` | 이름만(결정 51) |
| `hexa_activation` · `hexa_use_storage` · `hexa_storage_as_spend` | `includes_hexa_activation` · `uses_stored_fragments` · `counts_stored_fragments_as_spend` | 이름만(결정 40) |
| 나머지 금액 · 수량 · 레벨 · `item_name` · `inventory_item_id` | 같은 이름 | 그대로 |

| 기록의 분류 | `target_type` | 찾는 곳 |
|---|---|---|
| 수입 사냥 | `hunting_ground` | 사냥터 key |
| 수입 사냥 전리품 판매 · 아이템 판매, 지출 아이템 구매 | `item` | 아이템 key |
| 지출 컨텐츠 · 이벤트·BM · 버프 · 주문서 | `spend_item` | 지출 항목 key |
| 지출 심볼 강화 | `symbol` | 심볼 key |
| 지출 헥사 매트릭스 | 활성화 칸이 비었으면 `hexa_core`, 찼으면 `hexa_stat` | 코어는 그 캐릭터 직업(`character_profiles.job_class`)과 `전직업` 의 코어에서 이름으로 찾는다. 못 찾으면 이름을 `item_name` 에 옮기고 종류 · 줄 id 를 비운다(결정 44. 손으로 적은 기록이라 지우지 않는다) |
| 수입 솔 에르다 조각 · 기타, 지출 기타 | 없음 | 비운다 |

- 품목의 key 를 못 찾으면(헥사 코어 말고) 그 기록을 지운다. 백업의 기록은 모두 품목이 하나라 품목만 지우면 빈 기록이 남는다.
- 가리키던 인벤토리 줄이 지워지면 `inventory_item_id` 를 비운다. 서버도 그렇다(`ON DELETE SET NULL`).

**딸린 입력 표**

| 표 | 바꾸는 것 |
|---|---|
| `cashbook_entry_hunt_inputs` | `missed_mobs` → `missed_mob_quantity`, `fragments` → `fragment_quantity`, `meso_rate` → `meso_acquisition_percent`, `union_tier` → `union_wealth_tier`. `boosts` 를 `uses_wealth_potion` · `uses_union_wealth` 로 나눈다. 글자에 `potion` 이 있으면 앞의 것, `union` 이 있으면 뒤의 것을 켜고 차례는 보지 않는다. 계산기 기록에서 빈 글자면 둘 다 거짓, 직접 입력(`typed_meso` 가 찬 줄)이면 둘 다 비운다(결정 54). 백업 97줄 |
| `cashbook_entry_transfer_inputs` | `fee_auto` → `fee_follows_mvp_grade`(1 이면 참, 비었으면 거짓) |
| `cashbook_entry_exchange_inputs` | `sell_point_per_100m_meso` · `buy_point_per_100m_meso` → `sell_maple_point_per_100m_meso` · `buy_maple_point_per_100m_meso` |
| `cashbook_entry_fragment_uses` | `fragment_source` 의 `other` → `inventory`, `fragments` → `fragment_quantity`. `ocid` 는 그대로 둔다(서버 `character_id`). `account_id` · `world_key` 는 없앤다([[ADR-099]] 결정 54). 인벤토리에서 판 기타 조각 기록은 없애기 전에 그 월드를 기록으로 옮긴다(결정 9) |

### 결정 5. 인벤토리와 기억한 레벨

| 표 | 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|---|
| `inventory_items` | `world_key` | `world_id` | 월드 줄 id |
| | `item_key` + `ring_level` | `item_id` | 아이템 줄 id. 레벨이 있는 반지는 레벨 줄(결정 28) |
| | `item_kind_key` | `cashbook_item_type_id` | 아이템 종류 줄 id(결정 46) |
| | `quantity` | `added_quantity` | 이름만(결정 33) |
| `remembered_levels` | `kind` · `item_key` | `type` · `target_id` | 심볼은 심볼 줄 id, 헥사는 그 캐릭터 직업과 `전직업` 의 코어에서 이름(앞뒤 공백을 걷은 글자)으로 찾은 줄 id. 못 찾으면 지운다(결정 38) |

- 인벤토리의 아이템 · 월드 · 종류를 못 찾는 줄은 지운다. 그 줄을 가리키던 품목은 위 규칙대로 비운다. 백업 7줄은 모두 찾는다.
- 장비가 아닌 줄의 한 줄 기준(메이플 ID · 월드 · 아이템)은 서버처럼 그대로 지킨다. 기기는 SQLite 부분 인덱스로 걸고, 장비 종류의
  줄 id 는 변환 때 게임 데이터에서 읽어 적는다.

### 결정 6. 강화 합계 · 월드 리프 · MVP 등급

| 표 | 기기 칸(지금) | 바뀐 칸 | 바꾸는 규칙 |
|---|---|---|---|
| `enhancement_totals` | `world_key` | `world_id` | 월드 줄 id. 못 찾으면 비운다. 백업 970줄 가운데 57줄은 지금도 비어 있다 |
| | `enhancement_type` · `item_group` · `item_key` | 없앤다 | 장비는 넥슨이 준 이름 하나로 가린다(결정 37 · 55). 하루치를 바꿀 때 지우는 범위는 분류로 고른다 |
| | `nexon_account_id` · `character_name` · `account_id` | 없앤다 | 결정 10 |
| | `enhancement_category` · `attempts` · `event_world` | `category` · `attempt_count` · `is_event_world` | 이름만(결정 36 · 51 · 40) |
| | 유일 기준 `(ocid, history_date, enhancement_category, item_group)` | `(ocid, history_date, category, item_name)` | 백업에는 겹치는 줄이 없다 |
| `character_world_leaps` | `from_ocid` · `to_ocid` · `linked_at` | `previous_ocid` · `ocid` | 이름을 바꾸고 `linked_at` 은 없앤다(결정 56). A→B, B→C 처럼 이어진 줄은 모두 C 를 가리키게 모은다. 백업에는 줄이 없다 |
| `mvp_grade_history` | `grade` | `grade_id` | 등급 줄 id. 등급이 빈 줄은 켤 때 이미 지워져 없다 |

- `superior_cost_meso` 는 0 그대로 둔다. 서버는 0 을 받는다.

### 결정 7. Preferences 에 든 기록

| 키 | 바꾸는 것 |
|---|---|
| `manualTrackedContent:{ocid}` | 항목마다 `kind` → `type`, 대상은 줄 id(`targetId`. 컨텐츠는 컨텐츠 줄, 보스는 난이도 줄). 이름으로 적힌 옛 항목은 지금 이관 함수로 key 를 얻은 뒤 바꾼다. `maxCount` 는 없앤다(결정 47 · 52). 못 찾은 항목은 뺀다 |
| `worldSharedProgress:*` · `accountSharedProgress:*` | 목록의 열쇠를 컨텐츠 줄 id 로 바꾼다. `active` → `isRegistered`, `kind` 는 없애고, `lastUpdatedBucket` 은 그 컨텐츠의 주기로 `periodCode`(일간 `D`, 주간 `W`)로 바꾼다(결정 56). 키 글자의 월드 key 는 월드 줄 id 로 바꾼다. 못 찾은 컨텐츠는 뺀다 |
| `partyAppointments` | 보스마다 난이도 줄 id, 주는 주차 값, 칸 이름은 서버와 같게(`time` · `alarmMinutesBefore` · `date` · `fromWeekCode` · `untilWeekCode`). `members` 와 예외의 `type` 은 없앤다(결정 57). 못 찾은 보스는 그 항목만 빼고, 보스가 하나도 안 남은 약속은 지운다 |
| `bossProfitCalculatorRecords` | 보스마다 난이도 줄 id, 분배는 `splitShareMillipercent` 등 서버 칸 이름으로(결정 21 · 57). 못 찾은 보스는 위와 같다 |
| `quickLinks` · `barOrder` | `{ rowCount, keys }` · `{ groupKeys, subPageKeys }`. 값은 그대로 |
| 설정 키 다섯 | `trackingMode` → `trackingType`, `statsCumulativeStart` → `statsCumulativeStartDate`, `mvpLastCheckedWeek` → `mvpLastCheckedWeekCode`(주차 값), `mvpWeeklyCheckOff` → `isMvpWeeklyCheckOff`, `mvpBulkApplyAsked` → `isMvpBulkApplyAsked` |
| `figureMotions` | `rest` → `restsBetweenActions`(결정 40 · 57) |

- 마지막 입력 기억(`lastHunts` · `lastEpicDungeonRewards` 등)과 앱 설정은 바꾸지 않는다(결정 15). 그 값을 읽는 코드는 key 로 찾는
  조회를 그대로 쓴다.

### 결정 8. 변환 때 지우는 것

- 서버 표에 없는 보스 · 난이도 · 아이템 · 가계부 분류 · 지출 항목 · 심볼 · 사냥터를 가리키는 기록(결정 19 · 28 · 위 표들).
- 월드 · 등급처럼 기록의 대상이 아니라 속성인 칸은 못 찾으면 비운다. 월드를 모르는 줄은 지금도 있다(#947 설계 원본).
- 서버로 못 보낸 드롭 대기 표(`server_sync_queue`)는 비운다. 1.0.15 에는 드롭 판매가 경로(`/v1/drop-prices`)가 없고, 기기의 드롭은
  첫 올리기([[ADR-099]] 결정 13)가 모두 올린다. Preferences `serverBackfill` 도 지운다. 백업의 대기 표는 비어 있다.
- 버전 13 이 지웠어야 할 빈 표 `boss_profit_period_checks` 가 그 지우기를 넣기 전에 버전 13 을 지난 기기에 남아 있다. 변환에서 지운다.
- 주인을 붙일 캐릭터가 하나도 없는 옛 손입력(결정 10).
- 앞 사람의 기록([[ADR-099]] 결정 14)은 변환에서 지우지 않는다. 같은 사람인지는 서버가 답하므로 첫 받기에서 가린다.

### 결정 9. 인벤토리에서 판 기타 조각 기록은 기록에 월드를 적는다 (사용자 선택 2026-11-21)

- 인벤토리에서 기타 조각을 파는 기록(`app/inventory/InventorySaleSheet.tsx`)은 캐릭터 없이 메이플 ID 로 적는다. 지금은 그 조각의
  월드를 조각 사용 줄의 `world_key` 에만 적는다. [[ADR-099]] 결정 54 가 조각 사용 줄의 메이플 ID · 월드 칸을 없애므로 월드를 둘
  곳이 필요하다. 월드가 없으면 월드별 남은 조각 수(`storage/inventory.ts`)를 셀 수 없다.
- 그 기록의 `world_id` 에 판 조각의 월드를 적는다. 그러면 기타 조각을 가져온 곳은 언제나 기록의 메이플 ID · 월드다. 헥사 강화
  기록은 캐릭터의 월드가, 판매 기록은 판 조각의 월드가 기록에 있다. 서버 `cashbook_entry_fragment_uses` 의 설명도 이것과 같다.
- 메이플 ID 기록 가운데 월드가 찬 것은 이 기록뿐이다. 서버 `schema.ts` 의 `cashbook_entries.world_id` 주석("메이플 ID 에 붙은
  기록은 비어 있다")은 동기화 경로를 구현할 때 이 예외를 적게 고친다.
- 변환은 메이플 ID 기록에 붙은 기타 조각 사용 줄의 `world_key` 를 그 기록의 `world_id` 로 옮긴다. 백업에는 이런 기록이 없다.
- 판매 품목이 인벤토리 줄을 가리키게 하는 안(다른 아이템 판매처럼 `inventory_item_id`)은 쓰지 않는다. 남은 조각 수를 세는 조회를
  모두 바꿔야 한다. 조각 사용 줄에 두 칸을 다시 두는 안도 쓰지 않는다. 헥사 강화 기록에서 같은 값이 두 곳에 적힌다.

### 결정 10. 기기에만 있던 칸 넷은 없앤다 (사용자 선택 2026-11-21)

서버 표에 없고 지금 코드가 읽는 칸이다. 읽는 코드는 같은 값을 다른 기기 표에서 찾게 바꾼다. 그러면 기기 표와 서버 표가 같은
모양이 된다(결정 2).

| 칸 | 지금 읽는 곳 | 바꾼 뒤 찾는 곳 |
|---|---|---|
| `enhancement_totals.nexon_account_id` | 다시 받은 날의 줄을 갈아 끼울 때 지울 범위(`storage/enhancement-totals.ts` 의 `replaceEnhancementTotals`). 계정의 지금 캐릭터에 없는 옛 ocid 의 줄까지 지우려고 쓴다 | `character_accounts` 에서 그 넥슨 계정의 ocid. 이 표는 목록에서 사라진 캐릭터와 옛 ocid 도 지우지 않고 둔다 |
| `enhancement_totals.account_id` | 스타포스 MVP 할인을 구할 메이플 ID(`features/cashbook/records.ts`) | `character_accounts` 에서 그 강화 날짜에 그 캐릭터가 속한 메이플 ID(`first_seen_date` ~ `last_seen_date`) |
| `enhancement_totals.character_name` | 가계부 강화 줄의 이름을 못 찾을 때 대신 쓰는 이름(`features/cashbook/records.ts`) | `character_dated_names` 에서 그 날짜의 이름 |
| `cashbook_entries.nexon_account_id` | 주인을 모르는 옛 손입력을 붙이는 켜기 단계(`features/cashbook/legacy-entry-accounts.ts`) | 변환 전에 그 단계를 한 번 더 돌린다(결정 1). 그래도 붙일 캐릭터가 하나도 없는 기록은 지운다. 서버는 메이플 ID 없는 기록을 받지 않는다([[ADR-099]] 결정 49) |

- 백업의 강화 970줄은 세 칸의 값을 모두 두 표에서 찾는다. 가계부 기록 209건에는 `nexon_account_id` 가 찬 줄이 없다.
- 강화 합계를 적는 코드도 세 칸을 쓰지 않게 바꾼다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `storage/sqlite/__tests__/device-conversion-real-sqlite.test.ts` | 결정 1: 한 트랜잭션이고 도중에 던지면 아무것도 안 바뀌며 다시 돌면 끝까지 가는지, 표식이 있으면 다시 돌지 않는지, 사본 파일을 뜨는지, 새 기기는 새 표로 시작하는지 본다. 결정 3 ~ 6: 표마다 바꾸는 규칙(분배 % 반올림 · 요율 채우기와 받은 메소 다시 계산 · 주차 값 · 반지 레벨 줄 · 상자 연마석 · 받는 메소 · 사냥 효과 나누기 · 헥사 코어 찾기 · 이어진 리프)과 지우는 경우를 진짜 SQLite 로 본다 |
| 같은 파일 | 결정 1: 2026-11-20 기기 백업을 깎은 사본으로 변환을 돌려, 줄 수가 위 표의 숫자와 맞고 서버 표의 제약(`CHECK` · 유일 기준)을 어기는 줄이 없는지 본다 |
| `features/device-conversion/__tests__/preferences.spec.ts` | 결정 7: 키마다 새 모양으로 바뀌는지, 두 번 돌려도 같은지, 못 찾은 항목만 빠지는지 본다 |
| `storage/sqlite/__tests__/db-real-sqlite.test.ts` | 결정 1: 변환 뒤 DB 를 다시 열어도 옛 칸 보강과 옛 인덱스가 돌지 않아 열기가 성공하는지 본다 |
| `storage/sqlite/__tests__/inventory-real-sqlite.test.ts` | 결정 9: 메이플 ID 기록의 월드로 기타 조각의 남은 수를 월드마다 세는지, 변환이 조각 사용 줄의 월드를 기록으로 옮기는지 본다 |
| `storage/sqlite/__tests__/enhancement-totals-real-sqlite.test.ts` | 결정 10: 다시 받은 날의 줄을 갈아 끼울 때 그 넥슨 계정의 옛 ocid 줄도 지우는지, MVP 할인 메이플 ID 와 대신 쓰는 이름을 그 날짜로 찾는지 본다 |

## 번호 기록

- ADR-286 (2026-11-21): 1.0.15 기기 변환의 표 · 칸 대응과 변환 차례를 처음 작성했다. 인벤토리 기타 조각 판매의 월드(결정 9)와
  기기에만 있던 칸 넷(결정 10)은 사용자가 골랐다(#947)
