# 보스 스케줄러 (Boss Scheduler)

> **범위**: 주간/월간 보스 진행 상태, 캐릭터 추적, 파티 관리, 보스 카드·난이도 뱃지, 솔로/파티 필터, 보스 관리 페이지. 캐릭터 관리 피커·탭 토글은 [../foundation/design-system.md](../foundation/design-system.md), 수동/자동 트래킹 전역 토글은 [settings.md](./settings.md).
> **관련 소스**: `app/boss-scheduler/`(`BossScreen.tsx` — `BossCard`·`DifficultyBadge` export) · `features/boss-scheduler/` · `storage/boss-party-settings`(SQLite `boss_party_settings`) · `lib/boss-icons` · `lib/boss-matching` · `PartyManagementModal` · `/boss/manage` · `src/data/weekly-bosses.json`·`boss-crystal-prices.json`·`boss-portrait-crops.json`.
> **관련 ADR**: [[ADR-013]] [[ADR-012]] [[ADR-018]] [[ADR-019]] [[ADR-035]] [[ADR-031]] [[ADR-006]] [[ADR-053]] [[ADR-055]] [[ADR-056]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../foundation/game-data.md](../foundation/game-data.md), [boss-profit.md](./boss-profit.md).

## 정책
- 화면 안에 **주간 탭**(`cycle: bossWeekly`) + **월간 탭**(`cycle: bossMonthly`, 현재 검은마법사 1종). **일간 탭 없음** — `bossDaily` 는 [[ADR-007]] 정책대로 계속 무시.
- 컨텐츠 스케줄러와 동일하게 "캐릭터 관리"로 고른 캐릭터만 표시하고 API 호출도 그 캐릭터로만 제한. 추적 목록 `trackedCharacters:boss` 는 컨텐츠와 **독립**(예: 컨텐츠에서 안 고른 캐릭터를 보스에서 고를 수 있음). 피커 UI는 동일 컴포넌트 공유([[ADR-015]]).
- 피커 후보 목록 로딩도 컨텐츠 스케줄러와 **동일**([[ADR-053]], 정책 원문은 [content-scheduler.md](./content-scheduler.md) "캐릭터 관리 피커 — 후보 목록 로딩"): 활성(`access_flag: true`)이 확인된 캐릭터만 표시, 표시할 캐시가 없으면 스피너 → 조회 완료 후 한 번에 목록(캐시가 있으면 기존 [[ADR-016]] 즉시 표시 + patch 유지), 조회 후 목록이 비면 "활성 캐릭터 없음"과 "조회 실패"를 구분해 안내.
- 보스 진행 상태를 Nexon API 로 동기화해 읽기 전용 표시(컨텐츠와 동일 모델·엣지·에러). `complete_flag` 그대로 표시. `weekly-bosses.json` 은 보스명·난이도 표기 매핑 참조 테이블(주간=`weekly`+`eventWeekly`, 월간=`monthly` 섹션). 미매핑은 "알 수 없는 콘텐츠".
- **주간 12마리 제한**: 캐릭터당 주간 보스 최대 12마리(난이도 조합 단위)가 게임 규칙, API `weekly_boss_clear_count`/`weekly_boss_clear_limit_count` 반영. **이 카운트는 주간 탭에서만** 표시(월간 보스는 무관). 시즌보스(메이린)는 예외라 "n/12" 에서 별도 처리(`weekly` 섹션만 분모·분자).
- 미완료 시 로컬 알림(실시간 재확인). 주간 리셋 = KST 목요일 00:00.

## 파티 관리 ([[ADR-019]])
캐릭터+보스+난이도 단위로 파티 인원을 미리 설정하는 상시 데이터(완료 여부·주차 무관). 화면 상단 "캐릭터 관리" 옆 **"보스 관리" 버튼**([[ADR-035]] 이후 두 모드 공통, 이전엔 "파티 관리")에서 편집. 저장은 `storage/` 에 `(ocid, boss, difficulty)` 유니크 키로 `boss_party_settings` upsert(1로 저장하면 솔로 취급, 별도 삭제 API 없이 1로 덮어씀). `boss_profit_records`(주차별 완료 기록)와 별도 테이블, 같은 SQLite DB. 이 값은 보스 카드 파티 배지·솔로/파티 필터·[보스 수익](./boss-profit.md) 자동 기록 기본값에 함께 쓰인다.

## UI

