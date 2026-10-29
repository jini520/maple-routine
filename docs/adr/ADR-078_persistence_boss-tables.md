# ADR-078 보스 기록 테이블 재설계

> 🟢 유효
> 관련 소스: `storage/sqlite/boss-tables.ts` · `storage/sqlite/db.ts` · `storage/sqlite/migrations.ts` · `storage/boss-profit.ts` · `storage/boss-drops.ts` · `storage/boss-party-settings.ts` · `storage/boss-party-period-overrides.ts` · `storage/cache-data.ts` · `features/server-sync/drop-price-sync.ts`

## 배경

보스 기록은 테이블 넷에 있다. `boss_profit_records`(처치 기록) · `boss_party_settings`(보스 관리의 파티 설정) ·
`boss_party_period_overrides`(미완료 행에서 그 기간만 고친 값) · `boss_drop_records`(드롭과 판매가)다.

두 가지가 문제였다.

- **같은 칸이 테이블마다 반복된다.** 보스 조합(`ocid` · `boss_key` · `boss` · `difficulty`)은 네 테이블 모두에,
  분배 조건(인원 · 결정석 비율 · 분배 수수료)은 세 테이블에 있다. 드롭은 같은 뜻의 분배 칸을 `price_*` 이름으로 따로 가진다.
- **기본키가 값의 조합이다.** 처치 난이도가 확정되면 드롭 행마다 `difficulty` 를 옮겨 적어야 했다.

이 결정은 #686 에서 정했고(2026-10-21), v1.0.13 스토어 바이너리로 낸다. 실기기 DB 사본과 합성 DB 로 이관 리허설을 돌려
결정 3 · 5 를 확인했다.

## 결정

### 결정 1. 테이블 넷을 부모 · 자식 셋으로 다시 짜고, 기본키는 모두 uuid 다

```
boss_parties          id · ocid · boss_key · difficulty · 분배 조건 · created_at · updated_at
  └ boss_party_periods  id · party_id · period_key · cycle · world_key · status
      │                 · price_meso · payout_meso · defeated_date · source · 분배 조건 · created_at · updated_at
      └ boss_drops        id · period_id · sort_order · category · item_key · box_origin_key · ring_level
                        · record_status · price_meso · priced_at · 분배 조건 · sale_fee_percent · sale_fee_auto
                        · created_at · updated_at
```

- `boss_parties` 는 옛 `boss_party_settings` 를 대신한다. 보스 관리에서 정하지 않은 조합도 처치나 드롭이 생기면 행이
  생긴다. 그 행은 분배 칸이 NULL 이고, 보스 관리에서 정한 적이 없다는 뜻이다.
- `boss_party_periods` 는 옛 처치 기록과 그 기간 값을 한 행에 담는다. `clear_status` 가 처치 여부를 가른다(`cleared` 처치함 · `open` 그 기간 값이나 드롭만 있음). 지금은 처치 기록
  테이블에 행이 있는지로 완료를 판단한다.
- 드롭은 `period_id` 하나로 보스 · 난이도 · 기간 · 월드를 찾는다. 처치 난이도가 확정되면 기간 행의 `party_id` 만 바꾼다.

기본키와 유일성은 [[ADR-077]] 결정 8 을 따른다. `boss_parties (ocid, boss_key, difficulty)` 와
`boss_party_periods (party_id, period_key)` 는 `UNIQUE` 다. 같은 기간 행이 둘 생기면 드롭이 두 행에 나뉘어 붙기 때문이다.
드롭의 `(period_id, sort_order)` 는 일반 인덱스다.

### 결정 2. 분배 조건 6칸과 시각 2칸은 한 곳에서 정의해 세 테이블이 같이 쓴다

분배 조건은 `split_mode` · `party_size` · `my_share` · `shares_total` · `split_fee_percent` · `split_fee_auto` 이고, 시각은
`created_at` · `updated_at` 이다. `boss-tables.ts` 에 칸 정의와 읽기 · 쓰기 변환을 한 번만 두고 세 테이블이 가져다 쓴다.
별도 테이블로 빼지 않는 이유는 숫자 몇 개라서다. 빼면 읽을 때마다 조인이 하나씩 늘어난다.

결정석에도 `split_mode` 를 둔다. 지금 결정석은 비율 칸이 NULL 이면 균등으로 읽어서, 비율 1:3 과 균등 3인을 숫자로 가를
수 없다. 드롭은 같은 이유로 방식 칸을 이미 따로 두었다. 칸이 같아서 드롭 가격 카드의 분배 처음 값은 기간 행이나 조합 행의
분배 조건을 그대로 옮기면 된다.

