# 게임 데이터

보스 · 결정석 가격 · 드롭 표 · 컨텐츠 · 지출 목록 · 강화 비용 같은 게임 수치와 그 그림을 정리한다. 서버가 기준이고 앱
번들에는 없다. 앱은 서버에서 받아 기기에 두고, 다 받기 전에는 잠금 화면만 그린다. 값을 누가 정하는지와 key · 기간 규칙은
[[ADR-019]] 에, 서버 표와 앱이 받는 방법은 [[ADR-020]] 에 이유가 있다. 화면의 FAQ 문구도 게임 수치는 아니지만 같은
방법으로 받는다([[ADR-150]] 결정 5). 앱을 다시 내지 않고 고치기 위해서다.

게임 수치는 사용자가 확인한 값만 쓴다. AI 가 추정한 값을 넣지 않는다. 값과 그림 · 크롭은 서버 관리 화면에서 고친다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `types/game-data.ts` | 칸 이름(`GAME_DATA_SECTIONS`)과 칸마다의 형식 |
| `lib/game-data/table.ts` | 칸 하나의 현재 값(`gameTable` · `createTable` · `derive`) |
| `lib/game-data/initial.ts` | 표의 첫 값. 앱은 빈 표이고, jest 는 `src/__fixtures__/game-data/initial.ts` 로 바꿔 fixture 로 시작한다 |
| `lib/game-data/sections.ts` | 칸 스물의 표와 계약 검사(`SECTIONS`) · 사본 계약 판(`GAME_DATA_CONTRACT`) |
| `lib/assets/asset-files.ts` | 그림 목록(`assets` 칸)과 받은 그림의 `{ uri, width, height }` |
| `lib/assets/image-crops.ts` | 크롭 표(`imageCrops` 칸) |
| `lib/assets/asset-lookup.ts` | 그림 칸의 id · 앱 그림 key 를 그림 · 크롭으로 바꾸는 조회 |
| `lib/assets/app-images.ts` | 붙일 표가 없는 앱 그림(`appImages` 칸)의 key 와 드롭 연출 프레임 |
| `lib/item-catalog.ts` | 아이템 표(`items` 칸). key · 줄 id 로 찾기, 묶음(`itemGroupOf`) · 반지 레벨 줄(`ringLevelOf`) · 같은 물건의 원래 줄(`originalItemOf`), 넥슨 API 이름으로 찾기(`findItemByApiName`)와 기록의 아이템 이름(`recordedItemNameOf`) |
| `lib/game-rules.ts` | 게임 규칙(`gameRules` 칸) |
| `features/game-data/sync.ts` | 켤 때 사본 읽기 · 잠근 채 받기 · 돌아올 때 조용히 받기(`startGameData` · `refreshGameData`) · 칸 구독 훅(`useGameTable`) |
| `app/game-data/GameDataLock.tsx` | 다 받기 전의 잠금 화면 |
| `server/game-data.ts` | `GET /v1/game-data` 를 ETag 와 함께 받고 칸마다 검사한다 |
| `storage/game-data-copy.ts` | 기기 사본(SQLite `game_data_sections` · `game_data_meta`) |
| `storage/adapters/rn-asset-files.ts` | 그림 파일(문서 디렉터리 `game-assets/`) |
| `src/__fixtures__/game-data/` | 테스트가 쓰는 칸 스물. 서버 응답을 떠 둔 것이다. 1.0.15 계약으로 옮긴 칸은 DB 박스 서버(운영 DB 사본)의 응답이다 |
| `lib/boss/boss-profit-period.ts` | 줄의 유효 기간 판정(`isEffectiveIn` · `isEffectiveAnytimeIn`) |

## 칸 스물

