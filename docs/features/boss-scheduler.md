# 보스 스케줄러 (Boss Scheduler)

> **범위**: 주간/월간 보스 진행 상태, 캐릭터 추적, 파티 관리, 보스 카드·난이도 뱃지, 솔로/파티 필터, 보스 관리 페이지. 캐릭터 관리 피커·탭 토글은 [../foundation/design-system.md](../foundation/design-system.md), 수동/자동 트래킹 전역 토글은 [settings.md](./settings.md).
> **관련 소스**: `app/boss-scheduler/`(`BossScreen.tsx` — `BossCard`·`DifficultyBadge` export) · `features/boss-scheduler/` · `storage/boss-party-settings`(SQLite `boss_party_settings`) · `lib/boss-icons` · `lib/boss-matching` · `PartyManagementModal` · `/boss/manage` · `src/data/weekly-bosses.json`·`boss-crystal-prices.json`·`boss-portrait-crops.json`.
> **관련 ADR**: [[ADR-013]] [[ADR-012]] [[ADR-018]] [[ADR-019]] [[ADR-035]] [[ADR-031]] [[ADR-006]] [[ADR-053]] [[ADR-055]] [[ADR-056]] [[ADR-072]] [[ADR-073]] [[ADR-074]] [[ADR-096]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../foundation/game-data.md](../foundation/game-data.md), [boss-profit.md](./boss-profit.md).

**관리 화면 토글 저장 실패 ([[ADR-065]] 결정 4)**: 체크박스가 그 자리에 남아 맥락이 있으므로 토스트로 알린다 — 문구는 컨텐츠·보스 공통으로 "추적 목록을 저장하지 못했습니다" 하나다(같은 화면에서 무엇을 토글했는지는 사용자가 안다). 재시도 액션은 두지 않는다 — 다시 탭하면 되는 일이라 중복이다.

## 정책
- 화면 안에 **주간 탭**(`cycle: bossWeekly`) + **월간 탭**(`cycle: bossMonthly`, 현재 검은마법사 1종). **일간 탭 없음** — `bossDaily` 는 [[ADR-007]] 정책대로 계속 무시.
- **탭 선택과 솔로/파티 필터는 스토어가 소유한다**([[ADR-096]]) — `features/boss-scheduler` 의 `activeTab`·`weeklyFilter`·`monthlyFilter`. 화면 로컬 state 가 아니므로 다른 탭에 다녀와도 유지되고, 관리 페이지(`/boss/manage`)가 **진입 시점에 탭 값을 이어받아** 보던 탭 그대로 열린다(한 방향 — 관리 페이지의 탭 전환은 이 값을 바꾸지 않는다). 앱 재시작 후에는 기본값(`'weekly'`·`'all'`)으로 돌아간다(영속화하지 않음).
- 컨텐츠 스케줄러와 동일하게 "캐릭터 관리"로 고른 캐릭터만 표시하고 API 호출도 그 캐릭터로만 제한. 추적 목록 `trackedCharacters:boss` 는 컨텐츠와 **독립**(예: 컨텐츠에서 안 고른 캐릭터를 보스에서 고를 수 있음). 피커 UI는 동일 컴포넌트 공유([[ADR-015]]).
- 동기화 실패 표시도 컨텐츠 스케줄러와 **동일**([[ADR-063]]·[[ADR-083]], 정책 원문은 [content-scheduler.md](./content-scheduler.md) "동기화 실패 표시"): 전체 조회 실패도 **캐릭터별 실패(`selected.error`)도** 헤더 아래 인라인 문단이 아니라 **토스트**로 알리고, 원인별로 액션이 갈린다(`invalidApiKey` → 설정 열기 · `network` → 다시 시도 · `rateLimited`·`characterUnavailable` → 없음).
- 피커 후보 목록 로딩도 컨텐츠 스케줄러와 **동일**([[ADR-053]], 정책 원문은 [content-scheduler.md](./content-scheduler.md) "캐릭터 관리 피커 — 후보 목록 로딩"): 활성(`access_flag: true`)이 확인된 캐릭터만 표시, 표시할 캐시가 없으면 스피너 → 조회 완료 후 한 번에 목록(캐시가 있으면 기존 [[ADR-016]] 즉시 표시 + patch 유지), 조회 후 목록이 비면 "활성 캐릭터 없음"과 "조회 실패"를 구분해 안내.
- 보스 진행 상태를 Nexon API 로 동기화해 읽기 전용 표시(컨텐츠와 동일 모델·엣지·에러). `complete_flag` 그대로 표시. `weekly-bosses.json` 은 보스명·난이도 표기 매핑 참조 테이블(주간=`weekly`+`eventWeekly`, 월간=`monthly` 섹션). 미매핑은 "알 수 없는 콘텐츠".
- **주간 12마리 제한**: 캐릭터당 주간 보스 최대 12마리(난이도 조합 단위)가 게임 규칙, API `weekly_boss_clear_count`/`weekly_boss_clear_limit_count` 반영. **이 카운트는 주간 탭에서만** 표시(월간 보스는 무관). 시즌보스(메이린)는 예외라 "n/12" 에서 별도 처리(`weekly` 섹션만 분모·분자).
- 미완료 시 로컬 알림(실시간 재확인). 주간 리셋 = KST 목요일 00:00.