### 결정 3. 기간 행의 분배 칸은 NULL 이면 조합 행을 따른다

처치하면 그때의 분배 조건을 기간 행에 복사한다. 나중에 보스 관리 설정을 바꿔도 지난 정산이 바뀌지 않게 하기 위해서다.
처치 전 기간 행은 분배 칸이 NULL 이거나(드롭만 있음) 값이 있다(그 기간만 고친 값).

NOT NULL 로 두면 처치도 설정도 없이 드롭만 있는 기간을 옮길 수 없다. 리허설에서 이관이 그 자리에서 실패했다. 설정 값으로
채우면 그 기간이 그 기간만 고친 값처럼 보여서, 보스 관리 설정을 바꿔도 따라가지 않는다.

드롭 가격 카드의 분배 처음 값은 기간 행 → 조합 행 → 1인 순서로 찾는다.

### 결정 4. 직접 완료를 취소하면 그 기간은 보스 관리 설정 값으로 돌아간다

처치 기록과 그 기간 값이 한 행이라, 처치 전에 그 기간만 고쳐 둔 값은 처치할 때 처치 기록의 값으로 덮인다. 취소하면 기간
행의 분배 칸을 NULL 로 되돌린다. 미리 고쳐 둔 값을 따로 지키지 않는 이유는 직접 완료가 상시 쓰는 기능이 아니기 때문이다
(사용자 선택). 드롭이 남지 않으면 기간 행을 지운다.

### 결정 5. 드롭은 서버 `drop_prices` 와 칸 이름 · 상태 값을 맞춘다

- `record_status` 는 서버와 같은 `pending` · `completed` · `skipped` 다. 앱 타입은 화면의 말인 `priceState` 로 읽고, 서버로
  보낼 때 이름만 되돌린다. 금액을 다시 따지지 않는다. 서버의 `deleted` 는
  서버에만 있는 삭제 표시라 앱에 두지 않는다. 앱은 행을 지우고 `DELETE` 를 보낸다.
- `price_meso` · `priced_at` · 분배 조건 · 판매 수수료는 `completed` 일 때만 값이 있다(CHECK). 그래서 DB 를 열 때마다
  가격 없는 드롭에 `price_split_mode = 'even'` 을 채우는 백필이 새 표에는 닿지 않고, 값을 안 매긴 드롭의 분배 칸을 화면이
  안 읽게 한 우회([[ADR-076]])도 걷었다.
- `priced_at` · `created_at` · `updated_at` 은 서버와 같은 이름이다.
- 앱에만 있는 칸은 `sort_order` · `category` · `box_origin_key` 와 분배 · 수수료 칸이다. 분배 · 수수료는 내 몫을 세는
  재료라 서버로 보내지 않는다([[ADR-018]]).

### 결정 6. 이름은 저장하지 않고 key 만 둔다

`boss` · `item_name` · `box_origin` · `world` 를 지운다. 이름은 게임 데이터에서 key 로 찾는다(`bossNameOf` ·
`dropItemNameOf` · `worldNameOf`). 앱 타입(`BossProfitRecord.boss` · `BossDropRecord.itemName` 등)은 그대로 두고, 저장 함수가
읽을 때 key 로 찾아 채운다. 그래서 화면 코드는 바뀌지 않는다. 표에 없는 key 면 key 문자열이 선다. `item_key` 는 NOT NULL 이다. `quantity` 는 늘 1 이라 지우고, `slot` 은 2026-10-16
부터 안 쓰는 칸이라 지운다.

그래서 **서버 게임 데이터의 key 는 지우지 않는다.** 대상은 보스 · 난이도 · 드롭 아이템 · 상자 · 월드다. 기록이 key 만
가지므로 key 가 사라지면 그 기록의 이름을 찾을 수 없다. 지금 서버에는 이것들을 지우거나 key 를 바꾸는 경로가 없고, 앞으로도
만들지 않는다. 끝난 시즌 보스처럼 안 쓰게 된 것은 기간(`from` · `until`)으로 닫는다([[ADR-020]]).

### 결정 7. 가격 카드에서 0 을 입력하면 저장하지 않는다

