# ADR-020+097+103 게임 데이터 서버 표와 기기 사본

> 🟢 유효
> 옛 번호: ADR-341 · ADR-349 결정 1 · 2 · 5 · 6 · 정정 1 · 2 · 3 · 4 · ADR-350
> 관련 소스: `lib/game-data/` · `lib/assets/asset-files.ts` · `lib/assets/image-crops.ts` · `lib/assets/asset-lookup.ts` · `features/game-data/sync.ts` · `app/game-data/GameDataLock.tsx` · `app/AppShell.tsx` · `server/game-data.ts` · `storage/game-data-copy.ts` · `storage/sqlite/game-data-tables.ts` · `storage/adapters/rn-asset-files.ts` · `types/game-data.ts` · `src/__fixtures__/game-data/` · 서버 `modules/game-data/` · `modules/assets/` · `modules/admin/` · 이슈 #741

## 배경

게임 수치와 그 그림은 앱 번들에 있었다. 그래서 넥슨이 결정석 가격 하나를 바꿔도 OTA 를 내야 앱이 알았고, 서버에서 새 보스를
더해도 그림은 앱 빌드가 나가야 나왔다. 값과 그림을 서버에 두면 서버만 고치면 된다. 이 문서는 게임 수치와 그림을 서버 표로
두고, 앱이 그것을 받아 기기에 두는 방법을 정한다. 값을 누가 정하는지와 기간 · key 규칙은 [[ADR-019]] 에 있다.

## 결정

### 결정 1. 게임 수치 열네 칸과 그림 목록 · 크롭 두 칸은 서버가 기준이고, 앱 번들에는 없다

| 칸 | 서버 표 |
|---|---|
| `bosses` | `bosses` · `boss_difficulties` · `game_rules` |
| `dropItems` | `drop_items` |
| `bossDrops` | `boss_drop_rewards` |
| `dropBoxes` | `drop_boxes` · `drop_box_contents` |
| `crystalPrices` | `boss_crystal_prices` |
| `worlds` | `worlds` |
| `spendCatalog` | `spend_groups` · `spend_tiles` · `spend_items` · `spend_item_options` · `spend_item_forms` · `spend_forms` · `game_rules` |
| `cashbookCategories` | `cashbook_categories` · `cashbook_item_kinds` |
| `symbolCosts` | `symbol_groups` · `symbols` · `symbol_level_costs` |
| `contents` | `contents` · `content_categories` |
| `equipmentItems` | `equipment_items` |
| `enhancementCosts` | `potential_reset_costs` · `soul_potential_reset_costs` · `starforce_steps` · `game_rules` |
| `mvpGrades` | `mvp_grades` |
| `huntingGrounds` | `hunting_regions` · `hunting_grounds` · `hunting_ground_levels` |
| `assets` | `assets`. 그림 경로 · 내용 해시 · 바이트 · 가로 · 세로 |
| `imageCrops` | `image_crops`. 보스 초상 셋과 컨텐츠 지역 지도의 크롭 |

앱은 번들 사본을 두지 않는다(사용자 지정 2026-10-26). 번들 사본은 서버에서 새로 더한 그림을 가질 수 없고, 서버에 닿지 못한
날 오래된 값으로 수익을 잘못 계산한다. 그 대신 다 받은 기기 사본이 없으면 화면을 잠근다(결정 12).

번들에 남는 것도 있다. 테마(`job-themes.json` 과 배경 그림) · 업데이트 노트(`release-notes.ts`) · 기능 안내(`feature-guides/`
와 그 그림) · 도구 아이콘 · 넥슨 로그인 단추다. 이것들은 앱 코드와 함께 바뀌는 값이고, 잠금 화면도 테마로 그려야 한다.

### 결정 2. 앱은 `GET /v1/game-data` 하나로 열여섯 칸을 한 번에 받는다

```
GET /v1/game-data
→ { "bosses": { "updatedAt": "…", "rules": {…}, "bosses": [ … ] },
    "dropItems": { "updatedAt": "…", "items": [ … ] },
    … }
```