### 보스 카드 ([[ADR-018]])
보스별 독립 카드 + 일러스트 bleed. 목록 감싸는 상위 카드 없음(`space-y-2` 나열). **카드 배경·보더·보스명 텍스트만 앱 테마와 무관하게 레테(다크) 고정** — bleed·페이드·text-shadow가 어두운 배경 전제라 렌(라이트)에서 테마 토큰을 쓰면 대비가 깨짐. 각각 `#1A1720`/`#37323E`/`#E8DFEC` 리터럴.
```
카드: rounded-[14px] border border-[#37323E] bg-[#1A1720](레테 고정), height 80px, overflow-hidden, relative
일러스트(있는 보스만): absolute inset-0, background-size/position = boss-portrait-crops.json(없으면 cover/center),
  블러 없음, saturate(.85) brightness(.8) opacity .65, mask-image: linear-gradient(90deg,#000 0%,#000 38%,transparent 76%)
콘텐츠 행: flex items-center justify-between, padding 0 14px(좌우 동일, 일러스트 위에 바로)
  왼쪽: 난이도 뱃지 → 보스명 → 파티 배지(설정된 경우), 이름 text-shadow(0 1px 3px rgba(0,0,0,.9),0 0 10px rgba(0,0,0,.6))
  오른쪽: 완료 시에만 완료 배지, 미완료는 빈 공간
완료 뱃지: rounded-full bg-secondary text-bg text-xs font-bold px-2.5 py-1 (테마 토큰 — 앱 전역 "완료/성공" 의미색이라 고정 안 함)
```
왼쪽 체크 도형(`StatusDot`) 제거.

**파티 배지** ([[ADR-019]]): 파티 인원 2인 이상 설정된 카드에만. 일러스트 위 카드 로컬 요소라 레테 고정 리터럴.
```
rounded-full bg-white/20 text-[#E8DFEC] text-xs font-semibold px-2 py-1, flex items-center gap-1
아이콘: lucide Users(size 12, strokeWidth 2), 텍스트 "n인"
```
미설정/1인(솔로)이면 렌더 안 함(별도 "솔로" 뱃지 없음, 빈 공간으로 표현).

### 난이도 뱃지 — `DifficultyBadge`(`BossScreen.tsx` export)
게임 UI 난이도 뱃지 시각 언어(글로시 캡슐형). 게임 스크린샷 픽셀 추출 근사값:
```
공통: rounded-full, height 20px, padding 0 10px, font-size 10px, font-weight 800, letter-spacing .03em
이지    linear-gradient(180deg,#aab4bc,#7d8891) border #67717a  color #f5f6f7
노멀    linear-gradient(180deg,#5cc2dd,#2b93b0) border #1f7690  color #ffffff
하드    linear-gradient(180deg,#e784a6,#c04b74) border #9c3a5c  color #ffffff
카오스  linear-gradient(180deg,#3c3c3c,#221f1f) border #caa87f  color #f0d8b8
익스트림 linear-gradient(180deg,#3c3c3c,#1c1414) border(1.5px) #ef5d78 color #f4794f
```
파티 관리 모달·보스 관리 페이지에서 그대로 재사용(새 뱃지 스타일 신설 금지).

### 솔로/파티 서브 필터 ([[ADR-019]])
주간/월간 탭 행 바로 아래 한 줄. 탭 토글 pill 재사용하되 한 단계 낮은 위계라 `text-xs`. 옵션 전체/솔로/파티(순서 고정). 현재 활성 탭(주간/월간) 안에서만 적용, 두 탭의 필터 선택 상태는 독립. `partySizes` 맵 기반 클라이언트 필터(설정 없음=솔로 포함), API 재호출 없음. 수동 모드에서도 동일 동작([[ADR-035]]).