| 칸 | 담는 것 | 조회 모듈 | 관리 화면 |
|---|---|---|---|
| `bosses` | 보스 26개(key · 이름 · 짧은 이름 `shortName` · 시즌 보스 여부 `isSeasonBoss` · 초상 · 유효 기간)와 난이도 줄 58개(`bossDifficulties`. 주기 · 요구 레벨 · 파티 인원 상한 · 유효 기간). 보스 key 마스터 표다. 보스마다 난이도를 묶고 주기 하나를 정하는 일은 `lib/boss/bosses` 가 한다. 다른 칸은 난이도를 난이도 줄 id 로 가리킨다(`bossDifficultyIdOf` · `bossDifficultyOfId`) | `lib/boss/bosses` · `lib/boss/catalog` | `/admin/bosses` |
| `bossDrops` | 보스 난이도마다의 보상 줄 408개(`bossDifficultyRewards`. 난이도 줄 id · 분류(고정 보상 · 장비 · 소비) · 아이템 줄 id · 고정 보상 수량 `quantity` · 유효 기간). 보스 key · 아이템 key 로 묶어 보이는 일은 조회 모듈이 하고, 모르는 줄을 가리키는 보상은 뺀다 | `lib/boss/boss-drops` | `/admin/boss-drops` |
| `dropBoxes` | 개봉 결과를 직접 고르는 상자 7개(반지 상자 5 · 장신구 상자 2)의 아이템 줄 id · 반지 레벨 범위(`dropBoxes`)와 개봉 후보 줄(`dropBoxContents`). 후보는 같은 물건의 원래 아이템 key 로 선다(상자 연마석은 생명의 연마석) | `lib/boss/boss-drops` | `/admin/drop-boxes` |
| `crystalPrices` | 보스 난이도마다 결정석 가격 줄 106개(`bossCrystalPrices`. 난이도 줄 id · 가격 · 유효 기간). 한 난이도에 기간 줄이 여럿일 수 있다 | `lib/boss/boss-crystal-prices` | `/admin/crystal-prices` |
| `worlds` | 월드 20개의 key · 넥슨 표기 이름 · 엠블럼 · 챌린저스 여부(`isChallengers`) · 이벤트 월드 여부(`isEvent`)와 열린 기간 줄(`worldOpenPeriods`. 월드마다 여러 줄, [[ADR-100]] 결정 9). 월드 key 마스터 표다 | `lib/world/worlds` | `/admin/worlds` |
| `spendCatalog` | 가계부 지출 목록. 추가 리워드 종류 둘(`spendRewardTypes`) · 묶음 13(`spendGroups`. 카드 제목 · 분류 줄 id · 열림 `isActive`) · 타일 64(`spendTiles`) · 항목 80(`spendItems`. 묶음 · 타일 줄 id · 세라자르 주화 `rewardCoinQuantity` · 유효 기간)과 항목의 축 값(`spendItemOptions`) · 추가 리워드 종류(`spendItemRewardTypes`). 항목에 묶음 · 타일 · 분류 key 와 축 값 · 형태를 붙이는 일은 조회 모듈이 한다. 항목의 줄인 이름은 없다([[ADR-099]] 결정 60) | `lib/cashbook/spend-catalog` | `/admin/spend-catalog` |
| `cashbookCategories` | 가계부 수입 · 지출 분류 15개(`cashbookCategories`. 줄 id · 이름 · 카드 제목 · 그림 · 설명 · 단위)와 아이템 종류 4개(`cashbookItemTypes`. 장비 · 소비 · 기타 · 캐시의 이름 · 단위 · 관세 여부). 지출 묶음은 분류를 줄 id 로 가리킨다(`findCashbookCategoryById`) | `lib/cashbook/categories` | `/admin/cashbook-categories` |
| `symbolCosts` | 심볼 묶음 3(`symbolGroups`. 최고 레벨 · 고를 때 서는 레벨 `defaultFromLevel` · `defaultToLevel`) · 심볼 14(`symbols`. 묶음 줄 id) · 레벨별 강화 비용 줄 194개(`symbolLevelCosts`. 심볼 줄 id · 강화 전 레벨 `fromLevel` · 유효 기간) | `lib/cashbook/symbol-costs` | `/admin/symbol-costs` |
| `hexaMatrix` | 헥사 코어 종류 6 · 종류별 레벨 비용 줄 180개(조각 · 솔 에르다) · 기본 종류가 아닌 코어 이름 50 · 직업 48 개의 코어 672 · 헥사 스탯 3 과 활성화 조각. 코어 그림은 `skills/` 에 있다. 1.0.15 에서 표 이름의 배열 다섯으로 바꾸고 이름 표를 없앤다([[ADR-099]] 결정 65) | `lib/cashbook/hexa-matrix` | `/admin/hexa-matrix` |
| `contents` | 컨텐츠 분류 8 · 컨텐츠 41개의 넥슨 이름 · 표시 이름 · 배경 · 지역 아이콘 · 수동 모드 상한 · 요구 레벨 · 공유 범위 · 유효 기간. 컨텐츠 key 마스터 표다. 1.0.15 에서 배열 `contentCategories` · `contents` 로 내고 완료 조건(`checkType`)을 싣는다([[ADR-099]] 결정 65) | `lib/scheduler/contents` · `scheduler-content-scope` · `content-categories` | `/admin/contents` |
| `enhancementCosts` | 잠재 재설정 비용 32줄 · 소울 잠재 재설정 비용 4줄 · 스타포스 단계 30줄 · 슈페리얼 계열 3줄(스타포스 1회 비용) · 슈페리얼 장비 50개와 규칙 셋. 식은 `lib/enhancement/cost.ts` 에 있다. 1.0.15 에서 배열 `starforceSteps` 를 `starforceCostSteps` 로 바꾸고 슈페리얼 장비가 계열을 줄 id 로 가리키며, 규칙은 `gameRules` 칸으로 옮긴다([[ADR-099]] 결정 65) | `lib/enhancement/cost` | `/admin/enhancement-costs` |
| `mvpGrades` | MVP 등급 7개의 경매장 수수료 · 스타포스 할인 · 명패 그림. 순서가 등급의 높낮이다. 1.0.15 에서 배열 `mvpGrades` 로 내고 줄 id 를 싣는다([[ADR-099]] 결정 65) | `lib/mvp/grades` | `/admin/mvp-grades` |
| `huntingGrounds` | 사냥 지역 21 · 사냥터 408(인기 여부 포함) · 몬스터 레벨 줄 460. 계산 상수는 `lib/cashbook/hunting-meso.ts` 에 있다. 1.0.15 에서 배열 `huntingRegions` · `huntingGrounds` · `huntingGroundLevels` 로 내고 지역 · 사냥터를 줄 id 로 가리킨다([[ADR-099]] 결정 65) | `lib/cashbook/hunting-grounds` | `/admin/hunting-grounds` |
| `huntLoot` | 가계부 사냥 전리품 판매의 아이템 5개(조각 1 · 소비 2 · 이벤트 2)의 key · 분류 · 이름 · 그림 · NPC 개당 가격 · 유효 기간. 1.0.15 에서 배열 `huntLootItems` 로 내고 아이템을 줄 id 로 가리킨다([[ADR-099]] 결정 65) | `lib/cashbook/hunt-loot` | `/admin/hunt-loot` |
| `assets` | 앱이 받는 그림 약 1,500장의 id · 파일 이름 · 내용 해시 · 바이트(`sizeBytes`) · 가로 · 세로. 내용이 같은 그림이 여러 줄일 수 있다. 1.0.15 응답에는 서버 경로가 없어, 테스트가 경로로 그림을 찾을 때는 1.0.14 응답에서 뜬 `src/__fixtures__/asset-paths.json` 을 쓴다 | `lib/assets/asset-files` | `/admin/assets` |
| `imageCrops` | 보스 초상(카드 · 원형 아이콘 · 파티 모달 띠)과 컨텐츠 지역 지도의 크롭. 1.0.15 에서 배열 `imageCrops` 에 폭 · 가로 · 세로 위치를 숫자로 내고 파티 모달 띠를 걷는다([[ADR-099]] 결정 65) | `lib/assets/image-crops` | `/admin/assets` |
| `faqs` | 화면 FAQ 의 묶음(key · 제목)과 문항(질문 · 답 블록). 묶음 하나가 시트 하나다([[ADR-150]]). 1.0.15 에서 배열 `faqSheets` · `faqItems` 로 내고 답은 빈 줄로 문단을 나눈 글이다([[ADR-099]] 결정 65) | `lib/faq/faqs` | `/admin/faqs` |
| `gameRules` | 게임 규칙 아홉(주간 보스 선택 한도 · 주간 결정석 판매 한도 · 기본 파티 인원 상한 · 관세율 · 세라자르 주화 가격 · 메소마켓 수수료율 · 감정비용 무료 상한 · 감정비용 계수 · 파괴 방지 추가분)의 한 줄. 1.0.14 까지는 `bosses` · `spendCatalog` · `enhancementCosts` 의 `rules` 에 나뉘어 있었다([[ADR-099]] 결정 65) | `lib/game-rules` | 규칙을 쓰는 화면(보스 · 지출 카탈로그 · 강화 비용) |
| `appImages` | 붙일 표가 없는 앱 그림 72장의 key 와 그림 id. 결정석 칩 · 강화 다섯 · 메소 주머니 · 포스 · 모르는 캐릭터 · 드롭 연출 프레임 등이다([[ADR-187]] 결정 8) | `lib/assets/app-images` | 없음(S4 에서 만든다) |
| `items` | 아이템 698개(key · 이름 · 묶음 · 그림 · 드롭 여부 `isDrop` · 고가 여부 `isValuable` · 강화 장비 여부 `isEquipment` · 착용 레벨)와 묶음 39(종류 · 차례), 특수스킬 반지의 레벨 줄, 같은 물건의 다른 줄(상자에서 나온 연마석). 이름 차례다. 1.0.14 까지의 `dropItems` · `equipmentItems` 칸이 여기로 합쳐졌다([[ADR-099]] 결정 65). 드롭 아이템 · 강화 장비 조회는 이 표에서 칸 하나로 고른다. 인벤토리 넣기와 가계부 아이템 고르기는 여기서 고르고, 상자 · 레벨 줄 · 같은 물건의 다른 줄을 빼는 일과 장신구를 장비로 옮기는 일은 고르는 쪽이 한다([[ADR-187]] 결정 10). 가계부의 펼친 강화 줄도 장비 그림을 여기서 찾는다([[ADR-047]] 결정 21) | `lib/item-catalog` · `lib/drop/drop-items` · `lib/equipment/equipment-items` | `/admin/items` |

