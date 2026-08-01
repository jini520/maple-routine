# 컨텐츠 스케줄러 (Content Scheduler)

> **범위**: 일간/주간 콘텐츠 진행 상태 표시, 캐릭터 추적, 3단 캐시 병합, 콘텐츠 카드(일일퀘스트·몬스터파크·주간 콘텐츠), 컨텐츠 관리 페이지. 캐릭터 관리 피커 컴포넌트는 [../foundation/design-system.md](../foundation/design-system.md), 수동/자동 트래킹 모드 전역 토글은 [settings.md](./settings.md).
> **관련 소스**: `app/content-scheduler/`(`ContentScreen.tsx`) · `features/content-scheduler/` · `lib/scheduler-merge` · `lib/scheduler-content-scope` · `lib/content-category` · `lib/daily-quest-backgrounds` · `storage/scheduler-cache` · `storage/shared-progress-cache` · `src/data/scheduler-content-catalog.json`·`daily-quest-regions.json`·`daily-quest-region-crops.json`·`weekly-regional-quests.json`·`scheduler-content-template.json` · `/content/manage`.
> **관련 ADR**: [[ADR-013]] [[ADR-012]] [[ADR-030]] [[ADR-020]] [[ADR-021]] [[ADR-035]] [[ADR-018]] [[ADR-053]] [[ADR-057]] [[ADR-072]] [[ADR-073]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../foundation/error-resilience.md](../foundation/error-resilience.md).

## 정책
- 화면 안에 **일간 탭**(`daily_contents`) + **주간 탭**(`weekly_contents`). **월간 탭 없음**(월간 주기 일반 콘텐츠가 API에 없음).
- 사용자가 "캐릭터 관리"에서 고른 캐릭터만 표시(저장해야 확정, 미선택이면 "캐릭터를 선택해주세요" 빈 상태). 추적 목록 `trackedCharacters:content` 는 보스 스케줄러와 **독립**. Nexon 스케줄 API 호출도 추적 캐릭터로만 제한([[ADR-012]]·[[ADR-013]]).
- 캐릭터별 진행 상태를 Nexon Open API 로 동기화해 **읽기 전용** 표시(앱 내 수동 체크는 자동 모드엔 없음). 표시 항목은 게임 스케줄러에 실제 등록된 것만(`registration_flag: "true"`). 진행률은 `now_count`/`max_count` 그대로(예: 몬스터파크 7/14).
- 지정 시각까지 미완료 시 로컬 알림(알림 시각에 실시간 재확인, [[ADR-004]]). 알림 시각은 설정 가능.
- 빈 상태·에러 상태 처리는 [../foundation/error-resilience.md](../foundation/error-resilience.md).

