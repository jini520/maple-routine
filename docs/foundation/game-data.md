# 게임 데이터

보스 · 결정석 가격 · 드롭 표 · 컨텐츠 · 지출 목록 · 강화 비용 같은 게임 수치와 그 그림을 정리한다. 서버가 기준이고 앱
번들에는 없다. 앱은 서버에서 받아 기기에 두고, 다 받기 전에는 잠금 화면만 그린다. 값을 누가 정하는지와 key · 기간 규칙은
[[ADR-019]] 에, 서버 표와 앱이 받는 방법은 [[ADR-020]] 에 이유가 있다.

게임 수치는 사용자가 확인한 값만 쓴다. AI 가 추정한 값을 넣지 않는다. 값과 그림 · 크롭은 서버 관리 화면에서 고친다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `types/game-data.ts` | 칸 이름(`GAME_DATA_SECTIONS`)과 칸마다의 형식 |
| `lib/game-data/table.ts` | 칸 하나의 현재 값(`gameTable` · `createTable` · `derive`) |
| `lib/game-data/initial.ts` | 표의 첫 값. 앱은 빈 표이고, jest 는 `src/__fixtures__/game-data/initial.ts` 로 바꿔 fixture 로 시작한다 |
| `lib/game-data/sections.ts` | 칸 열여섯의 표와 계약 검사(`SECTIONS`) · 사본 계약 판(`GAME_DATA_CONTRACT`) |
| `lib/assets/asset-files.ts` | 그림 목록(`assets` 칸)과 받은 그림의 `{ uri, width, height }` |
| `lib/assets/image-crops.ts` | 크롭 표(`imageCrops` 칸) |
| `lib/assets/asset-lookup.ts` | 이름표를 그림 · 크롭으로 바꾸는 조회 |
| `features/game-data/sync.ts` | 켤 때 사본 읽기 · 잠근 채 받기 · 돌아올 때 조용히 받기(`startGameData` · `refreshGameData`) · 칸 구독 훅(`useGameTable`) |
| `app/game-data/GameDataLock.tsx` | 다 받기 전의 잠금 화면 |
| `server/game-data.ts` | `GET /v1/game-data` 를 ETag 와 함께 받고 칸마다 검사한다 |
| `storage/game-data-copy.ts` | 기기 사본(SQLite `game_data_sections` · `game_data_meta`) |
| `storage/adapters/rn-asset-files.ts` | 그림 파일(문서 디렉터리 `game-assets/`) |
| `src/__fixtures__/game-data/` | 테스트가 쓰는 칸 열여섯. 운영 서버 응답을 떠 둔 것이다 |
| `lib/boss/boss-profit-period.ts` | 줄의 유효 기간 판정(`isEffectiveIn` · `isEffectiveAnytimeIn`) |

## 칸 열여섯

| 칸 | 담는 것 | 조회 모듈 | 관리 화면 |
|---|---|---|---|
| `bosses` | 보스 26개와 난이도 줄(요구 레벨 · 파티 인원 상한 · 유효 기간), 규칙(주간 보스 선택 한도 · 주간 결정석 판매 한도 · 기본 파티 인원 상한). 보스 key 마스터 표다 | `lib/boss/bosses` · `lib/boss/catalog` | `/admin/bosses` |
| `dropItems` | 드롭 아이템 109개의 key · 이름 · 그림 · 고가 여부. 드롭 아이템 key 마스터 표다 | `lib/drop/drop-items` | `/admin/drop-items` |
| `bossDrops` | 보스 · 난이도마다의 보상 줄 387개(고정 보상 · 장비 · 소비, 고정 보상 수량, 유효 기간) | `lib/boss/boss-drops` | `/admin/boss-drops` |
| `dropBoxes` | 개봉 결과를 직접 고르는 상자 7개(반지 상자 5 · 장신구 상자 2)의 레벨 범위와 후보 | `lib/boss/boss-drops` | `/admin/drop-boxes` |
| `crystalPrices` | 보스 · 난이도마다 결정석 가격 줄 106개. 한 조합에 기간 줄이 여럿일 수 있다 | `lib/boss/boss-crystal-prices` | `/admin/crystal-prices` |
| `worlds` | 월드 19개의 key · 넥슨 표기 이름 · 엠블럼 · 챌린저스 여부 · 이벤트 월드 여부. 월드 key 마스터 표다 | `lib/world/worlds` | `/admin/worlds` |
| `spendCatalog` | 가계부 지출 목록. 묶음 12(카드 제목) · 타일 54 · 항목 70(원본 이름 · 줄인 이름) 과 항목의 축 값 · 형태, 형태 이름 둘, 규칙(관세율 · 세라자르 주화 가격) | `lib/cashbook/spend-catalog` | `/admin/spend-catalog` |
| `cashbookCategories` | 가계부 수입 · 지출 갈래 11개의 이름 · 카드 제목 · 그림 · 설명 · 단위와 아이템 종류 3개(장비 · 소비 · 기타)의 이름 · 단위 · 관세 여부 | `lib/cashbook/categories` | `/admin/cashbook-categories` |
| `symbolCosts` | 심볼 묶음 3 · 심볼 14 · 레벨별 강화 비용 줄 194개. 비용 줄에는 기간이 있다 | `lib/cashbook/symbol-costs` | `/admin/symbol-costs` |
| `contents` | 컨텐츠 분류 8 · 컨텐츠 41개의 넥슨 이름 · 표시 이름 · 배경 · 수동 모드 상한 · 요구 레벨 · 공유 범위 · 유효 기간. 컨텐츠 key 마스터 표다 | `lib/scheduler/contents` · `scheduler-content-scope` · `content-categories` | `/admin/contents` |
| `equipmentItems` | 강화 비용을 매길 장비 467개의 key · 붙여 쓴 이름 · 착용 레벨. 장비 key 마스터 표다 | `lib/equipment/equipment-items` | `/admin/equipment-items` |
| `enhancementCosts` | 잠재 재설정 비용 32줄 · 소울 잠재 재설정 비용 4줄 · 스타포스 단계 30줄과 규칙 셋. 식은 `lib/enhancement/cost.ts` 에 있다 | `lib/enhancement/cost` | `/admin/enhancement-costs` |
| `mvpGrades` | MVP 등급 7개의 경매장 수수료와 스타포스 할인. 순서가 등급의 높낮이다 | `lib/mvp/grades` | `/admin/mvp-grades` |
| `huntingGrounds` | 사냥 지역 21 · 사냥터 408 · 몬스터 레벨 줄 460. 계산 상수는 `lib/cashbook/hunting-meso.ts` 에 있다 | `lib/cashbook/hunting-grounds` | `/admin/hunting-grounds` |
| `assets` | 앱이 받는 그림 약 350장의 경로 · 내용 해시 · 바이트 · 가로 · 세로 | `lib/assets/asset-files` | `/admin/assets` |
| `imageCrops` | 보스 초상(카드 · 원형 아이콘 · 파티 모달 띠)과 컨텐츠 지역 지도의 크롭 | `lib/assets/image-crops` | `/admin/assets` |