지금은 0 이 저장되고, 앱은 그 드롭을 값을 매긴 것으로, 서버는 미입력으로 본다(`dropPricePayloadOf` 가 바꿔 보낸다).
상태 칸이 서버와 같은 값 하나라 둘 중 하나로 정해야 한다. 0메소에 판 경우는 사실상 없고, 팔지 않은 것은 `skipped`
(기록 안 함)가 뜻한다. 그래서 0 은 빈 칸처럼 다룬다.

### 결정 8. 이관은 옛 행의 뜻을 이렇게 옮긴다

- 옛 `price_state`: `'entered'` 이고 1메소 이상이면 `completed`, `'excluded'` 와 옛 값 `'skipped'` 는 `skipped`, 나머지는
  `pending` 이다. `completed` 가 아닌 행의 분배 · 수수료 칸은 버린다. 백필이 채운 값이라 뜻이 없다.
- 균등이어도 내 비율(`my_share`)이 있으면 남긴다. 2026-10-19 전의 균등 기록은 그 칸으로 금액을 센다([[ADR-044]] 결정 10).
  비우면 수수료가 붙은 기록의 내 몫이 바뀐다. 그룹을 다시 저장할 때도 같은 이유로 남긴다. 실기기 드롭 85건의 금액이
  이관 전후로 같은 것을 확인했다.
- `completed` 의 `priced_at` 은 `recorded_at` 으로 채운다. 가격을 매긴 시각이 따로 남아 있지 않다.
- 월드가 없는 드롭은 같은 기간 처치 기록의 `world_key` 를 물려받는다. 처치 기록의 월드는 처치할 때 적은 값이고, 리프하면
  ocid 가 새로 생기므로 같은 ocid 의 같은 기간은 같은 월드다. 실기기에서 77개가 해당하고 전부 10/15 주차 이전이라
  서버로 보낸 적이 없다.
- `item_key` 가 없는 드롭은 옮기지 않는다(실기기 0개).
- 처치 기록과 그 기간 값이 같은 기간에 둘 다 있으면 처치 기록의 값을 쓴다.

### 결정 9. 옛 테이블 넷은 v1.0.13 에서 지우지 않고, v1.0.14 에서 지운다

옛 코드가 새 DB 를 열어도 DB 가 열리지 않는 일이 없어야 한다. 새 드롭 테이블은 옛 `boss_drop_records` 와 다른 이름(`boss_drops`)으로
만든다. 같은 이름이면 옛 코드의 `ensureColumn` · 인덱스 생성 · `INSERT` 가 새 테이블에서 실패한다.

