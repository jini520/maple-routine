# ADR-020 게임 데이터 서버 표

> 🟢 유효
> 옛 번호: ADR-341 · ADR-349 결정 1 · 2 · 5 · 6 · 정정 1 · 2 · 3 · 4 · ADR-350
> 관련 소스: `src/data/*.json` · `lib/game-data/` · `features/game-data/query.ts` · `server/game-data.ts` · `storage/query-persister.ts` · `scripts/sync-game-data.mjs` · `types/game-data.ts` · 서버 `modules/game-data/` · `modules/admin/`

## 배경

게임 수치는 앱 번들의 JSON 이었다. 그래서 넥슨이 결정석 가격 하나를 바꿔도 OTA 를 내야 앱이 알았고, 지출 목록의
메이플 포인트 샵 묶음을 열고 닫는 것도 OTA 였다. 값을 서버에 두면 서버 값만 고치면 된다. 이 문서는 게임 수치를
서버 표로 옮기고, 앱이 그 값을 받아 쓰는 방법을 정한다. 값을 누가 정하는지와 기간 · key 규칙은 [[ADR-019]] 에 있다.

## 결정

### 결정 1. 게임 수치 열세 칸은 서버가 기준이고, 번들은 그 사본이다

| 칸 | 번들 파일 | 서버 표 |
|---|---|---|
| `bosses` | `bosses.json` | `bosses` · `boss_difficulties` · `game_rules` |
| `dropItems` | `drop-items.json` | `drop_items` |
| `bossDrops` | `boss-drops.json` | `boss_drop_rewards` |
| `dropBoxes` | `drop-boxes.json` | `drop_boxes` · `drop_box_contents` |
| `crystalPrices` | `crystal-prices.json` | `boss_crystal_prices` |
| `worlds` | `worlds.json` | `worlds` |
| `spendCatalog` | `spend-catalog.json` | `spend_groups` · `spend_tiles` · `spend_items` · `spend_item_options` · `spend_item_forms` · `game_rules` |
| `symbolCosts` | `symbol-costs.json` | `symbol_groups` · `symbols` · `symbol_level_costs` |
| `contents` | `contents.json` | `contents` · `content_categories` |
| `equipmentItems` | `equipment-items.json` | `equipment_items` |
| `enhancementCosts` | `enhancement-costs.json` | `potential_reset_costs` · `soul_potential_reset_costs` · `starforce_steps` · `game_rules` |
| `mvpGrades` | `mvp-grades.json` | `mvp_grades` |
| `huntingGrounds` | `hunting-grounds.json` | `hunting_regions` · `hunting_grounds` · `hunting_ground_levels` |

서버와 번들 값이 다르면 서버 값을 쓴다. 그래도 번들 사본을 남기는 이유는 서버에 닿지 못해도 앱이 떠야 하기 때문이다. 게임
데이터가 없으면 그릴 수 있는 화면이 거의 없다.

번들에만 남는 파일도 있다. 보스 초상 · 지도 크롭 좌표 넷, 테마(`job-themes.json`), 업데이트 노트(`release-notes.ts`),
기능 안내(`feature-guides/`)다. 이것들은 게임 수치가 아니라 번들에 있는 그림이나 앱 문구와 짝을 이룬다. 서버에서 먼저
바뀌면 없는 그림을 가리키거나 엉뚱한 곳을 자른다.

### 결정 2. 앱은 `GET /v1/game-data` 하나로 열세 칸을 한 번에 받는다

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

### 결정 3. 앱은 번들로 켜고, 켤 때 한 번 받아 바뀐 칸만 덮는다

받기 · 기기 사본 · 다시 그리기는 TanStack Query 가 맡는다(`features/game-data/query.ts`). 직접 짜면 재시도, 같은 요청
합치기, 바뀐 칸만 다시 그리기를 따로 만들어야 한다.

- 쿼리는 `['game-data']` 하나이고 응답 전체를 둔다. `initialData` 가 번들 열세 칸이라 켜는 순간부터 표가 채워져 있다.
- 켤 때 `hydrateGameData` 가 기기 사본을 복원한 다음 서버에서 한 번 받는다. 응답에서 `null` 이 아닌 칸만 지금 값 위에
  덮는다. 실패하면 한 번 다시 시도하고, 그래도 안 되면 가지고 있던 값을 그대로 쓴다.
- 켜 둔 동안은 다시 받지 않는다(`staleTime: Infinity`). 관리 화면에서 고친 값은 다음에 앱을 켤 때 기기에 반영된다.
- 기기 사본은 Preferences 키 `queryCache` 하나에 쿼리 캐시 전체를 문자열로 저장한다(`storage/query-persister.ts`).
  서버에서 받은 적 없는 번들 값은 저장하지 않는다. 칸의 계약이 바뀌어 옛 사본을 읽을 수 없게 되면 `GAME_DATA_CONTRACT`
  를 올리고, 앱은 켤 때 옛 사본을 통째로 버린다.