응답은 서버 표의 줄을 그대로 펼친 목록이다. 보스 · 난이도 · 분류로 묶거나 지역 안에 사냥터를 묶는 일은 조회 모듈이 한다.
부르는 쪽은 값이 기기 사본에서 왔는지 서버 응답인지 모른다.

위 표의 `1.0.15 에서` 로 적은 새 모양을 앱이 읽게 바꾸는 일은 #947 의 앱 작업 브랜치(`feat/game-data-contract-947`)에서 한다.
DB 박스에 서버 develop 을 띄운 뒤 develop 에 머지하므로, 그때까지 develop 의 앱은 지금의 모양을 읽고 운영 서버를 본다([[ADR-099]]
결정 65).

## 1.0.15 계약으로 바꾸는 일

#947 의 앱 작업 브랜치(`feat/game-data-contract-947`)에서 한다. 앱이 받는 게임 데이터를 서버 develop 의 새 모양으로 바꾸고, 그
값을 쓰는 앱 코드를 함께 고친다. 칸의 모양은 서버가 정했다([[ADR-099]] 결정 39 · 43 · 59 ~ 63 · 65). 여기에는 앱이 하는 일만 적는다.
브랜치는 DB 박스의 서버 develop 을 본다(`api.mapleroutine.store`, 결정 43).

