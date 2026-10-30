# ADR-099 보스 처치 · 가계부 · 강화 합계의 최종값을 서버로 보낸다

> 🟢 유효
> 관련 소스: `features/server-sync/*` · `storage/server-sync-sources.ts` · `storage/server-backfill.ts` · `server/write.ts` · `server/records.ts` · 서버 `modules/boss-clears` · `modules/cashbook-entries` · `modules/users` · `modules/identity`

## 배경

> 사용자 지정(2026-09-19): 원본 데이터는 사용자 기기에 저장하지만, 변경되지 않는 총액과 2차 생산 목록 등은 서버에서
> 관리한다. 사용자 기기의 데이터를 완전히 옮기려는 게 아니다. 화면을 그리는 데이터는 남겨 둔다.

서버로 올리는 이유는 여러 사용자의 기록으로 통계를 내기 위해서다. 지금 서버로 가는 것은 드롭 가격 하나다([[ADR-018]]).
보스 처치 기록 · 가계부 기록 · 강화 지출은 기기에만 있다(#507).

기록의 id 를 먼저 uuid 로 맞춘 뒤에 한다([[ADR-098]]). 강화 합계는 #614 가 합계 표를 만든 뒤에 이 전송에 더한다.

## 결정

### 결정 1. 보내는 것은 보스 처치 기간 · 가계부 기록 · 강화 합계이고, 드롭은 지금의 `drop_prices` 로 간다

| 종류 | 기기의 원천 | 한 행 |
|---|---|---|
| 보스 처치 | `boss_party_periods` 중 `status = 'cleared'` | 캐릭터 · 보스 · 난이도 · 기간 · 결정석 가격 · 받은 몫 · 분배 · 처치 날짜 |
| 가계부 기록 | `cashbook_entries` + `cashbook_entry_items` | 기록 하나와 품목들, 품목마다 금액 · 수수료 · 관세 |
| 강화 합계 | #614 의 합계 표 | 날짜 · 캐릭터 · 분류 · 장비별 횟수와 메소 |

- 넥슨 API 로 받아 앱이 값을 더한 데이터와 사용자가 적은 데이터가 대상이다(사용자 지정). 넥슨 응답 원본은 보내지 않는다.
- 드롭은 지금처럼 `drop_prices` 로 보낸다(사용자 선택). 서버 `drop_prices` 에 처치 기간 행의 id 칸을 더해 어느 처치에서
  나온 드롭인지 잇는다. 드롭 시세 관리 화면([[ADR-071]])은 바꾸지 않는다.

### 결정 2. 서버에는 행 단위 최종값을 둔다

기간 합계만 두면 서버는 어느 보스를 몇 번 잡았는지 몰라 값을 고칠 수 없다. 그래서 위 표의 한 행을 서버의 한 줄로
둔다(사용자 선택). 행의 id 는 기기의 uuid 이고, 서버는 [[ADR-018]] 결정 7 처럼 사람 안에서만 그 id 로 덮는다.

### 결정 3. 기기가 계산하고 기기 값이 기준이다. 서버 값은 사본이다

화면은 지금처럼 기기의 표를 읽는다(사용자 선택). 서버가 죽어도 앱은 선다. 서버 값은 통계에 쓰고, 기기로 내려보내지
않는다. 그래서 계산이 틀린 값을 고치는 일은 지금처럼 기기 이관이 맡는다.

### 결정 4. 저장할 때마다 다시 보내고, 지우면 `DELETE` 를 보낸다

굳는 시점을 따로 두지 않는다(사용자 선택). 가계부는 날짜를 골라 적고 드롭은 지난 기간을 다시 고칠 수 있어서, 과거 값도
언제든 바뀐다. 종류마다 `registry.ts` 에 등록한다.

- 처치 · 가계부는 쓰는 자리가 바뀐 기록 id 를 대기 표(`server_sync_queue`)에 넣고 곧바로 전송을 깨운다(`report.ts`).
  분배 수수료를 다시 매기면 수백 건이 한꺼번에 바뀌어, 건마다 바로 요청을 내면 몰리기 때문이다. 드롭 가격은 지금처럼 저장
  직후 한 건씩 보내고 못 보낸 것만 대기 표에 남긴다([[ADR-018]] 결정 4 · 8).
- 전송은 한 번에 한 회차만 돈다(`kick.ts`). 도는 중에 다시 깨우면 끝난 뒤 한 번 더 돈다. 두 회차가 겹치면 같은 줄을 두 번
  보낸다.
- 지우는 자리는 지우기 **전에** 기간 행 id 를 얻고 지운 **뒤에** 대기 표에 넣는다. 먼저 넣으면 전송이 지우기보다 앞서 돌아
  남아 있는 처치를 서버에 다시 적는다. 처치가 아니게 된 기간(`open`)과 사라진 기록은 전송이 `DELETE` 로 보낸다.

### 결정 5. 전송은 끌 수 없다

끄는 사용자가 있으면 그 사람의 값이 서버에 없다(사용자 지정). 드롭 가격도 이미 끌 수 없다.

### 결정 6. 이미 기기에 쌓인 기록은 업데이트 뒤 한 번 모두 올린다

업데이트 뒤 처음 켤 때부터 기존 기록을 올린다(사용자 선택). 서버 통계에 과거가 들어간다. 보내는 방법은 결정 12 의 묶음이고,
드롭도 함께 올린다(결정 13).

### 결정 7. 캐릭터는 ocid 로 적고, 강화 합계만 캐릭터 이름으로 적는다

보스 처치와 가계부 기록은 기기에 ocid 가 있어 ocid 를 보낸다. 강화 내역은 넥슨 응답이 캐릭터 이름만 줘서 이름을
보낸다(사용자 선택). 그래서 개인정보 처리방침에 캐릭터 이름 수집을 적는다.

강화 합계의 비용은 MVP 할인 전 값이다. MVP 할인은 앱이 화면에 보일 때만 붙이고 서버로 보내지 않는다(사용자 지정
2026-10-26, [[ADR-100]] 결정 2).

### 결정 8. 서버를 먼저 배포하고, 서버 PR 은 따로 낸다

받는 표와 경로가 없는 서버에 앱이 보내면 실패만 쌓인다([[ADR-018]] 결정 9).

### 결정 9. 넥슨 약관은 사용자가 확인하고, 처리방침은 함께 고친다

모든 사용자에게 끌 수 없이 적용되므로 넥슨 약관이 이 수집을 허용하는지 사용자가 확인한다. `PRIVACY.md` 수정 초안과
스토어 개인정보 신고에서 바꿀 항목 목록은 이 작업에 넣는다(사용자 선택). 지금 처리방침은 드롭 판매가만 적고 있다.

### 결정 10. 서버는 사람과 넥슨 계정을 나눈다

다계정([[ADR-101]])을 위해 이 작업의 서버 PR 에서 나눈다(사용자 선택 2026-10-26). 지금 `users` 는 한 줄에 `nexon_uid`
나 `api_key_hash` 하나를 둬서, 한 사람이 넥슨 계정을 여럿 가질 수 없다.

- `users` 는 사람이다. 새 `nexon_accounts` 표가 자격을 든다. 한 줄이 넥슨 계정 하나이고, 칸은 `user_id` · 종류(로그인 ·
  키) · `nexon_uid` 또는 `api_key_hash` · 기기가 만든 계정 id 다. 기존 `users` 의 두 칸은 이 표로 옮긴다.
- 기기가 만든 계정 id([[ADR-098]] 결정 5)는 사람 안에서만 유일하다. 드롭 기록 id 와 같은 이유다([[ADR-018]] 결정 7).
- 로그인 방식과 상관없이 모든 계정의 기록을 보낸다(사용자 지정). 부계정의 기록도 메인 계정의 신원으로 보내고, 어느 계정의
  기록인지는 계정 id 로 적는다.
- 강화 합계는 `nexon_account_id` 를 든다. 가계부 기록은 캐릭터가 없을 때만 든다. 보스 처치는 ocid 로 찾으므로 두지 않는다.
- API 키로만 쓰던 사람이 나중에 그 키를 부계정으로 등록하면, 그 키의 계정과 기록을 메인 사람 밑으로 옮기고 옛 사람 줄은
  닫는다(사용자 선택). 통계에서 한 사람이 둘로 세이지 않게 하려는 것이다.
  이 합치기는 부계정을 등록하는 경로가 생기는 다계정 작업([[ADR-101]])에서 만든다. 지금은 부계정을 등록할 길이 없다.

### 결정 11. 기기의 넥슨 계정 id 는 쓰기 요청마다 신원 헤더 옆에 싣는다

`x-nexon-account-id` 헤더에 메인 계정의 id([[ADR-098]] 결정 5)를 싣는다(사용자 선택 2026-10-26). 서버는 그 신원의
`nexon_accounts` 줄에 이 id 를 적는다. 따로 등록하는 호출이 없어 앱이 등록했는지를 기억할 필요가 없다. 헤더가 없는
옛 OTA 의 요청도 받는다. 그때는 계정 id 를 안 적을 뿐이다.

### 결정 12. 과거 기록은 묶음 경로로 100 건씩 나눠 보낸다

업데이트 직후 사용자마다 천여 건이 한 건씩 나가면 서버 요청이 몰린다(사용자 선택 2026-10-26). 그래서 종류마다 묶음
경로를 두고, 앱을 켤 때 보내지 않은 기록을 100 건씩 보낸다.

- 어디까지 보냈는지는 종류마다 마지막으로 보낸 기록 id 를 Preferences 에 적는다. 앱이 중간에 꺼져도 다음 회차가 그 뒤부터
  잇는다. 다 보내면 그 종류는 끝으로 적고 다시 훑지 않는다.
- 한 묶음이 실패하면 그 회차를 멈추고 다음에 앱을 켤 때 같은 자리부터 다시 보낸다. 서버는 기록 id 로 덮으므로 두 번 받아도
  줄이 늘지 않는다.
- 평소 저장은 지금처럼 한 건씩 보낸다. 과거를 보내는 동안 고친 기록은 한 건 전송이 따로 덮는다.

### 결정 13. 드롭의 기준일을 걷고 과거 드롭도 올린다

지금은 2026-10-15 이후 기간의 드롭만 보낸다(`SERVER_PRICE_FROM`). 이 기준을 걷고, 과거 드롭도 결정 12 의 묶음으로
올린다(사용자 선택). 드롭 시세 통계에 과거 판매가가 들어간다. 드롭 줄에는 어느 처치 기간의 드롭인지 기기 기간 id 를
더한다.

### 결정 14. 가계부 key 는 글자 그대로 두고, 보스 · 난이도 · 월드는 드롭 가격처럼 서버 표의 줄로 바꿔 적는다

- 가계부 품목의 key 는 갈래마다 다른 표(지출 항목 · 심볼 · 사냥터 · 아이템 종류)를 가리킨다. 외래키로 바꾸면 표에 없는
  key 가 온 기록을 거절하게 되고, 거절된 기록은 5 회 뒤 버려진다. 그래서 `category_key` · `item_key` 를 글자로 둔다(사용자
  선택). 게임 데이터 key 는 지우지 않으므로([[ADR-078]] 결정 6) 글자로 둬도 이름을 찾을 수 있다.
- 보스 처치의 보스 · 난이도 · 월드는 `drop_prices` 와 같은 방식이다(사용자 지정). 보스 key 는 바뀔 일이 없기 때문이다.
  보스 · 난이도는 `boss_difficulty_id` 로 바꿔 적고 표에 없으면 빈 칸이다. 월드는 `world_id` 로 바꿔 적고 표에 없으면
  400 으로 거절한다.

### 결정 15. 가계부 메모 칸을 없애고, 사냥 계산기 입력은 보내지 않는다

- 기기의 `cashbook_entries.memo` 칸과 기록 타입의 `memo` 를 지운다(사용자 지정). 입력 시트 아홉이 모두 이 칸을 `null` 로
  적고 화면에 입력하는 곳이 없다. 실기기에도 메모가 든 기록이 없었다(옛 표 둘 포함 0 건). 그래서 서버에도 칸을 두지 않는다.
- 사냥 계산기 입력(`cashbook_entry_hunt_inputs`)은 보내지 않는다. 계산에 쓴 원본 값이고, 최종값은 품목의 금액이다.
- 0 메소 헥사 매트릭스 기록은 보내지 않고, 보낸 적이 있으면 서버에서 지운다([[ADR-137]] 결정 10). 교환 불가 조각이 더 많아 돈이 안 든 기록이라 지출 통계에 넣지 않는다. 헥사 기록의 조각 칸 넷(필요 조각 · 교환 불가 · 개당 가격 · 활성화)은 함께 보낸다.

## 서버 표와 경로

칸 이름은 [[ADR-098]] 결정 7 의 규칙이다. 기기 uuid 는 `무엇_record_id` 로 적고 사람 안에서만 유일하다.

```
users             id · deleted_at · created_at                         (nexon_uid · api_key_hash 는 nexon_accounts 로 옮긴다)
nexon_accounts    id · user_id · identity_source(login · key) · nexon_uid UNIQUE · api_key_hash UNIQUE
                  · account_record_id · created_at · updated_at        UNIQUE(user_id, account_record_id)
boss_clears       id · user_id · identified_by · period_record_id · ocid · boss_difficulty_id · cycle · period_key
                  · world_id · price_meso · payout_meso · split_mode · party_size · my_share · shares_total
                  · split_fee_percent · defeated_date · source · deleted_at · created_at · updated_at
                  UNIQUE(user_id, period_record_id)
cashbook_entries  id · user_id · identified_by · entry_record_id · ocid · nexon_account_id · entry_type · category_key
                  · entry_date · deleted_at · created_at · updated_at   UNIQUE(user_id, entry_record_id)
  └ cashbook_entry_items  id · entry_id · sort_order · item_key · item_name · form_key · item_kind_key · quantity
                  · from_level · to_level · amount_meso · tariff_meso · sale_fee_percent · sale_fee_meso · amount_point
                  · point_per_100m_meso · amount_cash                   UNIQUE(entry_id, sort_order)
drop_prices       (지금 칸) + period_record_id
```

| 경로 | 하는 일 |
|---|---|
| `POST /v1/boss-clears` · `DELETE /v1/boss-clears/:periodRecordId` | 처치 기간 한 건을 덮어 적거나 지운 것으로 표시한다. 처치를 취소하면 지운다 |
| `POST /v1/cashbook-entries` · `DELETE /v1/cashbook-entries/:entryRecordId` | 가계부 기록 한 건과 품목. 품목은 통째로 갈아 끼운다 |
| `POST /v1/boss-clears/batch` · `POST /v1/cashbook-entries/batch` · `POST /v1/drop-prices/batch` | 과거 기록 묶음. 한 번에 100 건까지 |

- 지울 때는 줄을 남기고 `deleted_at` 을 적는다. 드롭 가격의 `deleted` 와 같은 이유다([[ADR-018]] 결정 6).
- 잘못된 본문 하나가 묶음 전체를 막지 않도록, 묶음은 건마다 결과를 돌려주고 받을 수 있는 건은 받는다. 통째로 거절하면
  앱이 같은 묶음을 계속 다시 보내 그 사용자의 과거 올리기가 멈춘다.
- 묶음에서 실패한 건은 평소 대기 표에 넣는다(사용자 선택). 한 건씩 5 회 다시 보내고 그래도 안 되면 버린다. 서버를 고치면
  다시 보낼 기회가 생긴다.


## 테스트

강화 합계(결정 1 의 셋째 종류 · 결정 7 의 이름)는 #614 가 합계 표를 만든 뒤에 더한다. 아래는 처치 · 드롭 · 가계부다.

| 파일 | 확인하는 것 |
|---|---|
| `features/server-sync/__tests__/backfill.spec.ts` | 결정 12: 종류마다 100 건씩 보내고 적게 읽히면 끝으로 적는지, 묶음이 실패하면 자리를 안 넘겨 다음 회차가 같은 자리부터 보내는지, 받지 못한 건만 대기 표로 보내는지, 끝난 종류를 건너뛰는지 |
| `features/server-sync/__tests__/kick.spec.ts` | 결정 4: 도는 중에 다시 깨우면 겹쳐 돌지 않고 끝난 뒤 한 번 더 도는지 |
| `features/server-sync/__tests__/record-payloads.spec.ts` | 결정 10 · 15: 캐릭터 없는 가계부 기록만 계정 id 를 싣고 사냥 입력을 안 싣는지, 값이 없으면 지우기를 보내는지 |
| `features/server-sync/__tests__/drop-price-sync.spec.ts` | 결정 13: 옛 기간의 드롭도 보내고 기간 행 id 를 싣는지 |
| `features/auth/__tests__/server-identity.spec.ts` | 결정 11: 신원 헤더 옆에 메인 계정 id 를 싣는지 |
| `storage/sqlite/__tests__/server-sync-sources-real-sqlite.test.ts` | 결정 1 · 4: 처치한 기간만 처치로 읽고, 키로 취소된 기간도 찾고, 과거 올리기가 id 차례로 나눠 읽는지 |
| `storage/sqlite/__tests__/record-keys-real-sqlite.test.ts` | 결정 15: 버전 17 이 메모 칸을 지우는지 |
| `src/server/__tests__/write.spec.ts` | 결정 12: 묶음이 `/batch` 로 가고 건마다 결과를 돌려받는지 |
| 서버 `users.repository.spec.ts` · `identity.guard.spec.ts` | 결정 10 · 11: 자격으로 사람 · 계정을 찾고 동시에 와도 사람이 하나인지, 헤더의 계정 id 를 적되 같은 사람의 다른 계정이 가진 id 는 안 적는지 |
| 서버 `boss-clears.*.spec.ts` · `cashbook-entries.*.spec.ts` · `drop-prices.*.spec.ts` · `common/batch.spec.ts` | 결정 2 · 4 · 12 · 14: 같은 기록은 한 줄로 덮고 사람이 다르면 따로인지, 지우면 표시만 하고 다시 적으면 되살아나는지, 모르는 월드는 거절하고 모르는 보스는 빈 칸인지, 묶음이 틀린 건만 실패로 돌려주는지 |

## 번호 기록

- ADR-099 (2026-10-26): 보스 처치 · 가계부 · 강화 합계를 서버로 보내는 결정을 처음 작성했다(#507). 같은 날 사람과
  넥슨 계정을 나누는 결정 10 과, 강화 합계를 MVP 할인 전 값으로 보내는 문단(결정 7)을 더했다
- ADR-099 (2026-10-26): 계정 id 헤더(결정 11) · 과거 기록 묶음(결정 12) · 드롭 기준일 걷기(결정 13) · key 를 적는 방식(결정 14) ·
  메모 칸 없애기와 보내지 않는 것(결정 15)과 서버 표 · 경로를 더했다
- ADR-099 (2026-10-26): 처치 · 드롭 · 가계부 전송과 과거 올리기, 서버 사람 · 계정 분리를 구현했다. 강화 합계는 #614 뒤