## 동기화 실패 표시 ([[ADR-063]], 구현 완료 2026-07-30)
전체 조회 실패(`status === 'error'`)는 **토스트**로 알린다 — 헤더 아래 인라인 문단(`text-sm text-error`)은 걷어냈다. 지속 상태는 새로고침 옆 "n분 전"(`formatSyncedAt`)이 이미 담당하므로 인라인 문단은 실패 사실만 중복해 말하고 있었고, 거기에는 버튼을 붙일 자리가 없었다.
- 원인별 액션: `invalidApiKey` → **설정 열기**(재시도로 안 풀린다) · `network` → **다시 시도**(`refresh`) · `rateLimited` → **없음**(지금 누르면 또 429).
- 스토어는 `catch` 에서 잡은 에러를 `toScheduleSyncError` 로 통과시킨다 — 전에는 `{ kind: 'network' }` 하드코딩이라 401/429가 화면에 도달할 경로가 없었다.
- 공용 훅 `useScheduleSyncErrorToast`(`features/schedule-sync/use-sync-error-toast.ts`). 스토어가 아니라 화면에서 띄우는 이유는 `설정 열기` 가 라우터를 필요로 하기 때문([[ADR-050]] — 스토어에서 `window.location` 이동은 리로드를 유발해 SQLite 커넥션을 stale하게 만든다).
- 캐릭터 단위 실패(`selected.error`)의 stale 배너는 이 범위 밖이다(이슈 #78 B).

## 캐릭터 관리 피커 — 후보 목록 로딩 ([[ADR-053]], 구현 완료 2026-07-29)
`getCharacterPickerRoster`(`features/schedule-sync`)가 `onUpdate` 로 흘리는 후보 목록의 정책. 보스 스케줄러([boss-scheduler.md](./boss-scheduler.md))·온보딩 캐릭터 선택 단계([onboarding.md](./onboarding.md))가 같은 함수를 공유하므로 세 화면에 동일하게 적용된다. 카드 그리드 자체의 스타일은 [../foundation/design-system.md](../foundation/design-system.md).
- **활성(`access_flag: true`)이 확인된 캐릭터만** 목록에 넣는다. `character/list` 응답에는 `access_flag` 가 없으므로 그 단계에서 캐시 없는 캐릭터를 채워 넣지 않는다 — 확인 경로는 `character-basic-cache` 또는 `character/basic` 응답 둘뿐이다([[ADR-015]] 결정 5를 "확인 전까지도 넣지 않는다"로 엄격 적용).
- **캐시가 있으면 즉시 표시 + 개별 patch**([[ADR-016]] 결정 4·[[ADR-017]] 결정 6 SWR 그대로, 변경 없음). **표시할 캐시가 한 건도 없으면(콜드 스타트 — 캐시 삭제·재설치 직후)** 중간 결과를 흘리지 않고 **스피너 → 조회 완료 후 한 번에** 목록을 그린다. 판정 기준은 "캐시 인덱스가 비었는가"가 아니라 "실제로 방출한 stub이 0건인가".
- 조회가 끝났는데 목록이 비면 **"활성 캐릭터 없음"(정상 빈 상태 — "표시할 캐릭터가 없어요", `text-text-muted`)** 과 **"조회 실패"** 를 구분해 안내한다. 401/429는 전역 실패로 throw되므로 그 reject 경로에서 반드시 로딩을 해제한다(스피너 영구 고정 방지).
- **실패는 원인과 행동을 함께 준다**([[ADR-062]]). 호출부가 reject를 `toScheduleSyncError` 로 변환해 `loadError: ScheduleSyncError | null` 로 내려주고(옛 `loadFailed: boolean` 대체), 공용 `ErrorState` 가 원인별 문구·액션을 그린다 — `invalidApiKey` 만 **설정 열기**(재시도로 안 풀린다), `rateLimited`·`network` 는 **다시 시도**. 재시도는 피커를 여는 경로와 같은 초기화(`reloadRoster`)를 재사용하므로 열기와 재시도가 한 코드로 수렴한다.
- **보여줄 항목이 있는 채로 실패하면 목록을 지우지 않는다**([[ADR-062]] 결정 4). `loadError !== null` 이어도 `entries.length > 0` 이면 그리드를 그대로 두고 그 위에 스탈 배너("목록이 최신이 아닙니다" + 다시 시도)를 얹는다. 캐시 stub이 네트워크보다 먼저 방출되므로([[ADR-017]] 결정 6) 예열이 끝난 정상 경로에서는 **이쪽이 기본 분기**다 — 배너가 없으면 실패의 대다수가 무음이 된다.

**관리 화면 토글 저장 실패 ([[ADR-065]] 결정 4)**: 체크박스가 그 자리에 남아 맥락이 있으므로 토스트로 알린다 — 문구는 컨텐츠·보스 공통으로 "추적 목록을 저장하지 못했습니다" 하나다(같은 화면에서 무엇을 토글했는지는 사용자가 안다). 재시도 액션은 두지 않는다 — 다시 탭하면 되는 일이라 중복이다.

## 3단 캐시 병합 ([[ADR-030]], 구현 완료)
캐릭터 단일 스냅샷 → 캐릭터/월드/계정 3단 캐시. 응답 도착 시:
- `daily_contents`/`weekly_contents` 를 각각 판정: 배열이 비었거나 없으면 "그 리셋 주기 이후 이 캐릭터 미접속"으로 간주(응답 `date` 는 항상 요청일 반환이라 타임스탬프 비교 불가 — 배열 empty 여부만 신호).
- **미접속**: `storage/scheduler-cache` 의 마지막 정상 상태에서 이름·`registration_flag` 유지하고 진행값(now_count/quest_state/isComplete)만 리셋. `boss_contents` 는 `cycle: weekly` 는 `weekly_contents` 와, `cycle: monthly` 는 월간 경계(매월 1일 00:00 KST)와 동일 판정.
- **신선**: 항목별 `scheduler-content-catalog.json` 의 `shareScope` 조회 — `character` 면 캐릭터별 캐시 갱신, `world`/`account` 면 개별 `registration_flag` 무시(마지막 활성 캐릭터 오염 대상이라 불신)하고 `worldSharedProgress:{world}`/`accountSharedProgress:{accountId}` 원장에 `{ active, 진행값, lastUpdatedBucket }` 갱신 — 한 번 `active: true` 가 되면 이후 이 원장을 기준으로 삼음.
- **표시 시**: character 항목은 캐릭터 캐시 값, world/account 항목은 원장의 `active` 로 노출 여부를 정하고 진행값도 원장에서(원장 stale 은 `lastUpdatedBucket` 을 `lib/reset-clock` 리셋 경계와 비교 — 경계 넘겼는데 아무도 갱신 안 했으면 진행값만 리셋, `active` 유지).
- **한계/오류**: 몬스터파크(world) 월드 간 오염은 구분 신호 없어 미처리. 길드 주간 미션 포인트 `max_count` 는 `maxCountOverride`(10)로 고정.

핵심 로직 `lib/scheduler-merge`·`lib/scheduler-content-scope`·`storage/shared-progress-cache` 는 TDD 로 단위 테스트 완비([../foundation/architecture.md](../foundation/architecture.md) 테스트 전략).

## UI — 콘텐츠 카드
카드 골격은 보스 카드([[ADR-018]], [boss-scheduler.md](./boss-scheduler.md))를 재사용 — `rounded-[14px]`, `.media-scope` + `bg-surface`/`border-border`(스코프가 media-* 로 다시 묶는다, [[ADR-064]] 결정 5), 80px 기본 높이, 일러스트 bleed(saturate .85 brightness .8 opacity .65, mask `linear-gradient(90deg,#000 0%,#000 38%,transparent 76%)`).

### 당겨서 새로고침 ([[ADR-072]] 제스처 · [[ADR-073]] 인디케이터)
목록 최상단에서 아래로 당기면 헤더 새로고침 버튼과 같은 재조회(`refresh(trackedOcids ?? [])`)가 돈다. **헤더는 제자리에 고정되고 목록 블록만 손가락을 따라 내려가며, 벌어진 틈에 인디케이터가 뜬다**([[ADR-073]]). 레시피는 [foundation/design-system.md](../foundation/design-system.md) 의 '당겨서 새로고침' 절. 이 화면의 활성 조건은 `!isEmpty`(추적 캐릭터 있음) 하나이고, `usePullToRefresh` 호출은 **빈 상태 조기 반환보다 위**에 있어야 한다(훅 규칙).

### 일일퀘스트 카드 ([[ADR-020]])
일간 탭 `kind: 'quest'` 항목에만. 왼쪽 지역 아이콘(`assets/maps/icons/{slug}`, 없으면 생략) + 퀘스트명("[일일 퀘스트] " 접두어 제거, text-shadow `0 1px 3px rgba(0,0,0,.9),0 0 10px rgba(0,0,0,.6)`). 오른쪽 `quest_state` 3단 뱃지:
```
완료(2):   rounded-full bg-secondary text-on-secondary text-xs font-bold px-2.5 py-1 "완료" (보스 완료 뱃지와 동일)
진행 중(1): rounded-full bg-surface-2 text-text text-xs font-semibold px-2.5 py-1 "진행 중"        ← .media-scope 안
시작 안함(0): rounded-full bg-surface-2 text-text-muted text-xs font-semibold px-2.5 py-1 "시작 안함" ← .media-scope 안
```
지역 배경 매칭: `daily-quest-regions.json`(지역명→슬러그) + `daily-quest-region-crops.json`(슬러그→크롭), `lib/daily-quest-backgrounds`. 공백 제거 표시명이 공백 제거 지역명으로 `startsWith`(예 "레헬른의평온한밤".startsWith("레헬른")). 미매칭이면 일러스트 레이어 생략. 디버그 프리뷰 `/debug/quest-cards`. `kind: 'contents'` 항목은 몬스터파크 예외를 빼면 기존 "이름 · now/max + 진행률 바" 유지.

### 몬스터파크 카드 ([[ADR-020]])
`kind: 'contents'` 중 "몬스터파크" 하나만의 예외 카드. 높이 **112px**(`h-28`). `flex flex-col`: 위 `h-20`(아이콘+이름·진행률 뱃지, 다른 카드와 같은 80px 위치) + 아래 `flex-1`(진행률 바, `items-start pt-0`).
```
진행률 뱃지: rounded-full bg-third-tint text-third-ink text-xs font-semibold px-2.5 py-1 "{now}/{max}"
  (.media-scope 안이라 media-surface 기준으로 계산된 값 — [[ADR-021]]에 미해결로 남아 있던 레테 3.88:1이 여기서 닫힌다.
   화면 헤더 n/12 배지는 스코프 밖이라 일반 기준 bg-primary-tint text-primary-ink)
진행률 바: maxCount>0 일 때만. 트랙 bg-track, 채움 bg-third
```
이름·아이콘·배경 "몬스터파크" 고정(별도 매핑 없이 이름 직접 비교). 이 "메인 행 80px + 하단 확장" 원칙은 길드 카드에도 재사용.

### 주간 콘텐츠 카드 ([[ADR-021]])
카테고리별 4변형:
- **① 에픽 던전**: 좌 `[카테고리 뱃지 "에픽 던전"] [던전명]`(접두어 제거), 우 `QuestStateBadge`(0→시작 안함, 완료는 2 매핑, 1 미사용). 배경 던전 일러스트(`assets/bosses/`, `boss-icons`). 80px.
- **② 주간 지역 퀘스트**: 좌 `[지역 아이콘] [콘텐츠명]`, 우 `QuestStateBadge`(0→시작 안함, 1→완료). 배경·아이콘은 일일퀘스트 지역 에셋 재사용(`weekly-regional-quests.json` 정확 일치). 80px.
- **③ 무릉도장**: 배경·뱃지 없음, 껍데기만 + 이름 수직 가운데. 80px.
- **④ 길드**: 몬스터파크 레이아웃 원칙(메인 80px + 하단 확장), 112px. 메인 행 좌 `[카테고리 뱃지 "길드"] ["지하 수로"]` 우 점수 뱃지(`bg-third-tint text-third-ink` "{now}점" — `.media-scope` 안이라 media 기준으로 계산된 값이 적용된다), 하단 "주간 미션 포인트: {now} · 플래그 레이스: {now}" `text-xs text-text-muted`. `grid-template-columns: auto 1fr` 로 하단 문구를 "지하 수로" 제목과 같은 x에서 시작. 배경 `arcanus`.
- 카테고리 뱃지("에픽 던전"/"길드"): `rounded-full bg-[#4DD2FF]/20 text-[#4DD2FF] text-xs font-semibold px-2.5 py-1`(길드 배경 아르카누스 전기빛과 맞춘 파란색). **의도적으로 테마 토큰을 쓰지 않는다** — 특정 일러스트(아르카누스)에 맞춘 색이라 테마를 따라가면 의미가 깨진다([[ADR-064]] 적용 범위 밖과 같은 성격).
- **폴백**: 길드 미션 포인트·플래그 레이스 둘 다 미등록이면 묶음 카드 대신 등록된 길드 항목만 기본 plain 카드(테마 토큰 `bg-surface`/`border-border`, "이름 · now/max")로.

## 수동 트래킹 — 화면은 읽기 전용, 편집은 관리 페이지 ([[ADR-035]] 결정 18·19)
컨텐츠/보스 스케줄러 화면은 두 모드(자동/수동) 모두 **순수 읽기 전용**. 표시 카드는 재사용하고 값은 동기화 결과·템플릿에서 조회(멤버십에 값 복제 없음).
- **헤더 진입점**: 수동 모드에서만 "컨텐츠 관리" 텍스트 버튼이 "캐릭터 관리" 왼쪽에 나타남(자동은 "캐릭터 관리" 하나). 버튼 `text-sm font-medium text-text-muted hover:text-text`.
- **빈 상태(수동)**: 공용 `EmptyState`(inline, `ListChecks`) — "추적할 일간/주간 컨텐츠가 없습니다" + CTA "컨텐츠 관리" → `/content/manage`([[ADR-060]]). 자동 모드는 "등록된 일간/주간 컨텐츠가 없습니다"(CTA 없음 — 목적지가 앱 밖). 레시피는 [design-system.md](../foundation/design-system.md).
- **탭 구분**: 수동 항목은 저장 시 확정된 `kind`(`'daily'|'weekly'`)로 해당 탭에만(표시 시점 추론 없음).

### 컨텐츠 관리 페이지 `/content/manage` ([[ADR-035]] 결정 18)
수동 모드 전용(자동 진입 시 `/content` 리다이렉트). 카드 박스 없는 페이지 레이아웃, 헤더~탭 sticky 고정(스케줄러와 동일 패턴, 화면 루트 `-mt-[var(--sa-top)]` 로 노치까지 `bg-bg`).
- **헤더**: 뒤로(`ArrowLeft`) + "컨텐츠 관리" + 대상 캐릭터 칩(스케줄러 선택 승계, 이름 앞 월드 엠블럼, `inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs`).
- **탭**: 일간/주간 pill 탭.
- **체크리스트 — 카테고리 그룹핑(2026-07-24)**: `scheduler-content-template.json` 을 카테고리로 묶어 나열, 추적 중인 항목만 선택 상태(`aria-pressed`, 선택 시 `border-primary bg-primary-tint`). 행 탭 = 추적 토글, **즉시 저장**(로컬 Preferences).
  - **카테고리 도출**: (1) `content_name` 접두사(`[X] Y`→카테고리 X, `에픽 던전 : Y`→"에픽 던전"), (2) 명시적 오버라이드 맵 `CATEGORY_OVERRIDE`(게임 도메인 분류라 **사용자 지정 값만**, [[ADR-006]]). 도출 로직 공용 유틸 `lib/content-category.ts`(`categorizeContentEntries`), 단위 테스트.
  - **사용자 확정 오버라이드(2026-07-24)**: 일간 `몬스터파크`(단독 그룹화, 주간 몬파와 아이콘 통일), 주간 `무릉도장`(단독), 주간 "아케인리버 지역 퀘스트"(에르다 스펙트럼·배고픈 무토·미드나잇 체이서·스피릿 세이비어·엔하임 디펜스·프로텍트 에스페라 + `성실한 조사에 대한 보답`). **주간 그룹 순서** `WEEKLY_CATEGORY_ORDER`: 에픽 던전 → 몬스터파크 → 길드 → 아케인리버 지역 퀘스트 → 주간 퀘스트 → 무릉도장 → 메이플 유니온(일간은 첫 등장 순서 유지).
  - **그룹 헤더**: 아이콘 배지(`h-6 w-6 rounded-lg bg-third-tint text-third-ink`) + 카테고리명 + 추적 카운트(`{tracked}/{total}`). 아이콘 매핑(컴포넌트): 일일/주간 퀘스트 `MapPin`, 에픽 던전 `Castle`, 메이플 유니온 `LayoutGrid`, 몬스터파크 `Swords`, 아케인리버 지역 퀘스트 `Sparkles`, 무릉도장 `Medal`, 길드 `Flag`, 그 외 `Sparkles`. 행 왼쪽에도 같은 아이콘 작게(선택 시 `text-primary-ink`).
  - **카운트 태그**: `contentCountTag(entry, category)`, 우선순위 아이템 오버라이드 → 카테고리 오버라이드 → 기본(카운트형이면 "최대 {max_count}회"). 도메인 오버라이드(사용자 확정, [[ADR-006]]): 일간 몬스터파크 "월드 당 최대 14회", 주간 익스트림 몬파 "ID당 2회", 에픽 던전 "ID당 1회", 아케인리버 지역 퀘스트 태그 숨김(`null`).

### 길드 콘텐츠 — 길드 가입 캐릭터만 선택 ([[ADR-057]], 구현 완료 2026-07-29)
길드 카테고리 항목(`[길드] 주간 미션 포인트`·`지하 수로`·`플래그 레이스`)은 **가입한 길드가 있는 캐릭터만** 선택할 수 있다. 미가입이면 관리 페이지에서 행 `disabled` + 흐림 위에 `길드 가입 시 진행 가능` 한 줄(표기 규칙은 보스 관리 화면과 공유 — 행 위를 덮는 스크림 `bg-bg/85` + `backdrop-blur-[2px]`, [[ADR-055]] 정정 1).
- **판정 원천**: `character/basic` 의 `character_guild_name` → `ContentCharacterView.guildName`(`sortByCachedLevel` 이 `level` 과 함께 캐시에서 꺼낸다, 추가 호출 0).
- **`null`(미가입)일 때만 잠근다.** `undefined` 는 "모름"(구버전 캐시·응답에 필드 없음)이라 잠그지 않는다 — 둘을 합치면 데이터가 불완전할 때 길드 콘텐츠가 전부 막힌다([[ADR-057]] 결정 2).
- **대상 판정은 카테고리 도출 재사용**(`isGuildContent` → `parse(name).category === '길드'`) — 항목명을 코드에 나열하지 않아 화면 그룹핑과 어긋날 수 없다.
- **이미 추적 중인 항목은 잠그지 않는다**(길드 탈퇴 후에도 해제 가능). 표시 화면(`ContentScreen`)의 `진행 불가` 표기는 이번 범위 밖 — 레벨 잠금만 표시한다.

## 폐기된 정책 (history)
- ~~레벨 미달 항목은 수동 선택 불가(관리 페이지 잠금) + 스케줄러 화면에 "진행 불가"~~ → **미도입, 자유 선택**([[ADR-055]] 정정 2, 2026-07-29 사용자 결정, 이슈 #32 폐기). 요구 레벨 데이터(`requiredLevel`)는 `scheduler-content-template.json` 에 남아 있으나 **읽는 코드가 없다**.
- ~~체크박스로 캐릭터 선택~~ → 캐릭터 이미지 카드형 그리드 토글([[ADR-015]]).
- ~~캐시가 없으면 `character/list` 응답으로 `access_flag` 미상 캐릭터까지 먼저 표시~~ → 활성 확인된 캐릭터만 표시, 콜드 스타트는 스피너([[ADR-053]], 2026-07-29).
- ~~캐시가 캐릭터 단위 단일 스냅샷~~ → 캐릭터/월드/계정 3단 캐시([[ADR-030]]).
- ~~평평한 체크리스트(관리 페이지)~~ → 카테고리 그룹핑([[ADR-035]] 2026-07-24): `[일일 퀘스트]` 접두사가 16/18줄 반복돼 지역명이 파묻히던 문제 해소.
- ~~수동 편집 UI가 스케줄러 화면에 상주(카드 X 삭제·"+ 항목 추가")~~ → 화면은 읽기 전용, 편집은 `/content/manage`([[ADR-035]] 결정 18). 수동 항목이 일간/주간 양쪽에 섞이던 버그의 원인이 멤버십 스키마의 일간/주간 구분 부재라 `ManualTrackedItem.kind` 세분.