## 파티 관리 ([[ADR-019]])
캐릭터+보스+난이도 단위로 파티 인원을 미리 설정하는 상시 데이터(완료 여부·주차 무관). 화면 상단 "캐릭터 관리" 옆 **"보스 관리" 버튼**([[ADR-035]] 이후 두 모드 공통, 이전엔 "파티 관리")에서 편집. 저장은 `storage/` 에 `(ocid, boss, difficulty)` 유니크 키로 `boss_party_settings` upsert(1로 저장하면 솔로 취급, 별도 삭제 API 없이 1로 덮어씀). `boss_profit_records`(주차별 완료 기록)와 별도 테이블, 같은 SQLite DB. 이 값은 보스 카드 파티 배지·솔로/파티 필터·[보스 수익](./boss-profit.md) 자동 기록 기본값에 함께 쓰인다.

## UI

### 당겨서 새로고침 ([[ADR-072]] 제스처 · [[ADR-073]] 인디케이터 · [[ADR-074]] 마크, 구현 완료 2026-08-01 · 실기기 검증 보류)
목록 최상단에서 아래로 당기면 헤더 새로고침 버튼과 같은 재조회가 돈다. **헤더는 제자리에 고정되고 목록 블록만 손가락을 따라 내려가며, 벌어진 틈에 인디케이터가 뜬다**([[ADR-073]]). **인디케이터 안에는 문구 없이 단풍잎 외곽선 링 하나가 있고, 당김 구간은 진행률만큼 그려지다 손을 떼면 그대로 회전한다**([[ADR-074]]). 레시피는 [foundation/design-system.md](../foundation/design-system.md) 의 '당겨서 새로고침' 절. 이 화면의 활성 조건은 `!isEmpty`(추적 캐릭터 있음) 하나다. 이 store의 `refresh` 는 `(ocids, onProgress?)` 지만 제스처는 세 화면 공통으로 **1인자**(`refresh(trackedOcids ?? [])`)로만 호출한다([[ADR-072]] 결정 3).

### 보스 카드 ([[ADR-018]])
보스별 독립 카드 + 일러스트 bleed. 목록 감싸는 상위 카드 없음(`space-y-2` 나열). **카드 배경·보더·보스명 텍스트는 페이지 표면이 아니라 일러스트 위 배색을 따른다** — bleed·페이드·text-shadow가 어두운 배경 전제라 라이트 테마에서 페이지 토큰(`bg-surface` 등)을 쓰면 대비가 깨짐. `media-*` 토큰 + `.media-scope`([[ADR-064]] 결정 5, [theme.md](./theme.md))를 쓴다 — 카드 루트에 스코프를 걸면 안쪽은 앱 전역과 같은 레시피를 쓰면서 자동으로 어두운 기준을 따른다.
```
카드: media-scope rounded-[14px] border border-border bg-surface, height 80px, overflow-hidden, relative
     (스코프가 surface·border 를 media-* 로 다시 묶으므로 카드 안팎이 같은 레시피를 쓴다)
일러스트(있는 보스만): absolute inset-0, background-size/position = boss-portrait-crops.json(없으면 cover/center),
  블러 없음, saturate(.85) brightness(.8) opacity .65, mask-image: linear-gradient(90deg,#000 0%,#000 38%,transparent 76%)
콘텐츠 행: flex items-center justify-between, padding 0 14px(좌우 동일, 일러스트 위에 바로)
  왼쪽: 난이도 뱃지 → 보스명(text-media-ink) → 파티 배지(설정된 경우), 이름 text-shadow(shadow-color 기반)
  오른쪽: 완료 시에만 완료 배지, 미완료는 빈 공간
완료 뱃지: rounded-full bg-secondary text-on-secondary text-xs font-bold px-2.5 py-1 (테마 토큰 — 앱 전역 "완료/성공" 의미색이라 고정 안 함)
```
왼쪽 체크 도형(`StatusDot`) 제거.