- 서버 응답은 `server/game-data.ts` 가 칸마다 계약 검사(`parse`)를 한다. 어긴 칸만 `null` 이 되고 나머지 칸은 쓴다.
  응답 자체를 못 받으면 `null` 하나다.

### 결정 4. 조회 모듈은 표 객체를 읽고, 부르는 쪽은 값이 어디서 왔는지 모른다

칸마다 현재 값을 담는 곳은 하나다(`lib/game-data/table.ts` 의 `createTable`). 조회 모듈(`lib/boss/bosses` ·
`lib/drop/drop-items` · `lib/cashbook/spend-catalog` 등)은 이 표를 읽고, 부르는 쪽은 서버 값인지 번들 값인지 모른다.

- 번들 값은 그 칸의 `parse` 를 통과시킨 뒤 초기값이 된다(`bundledTable`). 번들이 계약을 어기면 켜는 순간 던진다.
- 모듈 꼭대기에서 한 번 만들던 Map 과 정렬 목록은 `derive` 가 만든다. 표 객체가 바뀐 뒤 처음 읽을 때 다시 만든다.
  상수로 두면 모듈을 처음 불러온 순간의 값으로 굳는다.
- 쿼리 캐시를 구독해 바뀐 칸을 표의 `set` 으로 넘긴다(`connectGameTables`). 그래서 React 밖의 조회 함수도 새 값을 읽는다.
- 화면은 `useGameTable('bosses')` 처럼 칸 하나를 구독한다. 응답이 통째로 와도 바뀌지 않은 칸은 같은 객체를 유지하므로,
  바뀐 칸을 쓰는 화면만 다시 그린다.
- 열세 칸의 표와 `parse` 는 `lib/game-data/sections.ts` 의 `SECTIONS` 에 모여 있다. 칸을 더하면 여기와
  `types/game-data.ts` 에 한 줄씩 더한다.

### 결정 5. 빌드 전에 번들을 서버 값으로 다시 쓴다

`node scripts/sync-game-data.mjs` 가 `GET /v1/game-data` 를 받아 칸마다 `src/data/<칸 이름을 kebab-case 로>.json` 을 응답
그대로 쓴다. 선택 칸의 `null` 과 `updatedAt` 도 그대로다. `updatedAt` 이 `null` 인 칸은 파일을 건드리지 않는다.

이 스크립트는 `package.json` 의 `scripts` 에 넣지 않는다. 그 항목이 OTA 지문 재료라서, 스크립트 한 줄을 더하면 두 플랫폼의
지문이 바뀐다.

### 결정 6. 서버 값은 관리 화면에서 고치고, 첫 채움은 시드 CLI 가 했다

서버 저장소의 `seed-game-data` CLI 가 `src/database/seed/<표>.json` 을 읽어 비어 있는 표만 채운다. 줄이 하나라도 있는
표는 건드리지 않는다. 운영자가 폼으로 고친 값을 배포 때 되돌리지 않기 위해서다.

그 뒤로는 관리 화면(`/admin/*`, nginx basic auth) 폼으로 고친다. JSON 을 통째로 붙여 넣는 화면은 없다. 새 보스나 새
아이템은 하나씩 더하는 일이기 때문이다. key 는 바꿀 수 없고, 기록이 가리키는 줄(보스 · 아이템 · 장비 · 사냥터 · 컨텐츠
· 지출 항목)은 지우지 않는다. 더 쓰지 않는 줄은 `until` 로 닫는다.

### 결정 7. 값의 규칙은 서버가 지키고, 앱은 형식만 본다

| 규칙 | 지키는 곳 |
|---|---|
| 가리키는 key 가 표에 있다 | 서버 FK · UNIQUE |
| 한 보스 · 난이도의 가격 줄이 겹치지 않고 이어진다 · 새 가격의 시작이 그 보스의 기간 경계(주간 · 시즌은 목요일, 월간은 1일)다 · 기간 글자 형식 | 관리 화면의 쓰기 검사. 걸리면 400 이고 아무것도 안 바뀐다 |
| 스타포스 단계가 0 부터 빠짐없이 있다 · 잠재 재설정에 `min_level 1` 구간이 있다 · 심볼 비용이 1 부터 `max_level - 1` 까지 있다 | 관리 화면의 쓰기 검사 |
| 컨텐츠 API 이름 · 장비 이름이 NFC 와 공백 제거 뒤에도 유일하다 | 관리 화면의 쓰기 검사([[ADR-019]] 결정 4 의 찾는 규칙을 지키기 위해서다) |
| 칸의 형식 | 앱의 `parse`. 모르는 칸은 버린다 |

