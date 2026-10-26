# ADR-098 남은 표의 기본키 · 파티 약속 id · 넥슨 계정 id 를 uuid 로 둔다

> 🟢 유효
> 관련 소스: `storage/api-key.ts` · `storage/nexon-account-ids.ts` · `features/auth/legacy-account-ids.ts` · `features/auth/reentry-account-id.ts` · `storage/sqlite/record-key-tables.ts` · `storage/sqlite/db.ts` · `storage/sqlite/migrations.ts` · `storage/sqlite/uuid.ts` · `storage/character-profiles.ts` · `storage/character-world-leaps.ts` · `storage/enhancement-history.ts` · `storage/mvp-grades.ts` · `storage/character-accounts.ts` · `storage/party-appointments.ts` · `features/party-appointments/draft.ts`

## 배경

앱의 기본키는 uuid 한 칸이다([[ADR-077]] 결정 8). 보스 기록 표는 [[ADR-078]] 이, 가계부 기록 표와 기록 id 는
[[ADR-096]] 이 이미 옮겼다. 아직 옮기지 않은 것이 여섯 남았다(#670).

| 대상 | 지금 기본키 · id |
|---|---|
| `character_profiles` | `ocid` |
| `character_world_leaps` | `from_ocid` |
| `enhancement_history_checks` | `(kind, date_key)` |
| `mvp_grade_history` | `(account_id, start_date)` |
| `character_accounts` | `(ocid, name, account_id)` |
| 파티 약속(Preferences `partyAppointments`) | `newAppointmentId` 가 만든 `시각 + 난수` |

이 작업은 서버로 기록을 올리는 #507 보다 먼저 한다(사용자 지정 2026-10-26). 서버로 가는 행의 id 가 처음부터 uuid
여야, 서버 표가 나중에 id 를 옮기지 않아도 되기 때문이다. 순서는 #670 · #507 · #614 · #615 이고, 이슈마다 앱 PR 을
하나씩 낸다(사용자 선택). 네 이슈 모두 v1.0.13 스토어 바이너리로 낸다.

## 결정

### 결정 1. 다섯 표는 `id` 칸을 기본키로 두고, 옛 기본키 조합은 `UNIQUE` 로 옮긴다

```
character_profiles          id · ocid(UNIQUE) · 나머지 칸 그대로
character_world_leaps       id · from_ocid(UNIQUE) · to_ocid · linked_at
enhancement_history_checks  id · nexon_account_id · (nexon_account_id, enhancement_type, history_date) UNIQUE · 나머지 칸 그대로
mvp_grade_history           id · (account_id, from_date) UNIQUE · grade · updated_at
character_accounts          id · (ocid, name, account_id) UNIQUE · nexon_account_id · first_seen_date · last_seen_date
```

옛 기본키가 막던 중복은 `UNIQUE` 가 그대로 막는다. 다섯 표 모두 옛 기본키 조합이 곧 같은 값의 행이 둘 있으면 안 되는
조합이라, 일반 인덱스로 둘 칸이 없다.

칸 이름은 결정 7 의 규칙으로 바꾼 뒤의 이름이다.

### 결정 2. `id` 칸은 SQLite 가 기본값으로 채운다

`id TEXT NOT NULL PRIMARY KEY DEFAULT (NEW_UUID_SQL 식)` 으로 둔다. 기본값을 두는 이유는 둘이다.

지금 쓰는 코드가 `id` 를 몰라도 행이 들어가기 때문이다. 다섯 표의 쓰기는 `INSERT ... ON CONFLICT(옛 조합)` 이거나
단순 `INSERT` 다. `ON CONFLICT` 는 `UNIQUE` 조합을 대상으로도 돌기 때문에, 칸을 고르는 SQL 말고는 바꾸지 않아도 된다.

uuid 를 JS 가 아니라 SQLite 가 만드는 이유는 `storage/sqlite/uuid.ts` 와 같다.

### 결정 3. 버전 16 이 다섯 표를 한 트랜잭션 안에서 다시 쓰고, 옮긴 뒤 건수를 대조한다

칸의 제약이 바뀌므로 [[ADR-007]] 결정 5 대로 새 표를 만들어 행을 옮기고, 옛 표를 지운 뒤 이름을 바꾼다. 옛 행마다
새 uuid 를 하나씩 붙인다. 옛 행을 가리키는 곳은 없다. 다섯 표는 옛 기본키 조합으로만 읽힌다.

옮긴 뒤 표마다 옛 건수와 새 건수를 견주고, 하나라도 다르면 던져 버전 16 을 통째로 되돌린다. `mvp_grade_history` 와
`character_accounts` 는 사용자가 적었거나 다시 받을 수 없는 값이라, 덜 옮긴 채 버전을 올리는 것보다 DB 를 못 여는 편이
낫다([[ADR-096]] 결정 9 와 같은 이유).

[[ADR-096]] 결정 9 처럼 DB 파일을 따로 떠 두지는 않는다. 값을 바꾸지 않고 칸 하나를 더해 옮기는 이관이고, 실패하면
트랜잭션이 옛 표를 그대로 남긴다.

옛 표를 v1.0.14 까지 남겨 두지도 않는다([[ADR-078]] 결정 9 와 다르다). 이 이관은 v1.0.13 스토어 바이너리의 내장
번들에 들어간다. OTA 가 실패해 돌아가는 곳도 그 내장 번들이라, 새 표와 새 칸 이름을 모르는 코드가 이 DB 를 열 일이 없다.

### 결정 4. 파티 약속 id 는 `expo-crypto` 의 `randomUUID()` 로 만들고, 옛 id 도 uuid 로 바꾼다

- 새 약속은 `randomUUID()` 로 id 를 만든다. 가계부 기록과 같은 방법이다([[ADR-096]] 결정 5).
- 옛 `시각 + 난수` id 는 약속 목록을 읽을 때 한 번 uuid 로 바꿔 다시 저장한다(사용자 선택). 약속은 Preferences 의 JSON
  한 칸이라 SQLite 버전 이관이 닿지 않기 때문이다. uuid 꼴인지는 id 의 모양으로 가린다. 그래서 두 번째로 읽을 때는 바꿀
  것이 없다.
- 예약해 둔 약속 알림은 따로 옮기지 않는다. 알림 id 는 약속 id 로 만든 해시라, 다음 재조정이 옛 id 의 알림을 원장에서
  찾아 취소하고 새 id 로 다시 예약한다(`planReconcile`).
- 옛 id 로 예약된 알림을 바꾸기 전에 누르면 그 약속을 찾지 못해 파티 스케줄 화면만 열린다. 바꾸는 일은 앱을 켜고 약속을
  처음 읽을 때 일어나므로 그런 경우는 업데이트 직후 한 번뿐이다.

### 결정 5. 인증 수단마다 넥슨 계정 id(uuid)를 붙인다

다계정([[ADR-101]])을 위해 지금 연다(사용자 선택 2026-10-26). 넥슨 계정 하나가 인증 수단 하나다. 메인 계정은 넥슨
로그인이고, 부계정은 API 키다.

- 인증 수단 목록(`storage/api-key.ts`, Preferences `authMethods`)의 로그인과 키마다 `id` 를 둔다. 새 수단은
  `randomUUID()` 로 만들고, `id` 가 없는 옛 수단은 목록을 읽을 때 한 번 붙여 다시 저장한다(결정 4 와 같은 방법).
- 키 값이 아니라 이 `id` 가 계정을 가리킨다. 키를 다시 발급해도 같은 계정이어야 기록이 이어지기 때문이다.
- 새 키를 넣을 때 그 키의 `character/list` 에 아는 메이플 ID 가 있으면, 그 메이플 ID 가 속했던 계정의 `id` 를 잇는다
  (`reusableNexonAccountId`). 메이플 ID 는 넥슨 계정 하나에만 속하기 때문이다. 그 계정이 다른 수단으로 살아 있으면 잇지
  않는다. 같은 계정 id 를 두 수단이 가지면 안 된다.
- 같은 키를 다시 넣거나 다시 로그인해도 그 수단의 `id` 는 그대로다.
- 넥슨 자격(`NexonCredential`)도 `accountId` 를 든다. 저장 전에 검증하는 키는 아직 계정이 없어 `null` 이다.
- 메인 계정은 로그인이 있으면 로그인, 없으면 첫 번째 키다. 지금 넥슨을 부를 때 고르는 자격(`credentialOf`)과 같다.

### 결정 6. 계정 단위로 받는 표에 `nexon_account_id` 칸을 둔다

| 표 | 칸 | 이유 |
|---|---|---|
| `enhancement_history_checks` | `nexon_account_id`, `UNIQUE (nexon_account_id, enhancement_type, history_date)` | 강화 내역은 넥슨 계정 단위로 받는다. 계정마다 날짜별 조회를 따로 기록해야 한다 |
| `character_accounts` | `nexon_account_id` | 메이플 ID 소속은 계정마다 `character/list` 로 받는다. 메이플 ID 가 어느 넥슨 계정에 속하는지 여기서 찾는다 |
| `cashbook_entries` | `nexon_account_id`, 비어 있어도 된다 | 캐릭터가 없는 기록(계정 단위 지출 등)만 채운다. 캐릭터가 있는 기록은 ocid 에서 메이플 ID 를 거쳐 계정을 찾는다(사용자 선택) |

- 기존 행은 메인 계정의 `id` 로 채운다. 지금까지 받은 강화 내역과 소속은 모두 메인 계정의 자격으로 받았기 때문이다.
- 계정 id 는 Preferences 에 있어 SQLite 이관에서는 읽을 수 없다. 그래서 버전 16 은 옛 행의 계정 칸에 빈 글자를 적어 두기만
  하고, 앱을 켤 때 부팅 단계(`fillLegacyAccountIds`)가 빈 글자를 메인 계정 id 로 바꾼다. `NULL` 과 따로 두는 이유는
  `NULL` 이 계정을 모르는 자격(저장 전에 검증하는 키)으로 본 소속이라, 그것까지 메인 계정으로 채우면 다른 계정의 소속이
  메인 계정에 붙기 때문이다.
- 강화 수집기는 조회 기록을 읽기 전에 이 부팅 단계를 기다린다. 먼저 읽으면 옛 조회 기록이 안 보여, 이미 받은 날짜를 모두
  다시 받는다(로그인 계정이면 서버 스트림을 거친다).
- 채우기 전에 메인 계정으로 같은 날짜를 이미 다시 조회했으면 새 줄이 이기고 옛 줄은 지운다. 옛 줄을 옮기면 `UNIQUE` 가
  막기 때문이다.
- 소속을 다시 볼 때 계정을 모르는 자격이면 이미 적힌 계정을 지우지 않는다.
- 캐릭터 없는 가계부 기록은 처음 속한 계정을 지킨다. 고쳐서 캐릭터를 고르면 계정 칸을 비운다. 계정을 고르는 화면이 생기기
  전까지 새 기록은 메인 계정에 속한다.
- 메이플 ID 별 값인 `mvp_grade_history` 는 `account_id`(메이플 ID)로 이미 갈리므로 칸을 더하지 않는다.

### 결정 7. 칸 이름은 서버 규칙을 따른다

앱 표의 칸 이름을 서버 표의 규칙에 맞춘다(사용자 지정 2026-10-26). #507 이 같은 값을 서버로 보낼 때 이름을 다시 옮기지
않아도 되고, 두 저장소를 오가며 읽을 때 같은 값이 같은 이름이다.

| 규칙 | 예 |
|---|---|
| 분류는 `type` 또는 `무엇_type`. `kind` 는 쓰지 않는다 | `entry_type` · `enhancement_type` |
| 날짜는 `_date`, 시각은 `_at` | `entry_date` · `priced_at` |
| 차례는 `sort_order` | |
| 메소 금액은 `무엇_meso`, 비율은 `무엇_percent` | `price_meso` · `split_fee_percent` |
| 상태는 `무엇_status` | `record_status` · `clear_status` |
| `무엇_id` 는 다른 표를 가리키는 uuid | `party_id` · `nexon_account_id` |

버전 16 에서 바꾸는 이름은 이렇다. 다섯 표의 칸은 표를 다시 쓰면서, 나머지는 `ALTER TABLE ... RENAME COLUMN` 으로
바꾼다.

| 표 | 지금 | 바꾼 이름 |
|---|---|---|
| `enhancement_history_checks` | `kind` · `date_key` | `enhancement_type` · `history_date` |
| `character_accounts` | `first_seen_on` · `last_seen_on` | `first_seen_date` · `last_seen_date` |
| `mvp_grade_history` | `start_date` | `from_date` |
| `boss_party_periods` | `status` · `defeated_on` | `clear_status` · `defeated_date` |
| `boss_drops` | `drop_index` | `sort_order` |
| `cashbook_entry_hunt_inputs` | `fragment_price` | `fragment_price_meso` |
| `server_sync_queue` | `kind` | `record_type` |

예외가 둘 있다.

- **게임 데이터는 `_key` 로 가리킨다**(`boss_key` · `item_key` · `world_key`). 기기 번들에는 서버 표의 uuid 가 없고 key 만
  있기 때문이다. 서버는 받은 key 로 줄을 찾아 `item_id` 같은 외래키로 적는다. 지금 `drop_prices` 가 이렇게 한다.
- **메이플 ID 는 `account_id` 로 둔다**(사용자 선택). 넥슨 API 응답의 칸 이름과 같다. 다른 표를 가리키는 uuid 가 아니라
  넥슨이 주는 문자열이다.

인증 수단 목록(Preferences `authMethods`)의 `kind` 도 `type` 으로 바꾸고, 값은 서버 enum `identity_source` 와 같은
`login` · `key` 로 맞춘다(사용자 선택). 결정 5 가 계정 id 를 붙이며 목록을 다시 저장할 때 함께 옮긴다. 코드 안의 같은
구분 칸(`credentialOf` 가 돌려주는 값 등)도 함께 바꾼다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `storage/sqlite/__tests__/record-keys-real-sqlite.test.ts` | 결정 1 · 3: 버전 15 DB 의 다섯 표가 행 하나 안 잃고 값 그대로 옮겨지는지, 행마다 서로 다른 uuid 가 붙는지, 다시 열어도 다시 안 도는지. 결정 2: 옛 조합으로 같은 행을 또 넣으면 `UNIQUE` 가 막고, `id` 없이 쓰는 upsert 가 그대로 도는지. 결정 6: 옛 행의 계정 칸에 빈 글자가 적히고 캐릭터 있는 가계부 기록은 비는지, 부팅 단계가 빈 글자를 메인 계정으로 채우되 이미 다시 조회한 날짜는 새 줄을 남기는지, 계정이 다르면 같은 날짜의 조회 기록이 둘 서는지, 계정 모르는 자격이 아는 계정을 안 지우는지, 메이플 ID 로 옛 계정을 찾는지. 결정 7: 나머지 표의 칸이 이름만 바뀌고 값이 그대로인지 |
| `storage/__tests__/api-key.spec.ts` | 결정 5 · 7: `kind` 와 id 가 없는 옛 수단이 `type` 과 id 를 받아 한 번 다시 적히고 두 번째 읽기는 같은 id 인지, 옛 `apiKey` 칸에서 올린 키도 id 를 받는지, 같은 키 · 다시 로그인이 id 를 지키는지, 넘긴 계정 id 로 새 키를 저장하는지 |
| `features/auth/__tests__/reentry-account-id.spec.ts` | 결정 5: 메이플 ID 가 속했던 계정을 잇되 그 계정이 다른 수단으로 살아 있으면 잇지 않는지 |
| `features/auth/__tests__/store.spec.ts` | 결정 5: 다시 받은 키를 옛 계정 id 로 저장하는지 |
| `features/enhancement-history/__tests__/collect.spec.ts` | 결정 6: 옛 조회 기록을 채운 뒤에 그 계정의 기록을 읽고, 그 계정으로 조회 기록을 적는지 |
| `storage/__tests__/spend.spec.ts` | 결정 6: 캐릭터 없는 기록만 계정을 적고, 고쳐도 처음 계정을 지키며 캐릭터를 고르면 비우는지 |
| `storage/__tests__/party-appointments.spec.ts` | 결정 4: 옛 id 의 약속이 uuid 로 바뀌어 저장되고 다른 칸은 그대로인지, uuid 약속만 있으면 다시 쓰지 않는지 |

## 번호 기록

- ADR-098 (2026-10-26): 남은 다섯 표의 기본키와 파티 약속 id 를 uuid 로 바꾸는 결정을 처음 작성했다(#670). 같은 날
  다계정을 위해 넥슨 계정 id 와 `nexon_account_id` 칸(결정 5 · 6)을, 서버 규칙에 맞춘 칸 이름(결정 7)을 더했다
- ADR-098 (2026-10-26): 버전 16 이관 · 계정 id · 칸 이름 · 약속 id 를 구현했다
