# 게임 데이터

보스 · 결정석 가격 · 드롭 표 · 컨텐츠 · 지출 목록 · 강화 비용 같은 게임 수치를 정리한다. 서버가 기준이고 앱 번들의
`src/data/*.json` 은 그 사본이다. 값을 누가 정하는지와 key · 기간 규칙은 [[ADR-019]] 에, 서버 표와 앱이 받는 방법은
[[ADR-020]] 에 이유가 있다.

게임 수치는 사용자가 확인한 값만 쓴다. AI 가 추정한 값을 넣지 않는다. 값은 서버 관리 화면에서 고치고, 번들은 빌드
전에 서버 값으로 다시 쓴다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `src/data/<칸>.json` | 게임 데이터 열네 칸의 번들 사본. 형식은 서버 응답의 그 칸과 같다 |
| `types/game-data.ts` | 칸 이름(`GAME_DATA_SECTIONS`)과 칸마다의 형식 |
| `lib/game-data/table.ts` | 칸 하나의 현재 값(`createTable` · `bundledTable` · `derive`) |
| `lib/game-data/sections.ts` | 칸 열넷의 표와 계약 검사(`SECTIONS`) · 사본 계약 판(`GAME_DATA_CONTRACT`) |
| `features/game-data/query.ts` | 켤 때 사본 복원과 서버 받기(`hydrateGameData`) · 칸 구독 훅(`useGameTable`) |
| `server/game-data.ts` | `GET /v1/game-data` 를 칸마다 검사해 받는다 |
| `storage/query-persister.ts` | 기기 사본(Preferences `queryCache`) |
| `scripts/sync-game-data.mjs` | 빌드 전에 번들 열네 파일을 서버 값으로 다시 쓴다 |
| `lib/boss/boss-profit-period.ts` | 줄의 유효 기간 판정(`isEffectiveIn` · `isEffectiveAnytimeIn`) |
| `src/data/__tests__/bundled-game-data.spec.ts` | 번들이 계약을 통과하는지, 가리키는 그림 파일이 있는지 본다 |

## 칸 열넷

| 칸 · 번들 파일 | 담는 것 | 조회 모듈 | 관리 화면 |
|---|---|---|---|
| `bosses` · `bosses.json` | 보스 26개와 난이도 줄(요구 레벨 · 파티 인원 상한 · 유효 기간), 규칙(주간 보스 선택 한도 · 주간 결정석 판매 한도 · 기본 파티 인원 상한). 보스 key 마스터 표다 | `lib/boss/bosses` · `lib/boss/catalog` | `/admin/bosses` |
| `dropItems` · `drop-items.json` | 드롭 아이템 109개의 key · 이름 · 그림 · 고가 여부. 드롭 아이템 key 마스터 표다 | `lib/drop/drop-items` | `/admin/drop-items` |
| `bossDrops` · `boss-drops.json` | 보스 · 난이도마다의 보상 줄 387개(고정 보상 · 장비 · 소비, 고정 보상 수량, 유효 기간) | `lib/boss/boss-drops` | `/admin/boss-drops` |
| `dropBoxes` · `drop-boxes.json` | 개봉 결과를 직접 고르는 상자 7개(반지 상자 5 · 장신구 상자 2)의 레벨 범위와 후보 | `lib/boss/boss-drops` | `/admin/drop-boxes` |
| `crystalPrices` · `crystal-prices.json` | 보스 · 난이도마다 결정석 가격 줄 106개. 한 조합에 기간 줄이 여럿일 수 있다 | `lib/boss/boss-crystal-prices` | `/admin/crystal-prices` |
| `worlds` · `worlds.json` | 월드 19개의 key · 넥슨 표기 이름 · 엠블럼 · 챌린저스 여부 · 이벤트 월드 여부. 월드 key 마스터 표다 | `lib/world/worlds` | `/admin/worlds` |
| `spendCatalog` · `spend-catalog.json` | 가계부 지출 목록. 묶음 12(카드 제목) · 타일 54 · 항목 70(원본 이름 · 줄인 이름) 과 항목의 축 값 · 형태, 형태 이름 둘, 규칙(관세율 · 세라자르 주화 가격) | `lib/cashbook/spend-catalog` | `/admin/spend-catalog` |
| `cashbookCategories` · `cashbook-categories.json` | 가계부 수입 · 지출 갈래 11개의 이름 · 카드 제목 · 그림 · 설명 · 단위와 아이템 종류 3개(장비 · 소비 · 기타)의 이름 · 단위 · 관세 여부 | `lib/cashbook/categories` | `/admin/cashbook-categories` |
| `symbolCosts` · `symbol-costs.json` | 심볼 묶음 3 · 심볼 14 · 레벨별 강화 비용 줄 194개. 비용 줄에는 기간이 있다 | `lib/cashbook/symbol-costs` | `/admin/symbol-costs` |
| `contents` · `contents.json` | 컨텐츠 분류 8 · 컨텐츠 41개의 넥슨 이름 · 표시 이름 · 배경 · 수동 모드 상한 · 요구 레벨 · 공유 범위 · 유효 기간. 컨텐츠 key 마스터 표다 | `lib/scheduler/contents` · `scheduler-content-scope` · `content-categories` | `/admin/contents` |
| `equipmentItems` · `equipment-items.json` | 강화 비용을 매길 장비 467개의 key · 붙여 쓴 이름 · 착용 레벨. 장비 key 마스터 표다 | `lib/equipment/equipment-items` | `/admin/equipment-items` |
| `enhancementCosts` · `enhancement-costs.json` | 잠재 재설정 비용 32줄 · 소울 잠재 재설정 비용 4줄 · 스타포스 단계 30줄과 규칙 셋. 식은 `lib/enhancement/cost.ts` 에 있다 | `lib/enhancement/cost` | `/admin/enhancement-costs` |
| `mvpGrades` · `mvp-grades.json` | MVP 등급 7개의 경매장 수수료와 스타포스 할인. 순서가 등급의 높낮이다 | `lib/mvp/grades` | `/admin/mvp-grades` |
| `huntingGrounds` · `hunting-grounds.json` | 사냥 지역 21 · 사냥터 408 · 몬스터 레벨 줄 460. 계산 상수는 `lib/cashbook/hunting-meso.ts` 에 있다 | `lib/cashbook/hunting-grounds` | `/admin/hunting-grounds` |