**파티 배지** ([[ADR-019]]): 파티 인원 2인 이상 설정된 카드에만. 일러스트 위 카드 로컬 요소라 `.media-scope` 안 토큰을 쓴다.
```
rounded-full bg-surface-2 text-text text-xs font-semibold px-2 py-1, flex items-center gap-1  ← 스코프 안이라 media 기준
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
주간/월간 탭 행 바로 아래 한 줄. 탭 토글 pill 재사용하되 한 단계 낮은 위계라 `text-xs`. 옵션 전체/솔로/파티(순서 고정). 현재 활성 탭(주간/월간) 안에서만 적용, 두 탭의 필터 선택 상태는 독립(**탭과 함께 스토어 소유** — [[ADR-096]] 결정 1, 탭만 살리면 필터만 초기화되는 반쪽 상태가 된다). `partySizes` 맵 기반 클라이언트 필터(설정 없음=솔로 포함), API 재호출 없음. 수동 모드에서도 동일 동작([[ADR-035]]).
- **필터 결과 없음**: 공용 `EmptyState`(inline, `SlidersHorizontal`) — "이 조건에 해당하는 보스가 없습니다" + CTA **"필터 초기화"**(그 탭 필터를 `all` 로, [[ADR-060]]). 보스가 아예 0건인 빈 상태와는 다른 케이스라 문구·CTA를 나눈다.

### 빈 상태 ([[ADR-060]])
공용 `EmptyState`(inline, `Swords`). 수동 모드는 "추적할 주간/월간 보스가 없습니다" + CTA "보스 관리" → `/boss/manage`, 자동 모드는 "등록된 주간/월간 보스가 없습니다"(CTA 없음 — 목적지가 앱 밖). 주간/월간 문구를 공유하지 않는다. 레시피는 [design-system.md](../foundation/design-system.md).

### 보스 관리 페이지 `/boss/manage` ([[ADR-035]] 결정 18)
두 모드 공통 진입("보스 관리"). `PartyManagementModal` 을 완전 대체(파티원 수도 보스 단위라 추적 편집과 같은 행에 합침). 주간/월간 탭, 레이아웃·행 스타일은 컨텐츠 관리 페이지와 동일 — 헤더 캐릭터 드롭다운(`CharacterSelectDropdown size="compact"`)과 스케줄러 탭 승계도 같다([[ADR-096]] 결정 2·4). 주간에서 들어오면 주간, 월간에서 들어오면 월간이고, 여기서 탭을 바꿔도 스케줄러는 그대로다.
- **목록 구성** ([[ADR-056]], 2026-07-29): 참조표 전체가 아니라 **이 캐릭터가 고를 수 있는 것만** 나열한다. ① 미출시 보스(`status: "unreleased"`, 현재 벨로나) 제외 — 보스명이 아니라 `status` 로 거르므로 출시 시 데이터에서 그 필드만 지우면 된다. ② 시즌 보스(eventWeekly)는 **선택 캐릭터의 월드가 챌린저스(1~4)일 때만** 표시(`isChallengersWorld`, 보스 스케줄러 시즌 배지와 같은 판정). 월드 미상(구버전 캐시)이면 숨긴다. 두 모드 공통이며, 12개 한도의 시즌 보스 **카운트 제외** 규칙과는 별개다(챌린저스 월드에선 목록엔 나오고 카운트엔 안 들어간다).
- **수동 모드**: 위 규칙으로 걸러진 보스 나열(주간=weekly+시즌, 월간=monthly). 행 = 체크(추적, 탭 즉시 저장) + 체크된 행에 난이도 뱃지 목록(`boss-crystal-prices.json` 지원 난이도, 미선택 `opacity-40`)·파티 스테퍼. 난이도 변경 시 (보스,난이도) 쌍 교체.
- **자동 모드**: 같은 행 구조에서 체크박스만 없음. 상단 안내("자동 모드에서는 목록이 게임 등록 기준이에요 — 파티 인원만 설정") + "등록된 보스만 보기" 토글(기본 ON, [[ADR-031]] 결정 4). 난이도는 등록 난이도 기본 선택.
- **리디자인(2026-07-24) — 초상화 앵커 + 파티 스테퍼 상단 + 난이도 세그먼트**: 행 2줄 — 1줄 원형 `BossPortrait`(`size={44}`, `aria-hidden`) + 보스명(`flex-1 truncate`) + 파티 스테퍼(우상단 고정). 2줄(활성 시, `border-t`) 난이도 세그먼트. 선택 = 테두리·색(체크 원 없음, 미추적 `border-border bg-surface`, 추적 `border-primary bg-primary-tint`). 수동 토글은 초상화+보스명 영역이 버튼(`aria-label={보스명}`). 난이도 세그먼트: 선택은 `DifficultyBadge` 풀컬러, 미선택은 고스트 칩(`inline-flex h-5 rounded-full border border-border px-2.5 text-[10px] font-bold text-text-disabled`). 파티 스테퍼: 보더 pill 안 `Users` 아이콘 + −/값/+, 1~`getMaxPartySize(boss, difficulty)` 경계 비활성화, 탭 즉시 저장.

### 수동 선택 가드 ([[ADR-055]], 구현 완료 2026-07-29, 이슈 #62)
수동 모드 보스 관리 페이지에서 선택을 막는 사유는 **주간 12개 한도 하나뿐**이다(요구 레벨 미달 잠금은 [[ADR-055]] 정정 2로 폐기 — 아래 history). 가드의 본체는 스토어(`addManualBoss`)이고 화면은 사전 차단만 한다 — UI에서만 막으면 난이도 교체(remove → add) 같은 다른 호출 경로가 새어나간다.

**주간 12개 한도(#62)** — 게임의 주간 보스 등록 한도와 같은 규칙(`weeklyBossSelectionLimit`, `WEEKLY_BOSS_CLEAR_LIMIT`). 새 수치를 정의하지 않는다.
- **주간 탭에만** 적용. 월간 탭(검은마법사)은 한도 없음. 월간 보스도 같은 배열에 `kind: 'boss'` 로 저장되므로 `kind` 만으로 세면 안 되고 **주기로 걸러야 한다**.
- **시즌 보스(메이린) 제외** — `countClearedWeeklyBosses`([[ADR-031]] 결정 1)·`isSeasonBossName`([[ADR-054]] 결정 3)과 같은 규칙. 어긋나면 선택 `12/12` 인데 처치 `11/12` 인 모순이 생긴다. 카운트 규칙은 `lib/boss-matching` 의 `countManualWeeklyBosses` 한 곳에만 둔다(화면이 `BOSSES_BY_TAB` 으로 잃은 weekly/eventWeekly 구분은 `getBossCycleByName` 으로 되찾는다).
- **UI** ([[ADR-055]] 정정 3): 헤더 주간 탭에 `n/12` 배지(`BossScreen` 배지 스타일 재사용, 신규 스타일 금지). 한도 도달 시 **미선택 행만 흐리게**(`opacity-40`) 두고 **`disabled` 로 만들지 않는다** — 비활성 버튼은 클릭 이벤트가 나지 않아 이유를 알릴 수 없다. 누르면 스토어가 돌려준 `'limitReached'` 로 **토스트**(`주간 12개를 모두 선택했어요`)를 띄운다 — **`showInfo`**(자동 소멸 2.5초)다. 실패가 아니라 규칙 안내이고 `error` 는 자동 소멸이 없다(`duration: null`). 토스트에 `warning` 변형은 없다. 흐림은 "지금은 고를 수 없다"만 말하고, 이유는 시도한 순간에 말한다. 선택된 행은 흐리지 않는다(해제 대상이라 애초에 막을 이유가 없다).
- **초과 상태는 없다**: 미배포 앱이라 12개를 넘겨 저장한 사용자가 존재하지 않는다(결정 10). `15/12` 표시 규칙·잘라내기 로직을 만들지 않는다.

토스트는 폴백이다 — 잠긴 버튼은 클릭 이벤트가 안 나므로, 스토어가 거부한 우회 경로에서만 뜬다.

### 파티 관리 모달 — `PartyManagementModal`(레거시, `/boss/manage` 로 대체)
> 아래는 [[ADR-035]] 이전 설계. 현재 진입점은 위 보스 관리 페이지.

## 열린 질문
- 벨로나 출시 시 `weekly-bosses.json`·가격·아이템 데이터 갱신 필요.

## 폐기된 정책 (history)
- ~~탭 선택과 솔로/파티 필터는 화면 로컬 `useState`(스케줄러·관리 페이지가 각자 보유, 초기값 `'weekly'`)~~ → 기능 스토어 소유([[ADR-096]] 결정 1·2, 2026-08-05, 이슈 #143). 양쪽 기본값이 같아 컨텐츠 쪽보다 덜 드러났을 뿐 구조는 동일했다(월간 탭에서만 증상이 보였다).
- ~~관리 페이지 헤더의 대상 캐릭터는 읽기 전용 칩~~ → 컴팩트 드롭다운, 이 화면에서 캐릭터 변경 가능([[ADR-096]] 결정 4·5, 2026-08-05).
- ~~한도로 막힌 행을 `disabled` 로 두고 그 위에 스크림 + `주간 12개를 모두 선택했어요` 문구를 얹음~~ → **흐림만 + 누르면 토스트**([[ADR-055]] 정정 3, 2026-07-29 사용자 지시). 비활성 버튼은 클릭 이벤트가 나지 않아 "누르면 알려준다"와 양립할 수 없다.
- ~~레벨 미달 보스·난이도는 수동 선택 불가(흐리게 + 요구 레벨 표시), 표시 화면엔 "진행 불가"~~ → **미도입, 자유 선택**([[ADR-055]] 정정 2, 2026-07-29 사용자 결정, 이슈 #32 폐기). 요구 레벨 데이터(`requiredLevels`)는 `weekly-bosses.json` 에 남아 있으나 **읽는 코드가 없다**.
- ~~보스 전체를 하나의 카드(`<ul>`)에 담고 왼쪽 체크 도형으로 완료 표시~~ → 보스별 독립 카드 + 일러스트 bleed + 오른쪽 완료 뱃지([[ADR-018]]).
- ~~캐시가 없으면 `character/list` 응답으로 `access_flag` 미상 캐릭터까지 먼저 표시~~ → 활성 확인된 캐릭터만 표시, 콜드 스타트는 스피너([[ADR-053]], 2026-07-29).
- ~~앱 내에서 최대 12마리 선택 UI~~ → 미도입. 게임 등록 목록을 그대로 표시([[ADR-007]]) → **수동 모드 한정 재도입**([[ADR-055]], 이슈 #62). [[ADR-007]] 의 "미도입"은 게임 등록 목록을 그대로 읽는 자동 모드 전제였고, [[ADR-035]] 로 앱이 직접 선택을 보관하는 수동 모드가 생기면서 그 전제가 사라졌다 — 자동 모드는 여전히 선택 UI가 없다.
- ~~보스 초상화가 난이도별 파일~~ → 보스당 1장(webp)으로 통합, `getBossPortraitUrl(portraitSlug)` 에서 difficulty 제거([[ADR-018]]).
- ~~파티 관리 진입 = 보스 카드 안 아이콘 버튼 → 단일 보스 모달~~ → 화면 상단 버튼 + 3단 폼 모달([[ADR-019]] 재정정) → `/boss/manage` 페이지([[ADR-035]]).
- ~~파티 관리 모달 난이도 선택 = `ring-2 ring-primary` 테두리~~ → 투명도 차이만(선택 불투명, 비선택 `opacity-40`)([[ADR-019]] 정정).
- ~~보스 스케줄러 화면에서 수동 편집(카드 삭제·"보스 추가")~~ → 화면 읽기 전용, 편집은 `/boss/manage`([[ADR-035]] 결정 18).