응답은 서버 표의 줄을 그대로 펼친 목록이다. 보스 · 난이도 · 분류로 묶거나 지역 안에 사냥터를 묶는 일은 조회 모듈이 한다.
부르는 쪽은 값이 기기 사본에서 왔는지 서버 응답인지 모른다.

## 번들에 남는 것

게임 수치가 아니라 앱 코드와 함께 바뀌는 값이다. 서버로 옮기지 않는다.

| 파일 | 담는 것 |
|---|---|
| `src/data/job-themes.json` · `src/assets/themes/` | 테마 색 토큰과 배경. 잠금 화면도 테마로 그린다 |
| `src/data/release-notes.ts` · `src/data/feature-guides/` · `src/assets/guide/` | 업데이트 노트 · 기능 안내 문구와 그림 |
| `src/assets/utility/` · `src/assets/nexon/` | 도구 아이콘 · 넥슨 로그인 단추 |

## 값이 기기에 반영되는 순서

1. 켤 때 `startGameData` 가 기기 사본을 읽는다. 계약 판이 `GAME_DATA_CONTRACT` 와 같고 칸 열여섯이 계약을 지키면 표를
   세우고 바로 연다.
2. 사본이 없거나 읽을 수 없으면 잠금 화면을 세우고 받는다. 게임 데이터를 받은 뒤 기기에 없는 그림을 받고, 다 받으면 사본을
   한 트랜잭션으로 쓰고 표를 바꾼 뒤 풀린다. 실패하면 `다시 시도` 를 기다린다.
3. 연 뒤에는 켤 때와 백그라운드에서 돌아올 때 사본의 ETag 로 묻는다. 304 면 아무것도 받지 않는다. 바뀌었으면 조용히 받아
   그림까지 받은 뒤 한 번에 바꾸고, 목록에서 빠진 그림 파일을 지운다. 실패하면 가진 사본을 쓴다.

## 기록이 데이터를 가리키는 방법

- 기록은 이름이 아니라 key 를 저장한다. 이름 칸에는 적을 때의 이름을 함께 둔다. 화면은 key 로 지금 이름을 찾고, 표에 없는
  key 면 저장된 이름을 보인다.
- 넥슨 API 이름은 NFC 로 맞추고 공백을 모두 지운 뒤 완전히 같은 줄로 key 를 찾는다. 못 찾으면 key 는 `null` 이다.
- 그림을 가리키는 칸(`portraitSlug` · `backgroundMap` · `iconFile` · `emblem`)은 그림 목록의 경로로 푼다. 서버는 쓰기 때
  그 그림이 목록에 있는지 본다. 그래서 새 보스나 새 아이템도 관리 화면에서 그림을 먼저 올리면 앱 빌드 없이 그림까지 나온다.

## 유효 기간

결정석 가격 · 드롭 표 · 심볼 비용 · 지출 항목 · 컨텐츠 · 보스 · 보스 난이도 줄에 `from` · `until` 칸이 있다. 값은 KST
`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm` 이다.

| 판정 | 쓰는 곳 |
|---|---|
| `isEffectiveIn(row, periodKey, now)`. 기간 첫날로 보고, 경계에 첫날 안의 시각이 있을 때만 시계를 본다 | 가격 고르기 · 드롭 후보와 고정 보상 표시 · 컨텐츠 목록 · 지출 타일 · 보스와 난이도 표시 |
| `isEffectiveAnytimeIn(row, periodKey)`. 그 기간 어느 때라도 유효했으면 참 | 얻을 수 없는 드롭 기록을 지우는 판정 |

값이 바뀌면 옛 줄을 지우지 않고 `until` 로 닫고 새 줄을 연다. 관리 화면에서 새 가격을 열면 지금 줄이 닫힌다.