### 원칙

- 칸마다 앱 안의 값(`GameData[K]`)은 서버 응답과 같다(사용자 선택 2026-11-21). 배열 이름이 표 이름이고(`bossDifficulties`), 다른
  표의 줄은 줄 id 로 가리킨다(`bossDifficultyId`). 타입(`types/game-data.ts`)은 응답의 칸 이름을 그대로 쓴다. 받은 값을 옛 모양으로
  바꿔 두지 않는다. 바꿔 두면 앱 안의 이름과 서버 · 관리 화면의 이름이 다시 갈린다.
- 조회 모듈은 지금 파일과 역할을 지킨다. 표 값이 바뀔 때마다 줄 id 와 key 로 찾는 표를 한 번 만들어 둔다(`derive`). 보스 안의
  난이도나 지역 안의 사냥터처럼 묶어 보이는 일도 조회 모듈이 한다. 쓰는 쪽은 조회 모듈을 거치고 표의 배열을 직접 돌지 않는다.
- 기록은 기기 변환(결정 19)까지 지금처럼 key 를 적는다. 그래서 key 로 줄을 찾는 조회는 남긴다. key 가 없는 보스 난이도 줄은 보스
  key 와 난이도 글자로 찾는다. 기록이 줄 id 를 적게 바꾸는 일은 기기 변환에서 한다.