v1.0.13 은 스토어 바이너리로만 낸다. 바이너리에 든 번들이 새 코드라야, OTA 가 실패해 되돌아가도 옛 코드가 새 DB 를 열지
않는다. 옛 테이블은 v1.0.14 에서 새 마이그레이션 버전으로 지운다(#685). 그때도 이관 단계와 옛 테이블 정의는 남긴다.
v1.0.13 을 건너뛰고 올리는 기기가 그 단계를 거쳐야 하기 때문이다.

### 결정 10. 구현할 때 함께 바꾸는 것

이관 리허설과 코드 점검에서 나온 것이다. 빠뜨리면 기능이 멈추거나 기록이 사라진다.

- **`PRAGMA foreign_keys = ON` 을 DB 를 열 때 켠다.** 기기(op-sqlite)는 기본이 꺼져 있고 테스트(`node:sqlite`)는 켜져
  있어서, 켜지 않으면 테스트에서만 `ON DELETE CASCADE` 가 돈다. 켜면 테이블을 다시 만드는 이관([[ADR-007]] 결정 5)은
  트랜잭션 밖에서 외래키를 끄고 해야 한다. 부모 테이블을 `DROP` 하면 자식 행이 함께 지워지기 때문이다.
- **데이터 삭제를 행 단위로 한다.** 한 표에 `수동 선택 항목` 그룹의 분배 칸과 `보스 처치 · 드롭` 그룹의 행이 섞여 있다.
  `boss_parties` · `boss_party_periods` 는 처치 기록의 부모라 통째로 지우면 고르지 않은 그룹의 기록까지 사라진다.
- **옛 마이그레이션 단계가 쓰는 테이블 정의를 이관 전용으로 고정한다.** 새 기기도 0단계부터 다 돌고, 버전 4 · 12 는
  `boss-tables.ts` 의 정의로 테이블을 다시 만든다. 그 정의를 새 모양으로 바꾸면 옛 단계가 깨진다.
- **옛 표의 `ensureColumn` · 백필 · `boss_drop_records_group` 인덱스는 옛 표와 함께 v1.0.14 까지 둔다.** 새 표는 이름이 달라
  부딪히지 않는다. 옛 표를 지우는 날 함께 걷는다(#685). 하나라도 실패하면 DB 가 안 열려 가계부 · 지출 · 강화 기록까지
  멈추므로, 옛 표만 지우고 이 문장을 남기면 안 된다.
- **행이 있으면 완료로 읽던 함수는 `clear_status` 로 거른다.** `getBossProfitRecords` · `getAllBossProfitRecordKeys` ·
  `getWeeklyPeriodKeysWithRecords` · `findAdjacentPeriodKeyWithRecords` · `getEarliestBossProfitPeriodKeys` ·
  `getUndatedBossProfitRecords` · `getAutoFeeProfitRecords` 등이다. 거르지 않으면 안 잡은 보스가 완료로 보인다.
- **설정이 없으면 솔로라는 판정은 `boss_parties` 의 분배 칸이 NULL 인지로 한다.** `copyMissingBossPartySettings` 는 분배
  칸이 NULL 인 행을 채우는 `INSERT ... ON CONFLICT` 로 바꾼다.
- **난이도 확정 · 월드 리프 정리는 드롭을 다른 기간 행으로 옮기고, 비어 남은 기간 행을 지운다.** 옮기는 쪽은 새 그룹에
  같은 식별자로 먼저 쓰고 옛 그룹을 나중에 비운다. 그래서 `replaceBossDropRecords` 는 다른 기간에 있던 식별자를 들고 온
  드롭을 그 기간에서 걷어 온다. 걷지 않으면 기본키가 부딪혀 저장이 실패하고, 뒤이은 비우기가 드롭을 지운다. 옛 표에서도
  버전 12 부터 이렇게 드롭이 사라지고 있었다.

## 테스트

모두 `node:sqlite` 로 실제 엔진을 돌린다.

| 파일 | 확인하는 것 |
|---|---|
| `storage/sqlite/__tests__/boss-tables-real-sqlite.test.ts` | 결정 3 · 8: 옛 행을 심은 버전 13 기기에서 처치 · 설정 · 그 기간 값 · 드롭이 옮겨지는지, 드롭만 있는 기간이 분배 칸 빈 `open` 행이 되는지, 매기지 않은 드롭의 분배 칸을 버리는지, 0메소 드롭이 `pending` 인지, key 없는 드롭을 안 옮기는지, 월드를 물려받는지, 옛 표가 남는지, 이관이 한 번만 도는지 |
| | 결정 1 · 5 · 10: 조합 행 `UNIQUE`, 외래키를 켜는 문장과 `CASCADE`, 값을 매긴 드롭만 가격 · 분배 칸을 갖는 CHECK |
| `storage/__tests__/boss-profit.spec.ts` | 결정 1 · 4 · 10: 처치 읽기가 `open` 행을 세지 않는지, 처치를 걷으면 드롭이 남은 기간이 분배 칸 빈 `open` 이 되는지, 그 기간 값이 처치 값으로 덮이는지, 이름을 key 로 채우는지 |
| `storage/__tests__/boss-party-settings.spec.ts` | 결정 10: 분배 칸 빈 조합 행을 설정 없음으로 읽는지, 설정 옮기기가 그 행을 채우고 이미 정한 값은 안 덮는지 |
| `storage/__tests__/boss-party-period-overrides.spec.ts` | 결정 3: 처치한 기간과 드롭만 있는 기간을 그 기간 값으로 안 읽는지, 처치한 기간을 안 덮는지 |
| `storage/__tests__/boss-drops.spec.ts` | 결정 5 · 6 · 7: 상태 값, 0메소를 `pending` 으로 두는지, 가격을 바꿀 때만 `priced_at` 이 움직이는지, 비우면 빈 기간 행을 지우는지, 이름을 key 로 채우는지 |
| `storage/__tests__/cache-data-boss.spec.ts` | 결정 10: 데이터 삭제가 새 표 셋을 그룹마다 행 단위로 지우는지 |
| `features/boss-profit/__tests__/drop-moves-real-sqlite.test.ts` | 결정 4 · 10: 난이도 확정 · 직접 완료 난이도 변경이 드롭을 식별자째 옮기고 옛 기간 행을 지우는지, 직접 완료 취소가 기간 행까지 지우는지 |

## 번호 기록

- ADR-078 (2026-10-21): 보스 기록 테이블 재설계를 처음 작성하고 구현했다(#686)