- 공개 조회다. 칸 하나가 표 하나이고, 칸마다 `updatedAt` 이 있다. 응답 전체의 시각을 하나로 두면 표 하나만 바뀌어도
  모든 표를 다시 그려야 한다.
- 칸의 `updatedAt` 은 서버의 `game_data_sections` 표에 있다. 줄의 `updated_at` 최댓값으로 내면 줄을 지운 것이 드러나지
  않아서, 쓰기마다 이 표의 시각을 올린다. `bosses` 칸만 보스 줄의 `updated_at` 최댓값이다.
- 아직 한 번도 채우지 않은 표는 그 칸의 `updatedAt` 이 `null` 이고 목록이 비어 있다. 앱은 그 칸을 버린다.
- 응답은 서버 표의 줄을 그대로 펼친 목록이다. 예를 들어 드롭 표는 보상 줄의 목록이고, 보스 · 난이도 · 분류로 묶는 일은
  앱의 조회 모듈이 한다. 배열은 서버 `sort_order` 순서이고 `sort_order` 자체는 응답에 없다.
- 서버의 `GET /v1/bosses` 는 아직 남아 있다. 스토어 1.0.12 의 옛 OTA 가 이 경로를 부르기 때문이다.
- 응답 몸의 해시를 ETag 로 단다. `If-None-Match` 가 같으면 몸 없이 304 를 낸다. nginx 가 gzip 으로 줄이며 붙이는 `W/` 도
  같은 것으로 본다. 앱은 백그라운드에서 돌아올 때마다 묻기 때문에, 바뀐 것이 없는 날은 전송이 거의 없다.
- 그림 목록(`assets`)과 크롭(`imageCrops`)도 이 응답의 칸이다. 경로를 따로 두면 두 요청 사이에 관리 화면에서 값이 바뀔 수
  있다. 그러면 데이터는 새 그림을 가리키는데 목록에는 그 그림이 없어서, 결정 13 의 한 번에 바꾸기를 지키려면 이 어긋남을
  따로 막아야 한다(사용자 지정 2026-10-26).

### 결정 3. 기기 사본은 SQLite 표 둘이고, 칸과 표식을 한 트랜잭션으로 쓴다

칸 하나를 한 줄(`game_data_sections` 의 칸 이름 · 칸 JSON)로 두고, 사본 전체의 표식(`game_data_meta` 의 계약 판 · ETag)을
같은 트랜잭션으로 쓴다(`storage/game-data-copy.ts`). 표식이 있으면 칸과 그림을 다 받은 사본이고, 잠금 화면은 그것을 믿고
풀린다. 쓰다가 실패하면 앞 사본이 그대로 남는다.

- Preferences 에 두지 않는다. Preferences 는 여러 키를 한 번에 쓰지 못해 칸과 표식이 어긋날 수 있다. 또 iOS
  `UserDefaults` 는 켤 때 전체를 메모리에 올리고 Android SharedPreferences 는 키 하나를 써도 파일 전체를 다시 쓰는데,
  게임 데이터는 약 360KB 이고 계속 커진다.
- 두 표는 `storage/sqlite/db.ts` 의 `TABLE_DEFINITIONS` 에 있어 캐시 삭제의 `general` 그룹에 저절로 들어간다([[ADR-053]] 결정 1).
- 칸의 계약(`parse`)이 바뀌어 옛 사본을 읽을 수 없게 되면 `GAME_DATA_CONTRACT` 를 올린다. 켤 때 계약 판이 다른 사본은
  지우고 처음부터 받는다.
- 1.0.13 전의 사본(Preferences `queryCache` 와 그 전의 `bossCatalog`)은 켤 때 지운다. 옮기지 않는 것은 어차피 처음부터
  받기 때문이다.

### 결정 4. 조회 모듈은 표 객체를 읽고, 부르는 쪽은 값이 어디서 왔는지 모른다