- 없어진 칸은 그 칸을 없앤 결정대로 고친다(아래 표). 옛 칸을 앱에서 다시 만들지 않는다.
- 계약 판(`GAME_DATA_CONTRACT`)을 올린다. 켤 때 옛 사본을 버리고 잠금 화면이 새 모양을 처음부터 받는다.
- 테스트 fixture(`src/__fixtures__/game-data/`)는 DB 박스 서버의 응답을 떠서 칸마다 나눠 둔다. 운영 DB 를 옮긴 사본의 값이라 게임
  수치를 지어 넣지 않는다. `drop-items.json` · `equipment-items.json` 은 지우고 `game-rules.json` 을 더한다.

### 칸마다 바뀌는 것

| 칸 | 새 배열 | 앱이 고칠 것 |
|---|---|---|
| `appImages` | `images` 그대로 | 없음 |
| `assets` | `files` | `path` 가 없어지고 `size` 가 `sizeBytes` 다. 받을 크기를 세는 곳이 `sizeBytes` 를 읽는다 |
| `bosses` | `bosses` · `bossDifficulties` | 보스의 `alias` → `shortName`, `from` · `until` → `validFrom` · `validUntil`. 시즌 보스는 `isSeasonBoss` 이고 주기는 난이도 줄의 `cycle` 이다. 난이도는 `bossId` 로 묶는다. 규칙 셋은 `gameRules` 로 간다 |
| `bossDrops` | `bossDifficultyRewards` | 보스 key · 난이도 대신 난이도 줄 id, 아이템 key 대신 아이템 줄 id. 고정 보상 수량은 정수 `quantity` 다(결정 33). 화면의 `160개` 는 앱이 수량에서 만든다 |
| `dropBoxes` | `dropBoxes` · `dropBoxContents` | 상자는 아이템 줄 id 와 반지 레벨 범위(`ringLevelMin` · `ringLevelMax`), 내용물은 상자 줄 id 와 아이템 줄 id. 생명의 보스 반지 상자의 연마석은 상자 연마석 줄을 가리킨다(결정 28) |
| `crystalPrices` | `bossCrystalPrices` | 보스 key · 난이도 대신 난이도 줄 id |
| `dropItems` · `equipmentItems` | 없어진다 | `items` 에서 고른다. 드롭 아이템은 `isDrop`, 고가는 `isValuable`, 강화 장비는 `isEquipment`, 착용 레벨은 `requiredLevel` 이다 |
| `items` | `items` · `itemGroups` · `ringLevelItems` · `sameItemLinks` | 아이템의 묶음은 `groupId` 로 `itemGroups` 에서 찾고 묶음의 종류는 `type` 이다. 반지 레벨 줄은 `ringLevelItems` 로 원래 반지 · 레벨과 잇고, 상자 연마석은 `sameItemLinks` 로 원래 아이템과 잇는다 |
| `worlds` | `worlds` · `worldOpenPeriods` | `challengers` → `isChallengers`, `event` → `isEvent`. 열린 기간은 `worldId` 로 묶는다. 엠블럼은 그림 줄 id 만 있다 |
| `spendCatalog` | `spendRewardTypes` · `spendGroups` · `spendTiles` · `spendItems` · `spendItemOptions` · `spendItemRewardTypes` | 묶음은 가계부 분류 줄 id(`cashbookCategoryId`)를, 항목은 묶음 · 타일 줄 id 를 든다. `active` → `isActive`, `rewardCoins` → `rewardCoinQuantity`. 형태(`forms` · `itemForms`)는 추가 리워드 종류다. 항목의 줄인 이름은 없어진다(결정 60). 규칙은 `gameRules` 로 간다 |
| `cashbookCategories` | `cashbookCategories` · `cashbookItemTypes` | 줄 id 가 붙고 아이템 종류의 배열 이름이 바뀐다 |
| `symbolCosts` | `symbolGroups` · `symbols` · `symbolLevelCosts` | 묶음 · 심볼 줄 id. `defaultFrom` · `defaultTo` → `defaultFromLevel` · `defaultToLevel`, 비용 줄의 `level` → `fromLevel`, `symbol` → `symbolId` |
| `hexaMatrix` | `jobs` · `hexaCoreTypes` · `hexaCores` · `hexaCoreLevelCosts` · `hexaStats` | 직업의 코어 목록은 그 직업의 코어와 `전직업`(`isAllJobs`)의 코어를 종류의 차례, 같은 종류 안에서는 코어의 차례로 섞는다(결정 35). 이름 표가 없어지고 코어가 `typeId` 로 종류를 든다. 비용 줄은 `fromLevel` · `fragmentQuantity` · `solErdaQuantity`, 스탯은 `activationFragmentQuantity` |
| `contents` | `contentCategories` · `contents` | 아래 `컨텐츠` |
| `enhancementCosts` | `potentialResetCosts` · `soulPotentialResetCosts` · `starforceCostSteps` · `superiorSeries` · `superiorItems` | `starforceSteps` → `starforceCostSteps`, 잠재의 `minLevel` → `minRequiredLevel`, 슈페리얼 장비는 계열 줄 id(`seriesId`). 규칙은 `gameRules` 로 간다 |
| `mvpGrades` | `mvpGrades` | 배열 이름이 바뀌고 줄 id 가 붙는다. MVP 등급 기록은 기기 변환까지 등급 key 를 적는다 |
| `huntingGrounds` | `huntingRegions` · `huntingGrounds` · `huntingGroundLevels` | 지역 · 사냥터 줄 id. `force` → `requiredForce`, `mobs` → `mobQuantity`, `popular` → `isPopular`, 몬스터 레벨 줄은 `groundId` · `mobLevel` |
| `huntLoot` | `huntLootItems` | 아이템 줄 id 로 가리키고 이름 · 그림은 `items` 에서 읽는다. `kind` → `type`, 기간은 `validFrom` · `validUntil` |
| `imageCrops` | `imageCrops` | 크기 · 위치 글자 대신 숫자 셋(`widthPercent` · `positionXPercent` · `positionYPercent`)이다. 크롭은 `type` 과 그림 줄 id 로 가린다. 파티 모달 띠 크롭은 없어진다(결정 61. 지금 앱은 읽지 않는다) |
| `faqs` | `faqSheets` · `faqItems` | 문항은 묶음 줄 id(`sheetId`)를 든다. 답은 블록 배열이 아니라 글이고, 앱이 빈 줄에서 문단을 나눈다(결정 61) |
| `gameRules` | 새 칸, 줄 하나 | 규칙 아홉. 지금 `bosses` · `spendCatalog` · `enhancementCosts` 의 `rules` 를 읽는 곳이 이 칸을 읽는다(결정 65 열째 묶음) |

