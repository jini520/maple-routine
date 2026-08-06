# 게임 레퍼런스 데이터 (src/data)

> **범위**: `src/data/*.json` 정적 참조 데이터의 역할·조인 방식·컨벤션. **CRITICAL — AI가 수치를 임의 추정해 채우지 않는다. 반드시 사용자(도메인 전문가) 확인 후 반영**([[ADR-006]]).
> **관련 소스**: `src/data/*.json` · `src/data/__tests__/data-consistency.test.ts` · `lib/boss-matching` · `lib/boss-icons` · `lib/item-icons`.
> **관련 ADR**: [[ADR-006]] [[ADR-007]] [[ADR-010]] [[ADR-011]] [[ADR-030]] [[ADR-055]]. **관련 문서**: [nexon-api.md](./nexon-api.md), [features/item-drop.md](../features/item-drop.md), [features/boss-profit.md](../features/boss-profit.md).

## 원칙 ([[ADR-006]])
게임 패치로 자주 바뀌는 수치를 로직과 분리해 JSON 으로 둔다. 실제 값은 사용자가 확정해 채우고, AI는 임의 하드코딩하지 않는다(부정확 위험 회피). 초기엔 placeholder 로만 동작할 수 있음을 감수.

## 조인 키
`weekly-bosses.json`·`boss-crystal-prices.json`·`item-drop-table.json` 세 파일은 **보스명(`boss`) + 난이도(`difficulty`)** 를 공통 키로 조인한다. 컨테이너 상자 파일(`boss-ring-boxes.json`·`accessory-boxes.json`)은 아이템 `name` 문자열로 `item-drop-table.json` 과 연결한다.