칸마다 현재 값을 담는 곳은 하나다(`lib/game-data/table.ts` 의 `gameTable`). 조회 모듈(`lib/boss/bosses` ·
`lib/drop/drop-items` · `lib/cashbook/spend-catalog` 등)은 이 표를 읽고, 부르는 쪽은 값이 사본인지 서버 응답인지 모른다.

- 앱에서 표는 빈 값으로 시작한다. 첫 값은 `lib/game-data/initial.ts` 가 정하고, jest 는 `moduleNameMapper` 로 그 모듈을
  `src/__fixtures__/game-data/initial.ts` 로 바꿔 끼운다. 그래서 테스트는 fixture(운영 서버 응답을 칸마다 떠 둔 JSON)의
  실제 값으로 돈다. fixture 는 서버가 바뀌어도 따라 바꾸지 않는다. 값을 고정한 테스트가 많기 때문이다.
- 모듈 꼭대기에서 한 번 만들던 Map 과 정렬 목록은 `derive` 가 만든다. 표 객체가 바뀐 뒤 처음 읽을 때 다시 만든다.
  상수로 두면 모듈을 처음 불러온 순간의 값으로 굳는다.
- 화면은 `useGameTable('bosses')` 처럼 칸 하나를 구독한다(`features/game-data/sync.ts`). 바뀌지 않은 칸은 같은 객체를
  유지하므로, 바뀐 칸을 쓰는 화면만 다시 그린다.
- 열여섯 칸의 표와 `parse` 는 `lib/game-data/sections.ts` 의 `SECTIONS` 에 모여 있다. 칸을 더하면 여기와
  `types/game-data.ts` 에 한 줄씩 더한다.

### 결정 5. 그림은 기기 문서 디렉터리에 내용 해시 이름으로 둔다

받은 그림은 `expo-file-system` 문서 디렉터리의 `game-assets/` 에 `<sha256>.<확장자>` 로 둔다(`storage/adapters/rn-asset-files.ts`).

- 캐시 디렉터리에 두지 않는다. 저장 공간이 모자랄 때 iOS 가 캐시 디렉터리를 비우고, 비워지면 쓰는 도중에 잠금 화면이 다시
  걸린다.
- 임시 이름에 받고 sha256 이 목록과 같을 때만 제 이름으로 옮긴다. 이름이 곧 내용이라, 이름이 있으면 받은 것으로 믿는다.
- 그림을 다 받은 뒤에 결정 3 의 트랜잭션을 쓴다. 중간에 끊기면 표식은 옛 사본을 가리키므로 화면은 옛 사본 그대로다.
- 새 사본으로 바꾼 뒤 목록에 없는 파일을 지운다.
- 조회는 `{ uri, width, height }` 를 돌려준다(`lib/assets/asset-files.ts`). `Image.resolveAssetSource` 가 이 객체를 그대로
  돌려주므로 번들 그림의 크기를 읽던 크롭 · 종횡비 계산이 같은 길로 받은 그림의 크기를 읽는다. 같은 그림은 같은 객체라
  렌더마다 소스가 바뀐 것으로 읽히지 않는다.
- `expo-file-system` 과 sha256 을 재는 `expo-crypto` 는 이미 스토어 바이너리에 있다.

### 결정 6. 서버 값은 관리 화면에서 고치고, 첫 채움은 시드 CLI 가 했다

서버 저장소의 `seed-game-data` CLI 가 `src/database/seed/<표>.json` 을 읽어 비어 있는 표만 채운다. 줄이 하나라도 있는
표는 건드리지 않는다. 운영자가 폼으로 고친 값을 배포 때 되돌리지 않기 위해서다.

그 뒤로는 관리 화면(`/admin/*`, nginx basic auth) 폼으로 고친다. JSON 을 통째로 붙여 넣는 화면은 없다. 새 보스나 새
아이템은 하나씩 더하는 일이기 때문이다. key 는 바꿀 수 없고, 기록이 가리키는 줄(보스 · 아이템 · 장비 · 사냥터 · 컨텐츠
· 지출 항목)은 지우지 않는다. 더 쓰지 않는 줄은 `until` 로 닫는다.

