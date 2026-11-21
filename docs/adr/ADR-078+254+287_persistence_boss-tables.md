# ADR-078+254+287 보스 기록 테이블 재설계

> 🟢 유효
> 관련 소스: `storage/sqlite/boss-tables.ts` · `storage/sqlite/convert-boss-tables.ts` · `storage/sqlite/db.ts` · `storage/sqlite/migrations.ts` · `storage/boss-periods.ts` · `storage/boss-profit.ts` · `storage/boss-drops.ts` · `storage/boss-party-settings.ts` · `storage/boss-party-period-overrides.ts` · `storage/cache-data.ts` · `storage/legacy-space.ts` · `lib/boss/period-code.ts` · `lib/boss/drop-item-ids.ts` · `features/enhancement-history/legacy-totals.ts` · `features/server-sync/drop-price-sync.ts`

## 배경

v1.0.12 까지 보스 기록은 테이블 넷에 있었다. `boss_profit_records`(처치 기록) · `boss_party_settings`(보스 관리의 파티 설정) ·
`boss_party_period_overrides`(미완료 행에서 그 기간만 고친 값) · `boss_drop_records`(드롭과 판매가)다.

두 가지가 문제였다.

- **같은 칸이 테이블마다 반복된다.** 보스 조합(`ocid` · `boss_key` · `boss` · `difficulty`)은 네 테이블 모두에,
  분배 조건(인원 · 결정석 비율 · 분배 수수료)은 세 테이블에 있었다. 드롭은 같은 뜻의 분배 칸을 `price_*` 이름으로 따로 가졌다.
- **기본키가 값의 조합이다.** 처치 난이도가 확정되면 드롭 행마다 `difficulty` 를 옮겨 적어야 했다.

이 결정은 #686 에서 정했고(2026-10-21), DB 버전 14 가 테이블 넷을 셋(`boss_parties` · `boss_party_periods` · `boss_drops`)으로
옮겼다. 1.0.15 기기 변환이 그 셋을 서버 표와 같은 이름과 칸으로 다시 옮긴다([[ADR-286]] 결정 3). 기기와 서버가 기록 줄을
그대로 주고받으려면 두 표의 모양이 같아야 하기 때문이다([[ADR-099]] 결정 19).

## 결정

### 결정 1. 보스 기록은 표 셋이고, 기본키는 모두 uuid 다

```
boss_split_settings   id · ocid · boss_difficulty_id · 분배 칸 · created_at · updated_at

boss_profit_entries   id · ocid · boss_difficulty_id · period_code · world_id
  │                   · crystal_price_meso · crystal_received_meso · 분배 칸 · cleared_date · clear_recorded_by
  │                   · over_crystal_sale_limit · created_at · updated_at
  └ boss_drops          id · profit_entry_id · item_id · category · price_status · sale_price_meso · sale_received_meso
                        · priced_at · sale_fee_percent · sale_fee_follows_mvp_grade · 분배 칸 · created_at · updated_at
```

- `boss_split_settings` 는 보스 관리의 파티 설정이다. 분배를 정한 줄만 있다. 수익 건의 부모가 아니라서, 설정을 지워도 처치와
  드롭은 남는다([[ADR-099]] 결정 23).
- `boss_profit_entries` 는 한 캐릭터가 한 기간에 한 보스 난이도에서 거둔 수익 한 건이다. 처치 기록과 그 기간 값을 한 줄에
  담는다. 처치했는지는 `clear_recorded_by` 가 찼는지로 가른다. 처치한 줄은 `crystal_price_meso` · `crystal_received_meso` ·
  `clear_recorded_by` 가 모두 차 있고, 처치 전 줄은 셋 다 비어 있다(CHECK). 처치 전 줄에는 그 기간만 고친 분배나 드롭만 있다.
  상태 칸을 따로 두면 같은 사실을 두 번 적게 된다([[ADR-099]] 결정 27).
- 드롭은 `profit_entry_id` 하나로 캐릭터 · 보스 · 난이도 · 기간 · 월드를 찾는다. 처치 난이도가 확정되면 드롭을 확정 난이도의
  수익 건으로 옮긴다(결정 10).