앱에 남은 데이터 테스트는 `bundled-game-data.spec.ts` 하나다. 번들이 계약을 통과하는지와 번들이 가리키는 그림 파일이
있는지를 본다. 값을 고정해 둔 테스트는 두지 않는다. 서버가 기준이라 값은 관리 화면에서 바뀌고, 고정해 두면 동기화할
때마다 실패한다.

### 결정 8. 그림은 번들에 두고 서버에는 파일 이름만 둔다

보스 초상 slug · 드롭 아이템 `iconFile` · 지출 타일 그림 · 심볼 그림 · 월드 엠블럼 · 컨텐츠 배경은 모두 앱 에셋의 파일
이름이고, 서버에는 그 글자만 있다. 그래서 서버에서 새 보스나 새 아이템을 더하면 이름과 가격은 바로 나오지만, 그림은
앱 빌드가 나가야 나온다. 번들에 그림이 없으면 에러 없이 그림만 빠진 채로 그린다. 동기화한 번들이 없는 그림을 가리키면
`bundled-game-data.spec.ts` 가 잡는다.

### 결정 9. 여러 값이 붙는 칸은 배열이 아니라 줄 표다

보스의 난이도와 요구 레벨, 지출 항목의 축 값과 형태, 심볼의 레벨별 비용, 사냥터의 몬스터 레벨은 모두 줄 표다
(`boss_difficulties` · `spend_item_options` · `spend_item_forms` · `symbol_level_costs` · `hunting_ground_levels`). 배열이나
jsonb 칸 두 개에 나눠 두면 두 칸의 순서가 어긋나도 DB 가 잡지 못한다.

값이 정해진 집합(보스 난이도 · 주기, 드롭 분류, 지출 분류 · 화폐 · 형태, 컨텐츠 분류 · 섹션 · 공유 범위, 잠재 종류 · 등급,
MVP 등급, 포스 종류)은 Postgres ENUM 이다. 코드가 그 값으로 분기하기 때문에, 새 값은 앱 코드와 함께 마이그레이션으로
더한다. ENUM 의 한글 이름(형태 · 분류 이름, 잠재 등급의 넥슨 표기)은 앱 상수로 둔다.

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

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `features/game-data/__tests__/query.spec.ts` | 결정 3: 사본도 서버도 없으면 번들인지, 응답의 `null` 이 아닌 칸만 덮는지, 옛 보스 사본 키를 지우는지, 받은 값만 사본에 저장하는지, 사본이 있으면 그것으로 시작하고 서버를 못 받아도 유지되는지, 계약 판이 다른 사본을 버리는지, 저장소가 던져도 서버 응답은 쓰는지 본다 |
| | 결정 4: `useGameTable` 이 칸이 바뀔 때 다시 그리고, 안 바뀐 칸을 구독한 훅은 다시 그리지 않는지 본다 |
| `server/__tests__/game-data.spec.ts` | 결정 3: 칸마다 받은 표를 주고 없는 칸은 `null` 인지, 네트워크 실패 · 5xx · 객체가 아닌 응답이 `null` 인지, 계약을 어긴 칸과 `updatedAt` 이 `null` 인 칸만 `null` 인지, 선택 칸의 `null` 을 빠진 칸으로 통과시키는지 본다 |
| `lib/game-data/__tests__/table.spec.ts` | 결정 4: 표를 바꾸면 구독자에게 알리고, 같은 객체면 알리지 않고, 구독을 풀면 더 알리지 않는지, `bundledTable` 이 계약을 어기면 던지는지, `derive` 가 표가 바뀐 뒤에만 다시 만드는지 본다 |
| `lib/game-data/__tests__/sections.spec.ts` | 결정 4: 칸 열셋이 `GAME_DATA_SECTIONS` 와 같은 순서인지, 번들이 계약을 통과하고 다시 통과시켜도 같은지, 표를 덮으면 그 칸이 바뀌는지 본다 |
| `storage/__tests__/query-persister.spec.ts` | 결정 3: 옛 보스 사본 키를 지우는지 본다 |
| `src/data/__tests__/bundled-game-data.spec.ts` | 결정 7 · 8: 번들 열세 칸이 계약을 통과하는지, 드롭 아이템 · 지출 타일 · 심볼 · 월드 엠블럼 · 컨텐츠 배경 · 보스 초상 그림 파일이 에셋에 있는지 본다 |
| `scripts/__tests__/sync-game-data.test.mjs` | 결정 5: 칸 열셋이 앱과 같은 순서인지, 파일 이름이 칸 이름의 kebab-case 인지, `updatedAt` 이 `null` 인 칸은 파일을 쓰지 않는지, 응답 그대로 쓰는지 본다 |

## 번호 기록

- ADR-020 (2026-10-19): 옛 ADR-341 · ADR-349 · ADR-350 을 합쳐 처음 작성