이미 있는 보스에서 고칠 수 있는 칸은 별칭(`alias`)뿐이다(`PUT /admin/bosses/:key/alias`). 별칭은 좁은 자리에 보이는
글자일 뿐이어서 바꿔도 기록이 끊기지 않는다. 이름은 넥슨 API 의 `content_name` 과 맞춰 보는 값이라 열지 않았다.

그림과 크롭의 첫 채움은 서버 저장소의 `seed-assets` CLI 가 했다. 맥에서 앱 저장소의 그림 파일과 크롭 JSON 을 관리 화면
경로로 올렸고, 이미 있는 경로와 크롭은 건너뛴다. 관리 화면 경로를 거쳐야 형식 검사와 파일을 쓰는 차례가 운영과 같다.

### 결정 7. 값의 규칙은 서버가 지키고, 앱은 형식만 본다

| 규칙 | 지키는 곳 |
|---|---|
| 가리키는 key 가 표에 있다 | 서버 FK · UNIQUE |
| 한 보스 · 난이도의 가격 줄이 겹치지 않고 이어진다 · 새 가격의 시작이 그 보스의 기간 경계(주간 · 시즌은 목요일, 월간은 1일)다 · 기간 글자 형식 | 관리 화면의 쓰기 검사. 걸리면 400 이고 아무것도 안 바뀐다 |
| 스타포스 단계가 0 부터 빠짐없이 있다 · 잠재 재설정에 `min_level 1` 구간이 있다 · 심볼 비용이 1 부터 `max_level - 1` 까지 있다 | 관리 화면의 쓰기 검사 |
| 컨텐츠 API 이름 · 장비 이름이 NFC 와 공백 제거 뒤에도 유일하다 | 관리 화면의 쓰기 검사([[ADR-019]] 결정 4 의 찾는 규칙을 지키기 위해서다) |
| 그림 칸 아홉(보스 초상 · 아이템 · 엠블럼 · 갈래 · 지출 타일 둘 · 심볼 · 컨텐츠 배경 둘)이 그림 표에 있는 그림을 가리킨다 | 관리 화면의 쓰기 검사. 없는 그림을 가리키면 앱은 에러 없이 그림만 빈 채로 그린다 |
| 그림이 경로 규칙의 디렉터리 · 확장자이고 내용이 확장자와 같다 · 1MB 이하 | 관리 화면의 그림 올리기 |
| 크롭이 `<퍼센트>% auto` · `<퍼센트>% <퍼센트>%` 문법이다 | 관리 화면의 쓰기 검사와 앱의 `parse` |
| 칸의 형식 | 앱의 `parse`. 모르는 칸은 버린다 |

앱 코드가 그림을 이름으로 직접 가리키는 곳(가계부 줄 표식 · 포스 · MVP 명패 · 모르는 캐릭터 · 솔 에르다 단위)은 서버가 모르는
이름이다. 그래서 `code-referenced-assets.spec.ts` 가 fixture 그림 목록에서 그 이름을 찾는지 본다. 값을 고정해 두는 데이터
테스트는 두지 않는다.

### 결정 8. 그림은 서버 앱 박스의 디스크에 두고 nginx 가 바로 낸다

- 서버 컨테이너에 그림 볼륨(`/srv/maple-routine-assets` → `/data/assets`)을 걸고, 같은 박스의 nginx 가 `location /assets/` 로
  낸다. 파일 이름이 내용 해시라 같은 이름을 덮어쓰지 않으므로 `Cache-Control: public, max-age=31536000, immutable` 을 건다.
- 옛 해시 파일은 지우지 않는다. 옛 목록을 받은 앱이 아직 그 파일을 받는 중일 수 있다.
- 그림 디렉터리는 DB 덤프처럼 백업해야 한다. 앱 박스가 회수되면 함께 사라진다. 밤 백업은 아직 정하지 않았다.

다른 두 방법은 쓰지 않는다.