- 게임 데이터는 줄 id 로 가리킨다. 보스 난이도는 `boss_difficulty_id`, 아이템은 `item_id`, 월드는 `world_id` 다. 기간은
  `period_code`(주간 `W202647` · 월간 `M202611`)이고 첫 글자가 주기를 말해서 주기 칸이 없다([[ADR-099]] 결정 24).
- 화면과 계산은 보스 key · 난이도 · 기간 key · 아이템 key 를 든다. 저장 함수가 쓸 때와 읽을 때 그 사이를 바꾼다
  (`storage/boss-periods.ts` · `lib/boss/period-code.ts` · `lib/boss/drop-item-ids.ts`). 그래서 화면 코드는 표가 바뀌어도
  그대로다.

기본키와 유일성은 [[ADR-077]] 결정 8 을 따른다. `boss_split_settings (ocid, boss_difficulty_id)` ·
`boss_profit_entries (ocid, boss_difficulty_id, period_code)` · `boss_drops (profit_entry_id, item_id)` 는 `UNIQUE` 다. 같은 수익 건이
둘 생기면 드롭이 두 줄에 나뉘어 붙는다. 한 캐릭터는 한 기간에 한 보스에게서 같은 아이템을 둘 얻지 못하고, 보스가 직접 떨군
것과 상자에서 나온 것은 아이템 줄이 다르다([[ADR-099]] 결정 26 · 28).

변환 전 DB 는 버전 14 의 표 셋을 그대로 쓴다. DB 를 열 때 `device_conversion` 에 적힌 단계 번호로 어느 정의로 표를 만들지
고른다(`bossTableDefinitions`). 번호를 보지 않으면 변환이 지운 옛 표가 빈 표로 다시 생긴다. 새로 설치한 기기는 처음 열 때 곧바로
변환을 돌려 이 표 셋으로 선다.

### 결정 2. 분배 칸 다섯과 시각 칸 둘은 한 곳에서 정의해 세 테이블이 같이 쓴다

분배 칸은 `split_type` · `party_size` · `split_share_millipercent` · `split_fee_percent` · `split_fee_follows_mvp_grade` 이고, 시각은
`created_at` · `updated_at` 이다. 칸 정의는 `boss-tables.ts` 에, 읽기 · 쓰기 변환은 `storage/boss-periods.ts` 의 `splitValues` ·
`shareOf` 에 한 번만 두고 세 테이블이 가져다 쓴다. 별도 테이블로 빼지 않는 이유는 숫자 몇 개라서다. 빼면 읽을 때마다 조인이
하나씩 늘어난다.

| 칸 | 뜻 |
|---|---|
| `split_type` | `even`(균등) · `ratio`(비율) · `excluded`(제외). 드롭에는 `excluded` 가 없다(CHECK). 비율 1:3 과 균등 3인은 두 수가 같아서 이 칸이 없으면 가를 수 없다 |
| `party_size` | 파티 인원. 비율이어도 채운다. `excluded` 와 분배를 고르지 않은 줄은 비어 있다(CHECK) |
| `split_share_millipercent` | 비율로 나눌 때의 내 % 에 1000 을 곱한 정수(0 ~ 100000). `ratio` 일 때만 있다(CHECK). 읽으면 비율 합 100000 의 내 비율이 된다([[ADR-099]] 결정 21) |
| `split_fee_percent` | 분배 수수료율(%) |
| `split_fee_follows_mvp_grade` | 분배 수수료가 MVP 등급을 따라가는가. SQLite 에 참 · 거짓 형이 없어 1 · 0 이다 |

- `excluded` 는 결정석을 팔지 않은 처치다. 인원 · 내 몫 · 요율이 비어 있고, 읽을 때 솔로(1)로 읽는다([[ADR-099]] 결정 22).
- 분배 설정과 처치 전 수익 건은 등급을 따르면 요율을 비우고, 손으로 골랐으면 반드시 채운다. 처치한 수익 건의 비율 분배는
  요율이 반드시 있다. 그 처치를 계산한 요율이기 때문이다(CHECK, [[ADR-099]] 결정 25).
- 드롭의 빈 요율은 수수료 없음이다.

### 결정 3. 처치 전 수익 건의 분배 칸이 비어 있으면 분배 설정을 따른다