### 보스 관리 페이지 `/boss/manage` ([[ADR-035]] 결정 18)
두 모드 공통 진입("보스 관리"). `PartyManagementModal` 을 완전 대체(파티원 수도 보스 단위라 추적 편집과 같은 행에 합침). 주간/월간 탭, 레이아웃·행 스타일은 컨텐츠 관리 페이지와 동일.
- **목록 구성** ([[ADR-056]], 2026-07-29): 참조표 전체가 아니라 **이 캐릭터가 고를 수 있는 것만** 나열한다. ① 미출시 보스(`status: "unreleased"`, 현재 벨로나) 제외 — 보스명이 아니라 `status` 로 거르므로 출시 시 데이터에서 그 필드만 지우면 된다. ② 시즌 보스(eventWeekly)는 **선택 캐릭터의 월드가 챌린저스(1~4)일 때만** 표시(`isChallengersWorld`, 보스 스케줄러 시즌 배지와 같은 판정). 월드 미상(구버전 캐시)이면 숨긴다. 두 모드 공통이며, 12개 한도의 시즌 보스 **카운트 제외** 규칙과는 별개다(챌린저스 월드에선 목록엔 나오고 카운트엔 안 들어간다).
- **수동 모드**: 위 규칙으로 걸러진 보스 나열(주간=weekly+시즌, 월간=monthly). 행 = 체크(추적, 탭 즉시 저장) + 체크된 행에 난이도 뱃지 목록(`boss-crystal-prices.json` 지원 난이도, 미선택 `opacity-40`)·파티 스테퍼. 난이도 변경 시 (보스,난이도) 쌍 교체.
- **자동 모드**: 같은 행 구조에서 체크박스만 없음. 상단 안내("자동 모드에서는 목록이 게임 등록 기준이에요 — 파티 인원만 설정") + "등록된 보스만 보기" 토글(기본 ON, [[ADR-031]] 결정 4). 난이도는 등록 난이도 기본 선택.
- **리디자인(2026-07-24) — 초상화 앵커 + 파티 스테퍼 상단 + 난이도 세그먼트**: 행 2줄 — 1줄 원형 `BossPortrait`(`size={44}`, `aria-hidden`) + 보스명(`flex-1 truncate`) + 파티 스테퍼(우상단 고정). 2줄(활성 시, `border-t`) 난이도 세그먼트. 선택 = 테두리·색(체크 원 없음, 미추적 `border-border bg-surface`, 추적 `border-primary bg-primary/15`). 수동 토글은 초상화+보스명 영역이 버튼(`aria-label={보스명}`). 난이도 세그먼트: 선택은 `DifficultyBadge` 풀컬러, 미선택은 고스트 칩(`inline-flex h-5 rounded-full border border-border px-2.5 text-[10px] font-bold text-text-disabled`). 파티 스테퍼: 보더 pill 안 `Users` 아이콘 + −/값/+, 1~`getMaxPartySize(boss, difficulty)` 경계 비활성화, 탭 즉시 저장.

### 수동 선택 가드 ([[ADR-055]], 구현 완료 2026-07-29, 이슈 #62·#32)
수동 모드 보스 관리 페이지에서 항목을 선택할 수 없는 사유는 두 가지이고, **한 모델로 다룬다**(`levelLocked` > `limitReached` 우선순위 — 사용자가 이 화면에서 풀 수 없는 이유를 먼저 알린다). 가드의 본체는 스토어(`addManualBoss`)이고 화면은 사전 차단만 한다 — UI에서만 막으면 난이도 교체(remove → add) 같은 다른 호출 경로가 새어나간다.