| 방법 | 쓰지 않는 이유 |
|---|---|
| OCI Object Storage | 무료 요청이 월 50,000 건이다. 새 설치 한 번에 그림 약 350건이라, 한도에 닿으면 새 사용자가 잠금 화면에서 못 나간다 |
| Cloudflare R2 | 장애가 날 곳이 API 서버와 따로 하나 더 생긴다. 결정 12 때문에 그림 서버가 서지 않으면 새 사용자는 앱을 못 쓴다. 처리방침의 위탁 업체도 늘어난다 |

앱 박스는 API 와 같은 곳이라 장애가 날 곳이 늘지 않는다.

### 결정 9. 여러 값이 붙는 칸은 배열이 아니라 줄 표다

보스의 난이도와 요구 레벨, 지출 항목의 축 값과 형태, 심볼의 레벨별 비용, 사냥터의 몬스터 레벨은 모두 줄 표다
(`boss_difficulties` · `spend_item_options` · `spend_item_forms` · `symbol_level_costs` · `hunting_ground_levels`). 배열이나
jsonb 칸 두 개에 나눠 두면 두 칸의 순서가 어긋나도 DB 가 잡지 못한다.

값이 정해진 집합(보스 난이도 · 주기, 드롭 분류, 지출 화폐 · 형태, 가계부 수입 · 지출 구분, 컨텐츠 분류 · 섹션 · 공유 범위,
잠재 종류 · 등급, MVP 등급, 포스 종류)은 Postgres ENUM 이다. 코드가 그 값으로 분기하기 때문에, 새 값은 앱 코드와 함께
마이그레이션으로 더한다. ENUM 의 한글 이름(분류 이름, 잠재 등급의 넥슨 표기)은 앱 상수로 둔다.

가계부는 예외다. 갈래 · 아이템 종류 · 에픽던전 형태의 이름 · 카드 제목 · 단위는 서버 표(`cashbook_categories` ·
`cashbook_item_kinds` · `spend_forms`)가 든다([[ADR-096]] 결정 3 · 4 · 7). 하루 목록 카드의 이름을 앱 업데이트 없이
고치려는 것이다. 갈래 key 는 관리 화면에서 더하므로 ENUM 이 아니라 글자이고, 앱은 입력 폼을 모르는 key 를 목록에 이름만
세우고 못 고르게 한다. 형태 key 는 앱 코드가 갈려 ENUM 으로 남는다.

### 결정 10. 기간 칸은 KST 글자 그대로 둔다

`from` · `until` 은 서버에서도 `text` 이고, 앱과 같은 글자(`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm`)를 내려준다. 앱의 판정
`isEffectiveIn` 이 문자열 비교라서, `timestamptz` 로 바꾸면 경계를 판정하는 방법이 두 벌이 된다.

보스와 보스 난이도에도 기간이 있다. 시즌 보스는 시즌이 끝나면 새 챌린저스 월드에 나오지 않아야 하기 때문이다. 난이도
줄에 기간이 있으면 그 난이도는 그 값을 쓰고, 기간이 없는 칸은 보스의 값을 쓴다(`isBossActiveIn` · `activeDifficultiesOf`). 기록을
고치는 화면은 그 행의 난이도가 기간 밖이어도 목록에 남긴다.

### 결정 11. 고가 판정은 `drop_items.valuable` 한 칸이다

예전에는 세트 표와 고가 목록 파일이 따로 있었지만, 세트를 쓰는 곳이 고가 판정 하나뿐이었다. 그래서 드롭 아이템 줄의
`valuable` 칸 하나로 합쳤다. 판정 함수는 `lib/drop/drop-items.ts` 의 `isValuableDropItem` 이다. 새 아이템이 고가면
관리 화면에서 그 칸을 켠다. 세트에 속했다고 저절로 고가가 되지는 않는다.

### 결정 12. 다 받은 사본이 없으면 잠그고, 다 받은 뒤에만 앱을 쓴다 (사용자 지정 2026-10-26)