처치하면 그때의 분배를 수익 건에 복사한다. 나중에 보스 관리 설정을 바꿔도 지난 정산이 바뀌지 않게 하기 위해서다.
처치 전 수익 건은 분배 칸이 비어 있거나(드롭만 있음) 값이 있다(그 기간만 고친 값).

분배 칸을 비울 수 없게 하면 처치도 설정도 없이 드롭만 있는 기간을 담을 수 없다. 버전 14 이관 리허설에서 이관이 그 자리에서
실패했다. 설정 값으로 채우면 그 기간이 그 기간만 고친 값처럼 보여서, 보스 관리 설정을 바꿔도 따라가지 않는다.

드롭 가격 카드의 분배 처음 값은 수익 건 → 분배 설정 → 1인 순서로 찾는다.

### 결정 4. 직접 완료를 취소하면 그 기간은 보스 관리 설정 값으로 돌아간다

처치 기록과 그 기간 값이 한 줄이라, 처치 전에 그 기간만 고쳐 둔 값은 처치할 때 처치 기록의 값으로 덮인다. 취소하면 수익 건의
처치 칸과 분배 칸을 비운다(`deleteBossProfitRecord`). 미리 고쳐 둔 값을 따로 지키지 않는 이유는 직접 완료가 상시 쓰는 기능이
아니기 때문이다(사용자 선택). 드롭이 남지 않으면 수익 건을 지운다(`deleteEntryIfEmpty`).

### 결정 5. 드롭은 서버 `boss_drops` 와 칸 이름 · 상태 값을 맞춘다

- `price_status` 는 서버 `boss_drops` 와 같은 `pending` · `entered` · `skipped` 다. 앱 타입은 화면의 말인 `priceState`
  (`entered` · `excluded` · `null`)로 읽는다. 지금 서버로 보내는 판매가 경로는 옛 상태 이름을 받아서 보낼 때 `entered` 를
  `completed` 로 바꾼다(`dropPricePayloadOf`, [[ADR-018]] 결정 5). 지운 드롭은 행을 지우고 `DELETE` 를 보낸다.
- `sale_price_meso` · `sale_received_meso` · `priced_at` · 분배 칸은 `entered` 일 때만 값이 있다(CHECK). 판매 수수료도 `entered`
  일 때만 적는다(`replaceBossDropRecords`). 그래서 값을 안 매긴 드롭의 분배 칸은 늘 비어 있고, 화면은 분배 처음 값으로 연다.
- `sale_received_meso` 는 판매 수수료와 분배를 반영해 내가 받는 메소다. 가격 · 분배 · 수수료를 고칠 때만 다시 세고, 같은 값으로
  다시 저장하면 이어 받는다([[ADR-099]] 결정 26). 셈법이 바뀌어도 지난 금액이 그대로 남게 하려는 것이다.
- 차례 칸은 없다. 읽을 때 수익 건마다 드롭 표의 차례로 늘어놓고 차례 번호(`dropIndex`)를 매긴다. 차례를 저장하면 드롭 하나를
  넣거나 뺄 때마다 그 묶음의 모든 줄이 바뀐다([[ADR-099]] 결정 27). 그래서 드롭 하나를 고치는 쓰기(`updateDropFees`)는 차례
  번호가 아니라 드롭 id 로 가리킨다.
- 칸은 서버 `boss_drops` 와 같고, 서버의 동기화 칸(`change_seq` · `deleted_at`)만 없다. 지금 판매가 경로는 분배 · 수수료를
  싣지 않는다. 내 몫을 세는 재료라 시세에 쓰지 않기 때문이다([[ADR-018]]).

### 결정 6. 이름은 저장하지 않고 게임 데이터의 줄 id 만 둔다

보스 · 아이템 · 상자 · 월드 이름은 저장하지 않는다. 저장 함수가 읽을 때 줄 id 로 key 를 찾고, 이름은 그 key 로 게임 데이터에서
찾는다(`bossNameOf` · `dropItemNameOf` · `worldNameOf`). 앱 타입(`BossProfitRecord.boss` · `BossDropRecord.itemName` 등)은
그대로 두고 저장 함수가 채운다. 그래서 화면 코드는 바뀌지 않는다. `item_id` 는 NOT NULL 이다. 수량은 늘 1 이라 칸이 없고,
부위도 쓰는 곳이 없어 칸이 없다.