### 컨텐츠(동작이 바뀐다)

- 완료 조건을 앱 코드에서 컨텐츠 key 로 가르지 않고 `contents.checkType` 으로 읽는다(결정 34). 카드 · 완료 판정 함수 · 진행 링 ·
  오늘의 남은 스케줄 · 미완료 스케줄 알림이 같은 칸을 읽는다. 무릉도장은 층수가 0 보다 크면 완료로 센다. [[ADR-033]] 결정 5 의
  본문을 함께 고친다.
- `onlyWhenScheduled` · `trustRegistrationFlag` · `cumulativeScore` 가 없어진다(결정 42). 공유 컨텐츠 위젯은 공유 범위가 캐릭터가
  아니고 `checkType` 이 `count_only` · `both` 인 컨텐츠만 그린다. 최근 활동 판정은 `checkType` 이 `score` 인 컨텐츠를 세지 않는다.
- 최대 횟수는 `maxCount` 한 칸이다(결정 52). `maxCountOverride` 가 없어진다.
- 보이는 이름은 `displayName` → `name`, 공유 줄의 짧은 이름은 `shortName` 이다(결정 60). `category` → `categoryId`,
  `section` → `cycle`. 분류의 `weeklyLimit` → `weeklyMaxCount`, `hideCountTag` → `hidesCountTag`, `sharedOrder` → `sharedSortOrder`.