앱은 다 받은 기기 사본이 있을 때만 화면을 연다. 사본이 없으면 받는 동안 화면을 잠그고 진행을 보여 준다. 받지 못하면 다시
시도하는 단추를 둔다. 사본이 없는 때는 처음 설치해 켰을 때, 캐시 데이터 삭제 뒤, 사본의 계약 판이 지금 앱과 다를 때다.

그래서 처음 켤 때는 서버에 닿아야 앱을 쓸 수 있다. "서버가 꺼져도 앱은 그대로 동작한다"([[ADR-016]] 결정 1)는 사본을 한 번
받은 뒤에만 지켜진다.

`AppShell` 은 게임 데이터가 준비된 뒤에만 나머지(`ReadyShell`)를 마운트한다. 빈 표를 읽은 마운트 이펙트가 엉뚱한 일을 하지
않게 하기 위해서다. 알림 예약 맞추기가 빈 컨텐츠 표를 읽으면 예약을 전부 지운다. 테마 · 글자 크기 복원과 OTA 확인은 잠금과
상관없이 돈다. 잠금 화면은 테마로 그려야 하고, 잠금이 풀리지 않는 결함도 OTA 로 고칠 수 있어야 한다.

### 결정 13. 사본이 있으면 바로 열고, 서버 값이 바뀌면 조용히 받아 한 번에 바꾼다 (사용자 지정 2026-10-26)

- 받는 때는 앱을 켤 때와 백그라운드에서 돌아올 때(`useReturnToForeground`)다. 사본의 ETag 로 묻고, 304 면 아무것도 받지 않는다.
- 사본이 있으면 잠그지 않는다. 받는 동안에도 가진 사본으로 화면을 그린다. 보스를 기록하는 도중에 화면이 막히면 안 되기 때문이다.
- 칸 열여섯이 전부 계약을 지킬 때만 받는다. 표 하나가 빈 채로 화면을 열 수 없다.
- 새 데이터의 그림을 모두 받은 뒤 사본을 쓰고, 표 열여섯을 같은 틱에서 바꾼다. 데이터만 새것이고 그림은 옛것인 상태를
  화면에 내지 않는다.
- 조용히 받다 실패하면 알리지 않고 가진 사본을 쓴다. 다음에 켜거나 돌아올 때 다시 묻는다.
- 겹쳐 부른 받기는 돌고 있는 것을 기다린다.

### 결정 14. 서버로 옮긴 그림과 번들에 남는 그림 (사용자 지정 2026-10-26)

| 서버에서 받는다 | 번들에 남는다 |
|---|---|
| 보스 초상(`bosses/`) · 아이템(`items/` · `items/rings/`) · 지도와 지도 아이콘(`maps/` · `maps/icons/`) · 월드 엠블럼(`worlds/`) | 테마 배경(`themes/`)과 테마 색 토큰(`job-themes.json`) |
| MVP 명패(`mvp/`) · 포스(`force/`) · 모르는 캐릭터 그림(`characters/`) | 기능 안내 그림(`guide/`) |
| 고가 드롭 연출 프레임(`drop-effect/<단계>/<번호>`) | 도구 아이콘(`utility/`) · 넥슨 로그인 단추(`nexon/`) |

서버 경로는 앱 저장소 `src/assets/` 기준의 옛 경로 그대로다. 디렉터리 · 확장자 목록은 서버 `modules/assets/asset-paths.ts` 에 있다.
연출 프레임은 그림 목록에서 `drop-effect/<단계>/` 의 숫자 이름을 숫자 차례로 모은다(`dropEffectFrames`). 글자 차례면 `10 < 2` 라
프레임이 뒤섞인다.

### 결정 15. 그림과 크롭은 관리 화면 하나(`/admin/assets`)에서 고친다 (사용자 지정 2026-10-26)

- 종류별 그림 목록 · 미리보기 · 올리기 · 바꾸기를 이 화면에 모은다. 연출 프레임 · MVP 명패처럼 가리키는 표가 없는 그림도
  있어서, 표마다 화면에 올리기 칸을 붙이면 그 그림들을 올릴 곳이 따로 또 필요하다.