- 반지는 레벨마다 아이템 줄이 따로 있어 `item_id` 가 레벨까지 가리킨다. 상자에서 나온 생명의 연마석은 상자용 줄이다.
- 나온 상자는 적지 않는다. 읽을 때 그 수익 건의 난이도가 그 기간에 주는 상자 가운데 그 아이템을 든 것을 찾는다
  (`dropItemPartsOf`). 같은 난이도가 같은 아이템을 든 상자를 둘 주지 않기 때문이다([[ADR-099]] 결정 28).

그래서 **서버 게임 데이터의 줄은 지우지 않는다.** 대상은 보스 난이도 · 아이템(반지 레벨 줄과 상자용 줄 포함) · 월드다. 기록이
줄 id 만 가지므로, 보스 난이도나 아이템 줄이 사라지면 저장 함수가 그 기록을 읽지 못하고 건너뛴다. 월드 줄이 사라지면 월드를
모르는 기록이 된다. 끝난 시즌 보스처럼 안 쓰게 된 것은 기간(`from` · `until`)으로 닫는다([[ADR-020]]).

### 결정 7. 가격 카드에서 0 을 입력하면 저장하지 않는다

0 을 저장하면 앱은 그 드롭을 값을 매긴 것으로, 서버는 미입력으로 봐서 상태가 갈린다. 상태 칸이 서버와 같은 값 하나라 둘 중
하나로 정해야 한다. 0메소에 판 경우는 사실상 없고, 팔지 않은 것은 `skipped`(기록 안 함)가 뜻한다. 그래서 0 은 빈 칸처럼
다룬다.

### 결정 8. 버전 14 이관은 옛 행의 뜻을 이렇게 옮긴다

옛 테이블 넷을 버전 14 의 표 셋으로 옮길 때(`moveBossTablesToParties`)의 규칙이다. 버전 1 부터 차례로 오르는 기기가 지금도 이
단계를 지나므로 남긴다. 그 표 셋을 지금 표로 옮기는 규칙은 [[ADR-286]] 결정 3 에 있다.

- 옛 `price_state`: `'entered'` 이고 1메소 이상이면 `completed`, `'excluded'` 와 옛 값 `'skipped'` 는 `skipped`, 나머지는
  `pending` 이다. `completed` 가 아닌 행의 분배 · 수수료 칸은 버린다. 백필이 채운 값이라 뜻이 없다.
- 균등이어도 내 비율(`my_share`)이 있으면 남긴다. 2026-10-19 전의 균등 기록은 그 칸으로 금액을 센다([[ADR-044]] 결정 10).
  비우면 수수료가 붙은 기록의 내 몫이 바뀐다. 실기기 드롭 85건의 금액이 이관 전후로 같은 것을 확인했다. 1.0.15 기기 변환은
  받는 메소를 이 칸으로 한 번 센 뒤 저장하고 칸을 비운다.
- `completed` 의 `priced_at` 은 `recorded_at` 으로 채운다. 가격을 매긴 시각이 따로 남아 있지 않다.
- 월드가 없는 드롭은 같은 기간 처치 기록의 `world_key` 를 물려받는다. 처치 기록의 월드는 처치할 때 적은 값이고, 리프하면
  ocid 가 새로 생기므로 같은 ocid 의 같은 기간은 같은 월드다. 실기기에서 77개가 해당하고 전부 10/15 주차 이전이라
  서버로 보낸 적이 없다.
- `item_key` 가 없는 드롭은 옮기지 않는다(실기기 0개).
- 처치 기록과 그 기간 값이 같은 기간에 둘 다 있으면 처치 기록의 값을 쓴다.

### 결정 9. 옛 테이블 넷은 v1.0.13 에서 남기고, DB 버전 23 이 지운다

옛 코드가 새 DB 를 열어도 DB 가 열리지 않는 일이 없어야 한다. 새 드롭 테이블은 옛 `boss_drop_records` 와 다른 이름(`boss_drops`)으로
만든다. 같은 이름이면 옛 코드의 `ensureColumn` · 인덱스 생성 · `INSERT` 가 새 테이블에서 실패한다.

v1.0.13 은 스토어 바이너리로만 냈다. 바이너리에 든 번들이 새 코드라야, OTA 가 실패해 되돌아가도 옛 코드가 새 DB 를 열지
않는다. 같은 이유로 v1.0.13 에서는 옛 테이블을 지우지 않았다.