**주간 12개 한도(#62)** — 게임의 주간 보스 등록 한도와 같은 규칙(`weeklyBossSelectionLimit`, `WEEKLY_BOSS_CLEAR_LIMIT`). 새 수치를 정의하지 않는다.
- **주간 탭에만** 적용. 월간 탭(검은마법사)은 한도 없음. 월간 보스도 같은 배열에 `kind: 'boss'` 로 저장되므로 `kind` 만으로 세면 안 되고 **주기로 걸러야 한다**.
- **시즌 보스(메이린) 제외** — `countClearedWeeklyBosses`([[ADR-031]] 결정 1)·`isSeasonBossName`([[ADR-054]] 결정 3)과 같은 규칙. 어긋나면 선택 `12/12` 인데 처치 `11/12` 인 모순이 생긴다. 카운트 규칙은 `lib/boss-matching` 의 `countManualWeeklyBosses` 한 곳에만 둔다(화면이 `BOSSES_BY_TAB` 으로 잃은 weekly/eventWeekly 구분은 `getBossCycleByName` 으로 되찾는다).
- **UI**: 헤더 주간 탭에 `n/12` 배지(`BossScreen` 배지 스타일 재사용, 신규 스타일 금지) + 한도 도달 시 **미선택 행만** `disabled`(선택된 행은 해제할 수 있어야 하므로 계속 활성).
- **초과 상태는 없다**: 미배포 앱이라 12개를 넘겨 저장한 사용자가 존재하지 않는다(결정 10). `15/12` 표시 규칙·잘라내기 로직을 만들지 않는다.

**요구 레벨 미달(#32)** — 캐릭터 레벨 < 요구 레벨이면 선택 불가. 요구 레벨은 `weekly-bosses.json` 의 `requiredLevels`(**난이도별 맵**)이며 값은 사용자 확정분만([[ADR-006]], 2026-07-29 전량 반영).
- **잠금 단위는 난이도 칩**이다. 같은 보스라도 익스트림만 잠길 수 있으므로 잠긴 난이도 칩만 `disabled` 로 두고, **모든 난이도가 잠긴 보스만** 행 전체를 잠근다. `defaultDifficultyFor` 도 선택 **가능한** 난이도 중에서 고른다(그러지 않으면 눌러도 아무 일 없는 행이 된다).
- **난이도 칩 잠금은 수동 모드에서만.** 자동 모드의 난이도 선택은 멤버십이 아니라 파티 인원 편집 대상 선택이라, 막으면 진행 불가 보스의 파티 인원 사전 설정([[ADR-031]] 결정 4)이 막힌다.
- **이미 선택된 행은 사유와 무관하게 잠그지 않는다** — 해제할 수 있어야 한다(한도·레벨 공통).
- 난이도 교체(`handleSwitchDifficulty`)는 `remove` → `add` 순서라 add가 거부되면 항목이 사라진다 — 그래서 **지우기 전에** 레벨 잠금을 먼저 확인한다.
- **모르면 잠그지 않는다**: 요구 레벨 데이터가 없거나 캐릭터 레벨 캐시가 없으면 통과(결정 5). 데이터가 채워지는 엔트리부터 잠금이 켜진다.
- **캐릭터 레벨 출처**: `BossCharacterView.level`(`sortByCachedLevel` 이 이미 읽는 캐시값을 보존, 결정 6).
- **UI**: 잠긴 항목은 dim + 기존 고스트 칩에 `Lv.{요구레벨}`(관리 화면에서는 "몇 레벨이면 되는지"가 실행 가능한 정보). 보스 카드 표시 화면에서는 dim + `진행 불가` 칩이고, 잠긴 추적 항목을 **자동으로 제거하지 않는다**(결정 9).

토스트는 폴백이다 — 잠긴 버튼은 클릭 이벤트가 안 나므로, 스토어가 거부한 우회 경로에서만 뜬다.

### 파티 관리 모달 — `PartyManagementModal`(레거시, `/boss/manage` 로 대체)
> 아래는 [[ADR-035]] 이전 설계. 현재 진입점은 위 보스 관리 페이지.

## 열린 질문
- 벨로나 출시 시 `weekly-bosses.json`·가격·아이템 데이터 갱신 필요.

## 폐기된 정책 (history)
- ~~보스 전체를 하나의 카드(`<ul>`)에 담고 왼쪽 체크 도형으로 완료 표시~~ → 보스별 독립 카드 + 일러스트 bleed + 오른쪽 완료 뱃지([[ADR-018]]).
- ~~캐시가 없으면 `character/list` 응답으로 `access_flag` 미상 캐릭터까지 먼저 표시~~ → 활성 확인된 캐릭터만 표시, 콜드 스타트는 스피너([[ADR-053]], 2026-07-29).
- ~~앱 내에서 최대 12마리 선택 UI~~ → 미도입. 게임 등록 목록을 그대로 표시([[ADR-007]]) → **수동 모드 한정 재도입**([[ADR-055]], 이슈 #62). [[ADR-007]] 의 "미도입"은 게임 등록 목록을 그대로 읽는 자동 모드 전제였고, [[ADR-035]] 로 앱이 직접 선택을 보관하는 수동 모드가 생기면서 그 전제가 사라졌다 — 자동 모드는 여전히 선택 UI가 없다.
- ~~보스 초상화가 난이도별 파일~~ → 보스당 1장(webp)으로 통합, `getBossPortraitUrl(portraitSlug)` 에서 difficulty 제거([[ADR-018]]).
- ~~파티 관리 진입 = 보스 카드 안 아이콘 버튼 → 단일 보스 모달~~ → 화면 상단 버튼 + 3단 폼 모달([[ADR-019]] 재정정) → `/boss/manage` 페이지([[ADR-035]]).
- ~~파티 관리 모달 난이도 선택 = `ring-2 ring-primary` 테두리~~ → 투명도 차이만(선택 불투명, 비선택 `opacity-40`)([[ADR-019]] 정정).
- ~~보스 스케줄러 화면에서 수동 편집(카드 삭제·"보스 추가")~~ → 화면 읽기 전용, 편집은 `/boss/manage`([[ADR-035]] 결정 18).
