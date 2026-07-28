# 보스 스케줄러 (Boss Scheduler)

> **범위**: 주간/월간 보스 진행 상태, 캐릭터 추적, 파티 관리, 보스 카드·난이도 뱃지, 솔로/파티 필터, 보스 관리 페이지. 캐릭터 관리 피커·탭 토글은 [../foundation/design-system.md](../foundation/design-system.md), 수동/자동 트래킹 전역 토글은 [settings.md](./settings.md).
> **관련 소스**: `app/boss-scheduler/`(`BossScreen.tsx` — `BossCard`·`DifficultyBadge` export) · `features/boss-scheduler/` · `storage/boss-party-settings`(SQLite `boss_party_settings`) · `lib/boss-icons` · `lib/boss-matching` · `PartyManagementModal` · `/boss/manage` · `src/data/weekly-bosses.json`·`boss-crystal-prices.json`·`boss-portrait-crops.json`.
> **관련 ADR**: [[ADR-013]] [[ADR-012]] [[ADR-018]] [[ADR-019]] [[ADR-035]] [[ADR-031]] [[ADR-006]] [[ADR-053]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../foundation/game-data.md](../foundation/game-data.md), [boss-profit.md](./boss-profit.md).

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
- **수동 모드**: `weekly-bosses.json` 전체 보스(주간=weekly+eventWeekly, 월간=monthly) 나열. 행 = 체크(추적, 탭 즉시 저장) + 체크된 행에 난이도 뱃지 목록(`boss-crystal-prices.json` 지원 난이도, 미선택 `opacity-40`)·파티 스테퍼. 난이도 변경 시 (보스,난이도) 쌍 교체.
- **자동 모드**: 같은 행 구조에서 체크박스만 없음. 상단 안내("자동 모드에서는 목록이 게임 등록 기준이에요 — 파티 인원만 설정") + "등록된 보스만 보기" 토글(기본 ON, [[ADR-031]] 결정 4). 난이도는 등록 난이도 기본 선택.
- **리디자인(2026-07-24) — 초상화 앵커 + 파티 스테퍼 상단 + 난이도 세그먼트**: 행 2줄 — 1줄 원형 `BossPortrait`(`size={44}`, `aria-hidden`) + 보스명(`flex-1 truncate`) + 파티 스테퍼(우상단 고정). 2줄(활성 시, `border-t`) 난이도 세그먼트. 선택 = 테두리·색(체크 원 없음, 미추적 `border-border bg-surface`, 추적 `border-primary bg-primary/15`). 수동 토글은 초상화+보스명 영역이 버튼(`aria-label={보스명}`). 난이도 세그먼트: 선택은 `DifficultyBadge` 풀컬러, 미선택은 고스트 칩(`inline-flex h-5 rounded-full border border-border px-2.5 text-[10px] font-bold text-text-disabled`). 파티 스테퍼: 보더 pill 안 `Users` 아이콘 + −/값/+, 1~`getMaxPartySize(boss, difficulty)` 경계 비활성화, 탭 즉시 저장.

### 파티 관리 모달 — `PartyManagementModal`(레거시, `/boss/manage` 로 대체)
> 아래는 [[ADR-035]] 이전 설계. 현재 진입점은 위 보스 관리 페이지.

## 열린 질문
- 벨로나 출시 시 `weekly-bosses.json`·가격·아이템 데이터 갱신 필요.

## 폐기된 정책 (history)
- ~~보스 전체를 하나의 카드(`<ul>`)에 담고 왼쪽 체크 도형으로 완료 표시~~ → 보스별 독립 카드 + 일러스트 bleed + 오른쪽 완료 뱃지([[ADR-018]]).
- ~~캐시가 없으면 `character/list` 응답으로 `access_flag` 미상 캐릭터까지 먼저 표시~~ → 활성 확인된 캐릭터만 표시, 콜드 스타트는 스피너([[ADR-053]], 2026-07-29).
- ~~앱 내에서 최대 12마리 선택 UI~~ → 미도입. 게임 등록 목록을 그대로 표시([[ADR-007]]).
- ~~보스 초상화가 난이도별 파일~~ → 보스당 1장(webp)으로 통합, `getBossPortraitUrl(portraitSlug)` 에서 difficulty 제거([[ADR-018]]).
- ~~파티 관리 진입 = 보스 카드 안 아이콘 버튼 → 단일 보스 모달~~ → 화면 상단 버튼 + 3단 폼 모달([[ADR-019]] 재정정) → `/boss/manage` 페이지([[ADR-035]]).
- ~~파티 관리 모달 난이도 선택 = `ring-2 ring-primary` 테두리~~ → 투명도 차이만(선택 불투명, 비선택 `opacity-40`)([[ADR-019]] 정정).
- ~~보스 스케줄러 화면에서 수동 편집(카드 삭제·"보스 추가")~~ → 화면 읽기 전용, 편집은 `/boss/manage`([[ADR-035]] 결정 18).