응답과 번들은 서버 표의 줄을 그대로 펼친 목록이다. 보스 · 난이도 · 분류로 묶거나 지역 안에 사냥터를 묶는 일은 조회 모듈이 한다.
부르는 쪽은 값이 서버에서 왔는지 번들인지 모른다.

## 번들에만 있는 파일

게임 수치가 아니라 번들의 그림 · 문구와 짝인 파일이다. 서버로 옮기지 않는다.

| 파일 | 담는 것 |
|---|---|
| `boss-portrait-crops.json` · `boss-portrait-icon-crops.json` · `boss-portrait-modal-crops.json` | 보스 초상을 카드 · 원형 아이콘 · 모달에서 자르는 크기와 위치 |
| `daily-quest-region-crops.json` | 컨텐츠 카드 지도 배경을 자르는 크기와 위치 |
| `job-themes.json` | 테마 색 토큰과 배경 |
| `release-notes.ts` · `feature-guides/` | 업데이트 노트 · 기능 안내 문구 |

## 값이 기기에 반영되는 순서

1. 켜는 순간 번들 열네 칸으로 표가 채워진다.
2. `hydrateGameData` 가 기기 사본(`queryCache`)을 복원한다. 사본의 계약 판이 `GAME_DATA_CONTRACT` 와 다르면 버린다.
3. 서버에서 한 번 받아 `null` 이 아닌 칸만 덮고, 덮은 값을 사본에 저장한다. 실패하면 한 번 다시 시도하고 그래도 안 되면
   가지고 있던 값을 그대로 쓴다.
4. 켜 둔 동안은 다시 받지 않는다. 관리 화면에서 고친 값은 다음에 켤 때 반영된다.

## 기록이 데이터를 가리키는 방법

- 기록은 이름이 아니라 key 를 저장한다. 이름 칸에는 적을 때의 이름을 함께 둔다. 화면은 key 로 지금 이름을 찾고, 표에 없는
  key 면 저장된 이름을 보인다.
- 넥슨 API 이름은 NFC 로 맞추고 공백을 모두 지운 뒤 완전히 같은 줄로 key 를 찾는다. 못 찾으면 key 는 `null` 이다.
- 그림을 가리키는 칸(`portraitSlug` · `backgroundMap` · `iconFile` · `emblem`)는 앱 에셋 파일 이름이다. 서버에 새 줄을 더해도
  그림은 앱 빌드가 나가야 보인다.

## 유효 기간

결정석 가격 · 드롭 표 · 심볼 비용 · 지출 항목 · 컨텐츠 · 보스 · 보스 난이도 줄에 `from` · `until` 칸이 있다. 값은 KST
`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm` 이다.

| 판정 | 쓰는 곳 |
|---|---|
| `isEffectiveIn(row, periodKey, now)`. 기간 첫날로 보고, 경계에 첫날 안의 시각이 있을 때만 시계를 본다 | 가격 고르기 · 드롭 후보와 고정 보상 표시 · 컨텐츠 목록 · 지출 타일 · 보스와 난이도 표시 |
| `isEffectiveAnytimeIn(row, periodKey)`. 그 기간 어느 때라도 유효했으면 참 | 얻을 수 없는 드롭 기록을 지우는 판정 |

값이 바뀌면 옛 줄을 지우지 않고 `until` 로 닫고 새 줄을 연다. 관리 화면에서 새 가격을 열면 지금 줄이 닫힌다.