v1.0.14 의 DB 버전 23(`dropLegacyTables`)이 옛 테이블 넷과 옛 가계부 표 둘(`income_records` · `spend_records`, [[ADR-096]]
결정 6)을 지운다(#685). v1.0.14 도 스토어 바이너리로만 낸다.

- 이관 단계와 이관 전용으로 고정한 옛 테이블 정의는 남긴다. v1.0.13 을 건너뛰고 올라오는 기기와 새 기기는 버전 1 부터 차례로
  돌며 옛 표를 읽는다.
- 그래서 옛 표 여섯의 `CREATE` · `income_records` 다시 쓰기 · `ensureColumn` · 백필은 `user_version` 이 23 보다 작은 DB 에서만
  돈다. 부팅마다 돌면 지운 표가 다음 부팅에 빈 표로 다시 생긴다. 새 기기도 옛 표를 빈 채로 만들었다가 버전 23 에서 지운다.
- 옛 표의 인덱스 `boss_drop_records_group` 은 만들지 않는다. 이관 단계는 이 인덱스 없이 돈다.
- 옛 표끼리도, 새 표에서 옛 표로도 외래키가 없다. 그래서 옛 표를 지워도 새 표의 행이 따라 지워지지 않는다.

### 결정 10. 구현할 때 함께 바꾸는 것

이관 리허설과 코드 점검에서 나온 것이다. 빠뜨리면 기능이 멈추거나 기록이 사라진다.

- **`PRAGMA foreign_keys = ON` 을 DB 를 열 때 켠다.** 기기(op-sqlite)는 기본이 꺼져 있고 테스트(`node:sqlite`)는 켜져
  있어서, 켜지 않으면 테스트에서만 `ON DELETE CASCADE` 가 돈다. 켜면 테이블을 다시 만드는 이관([[ADR-007]] 결정 5)은
  트랜잭션 밖에서 외래키를 끄고 해야 한다. 부모 테이블을 `DROP` 하면 자식 행이 함께 지워지기 때문이다. 기기 변환은 외래키를 켠
  채 자식 표부터 지운다.
- **데이터 삭제를 행 단위로 한다.** `boss_profit_entries` 한 줄에 `수동 선택 항목` 그룹의 그 기간 값과 `보스 처치 · 드롭` 그룹의
  처치가 섞여 있다. 수익 건은 드롭의 부모라 통째로 지우면 고르지 않은 그룹의 기록까지 사라진다. 분배 설정 표는 그 그룹만의
  표라 통째로 지운다.
- **옛 마이그레이션 단계가 쓰는 테이블 정의를 이관 전용으로 고정한다.** 새 기기도 0단계부터 다 돌고, 버전 4 · 12 는
  `boss-tables.ts` 의 첫째 무리 정의로 테이블을 다시 만든다. 그 정의를 새 모양으로 바꾸면 옛 단계가 깨진다. 버전 14 의 표 셋
  정의(둘째 무리)도 변환 전 DB 를 열 때와 앞 버전 이관이 쓰므로 고치지 않는다.
- **옛 표의 `ensureColumn` · 백필은 옛 표가 있는 DB(버전 23 전)에서만 돈다.** 새 표는 이름이 달라 부딪히지 않는다. 표를 지운
  뒤에도 돌면 없는 표에 칸을 더하려다 실패하고, DB 가 안 열려 가계부 · 지출 · 강화 기록까지 멈춘다(결정 9). 같은 이유로 버전 14
  표의 칸 보강(`crystal_excluded` · `over_crystal_limit`)과 인덱스 `boss_drops_period` 는 기기 변환 전 DB 에서만 돈다.
- **완료 판정은 `clear_recorded_by` 가 찼는지로 거른다.** `getBossProfitRecords` · `getAllBossProfitRecordKeys` ·
  `getWeeklyPeriodKeysWithRecords` · `findAdjacentPeriodKeyWithRecords` · `getEarliestBossProfitPeriodKeys` ·
  `getUndatedBossProfitRecords` · `getAutoFeeProfitRecords` 등이다. 거르지 않으면 드롭만 있는 처치 전 수익 건 때문에 안 잡은
  보스가 완료로 보인다.
- **설정이 없으면 솔로라는 판정은 분배 설정 줄이 있는지로 한다.** 설정 표에는 분배를 정한 줄만 있다.
  `copyMissingBossPartySettings` 는 새 캐릭터에 없는 줄만 넣는 `INSERT ... ON CONFLICT DO NOTHING` 이다.
- **난이도 확정 · 월드 리프 정리는 드롭을 다른 수익 건으로 옮기고, 비어 남은 수익 건을 지운다.** 옮기는 쪽은 새 그룹에
  같은 식별자로 먼저 쓰고 옛 그룹을 나중에 비운다. 그래서 `replaceBossDropRecords` 는 다른 수익 건에 있던 식별자를 들고 온
  드롭을 그 수익 건에서 걷어 온다. 걷지 않으면 기본키가 부딪혀 저장이 실패하고, 뒤이은 비우기가 드롭을 지운다. 옛 표에서도
  버전 12 부터 이렇게 드롭이 사라지고 있었다.

### 결정 11. 옛 표를 다 지운 뒤 한 번, 사본 파일을 지우고 `VACUUM` 한다

SQLite 는 표를 지워도 그 공간을 파일 안에 빈 칸으로 남긴다. `VACUUM` 으로 파일을 다시 써야 줄어든다. 2026-10-29 아이폰
실측에서 DB 47MB 가운데 41MB 가 이전 버전 사본이었고, 대부분이 옛 강화 원본(`enhancement_history`)이었다.

- 마지막으로 지워지는 옛 표는 강화 원본이다. 버전 23 은 DB 를 열 때 돌지만, 강화 원본은 합계로 옮긴 뒤
  `ensureEnhancementTotals` 가 지운다([[ADR-101]] 결정 27). 그래서 회수는 강화 원본을 지운 바로 뒤에 한다. 버전 23 뒤에
  곧바로 `VACUUM` 하면 아직 남은 강화 원본까지 다시 쓰고, 그 표를 지운 뒤 한 번 더 돌려야 한다.
- 회수는 두 가지다. 가계부 이관 전에 떠 둔 사본 파일(`boss_profitSQLite-before-v15.db`, [[ADR-096]] 결정 9)을 지우고,
  `VACUUM` 을 돌린다. 사본 파일은 SQL 로 못 지워 `SqlitePort` 의 `removeFile` 로 지운다. 경로는 `PRAGMA database_list`
  의 DB 파일 경로에서 만든다. 파일이 없으면 지운 것으로 본다.
- 한 번만 돈다. 끝나면 Preferences 에 `legacySpaceReclaimed` 를 둔다. 강화 원본이 처음부터 없거나 이미 지운 기기도 표식이
  없으면 한 번 돈다. 그래야 develop 빌드로 강화 원본을 먼저 지운 기기도 사본 파일이 지워진다.
- `VACUUM` 은 트랜잭션 안에서 돌지 않는다. 같은 연결의 트랜잭션 줄(`inTransaction`) 뒤에 세운다. 다른 쓰기 트랜잭션이 열린
  사이에 돌면 `cannot VACUUM from within a transaction` 으로 실패한다.
- 실패하면 표식을 두지 않고 던지지 않는다. 다음 실행에 다시 돈다.
- 2026-11-17 아이폰 DB 사본 둘로 리허설했다. 버전 22 사본은 48.7MB 가 6.0MB 로, 버전 13 사본은 45.3MB 가 1.2MB 로 줄었고,
  두 사본 모두 새 표의 행 수가 그대로였다.

## 테스트

모두 `node:sqlite` 로 실제 엔진을 돌린다.

| 파일 | 확인하는 것 |
|---|---|
| `storage/sqlite/__tests__/boss-tables-real-sqlite.test.ts` | 결정 3 · 8: 옛 행을 심은 버전 13 기기에서 처치 · 설정 · 그 기간 값 · 드롭이 버전 14 의 표 셋으로 옮겨지는지, 드롭만 있는 기간이 분배 칸 빈 `open` 행이 되는지, 매기지 않은 드롭의 분배 칸을 버리는지, 0메소 드롭이 `pending` 인지, key 없는 드롭을 안 옮기는지, 월드를 물려받는지, 이관이 한 번만 도는지 본다 |
| | 결정 10: 버전 14 표에서 조합 행 `UNIQUE`, 외래키를 켜는 문장과 `CASCADE`, 값을 매긴 드롭만 가격 · 분배 칸을 갖는 CHECK 를 본다 |
| `storage/sqlite/__tests__/legacy-tables-real-sqlite.test.ts` | 결정 9: 옛 행을 심은 버전 13 DB 와 새 기기가 버전 23 까지 오른 뒤 옛 표 여섯과 옛 인덱스가 `sqlite_master` 에 없고 새 표의 행이 그대로인지, 다시 열어도 옛 표가 생기지 않는지 본다 |
| `storage/__tests__/legacy-space.spec.ts` | 결정 11: 사본 파일을 지우고 `VACUUM` 한 뒤 표식을 두는지, 표식이 있으면 다시 돌지 않는지, 실패하면 표식을 두지 않고 던지지 않는지, 열린 트랜잭션이 끝난 뒤에 `VACUUM` 하는지 본다 |
| `storage/sqlite/__tests__/enhancement-totals-real-sqlite.test.ts` | 결정 11: 옮긴 뒤에도, 이미 옮긴 기기에서도 강화 원본을 지운 다음에 회수를 부르는지 본다 |
| `storage/__tests__/boss-profit.spec.ts` | 결정 1 · 4 · 10: 처치 읽기가 처치 전 수익 건을 세지 않는지, 처치를 걷으면 드롭이 남은 수익 건이 처치 칸과 분배 칸이 빈 줄로 남는지, 그 기간 값이 처치 값으로 덮이는지, 이름을 key 로 채우는지, 게임 데이터에 없는 보스를 적지 않고 던지는지 본다 |
| `storage/__tests__/boss-party-settings.spec.ts` | 결정 2 · 10: 비율을 % 의 1000 배로 쓰고 등급을 따르면 요율을 비우는지, 처치만 있는 조합을 설정 없음으로 읽는지, 설정 옮기기가 새 캐릭터에 없는 줄만 넣고 이미 정한 값은 안 덮는지 본다 |
| `storage/__tests__/boss-party-period-overrides.spec.ts` | 결정 3: 처치한 기간과 드롭만 있는 기간을 그 기간 값으로 안 읽는지, 처치한 기간을 안 덮는지 본다 |
| `storage/__tests__/boss-drops.spec.ts` | 결정 5 · 6 · 7: 상태 값, 0메소를 `pending` 으로 두는지, 가격을 바꿀 때만 `priced_at` 이 움직이는지, 받는 메소를 이어 받는지, 드롭 표의 차례로 늘어놓는지, 수수료를 드롭 id 로 고치는지, 비우면 빈 수익 건을 지우는지, 이름을 key 로 채우고 나온 상자를 드롭 표에서 되짚는지 본다 |
| `storage/__tests__/cache-data-boss.spec.ts` | 결정 10: 데이터 삭제가 새 표 셋을 그룹마다 행 단위로 지우는지 본다 |
| `features/boss-profit/__tests__/drop-moves-real-sqlite.test.ts` | 결정 4 · 10: 난이도 확정 · 직접 완료 난이도 변경이 드롭을 식별자째 옮기고 옛 수익 건을 지우는지, 직접 완료 취소가 수익 건까지 지우는지 본다 |

## 번호 기록

- ADR-078 (2026-10-21): 보스 기록 테이블 재설계를 처음 작성하고 구현했다(#686)
- ADR-254 (2026-11-17): 결정 9 를 DB 버전 23 이 옛 표 여섯을 지우는 것으로 다시 쓰고, 결정 10 의 옛 표 `ensureColumn` 을 버전 23
  전 DB 로 좁혔다. 사본 파일과 `VACUUM` 으로 공간을 거두는 결정 11 을 더했다(#685)
- ADR-287 (2026-11-21): 결정 1 · 2 · 3 · 4 · 5 · 6 · 10 을 1.0.15 기기 변환이 만든 표 셋(`boss_split_settings` ·
  `boss_profit_entries` · `boss_drops`)으로 다시 썼다. 게임 데이터를 줄 id 로 가리키고, 분배 칸을 다섯으로 줄이고, 드롭의 받는
  메소를 저장하고 차례 칸을 없앴다. 결정 8 은 버전 14 이관의 규칙으로 남겼다(#947)