### 하는 차례

1. 바탕: 타입 · `sections.ts` · 계약 판 · fixture 를 새 모양으로 바꾸고, 칸마다 받는 함수(`parse`)와 그 테스트를 쓴다.
2. 칸마다 조회 모듈과 쓰는 쪽을 고친다. 다른 칸이 가리키는 칸부터 한다(아이템 · 월드 · 보스 → 드롭 · 결정석 → 가계부 기준 표 ·
   지출 목록 · 심볼 · 헥사 · 사냥터 · 사냥 전리품 → 컨텐츠 → 강화 비용 · MVP · 크롭 · FAQ · 규칙). 칸 하나가 커밋 하나이고 커밋마다
   타입 검사와 그 칸의 테스트가 통과한다.
3. 시뮬레이터에서 DB 박스 서버로 켜 잠금 화면이 받고 열리는지, 보스 · 가계부 · 스케줄 화면이 그려지는지 본다. 넥슨 로그인은 넥슨이
   `api` 콜백을 승인한 뒤에 보고, 그 전에는 API 키로 본다.
4. 이 브랜치를 develop 에 머지한다(결정 65). 서버는 2026-11-21 에 떴다.

이 일에 들지 않는 것: 기록이 줄 id 를 적게 바꾸는 기기 변환(결정 19), 동기화(결정 7 ~ 18), OTA 주소를 `api` 로 옮기는 일(#1090).

## 번들에 남는 것

게임 수치가 아니라 앱 코드와 함께 바뀌는 값이다. 서버로 옮기지 않는다.

| 파일 | 담는 것 |
|---|---|
| `src/data/job-themes.json` · `src/assets/themes/` | 테마 색 토큰과 배경. 잠금 화면도 테마로 그린다 |
| `src/data/release-notes.ts` | 업데이트 노트 |
| `src/assets/utility/` · `src/assets/nexon/` | 도구 아이콘 · 넥슨 로그인 단추 |

## 값이 기기에 반영되는 순서

1. 켤 때 `startGameData` 가 기기 사본을 읽는다. 계약 판이 `GAME_DATA_CONTRACT` 와 같고 칸 스물이 계약을 지키면 표를
   세우고 바로 연다.
2. 사본이 없거나 읽을 수 없으면 잠금 화면을 세운다. 먼저 OTA 부팅 확인(`checkOnBoot`)이 끝나기를 기다린다. 새 번들이
   계약 판을 바꾸면 먼저 받은 게임 데이터를 재시작 뒤 또 받기 때문이다. 그다음 게임 데이터를 받는다. 처음 실행(사본이
   아예 없음)이거나 받을 양이 5MB 를 넘으면 받을 크기를 보여 주고 `확인` 을 기다린다(`confirmGameData`). 확인하면 기기에
   없는 그림을 받고, 다 받으면 사본을 한 트랜잭션으로 쓰고 표를 바꾼 뒤 풀린다. 실패하면 `다시 시도` 를 기다린다.
   그림이 한 장이라도 실패하면 새 그림을 더 받지 않고, 받고 있던 그림이 끝난 뒤 실패로 남는다. 받던 그림의 진행이
   실패를 덮으면 `다시 시도` 가 사라지고 99% 에서 멈추기 때문이다([[ADR-020]] 결정 12).
3. 연 뒤에는 켤 때와 백그라운드에서 돌아올 때 사본의 ETag 로 묻는다. 304 면 아무것도 받지 않는다. 바뀌었으면 조용히 받아
   그림까지 받은 뒤 한 번에 바꾸고, 목록에서 빠진 그림 파일을 지운다. 실패하면 가진 사본을 쓴다.

## 기록이 데이터를 가리키는 방법

- 기록은 이름이 아니라 key 를 저장한다. 이름 칸에는 적을 때의 이름을 함께 둔다. 화면은 key 로 지금 이름을 찾고, 표에 없는
  key 면 저장된 이름을 보인다.
- 넥슨 API 이름은 NFC 로 맞추고 공백을 모두 지운 뒤 완전히 같은 줄로 key 를 찾는다. 못 찾으면 key 는 `null` 이다.
- 그림을 가리키는 칸(`portraitAssetId` · `iconAssetId` · `emblemAssetId` · `backgroundMapAssetId` 등)은 그림 목록(`assets` 칸)의
  id 다. 앱은 이 id 로 기기의 파일을 찾고, 경로는 보지 않는다. 서버는 쓰기 때 그림 표에 없는 그림을 거절한다. 그래서 새 보스나
  새 아이템도 관리 화면에서 그림을 먼저 올리면 앱 빌드 없이 그림까지 나온다([[ADR-187]] 결정 4).
- 서버는 옛 글자 칸(`portraitSlug` · `iconFile` · `emblem` · `backgroundMap` 등)도 함께 낸다. 스토어 1.0.13 이 읽던 칸이고, 지금
  앱은 읽지 않는다. 관리 화면의 편집 칸이 같은 값을 읽어 운영 서버에서는 그대로 두고, 1.0.15 로 옮길 때 없앤다([[ADR-187]] 결정 4).
- 앱 코드가 그림을 이름으로 직접 찾지 않는다. 붙일 표가 없는 그림은 `appImages` 칸의 key 로 찾는다. key 는 앱 코드
  (`APP_IMAGE_KEYS`)가 정하고, 표에 없는 key 면 그림 없이 선다.

## 유효 기간

결정석 가격 · 드롭 표 · 심볼 비용 · 지출 항목 · 컨텐츠 · 보스 · 보스 난이도 · 사냥 전리품 줄에 `from` · `until` 칸이 있다. 값은 KST
`YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm` 이다.

| 판정 | 쓰는 곳 |
|---|---|
| `isEffectiveIn(row, periodKey, now)`. 기간 첫날로 보고, 경계에 첫날 안의 시각이 있을 때만 시계를 본다 | 가격 고르기 · 드롭 후보와 고정 보상 표시 · 컨텐츠 목록 · 지출 타일 · 보스와 난이도 표시 |
| `isEffectiveAnytimeIn(row, periodKey)`. 그 기간 어느 때라도 유효했으면 참 | 얻을 수 없는 드롭 기록을 지우는 판정 |
| `huntLootOn(dateKey)`. 시트의 날짜가 `from` 이상이고 `until` 보다 앞이면 참. 사냥 전리품은 기간이 아니라 적는 날 하나로 가른다 | 사냥 전리품 판매 폼의 이벤트 아이템 |

값이 바뀌면 옛 줄을 지우지 않고 `until` 로 닫고 새 줄을 연다. 관리 화면에서 새 가격을 열면 지금 줄이 닫힌다.