## 게임 데이터 파일 ([[ADR-006]] 대상 — 사용자 확인 필수)
- **`weekly-bosses.json`**: 주간 보스(24종)+이벤트 주간(1종, 메이린)+월간(1종, 검은마법사) 명단·난이도. [[ADR-007]] 이후 "앱 내 선택 UI 목록"이 아니라 "API 응답(영문·공백 표기)을 한글 표기와 매핑하는 참조 테이블". `weeklyBossSelectionLimit`(12)은 원래 `weekly_boss_clear_limit_count` 대조용이었고, [[ADR-055]](이슈 #62) 이후 **수동 모드 보스 관리 페이지의 선택 한도로도 쓰인다**(자동 모드는 여전히 게임 등록 목록 그대로라 제약 없음). `eventWeekly`(시즌보스)는 12마리 제한 예외라 "n/12" 카운터에서 `weekly` 섹션만 분모·분자에 포함. **`weeklyCrystalSaleLimit`(90)은 이름만 비슷할 뿐 단위가 다른 별개 값이다**([[ADR-054]], 2026-07-29 사용자 확정) — `weeklyBossSelectionLimit`(12)이 **캐릭터당** 주간 보스 등록/처치 한도인 반면 `weeklyCrystalSaleLimit`(90)은 **월드당** 주간 결정석 판매 한도이며, 주간 보스만 포함하고(월간 보스=검은마법사 결정석은 90에 불포함) 시즌 보스는 제외하며 안 판 결정석은 다음 주로 이월되지 않는다(매주 초기화). 두 값 모두 `lib/boss-matching`(`WEEKLY_BOSS_CLEAR_LIMIT`·`WEEKLY_CRYSTAL_SALE_LIMIT`)에서 나란히 읽는다. 벨로나 `status: "unreleased"`(참조표엔 남기되 **보스 관리 목록에서는 이 필드로 걸러 숨긴다** — [[ADR-056]] 결정 1), 카이는 시즌 종료로 제외. `portraitSlug` = `assets/bosses/{portraitSlug}.webp` 조회 키(난이도 무관), `apiAlias` = 공백 제거로 안 잡히는 예외 매핑.
- **`boss-crystal-prices.json`**: 보스×난이도 "강력한 힘의 결정" 정가(1인 기준). 실수령 = `partySizeScaling.formula`(`floor(priceMeso / partySize)`). 벨로나 `priceMeso: null`. 메이린은 결정이 아닌 황금 메소 주머니(1개=1000만) 총 가치로 채움(entry `note`). 입장 인원 상한: `partySizeScaling.defaultMaxPartySize`(6) + entry별 `maxPartySize`(예외: 스우 익스트림 2인, 최초의 대적자·찬란한 흉성·림보·발드릭스·유피테르 3인, 메이린 1인).
- **`item-drop-table.json`**: 보스×난이도 보상 전체(고정 보상/장비/소비/기타)를 원본 그대로. 버튼 노출 항목은 사용자가 선별(코드가 임의 선별 금지). 아이템 시세(`priceMeso`, [[ADR-010]])는 컨벤션만 정하고 값은 확정 시 채움. **코드가 읽는 카테고리는 `fixed`·`equipment`·`consumable` 뿐**이라 그 밖의 키는 화면에 나오지 않는다 — 원본에 있던 `scroll`(주문서 교환권 3종)은 [[ADR-070]]에서 `consumable` 로 흡수했고, `misc`("태초의 정수" 2건)는 죽은 데이터로 두기로 확정했다(사용자 확인 2026-07-31).
- **`boss-ring-boxes.json`** ([[ADR-010]], [[ADR-011]]): "OO옥의 보스 반지 상자" 5종(녹옥/홍옥/흑옥/백옥/생명의)의 레벨별·반지별 확률표. 확률은 자동 추정용이 아니라 사용자가 획득 기록 시 고를 후보 목록. 각 반지 `iconFile` = `assets/items/rings/` GMS 영문 파일명.
- **`accessory-boxes.json`** ([[ADR-010]]): "혼돈의 칠흑 장신구 상자"·"메이린의 칠흑 장신구 상자"(이름만 다르고 후보 동일) 후보 7종. 레벨 개념 없고 개별 확률 비공개라 후보 목록만(확률 `null`).
- **`item-icons.json`** ([[ADR-011]]): 일반 물욕템(반지 제외) "한글 아이템명 → `assets/items/` 파일명" 매핑. 같은 아이템이 여러 보스에 반복돼 `item-drop-table.json` 필드로 안 넣음. 확신도 높은 매칭만 반영.
- **`scheduler-content-template.json`** ([[ADR-035]] 결정 7·8): 수동 트래킹 모드에서 `schedulerCache` 에 한 번도 잡힌 적 없는 항목에 쓸 **캐릭터 무관 default 값**(일간/주간 컨텐츠 전용 — 보스는 `weekly-bosses.json` 재사용). `content_name` 은 실제 Nexon 응답과 정확히 일치해야 매칭된다. 새 컨텐츠가 게임에 추가되면 이 파일부터 갱신([[ADR-006]] 절차). 요구 레벨 필드(`requiredLevel`)는 값만 채워져 있고 **읽는 코드가 없다**([[ADR-055]] 정정 2) — 아래 "데이터 확정 현황".
- **`scheduler-content-catalog.json`** ([[ADR-030]]): character 범위(기본값)가 아닌 예외만 등록 — `worldShared`/`accountShared` 배열(`{ name, section }`), `maxCountOverrides`(`{ 항목명: 고정값 }`). `section` 은 daily/weekly 어디서 오는지(빈 응답 stale 시 원장 복원용). `maxCountOverrides` 는 API 알려진 오류 필드 덮어쓰기 전용. 조회는 `lib/scheduler-content-scope.ts`. [[ADR-006]] 취지 준용.
- **`valuable-drops.json`** ([[ADR-038]], [[ADR-040]]): 고가 아이템 리스트(칠흑·광휘 세트 + 연마석 2종 + 칠흑 장신구 상자 + 익셉셔널 해머). 세트명+개별명 기준으로 수정 용이. `isValuableDrop` 판정·고가 드롭 강조 연출에 사용.
- **`world-emblems.json`** ([[ADR-006]]): 한글 월드명 → 엠블럼 파일 basename. 챌린저스1~4 모두 `challengers`.

## UI 표시 전용 설정 파일 ([[ADR-006]] 대상 아님 — 게임 수치 아님)
게임 밸런스/수치가 아니라 화면 크롭 파라미터이므로 사용자가 이미지 넣을 때마다 직접 조정(디버그 프리뷰에서 값 복사).
- **`boss-portrait-crops.json`** ([[ADR-018]]): 보스 스케줄러 새 보스 카드 bleed 일러스트의 `portraitSlug → { size, position }`(CSS background-size/position). 매핑 없으면 cover/center. 값 조정은 전용 디버그 화면에서 눈으로 맞췄고, 그 화면은 조정을 마치고 삭제했다([[ADR-092]] — 다시 만질 일이 생기면 복원 선행). 주간 콘텐츠 카드 배경(에픽 던전 3종·길드 지하수로)도 이 파일 재사용([[ADR-021]]).
- **`boss-portrait-icon-crops.json`** (2026-07-14): `BossPortrait`(원형 아이콘, 보스 수익 화면)의 크롭. 형식은 위와 동일하나 값은 공유하지 않는 별도 파일(원형/사각형은 이상적 크롭이 다름). 조정 화면은 [[ADR-092]] 에서 삭제.
- **`daily-quest-regions.json`** ([[ADR-020]]): 일일퀘스트 카드 "지역명 → 배경 슬러그". 매칭은 접두어 제거 후 공백 제거 표시명이 지역명으로 `startsWith`.
- **`daily-quest-region-crops.json`** ([[ADR-020]]): 지역 슬러그 → `{ size, position }`. 조정 화면은 [[ADR-092]] 에서 삭제. 길드 미션 포인트(`hallOfHeroes`)·플래그 레이스(`flagRace`, jpg)도 추가([[ADR-021]]).
- **`weekly-regional-quests.json`** ([[ADR-021]]): 주간 지역 콘텐츠(에르다 스펙트럼 등 6종) "콘텐츠명 → 배경 슬러그". 콘텐츠명에 지역명이 없어 `startsWith` 아닌 정확 일치. 슬러그·에셋은 `daily-quest-regions.json` 재사용(신규 에셋 없음).
- **`job-themes.json`** ([[ADR-009]], [[ADR-064]], [[ADR-104]]): 테마별 38토큰 컬러 + `mode` + 선택 `background` + **`category`**(기본/직업/보스 — 소속은 게임 도메인이라 사용자 확인으로 정한다) → [features/theme.md](../features/theme.md).

## 데이터 확정 현황
- 세 게임 데이터 파일 반영 완료. 가격 갱신일: 주간/이벤트 주간 `2026-06-25`, 월간(검은마법사) `2026-07-01`. 힐라(하드)·핑크빈(카오스) 일간 격하로 제거, 벨로나 미출시 보류, 카이 시즌 종료 제외.
- 보스 반지 상자 5종·칠흑 장신구 상자 후보 반영 완료(2026-07-09).
- `weekly-bosses.json` `weeklyCrystalSaleLimit: 90`(**월드당** 주당 결정석 판매 한도) 반영 완료 — 2026-07-29 사용자 확정([[ADR-054]], 이슈 #53). 값·포함 범위(주간 보스만·시즌 보스 제외·이월 없음) 모두 사용자 확인분이며 AI 추정 없음.
- **보스 요구 레벨(`weekly-bosses.json` → `requiredLevels`) 반영 완료 — 단 현재 이 필드를 읽는 코드는 없다**([[ADR-055]] 정정 2로 요구 레벨 잠금 폐기, 이슈 #32). 값은 2026-07-29 사용자 확정분이라 그대로 보존하고 정합성 테스트도 유지한다 — 다시 쓸 일이 생기면 데이터는 이미 있다. 26엔트리 56쌍 전부 채움(미출시 벨로나 포함). **메이린을 뺀 모든 보스는 난이도가 달라도 입장 레벨이 같다**(사용자 확인) — 그래도 스키마는 난이도별 맵을 유지한다(게임이 난이도별로 가를 수 있는 값이고, 실제로 메이린이 그렇다: 노멀 270 / 하드 280). 키는 그 엔트리 `difficulties` 와 완전히 일치한다.
- **컨텐츠 요구 레벨(`scheduler-content-template.json` → `requiredLevel`) 반영 완료 — 마찬가지로 현재 읽는 코드 없음**([[ADR-055]] 정정 2). 2026-07-29 사용자 확정. 40엔트리 중 **35개에 값**, 5개는 **레벨 제한 없음이라 필드 생략**(메이플 유니온 주간 드래곤 퇴치 2종 · 길드 3종). 확정 과정에서 사용자가 판정한 두 건: (1) 아케인리버 주간 콘텐츠 6종은 **같은 지역 일일퀘와 동일 레벨**(에르다 스펙트럼 200 · 배고픈 무토 210 · 미드나잇 체이서 220 · 스피릿 세이비어 225 · 엔하임 디펜스 230 · 프로텍트 에스페라 235), (2) 보상 수령 성격의 "…에 대한 보답" 3종은 **소속 콘텐츠 레벨을 따른다**(성실한 조사→아케인리버 최저 200 · 타락한 세계수 정화→190 · 꾸준한 의뢰→헤이븐 190).

## 열린 질문 (미확정 수치)
- 찬란한 흉성(하드)·유피테르(노멀/하드)의 솔 에르다의 기운 수량이 `(추정)` 표기 — 실제 수치 확정 필요. 확정 전까지 UI에도 추정 표시 유지.
- 파풀라투스(카오스) 드랍이 equipment 1건뿐 — 실제로 이것만 존재하는지/누락인지 확인 필요.
- 물욕템(반지·장신구 포함) 개별 시세 전무([[ADR-010]]). 개봉 결과 개별 반지/장신구 거래 가능 여부(박스 자체는 교환 불가 확인).
- 결정 시세의 시점별 이력화 필요 여부([[ADR-023]]) — 게임 패치로 시세 조정 시 과거 백필 위해 "언제부터 이 가격" 이력 관리가 필요할 수 있음. 실제 필요 여부·과거 값 확보 방법 미정 → [features/boss-profit.md](../features/boss-profit.md).

## 폐기된 정책 (history)
- ~~보스별 상세 정보 쪽 금액을 가격 소스로 사용~~ → 사용자 지정 시세표 값 채택([[ADR-006]]).
- ~~황금 메소 주머니를 `item-drop-table.json` 항목으로 보유~~ → 메이린 가격을 `boss-crystal-prices.json` 에 총 가치로 반영하고 드랍 테이블 항목은 제거(2026-07-09).
- ~~데미안(노멀·하드) 드랍에 "루인 포스실드"~~ → 사용자 지시로 제거(2026-07-31). `item-icons.json` 매핑과 1×1 플레이스홀더 파일(`ruin_force_shield.png`)도 함께 제거 — 매핑이 남으면 "매핑된 아이템명은 드랍 테이블에 존재한다" 정합성 테스트가 깨진다. 되살아나지 않도록 황금 메소 주머니와 같은 부재 테스트를 둔다. **이 아이템은 장비 타일로 노출된 적이 있어** 교환권 3종([[ADR-070]] 결정 5)과 달리 과거 기록이 남아 있을 수 있다 — 그 기록은 난이도 확정 시 `pruneUnobtainableDrops` 로 삭제된다([[ADR-069]] 결정 4).
- ~~유피테르(하드) "오만의 원죄" 장비 슬롯 "미상"~~ → 아이콘 매칭 과정에서 "얼굴장식"으로 확정([[ADR-011]]).