- 같은 경로에 올리면 해시만 바뀐다. 내용이 같으면 아무것도 안 바뀌어 앱이 다시 받지 않는다.
- 크롭은 보스 초상 셋(카드 · 원형 아이콘 · 파티 모달 띠)과 컨텐츠 지역 지도를 숫자로 고치고 잘린 모양을 그 자리에서 본다.
  새 보스를 앱 빌드 없이 더하려면 그 초상의 크롭도 서버에서 맞춰야 하기 때문이다. 크롭이 없는 그림은 `cover` · 가운데다.
- 기존 화면(보스 · 드롭 아이템 등)의 그림 이름 칸은 글자로 둔다.
- 가로 · 세로 픽셀은 서버가 올릴 때 파일 머리(png · jpg · webp)에서 읽어 둔다. 내려받은 파일은 번들 그림처럼 그 자리에서 크기를
  알 수 없고, 비동기로 재면 첫 프레임이 기본 크롭으로 그려졌다가 튄다.

### 결정 16. 잠금 화면은 모달 하나이고, 단계마다 칸을 둔다 (사용자 지정 2026-10-26)

시안 캔버스(https://claude.ai/artifact/JCUoYobA1mQ487K4zwLAFV)의 5번이다(`app/game-data/GameDataLock.tsx`).

- 테마 바탕 위에 스크림을 깔고 패널 하나를 띄운다. 머리는 받기 아이콘 배지와 제목 `게임 데이터를 받고 있어요` · 설명
  `처음 한 번만 받아요` 를 왼쪽에 한 줄로 놓는다.
- 단계는 `게임 데이터` · `이미지 데이터` 둘이고 줄마다 `card-inset` 칸이다. 끝난 단계는 체크, 받는 단계는 스피너, 기다리는
  단계는 빈 원이다.
- 단계와 진행 막대는 데이터 크기(MB, 1MB 는 1,000,000 바이트)로 센다. 게임 데이터는 응답 크기, 이미지 데이터는 기기에 없는
  그림의 `size` 합이다. 이미지 장 수로 세면 큰 지도와 작은 아이콘이 같은 한 칸이라 막대가 받는 시간과 어긋난다.
- 패널에는 테두리가 없다. 다크에서는 바텀시트처럼 표면을 한 단 올려(`buildSheetScopeVariables`) 스크림과 가른다. 카드 테두리를
  걷은 정책([[ADR-060]] 결정 16)을 이 패널에 먼저 적용한 것이다. 다른 모달에 적용할지는 정하지 않았다.
- 받지 못하면 같은 패널에 `ErrorState` 를 그린다. 제목은 `게임 데이터를 받지 못했습니다` 이고 단추는 `다시 시도` 다.
- 스피너는 단풍잎이 아니라 트랙 있는 링(`RingSpinner`)이다(사용자 지정). 앱 전체의 단풍잎 스피너도 나중에 단순한 모양으로 바꿀
  예정이고 이 화면만 먼저 바꾼다. 그때까지 [[ADR-061]] 결정 2 는 이 화면을 뺀 나머지에 그대로 맞다.

### 결정 17. 캐시 삭제는 사본과 그림을 함께 지운다

캐시 데이터 삭제의 `general` 그룹이 사본 표 둘과 그림 디렉터리를 지우고, 그림 디렉터리 크기를 용량에 센다([[ADR-053]] 결정 1).
서버에서 다시 받을 수 있는 값이기 때문이다. 지운 뒤 앱이 다시 켜지면 사본이 없으므로 잠금 화면이 다시 받는다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `features/game-data/__tests__/sync.spec.ts` | 결정 12 · 13: 사본이 없으면 잠근 채 받고 그림을 다 받은 뒤 사본을 쓰는지, 그림 하나라도 실패하면 사본도 표도 그대로이고 다시 시도로 받는지, 칸 하나라도 계약을 어기면 실패인지, 이미 있는 그림은 받지 않고 진행에 MB 가 쌓이는지, 사본이 있으면 ETag 로 묻고 304 면 쓰지 않는지, 바뀌면 조용히 받아 한 번에 바꾸고 옛 그림을 지우는지, 계약 판이 다르면 처음부터 받는지, 겹친 받기가 한 번인지 본다. 결정 4: `useGameTable` 이 그 칸이 바뀔 때만 다시 그리는지 본다 |
| `storage/sqlite/__tests__/game-data-copy-real-sqlite.test.ts` | 결정 3: 표식이 없으면 사본이 없는 것인지, 쓰다가 실패하면 앞 사본이 그대로인지, 지우면 사본이 없는지 진짜 SQLite 로 본다 |
| `server/__tests__/game-data.spec.ts` | 결정 2: 칸마다 받은 표와 원문 · ETag · 바이트를 주는지, ETag 를 보내고 304 를 바뀐 것 없음으로 읽는지, 실패 · 5xx · 객체가 아닌 응답이 `null` 인지, 계약을 어긴 칸만 `null` 인지 본다 |
| `lib/assets/__tests__/asset-files.spec.ts` | 결정 5: 파일 이름이 해시와 다르거나 크기가 없거나 경로가 겹치면 목록을 버리는지, NFD 경로도 찾는지 본다 |
| `lib/assets/__tests__/image-crops.spec.ts` | 결정 15: 크롭 계산이 못 읽는 문법을 버리는지, 종류마다 다른 줄을 읽고 없으면 기본 크롭인지 본다 |
| `lib/assets/__tests__/code-referenced-assets.spec.ts` | 결정 7: 코드가 이름으로 가리키는 그림이 그림 목록에 있는지 본다 |
| `lib/game-data/__tests__/table.spec.ts` | 결정 4: 표를 바꾸면 구독자에게 알리고, 같은 객체면 알리지 않고, 구독을 풀면 더 알리지 않는지, `derive` 가 표가 바뀐 뒤에만 다시 만드는지 본다 |
| `lib/game-data/__tests__/sections.spec.ts` | 결정 4: 칸이 `GAME_DATA_SECTIONS` 와 같은 순서인지, fixture 가 계약을 통과하고 다시 통과시켜도 같은지, 표를 덮으면 그 칸이 바뀌는지 본다 |
| `app/game-data/__tests__/GameDataLock.test.tsx` | 결정 16: 받는 단계 · 대기 단계, 두 데이터를 합친 MB 와 퍼센트, 받을 그림이 없을 때 끝난 단계, 실패 상태와 다시 시도를 본다 |
| `__tests__/boot-order.test.tsx` | 결정 12: 준비 전에는 잠금 화면만 서고 테마 복원과 OTA 확인만 도는지, 돌아오면 다시 묻는지 본다 |
| `storage/__tests__/cache-data.spec.ts` | 결정 17: 일반 그룹이 그림 디렉터리를 지우고 용량에 세는지, 기록 그룹은 건드리지 않는지 본다 |
| 서버 `modules/assets/*.spec.ts` · `modules/admin/admin-assets.controller.spec.ts` · `modules/game-data/game-data.controller.spec.ts` | 결정 2 · 7 · 8 · 15: 경로 규칙 · 머리로 형식과 크기 읽기 · 해시 이름 쓰기 · 파일 먼저 표 나중 · ETag 304 · 그림 칸 검사를 본다 |

## 번호 기록

- ADR-020 (2026-10-19): 옛 ADR-341 · ADR-349 · ADR-350 을 합쳐 처음 작성
- ADR-097 (2026-10-25): 가계부 갈래 · 아이템 종류 · 형태 이름을 서버 표로 옮기고 `cashbookCategories` 칸을 더했다(결정 1 · 9, [[ADR-096]])
- ADR-103 (2026-10-27): 번들 사본을 걷고 게임 데이터 · 그림을 받아 기기에 둔다(결정 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 다시 씀, 결정 12 ~ 17 더함, 이슈 #741)
