# 패리티 인벤토리 — 옮길 대상 전수 목록

**범위**: 전환 대상 전 파일의 목록과 **각 파일에 걸린 ADR 계약**. 전략·단계는 [README.md](./README.md),
데이터 보존은 [data.md](./data.md).

**관련 소스(read/write)**: `src/**` 전체

**관련 ADR**: [[ADR-128]] · 아래 표에 나열된 113개

**관련 문서**: `foundation/architecture.md` · 각 `features/*.md`

---

## 이 문서를 쓰는 법

**표의 ADR 열이 체크리스트다.** 한 파일의 재작성이 끝났다는 것은 다음 세 가지를 모두 마쳤다는 뜻이다.

1. 새 파일이 화면에 같은 것을 그린다
2. 그 행의 ADR을 **전부 다시 읽었다**
3. 각 ADR이 정한 동작이 새 코드에 있음을 확인했다 — 없으면 왜 없어도 되는지를 적었다

3번을 건너뛰면 이 문서는 파일 목록일 뿐이고, 그러면 "한치의 오차도 없이"를 보장하는 장치가 저장소에
하나도 없게 된다. **화면에 안 보이는 판단이 대부분**이라 눈으로는 못 잡는다.

> 소스에 박힌 ADR 참조를 기계적으로 추출한 결과다(2026-08-11 기준).
> 재생성: `grep -ohE 'ADR-[0-9]+' <파일> | sort -u`

---

## 1. 라우트 → 스크린 매핑

`react-router-dom` 의 중첩 라우트를 react-navigation 구조로 옮긴다. 하위 화면은 `<Outlet />` 자리에
`StackScreen` 이 **포털로** 그리고 있다([[ADR-120]] 결정 13~18) — RN에서는 네이티브 스택의 push가 된다.

| 현재 경로 | 화면 | RN 대응 | 비고 |
|---|---|---|---|
| `/` | → `/content` 리디렉트 | 초기 라우트 | |
| `/onboarding` | `OnboardingScreen` | 별도 스택 | 완료 시 `/content` 로 `replace` |
| `/content` | `ContentScreen` | **탭 1** | |
| `/content/manage` | `ContentManageScreen` | 탭 1 위 push | |
| `/boss` | `BossScreen` | **탭 2** | |
| `/boss/manage` | `BossManageScreen` | 탭 2 위 push | |
| `/profit` | `BossProfitScreen` | **탭 3** | |
| `/profit/drops` | `DropHistoryScreen` | 탭 3 위 push | 전 기간 히스토리 |
| `/profit/prices` | `DropPriceScreen` | 탭 3 위 push | |
| `/settings` | `SettingsScreen` | **탭 4** | |
| `/settings/guide` | `SettingsFeatureGuideListScreen` | 탭 4 위 push | |
| `/settings/guide/:guideId` | `SettingsFeatureGuideScreen` | 위에 push | |
| `/settings/release-notes` | `SettingsReleaseNotesScreen` | 탭 4 위 push | |
| `/settings/release-notes/:guideId` | `SettingsFeatureGuideScreen` | 위에 push | **같은 상세 화면** |
| `/settings/account-data` | `SettingsAccountDataScreen` | 탭 4 위 push | |
| `/settings/about` | `SettingsAboutScreen` | 탭 4 위 push | |
| `/settings/about/privacy` | `SettingsPrivacyScreen` | `/settings/about` 위 push | 이 앱에서 **유일한 2단 스택** |

**보존해야 할 라우팅 동작**

- 온보딩 미완료 시 모든 탭이 `/onboarding` 으로 `replace` (완료 시 그 반대)
- 탭 이동은 `NavLink` 가 아니라 **인터셉터**가 책임진다(`App.tsx:196`) — 전면광고 게이트([[ADR-090]])가
  거기 걸려 있다. RN에서는 탭 `listeners` 로 옮긴다
- `/settings/guide/:guideId` 와 `/settings/release-notes/:guideId` 가 **같은 화면**을 그린다([[ADR-125]])

---

## 2. `app/` — 전면 재작성 (9.7k줄)

### 2.1 최상위

**셋 다 옮겼다**(4단계 step 0, 2026-08-12 — `packages/app-rn/App.tsx` · `src/app/`). 각 행의 ADR 을
다시 읽고 그 동작이 새 코드에 있음을 확인한 결과가 «확인» 열이고, 웹이 하던 것과의 **전수 대조표**는
[README «4-0단계 결과»](./README.md) 에 있다.

| 파일 | ADR 계약 | 확인 |
|---|---|---|
| `App.tsx` (573줄) | 스택·탭·라우팅·광고 인터셉터 — **분해 대상**, 아래 참조 | 부팅 순서는 `src/app/AppShell.tsx`, 프로바이더·에러 경계는 `App.tsx`, 나머지는 3-2단계가 이미 가져갔다. 순서는 `src/__tests__/boot-order.test.tsx` 가 계약으로 든다 |
| `ApiKeyNoticeModal.tsx` | 114, 115, 116 | 114 결정 1(단계를 판정하지 않는다)·결정 4(모달은 처방까지) ✅ / 115 결정 10(닫을 수 없다·확인해야 이동) ✅ — 이동 수단만 갈렸다(라우트 가드 → **화면 목록 교체**, 3-2단계) / 116 결정 1(429 가 같은 사슬·문구만 갈림)·「구현하며 정한 것」의 falsy 가드 ✅ |
| `UpdatePromptModal.tsx` | 027, 061, 065, 117, 119, 125, 126 | 상태 아홉·문구·분기 전부 옮겼고 **마운트만 없다**(OTA 미연결 — README). 027 동의형 흐름 ✅ / 061 결정 1·2·6(결정형 진행률은 `ProgressBar`, 적용 중은 스윕 스피너) ✅ / 065 결정 2(`check-error` 는 모달 아님 · `GHOST_*` 축소를 네 분기가 공유) ✅ / 117 결정 1·7(`apply-error` 는 다시 받지 않고 `apply()` 만 · `applying` 은 버튼 0개) ✅ / 126 결정 1·6·7(받기 전 아코디언 · 없으면 버튼째 없음 · `ready-to-apply` 엔 안 붙음)·결정 4(`updated` 는 개발 노트로 이동) ✅ — **119·125 는 이 모달 밖**(개발 노트·기능 설명 화면, step 3) |

`App.tsx` 는 통째로 옮기지 않는다. 현재 다섯 가지가 한 파일에 있다 — 라우팅 · 탭바 · 스택 오버레이
합성 · 시스템 뒤로가기 · 광고 인터셉터. RN에서는 스택 오버레이 합성과 시스템 뒤로가기가 사라지므로
(README «삭제되는 화면 전환 machinery») **라우팅 + 탭바 + 광고 인터셉터만** 남는다.

### 2.2 온보딩 (`features/onboarding.md`)

| 파일 | ADR 계약 |
|---|---|
| `onboarding/OnboardingScreen.tsx` | 016, 035, 061, 083, 086 |
| `onboarding/ApiKeyForm.tsx` | 003, 007, 061, 086, 110 |
| `onboarding/AccountSelectionList.tsx` | 015, 051, 061, 063, 068, 083, 086, 113, 114, 116 |
| `onboarding/ContentCharacterStep.tsx` | 016, 035, 053, 060, 061, 062, 067, 086, 107, 114, 115, 116 |
| `onboarding/TrackingModeStep.tsx` | 035, 060 |

### 2.3 컨텐츠 스케줄러 (`features/content-scheduler.md`)

| 파일 | ADR 계약 |
|---|---|
| `content-scheduler/ContentScreen.tsx` | 015, 016, 017, 035, 047, 053, 060, 061, 062, 063, 072, 073, 077, 083, 096, 098, 099, 101, 115, 116, 120 |
| `content-scheduler/ContentManageScreen.tsx` | 035, 055, 057, 060, 061, 065, 096, 098, 099, 120 |
| `content-scheduler/DailyContentCards.tsx` | 018, 020, 094 |
| `content-scheduler/WeeklyContentCards.tsx` | 021, 094 |
| `content-scheduler/content-badges.tsx` | 094 |

### 2.4 보스 스케줄러 (`features/boss-scheduler.md`)

| 파일 | ADR 계약 |
|---|---|
| `boss-scheduler/BossScreen.tsx` | 015, 016, 017, 018, 019, 031, 035, 047, 053, 060, 061, 062, 063, 064, 072, 073, 077, 083, 096, 098, 099, 101, 115, 116, 120, 121 |
| `boss-scheduler/BossManageScreen.tsx` | 031, 035, 055, 056, 061, 065, 096, 098, 099, 120, 121 |

### 2.5 보스 수익 (`features/boss-profit.md`) — **최고 위험 구역**

| 파일 | ADR 계약 |
|---|---|
| **`boss-profit/BossProfitScreen.tsx`** | **032, 045, 046, 047, 049, 054, 059, 060, 061, 063, 067, 068, 071, 072, 073, 076, 077, 080, 082, 083, 085, 087, 088, 094, 099, 100, 101, 102, 112, 120, 123, 124** |
| `boss-profit/boss-profit-context.tsx` | 068, 085, 087, 094, 100 |
| `boss-profit/character-groups.ts` | 036, 038, 046, 054, 059, 069, 094, 124 |
| `boss-profit/BossProfitBossRow.tsx` | 032, 038, 041, 049, 063, 094, 100, 124 |
| `boss-profit/BossDropSheet.tsx` | 038, 040, 041, 069 |
| `boss-profit/DropHistoryScreen.tsx` | 010, 045, 046, 062, 069, 071, 077, 120 |
| `boss-profit/DropPriceScreen.tsx` | 046, 063, 124 |
| `boss-profit/DropPricePad.tsx` | 046, 121 |
| `boss-profit/HeadlineChips.tsx` | 046, 047, 049, 054, 087, 094 |
| `boss-profit/ItemRevenuePopover.tsx` | 049, 068, 071, 124 |
| `boss-profit/AccordionBody.tsx` | 068, 094 |
| `boss-profit/CharacterAvatar.tsx` | 015, 018, 049, 054, 059, 094 |
| `boss-profit/CharacterIssue.tsx` | 047, 049, 054, 063, 067, 068, 094 |

**`BossProfitScreen.tsx` 는 ADR 32개를 진다.** 이 저장소에서 가장 밀도 높은 파일이고, 전환 실패가
가장 먼저 드러날 곳이다. 다른 화면과 같은 취급을 하지 말 것 — 단독으로 계획을 세우고, 재작성 전에
32개 ADR을 먼저 읽고 **동작 명세를 따로 뽑아 두는 것**을 권한다.

### 2.6 설정 (`features/settings.md`)

| 파일 | ADR 계약 |
|---|---|
| `settings/SettingsScreen.tsx` | 058, 061, 098, 099, 118, 120, 125 |
| `settings/SettingsAboutScreen.tsx` | 035, 085, 099, 112, 118, 120 |
| `settings/SettingsAccountDataScreen.tsx` | 035, 058, 061, 118, 120 |
| `settings/SettingsPrivacyScreen.tsx` | 062, 118, 120 |
| `settings/SettingsReleaseNotesScreen.tsx` | 060, 118, 119, 120, 125 |
| `settings/SettingsFeatureGuideListScreen.tsx` | 018, 060, 125 |
| `settings/SettingsFeatureGuideScreen.tsx` | 125 |
| `settings/AppUpdateSection.tsx` | 026, 027, 061, 118, 126 |
| `settings/AccountModal.tsx` | 086 |
| `settings/AccountFlowStatus.tsx` | 086, 113, 114 |
| `settings/ThemeModal.tsx` | 035, 104 |
| `settings/ThemeSelector.tsx` | 018, 064, 104 |
| `settings/TrackingModeModal.tsx` | 035, 061 |
| `settings/TrackingModeSelector.tsx` | 035, 060 |
| `settings/CacheClearConfirm.tsx` | 052, 058, 061 |
| `settings/DisconnectConfirm.tsx` | 061 |
| `settings/SettingsRow.tsx` · `SettingsLinkRow.tsx` · `row-class.ts` | 118 |
| `settings/error-message.ts` | 114 |

---

## 3. `components/` — 전면 재작성 (2.6k줄, 4계층 34개)

계층 간 의존 방향은 테스트로 강제된다(atoms ← molecules ← organisms ← templates). **RN에서도 같은
테스트를 유지한다** — 새 컴포넌트를 어느 계층에 둘지부터 정하는 규율이 전환 중에 특히 필요하다.

### atoms (9)

**전부 옮겼다**(3단계 step 3, 2026-08-12 — `packages/app-rn/src/components/atoms/`). 각 행의 ADR 을
다시 읽고 그 동작이 새 코드에 있음을 확인한 결과가 «확인» 열이고, RN 에서 갈린 자리는 컴포넌트
주석과 [README «3-3단계 결과»](./README.md) 에 있다. 계층 규칙은 RN 쪽 `layer-dependencies.test.ts`
가 강제한다.

| 컴포넌트 | ADR 계약 | 확인 |
|---|---|---|
| `AnimatedMeso` | 046, 087 | 046 숫자만 냄 + **실제 공백 문자** ✅ / 087 결정 6·7·8·정정 1 은 core `use-count-up` 과 **호출부 identity 키**에 산다 — 훅을 그대로 부르므로 유지(키는 step 4 몫) |
| `Badge` | 094 | 결정 3 재정정(만든다)·`*-tint`/`*-ink` 6곳만 덮는 좁은 범위 ✅ |
| `Button` (+ `variants.ts`) | 094 | 결정 3(design-system 규정만)·외형만 갖고 레이아웃은 호출부 ✅ / **결정 4(DOM 보존)는 RN 에서 성립 불가** — 상자/글자를 갈라야 해서, 그 자리를 새 스냅샷 기준선이 대신한다 |
| `Card` | 094 | 결정 3·`rounded-[14px]` 를 한곳에 ✅ |
| `DifficultyBadge` | — | (계약 없음) 웹의 색·그림자 값 그대로 |
| `MapleSpinner` | — | (계약 없음) **모션 완료**(step 7) — `maple-trail` 을 `useAnimatedProps` 로. 웹의 `pathLength={300}` 정규화가 없어 오프셋을 **실측 둘레**까지 굴린다(숫자는 다르고 *"한 주기 = 둘레 한 바퀴"* 라는 성질이 같다 — 깨지면 반복 이음매에서 튄다) / `motion-reduce:animate-none` → `useReducedMotion()` ✅ |
| `MapleSweepSpinner` | 061 | 결정 1 크기 규칙(16px=트레일 링 / 24px 이상=스윕)·아래→위 방향 ✅ / **모션 완료**(step 7) — 웹은 띠에 `translateY` 였지만 RN 은 **`<Rect>` 의 `y` 자체**를 굴린다(이동량 230 동일·부호 반대). `<G>` transform 은 JS 에서 matrix 로 접혀 나가 UI 스레드 갱신이 그 접기를 건너뛴다 / `motion-reduce` 짝 ✅ — 켜지면 띠가 `y=140`(viewBox 밖)에 머물러 **바탕 잎만** 남는다 |
| `ProfitIcon` | 066 | 결정 3 lucide 규격 6항목·결정 4 좌표로 겹침(clipPath·mask 0개) ✅ |
| `ProgressBar` | 061, 094 | 061 결정 6 `h-1.5` 단일 프리미티브 ✅ / 094 결정 3 ✅ · `animated` **동작함**(step 7) — 웹의 `transition-[width]` 한 클래스를 Reanimated CSS 트랜지션으로 폈다. NativeWind 의 `transition-*` 을 안 쓴 이유는 그쪽이 지속시간·곡선을 **RN 에 없는 Tailwind 프리셋 변수**에서 읽어 값이 조용히 달라지기 때문이고, 그래서 웹이 실제로 쓰던 두 기본값(150ms · `cubic-bezier(.4,0,.2,1)`)을 값으로 적고 그 대조를 `keyframes-parity.test.ts` 가 `tailwindcss/theme.css` 를 읽어 한다 |

### molecules (11)

**전부 옮겼다**(3단계 step 4, 2026-08-12 — `packages/app-rn/src/components/molecules/`). 각 행의 ADR 을
다시 읽고 그 동작이 새 코드에 있음을 확인한 결과가 «확인» 열이고, RN 에서 갈린 자리는 컴포넌트
주석과 [README «3-4단계 결과»](./README.md) 에 있다.

**셋은 절반만 왔다** — `BossPortrait`(그림 분기) · `ValuableDropBadge`(아이콘) ·
`CharacterSelectDropdown`(엠블럼·목록). 앞의 둘은 **에셋 레이어**를, 마지막은 **목록 UI 결정**을
기다린다(아래 표의 «확인» 열에 무엇이 없는지 적어 뒀다).

| 컴포넌트 | ADR 계약 | 확인 |
|---|---|---|
| `BossPortrait` | — | (계약 없음) **플레이스홀더 분기만** — RN 번들에 보스 일러스트가 없어 `getBossPortraitUrl` 이 항상 `null` 이다. 그림 분기는 슬러그→에셋 매핑과 CSS `background-size/position` → RN 기하 변환이 함께 필요해 **에셋 레이어 몫**(`src/lib/rn-boss-icons.ts` 파일 머리) |
| `CharacterSelectDropdown` | 001, 096 | 001 은 **웹뷰 사정**이라 사라진다(네이티브 `<select>`·UA 화살표 억제) / 096 결정 5 두 크기의 치수·엠블럼 자리·chevron 직접 그리기 ✅ / **목록(열린 상태)은 미도착** — RN 에 `<select>` 짝이 없고 무엇으로 그릴지가 디자인 결정이라 step 5(오버레이)와 함께. `onSelect` 는 시그니처만 유지 |
| `DifficultySegment` | 121 | 결정 4 미선택 = 같은 뱃지 + `opacity-40`(고스트 칩 회귀 가드) ✅ / 같은 값 재탭이 저장을 안 부른다 ✅ / `aria-pressed` → **`aria-selected`**(RN 접근성 상태에 *pressed* 가 없다 — 전달되는 사실은 같다) |
| `EmptyState` (+ `UnavailableNotice`) | 060, 066 / 060, 067, 068 | 060 결정 1 두 변형·결정 2 배지 마크(leaf/컨텍스트)·**결정 3 액션 없는 자리에 버튼 없음** ✅ / 066 결정 5 `icon` 타입이 커스텀 아이콘도 받는다 ✅ / 068 결정 1 `notCollected` 넷째 얼굴(중립 톤 + Clock)·067 트레이드오프대로 **시각을 암시하지 않는 문구** ✅ · **문구는 한 글자도 안 바꿨다** |
| `ErrorState` (+ `StaleBanner`) | 060, 061, 062, 114, 116 / 016, 017, 062, 094, 114 | 062 결정 1 배지 없는 단독 아이콘(빈 상태와의 구분 근거) ✅ / 116 결정 4 `action` 옵셔널 + 그 조건을 주석 계약으로 ✅ / 114 결정 2·3 배너의 문구·라벨·액션은 **전부 호출부가 넘긴다**(molecule 이 `ScheduleSyncError` 를 모른다 — 094 결정 2) ✅ / 016·017 은 이 배너가 서는 **이유**(캐시 stub 이 먼저 방출돼 실패가 무음이 된다)라 코드가 아니라 주석에 산다 |
| `LoadingState` | 016, 061 | 061 결정 2 셸 승계 카드(`Card` atom)·크기별 스피너 32/24 ✅ / 결정 3 점선 미사용 ✅ / 016 "캐시가 있으면 가리지 않는다"는 호출부 규칙이라 주석에 ✅ / **스피너가 돈다**(step 7 — 이 파일은 한 줄도 안 바뀌었고 `MapleSweepSpinner` 가 살아나며 따라왔다) |
| `PartySizeStepper` | 121 | 결정 7 두 크기·−/+ 채움 없음·`compact` 단위 생략 ✅ / `disabled:opacity-40` → **JS 조건**(NativeWind 변형이 `Pressable disabled` 와 안 이어진다 — 그대로 두면 비활성이 멀쩡해 보인다) / `-m-1 p-1` → `hitSlop` |
| `PullToRefreshIndicator` | 047, 061, 073, 074 | 073 결정 6·7 높이와 목록 오프셋이 한 함수·배경/테두리 없음·틈 세로 중앙 ✅ / 074 결정 1 문구 없음·2·3 외곽선 링 진행률 드로잉·4·6 두 구간 같은 마크 28px·7 `aria-hidden` ✅ / 061 결정 1 의 PTR 예외(28px 트레일 링) ✅ / 047 은 이 인디케이터가 **절대 배치**여야 하는 이유(부모 실측 높이를 안 바꾼다) ✅ / **두 구간이 이제 둘 다 산다**(step 7 — 이 파일은 한 줄도 안 바뀌었다): 재조회 구간의 링은 `MapleSpinner` 가 살아나며 함께 돌고, 당김 구간의 드로잉은 애니메이션이 아니라 **손가락 위치의 함수**라 원래부터 살아 있었다. 074 결정 4·5 의 *"같은 마크가 그대로 이어진다"* 가 코드 위에서는 성립하고 **눈으로는 못 봤다** / **`RefreshControl` 과 겹치는 물건**이라 화면 배선에서 하나를 골라야 한다 — 갈래는 컴포넌트 주석 |
| `ValuableDropBadge` | 045, 046, 071 | 045 결정 2 골드 pill + Sparkles + 아이콘 최대 3 + `+N`·결정 3 **전 테마 공통 고정 골드** ✅ / 046 결정 4 배치·라벨은 호출부 ✅ / 071 결정 4 는 호출 자리(히스토리 요약 줄)라 컴포넌트 무관 ✅ / **아이콘 그림은 미도착**(에셋 레이어) — 스택 규칙은 폴백 원으로 확인 / **모션은 이 배지에 없다**(step 사양 정정 — `@keyframes` 셋은 전부 카드·행 쪽이다) |

### organisms (10)

**전부 옮겼다**(3단계 step 5, 2026-08-12 — `packages/app-rn/src/components/organisms/`). 각 행의 ADR 을
다시 읽고 그 동작이 새 코드에 있음을 확인한 결과가 «확인» 열이고, RN 에서 갈린 자리는 컴포넌트
주석과 [README «3-5단계 결과»](./README.md) 에 있다.

**이 계층에서 처음 만난 벽은 «떠 있는 것을 무엇으로 그리는가»다.** 웹에서 오버레이 넷은 전부
`createPortal(document.body)` + `z-*` 였는데, RN 에는 문서도 z-index 도 없고 **화면 전체를 덮는
방법이 `Modal`(별도 네이티브 윈도우) 하나뿐**이다. `absolute inset-0` 은 부모 상자에 갇혀 탭바조차
못 덮는다. 그래서 셋(`Modal`·`CharacterTrackingPicker`·`DropEffectOverlay`)은 `Modal` 로 갔고,
**`ToastStack` 만 갈 수 없다** — 안드로이드에서 그것은 화면 전체의 터치를 삼키는 다이얼로그라 토스트에
쓸 수 없다(아래 표의 «확인» 열에 남는 한계를 적었다).

**미도착 둘**(step 7 이 하나를 지웠다) — ① `DropEffectOverlay` 의 재생 엔진·팝인 — **막은 것은
시간이 아니라 에셋이다**(아래 표 참고) ② `PartySizeModal`·`CharacterTrackingGrid` 의 그림(에셋 레이어,
step 4 와 같은 벽). `Toast` 의 남은 시간 바·진입 트랜지션은 step 7 이 채웠다.

| 컴포넌트 | ADR 계약 | 확인 |
|---|---|---|
| `BottomSheet` | 038, 039 | `vaul` → **`@gorhom/bottom-sheet`**. 039 결정 2 스킨(그랩 핸들 `h-1 w-9 bg-border-strong` · `rounded-t-[20px]` · `bg-bg` · `max-w-md` 중앙 · 하단 안전영역)·결정 3 "마운트가 곧 열림, 닫힘은 이탈 애니메이션 뒤 통보"(`present()`/`onDismiss`) ✅ / **라이브러리 기본값을 세 자리에서 거부했다** — 고정 `snapPoints`(039 의 `max-h-[82vh]` 는 *상한*이지 높이가 아니다 → `enableDynamicSizing`+`maxDynamicContentSize`) · 전폭(→ `max-w-md` 448 중앙) · 백드롭 기본 검정+자체 알파(→ `bg-scrim` 토큰 + `opacity={1}`, 안 끄면 라이트 테마에서 스크림이 두 겹) / **039 정정 1·2 는 RN 에 없는 문제다** — 둘 다 원인이 Radix `dismissable-layer` 였다(`pointer-events:none` · 바깥 pointerdown dismiss). 038 은 이 시트가 담는 내용(드롭 기록)이라 화면 단계 몫 / **전제**: `BottomSheetModalProvider`·`GestureHandlerRootView` 는 앱 셸이 세운다 |
| `CharacterTrackingPicker` | 016, 017, 043, 053, 062, 067, 086, 107, 114, 115, 122 | **11개를 한 줄씩 확인했다.** 043 결정 1 저장 활성 판정을 **집합 비교**로(그리드가 ocid 를 배열 끝에 append 해 같은 집합도 순서가 갈린다) ✅ / 086 결정 7 최소 1명(0명은 어떤 의도도 표현하지 않는다) ✅ / 053 결정 3 콜드 스타트 스피너 — **항목이 하나라도 있으면 조회 중에도 그리드**(016 캐시 우선 표시를 스피너로 가리지 않는다) ✅ / 062 결정 2·4 항목이 있는 채로 실패하면 그리드를 안 지우고 **스탈 배너**를 얹는다(017 결정 6 으로 캐시 stub 이 먼저 방출돼 **이쪽이 기본 분기**다 — 배너가 없으면 실패 대다수가 무음) ✅ / 114 결정 3 그 배너의 문구·액션이 원인별(429·`characterUnavailable` 은 액션 없음 — 목록이 남아 막다른 길이 아니다) ✅ / 115 결정 7 401 은 배너·`ErrorState` 양쪽에 액션 없음(화면이 스스로 키 입력으로 이동해 **누를 것이 없다**) ✅ / 067 결정 1 영구 실패에 재시도 없음 ✅ / 107 결정 1·2·3 은 **셋 다 값 계산으로 옮겼다**(아래) / 122 는 `border-panel-border` 한 클래스 ✅ / **RN 에서 갈린 것 다섯**: 오버레이가 `fixed inset-0` → `Modal`(별도 네이티브 윈도우) · `useBodyScrollLock` 은 **대체가 아니라 필요 자체가 사라짐** · `onRequestClose` 가 안드로이드 뒤로가기를 **스택 pop 이 아니라 이 오버레이 닫기**로([[ADR-120]] 결정 18 후반, 2단계가 남긴 자리) · `--sa-*` → `useSafeAreaInsets()`+`useSafeAreaFrame()` 이라 107 결정 2 의 `min(385px, calc(100dvh − …))` 가 **클래스가 아니라 JS 계산** · `panel-on-scrim` → 토큰 |
| `CharacterTrackingPicker/CharacterTrackingGrid` | 015, 035, 054, 068, 107 | 015 얼굴 크롭(300px 원본 · 크롭 박스 115/120/64)·즐겨찾기 우선 정렬(그룹 안은 레벨 내림차순 유지) ✅ / 035 그리드를 떼어 **모달과 온보딩이 같은 렌더링**을 쓴다 ✅ / 068 결정 4 조회 불가 캐릭터는 **별도 섹션 + 해제만 가능**(고를 수 없는 후보를 새로 고르면 즉시 매 동기화 실패, 이미 추적 중이면 해제가 유일한 탈출구) ✅ / 054 정정 4 계열의 3줄 고정 385px 은 `roster-body.ts` 로 뺐다(값이 두 호출부에서 서로 다른 계산에 들어가고, 컴포넌트 파일이 비-컴포넌트를 export 하면 fast refresh 가 깨진다) ✅ / 107 결정 3 스크롤포트·높이 상한을 **여기 두지 않는다**(쓰는 쪽이 자기 자리에 맞게 둔다) ✅ / **RN 에서 갈린 것**: `grid grid-cols-3 gap-2` 짝이 없어(Yoga 에 CSS Grid 없음, `flex-wrap`+`gap` 은 좁은 폭에서 조용히 2열로 접힌다) **셀 `w-1/3 p-1` + 줄 `-m-1`** 로 — 간격이 정확히 8px 이고 어떤 너비에서도 3열이 안 깨진다 · `aria-pressed`→`aria-selected` · `truncate`→`numberOfLines` · **`fill-primary-ink` 는 조용히 사라져**(별이 테두리만 남아 "선택됨"이 안 읽힌다) lucide `fill` 프롭에 테마 값을 직접 넘긴다 / **월드 엠블럼 미도착**(에셋 레이어 — 이름 줄 높이를 정하던 `h-[17px]` 가 지금은 16px) |
| `DropEffectOverlay` | 038, 039, 048, 064, 103 | **부유(`fx-drop-float`)만 왔고 엔진·팝인은 아직**(step 7). 038 구성(ScreenEff 전면 + 8프레임에 아이템 팝인 + DropEff pre→loop∞ · 탭하면 end 재생 후 닫힘)의 **레이어·쌓임 순서·props 계약**만 세웠다 ✅ / 064 **적용 범위 밖**을 지켰다 — 오버레이 색이 테마를 안 따른다(스프라이트가 어두운 바탕 전제라 밝은 테마에서 표면색을 쓰면 연출이 사라진다), 웹과 같은 고정 hex ✅ / 039 정정 1·2 가 다루던 문제가 **사라진다**(시트 위에 서는 것을 네이티브 윈도우가 보장 — `pointer-events-auto` 마커도 `data-sheet-keep-open` 가드도 불필요) ✅ / **중앙 아이템의 부유는 step 7 이 붙였다** — `fx-drop-float` 을 Reanimated CSS 애니메이션으로(`2.6s ease-in-out infinite` · `translateY −5 → 5 → −5`). 웹이 이것을 **별도 래퍼**에 걸어 둔 이유가 RN 에서도 그대로다(중앙정렬·부유·팝인 세 transform 이 한 요소에 겹치면 서로를 덮어쓴다). 다만 그 래퍼는 `itemUrl !== null` 안쪽이고 RN 의 아이템 아이콘이 전부 `null` 이라 **한 번도 렌더되지 않으므로**, 값의 대조는 렌더 트리가 아니라 `keyframes-parity.test.ts` 가 상수를 직접 읽어 한다 / **048·103 은 엔진과 함께 온다 — 막은 것은 시간이 아니라 에셋이다**(step 7 이 확인). 프레임 에셋이 네 단계 모두 빈 배열이고(`rn-drop-effect-frames.ts`, 빈 배열은 원본이 정의한 정상 경로) 재생 루프가 DOM(`new Image()`·`el.complete`·`el.style.transform`) 위에 서 있어 다시 써야 하는데, **RN 의 `Image` 는 원격 URI 의 고유 크기를 모른다**(`require()` 로 번들에 든 에셋만 스스로 안다). 048 의 배치는 origin 을 **그 프레임 비트맵 크기 위에서** 되미는 일이라, 에셋이 어떤 모양으로 오는지가 정해지기 전에 배치 코드를 쓰면 그 결정을 코드가 몰래 대신 내리게 된다(크기 표는 `DROP_EFFECT_ORIGINS` 의 **주석에만** 있어 데이터로 읽을 수도 없다). 팝인도 같은 이유로 못 붙였다 — 대상이 아직 없는 `<Image>` 이고 그것을 켜는 트리거가 그 엔진이다. 103 의 **판정 근거가 성능이 아니라 눈**이라는 점을 주석에 박아 뒀다(2배 → 사용자 반려 → 1.5배) — 되살릴 때도 «단계별 fps 표 + 한 배율» 구조를 먼저 세우고 값은 실기기에서 확정하며, 팝인은 fps 가 아니라 트랜지션이라 **같은 배율로 함께** 바꿔야 한다(결정 2) / **RN 에서 갈린 것**: `radial-gradient` → `react-native-svg`(반지름은 `farthest-corner` 의 근사 √2/2) · **`mix-blend-screen` 짝이 없다**(가산 합성이 빠지면 검은 사각형이 그대로 보인다 — 프레임이 올 때 함께 풀 자리) |
| `ErrorBoundary` | 065, 117 | 065 결정 5 폴백은 **'다시 시작' 하나뿐**(설정 열기·스택트레이스·브랜드 마크 없음 — 목적은 복구 도구가 아니라 빈 화면을 없애는 것) ✅ / **117 결정 6 은 셋 중 하나만 대응된다** — ⑴ *"커버가 안 걷힌다"* **대응 없음**(`#boot-cover` 는 `index.html` 의 DOM 이고 RN 엔 문서가 없다) · ⑵ *"폴백이 커버 밑에 그려진다"* **대응됨**(`expo-splash-screen` 도 JS 트리 위 네이티브 뷰라 마운트 시 내린다) · ⑶ *"버튼이 눌리지 않는다"* **대응 없음**(`isUserInteractionEnabled=false` 는 Capacitor 플러그인의 동작). 그래서 호출은 남되 **이유가 ⑵ 하나로 줄고**, z-index 를 안 올린다는 결정은 그 숫자가 애초에 없어 그대로 ✅ / **'다시 시작'이 필수 프롭이 됐다** — 웹 기본값 `location.reload()` 의 짝이 없고(번들 재실행은 OTA 런타임 `expo-updates` 의 일, [[ADR-128]] 결정 7 이 별도 ADR 로 미뤘다) 없는 기본값을 지어내면 같은 예외로 즉시 되돌아오는 버튼이 되어 065 결정 5 의 *"그 하나가 분명해진다"* 를 깬다 |
| `Modal` | 065, 094, 122 | 094 3단계 compound(`Modal.Card`/`Modal.Panel`) — `card={false}` 부정 불리언이 사라지고 `maxWidth`·`tight` 가 의미를 갖는 패널에만 붙는다 ✅ / 결정 1 오버레이가 취약 구조(전체 화면·스크림·안전영역·바깥 탭)를 소유 ✅ / 065 결정 2 `tight` 는 하단 패딩만 ✅ / **122 는 이 계층의 핵심 확인 항목이었다** — `:root[data-mode]` 선택자가 RN 에 없어 그 규칙이 계산하던 결과를 **파생 토큰 `--color-panel-border`** 로 미리 만들었고(step 1), 분기는 `theme-vars.ts` 에서 `definition.mode` 로 **딱 한 번** 일어난다. **테마 이름으로 가르지 않는다**([[ADR-064]] 결정 8 이 폐기한 수동 목록이 CSS 쪽에 되살아나는 것을 막는다) ✅ / **122 결정 3 의 두 클래스 중 `panel-on-scrim-parent` 짝은 RN 에 없다** — 자손 선택자가 없어 부모가 자식 스타일을 정할 방법이 없다. 그 결정이 지키려던 것을 **자식이 `border-panel-border` 를 직접 쓰는 것**으로 대신한다(스크림 없는 화면과 공유되는 자식은 프롭으로 받아야 — 화면 단계) / **RN 에서 갈린 것**: 포털 → `Modal` · `stopPropagation` → **`onStartShouldSetResponder`**(RN 엔 버블링이 없고 responder 를 안 가져가면 바깥 `Pressable` 이 받아 닫힌다 — 웹이 `stopClickPropagation` 을 걸던 **같은 자리**) · `overflow-y-auto` **안 옮김**(오버레이가 스크롤을 가지면 바깥 탭이 죽는다 → 107 결정 3 규칙대로 길어질 모달이 자기 스크롤포트를 갖는다) |
| `PartySizeModal` | 018, 064, 121, 122 | 121 결정 2 난이도+파티 인원을 함께·결정 3 **표시 전용**(모드를 모르고 난이도 선택의 뜻은 호출부가 정한다 — 두 모드를 통합할 때 지울 코드를 만들지 않는다)·결정 7 `Modal.Panel maxWidth="max-w-2xs"`(288 = 4난이도 칩이 안 접히는 하한)·전폭 스테퍼 ✅ / 064 결정 5 `MediaScope` 안에서 `bg-surface`·`text-text` 가 media-* 로 해석 ✅ / 018 bleed 레시피 + **`border-t` 는 `media-scope` 바깥**(검은마법사는 media-surface 가 surface 와 값이 같아 이 선이 유일한 경계) ✅ / 122 는 `Modal.Panel` 자식이라 **이 View 가 직접** `border-panel-border` 를 쓴다 ✅ / **RN 에서 갈린 것**: `bg-surface/60` 이 **안 나온다**(NativeWind v3 엔진은 `var()` 색에 투명도 접미사를 못 만든다 — step 3 이 남긴 함정) → 값에서 rgba 를 만들고, 그 값이 `surface` 가 아니라 **`mediaSurface`** 인 것도 같은 이유 · `textShadow` 두 겹을 **하나만**(RN 은 세 프롭이라 겹칠 수 없다) · `linear-gradient` 베일 → `expo-linear-gradient` / **일러스트 미도착**(에셋 레이어 — `crop` 값은 지금도 진짜다, `MEDIA_ART_FILTER`·`MEDIA_ART_MASK_HERO` 는 CSS 문자열이라 그때 함께 풀 자리) |
| `ProgressModal` | 016 | 016 예열 진행률 바를 그대로 재사용(신규 스타일 0) ✅ / 완료 시점에만 프로그램적으로 닫히므로 `onClose` 가 no-op — **안드로이드 뒤로가기도 아무 일이 없다**(웹에서 오버레이 클릭이 무시되던 것과 같은 뜻) ✅ / 바뀐 것은 `space-y-2`→`gap-2`·`<p>`→`<Text>` 둘뿐 |
| `Toast` | 063, 064 | 064 결정 2 톤 배경이 `*-tint` **토큰**(웹이 `color-mix` 로 우회하던 자리) ✅ / 063 액션은 아이콘만 보이고 라벨은 접근성 이름 · 뜻이 다른 액션은 자기 아이콘을 넘긴다(기본이 '다시 시도' 전제) ✅ / **스와이프 해제는 responder 프롭으로 그대로** — `@core/lib/swipe-dismiss` 의 임계 판정을 그대로 부르고 **`PanResponder` 를 안 쓴다**(그것은 터치 히스토리에서 제스처를 스스로 계산해 웹이 갖던 "시작점 + 현재 x" 모델을 대신 세우고, 테스트에서 `touchHistory` 를 지어내야 한다). **`onMove…` 에서만 responder 를 가져오는 것이 요점** — 시작에서 가져가면 안쪽 버튼이 안 눌린다(웹이 `closest('button')` 로 걸러내던 목적을 규칙이 구조로 해 준다) / **모션 완료**(step 7): `toast-shrink` 는 Reanimated CSS 애니메이션이고 웹이 인라인으로 넣던 지속시간(토스트마다 다르다 — 성공 2초/정보 2.5초)이 그대로 `animationDuration` 에 간다. `origin-left` → `transformOrigin` / 진입 트랜지션도 CSS 트랜지션으로 — 웹이 `transition-opacity` 라 **흐르는 것은 투명도뿐**이고 `translate-y-3 → 0` 은 즉시 튄다(투명도 0 이라 안 보인다), 드래그 중에는 프롭을 빼 손가락을 그대로 따라간다 / `motion-reduce:hidden` 짝 ✅ — 켜지면 남은 시간 바가 통째로 없다(줄지 않는 막대는 "시간이 안 간다"로 읽힌다) / **남은 어긋남**: core 의 `ToastAction.icon` 타입이 `lucide-react`(웹)라 RN 아이콘이 타입상 안 들어간다 — 렌더만 하는 이 파일은 무사하고 **아이콘을 넘기는 쪽**이 화면 단계에서 걸린다(core 무수정 원칙이라 사실만 적어 둔다) |
| `Toast/ToastStack` | 063 | 063 결정 4 자리(탭바 위 12px)·아래에서부터 쌓기 ✅ / **포털의 짝을 여기서 만들지 않았다** — 웹이 포털을 쓴 이유는 *"토스트는 항상 최상단"* 인데 RN 에서 그것을 주는 것은 `Modal` 뿐이고 안드로이드에서 그것은 화면 전체의 터치를 삼키는 다이얼로그다. 그래서 **자기가 놓인 자리에 절대 배치**로 그리고 어디에 마운트할지는 앱 셸이 정한다(화면 단계) / **남는 한계**: 그래도 `Modal` 이 열려 있는 동안 새로 뜬 토스트는 그 네이티브 윈도우 **뒤**에 가린다(웹은 z-60 으로 항상 앞). 실제로 걸리는 자리가 있다 — 파티 인원 모달이 열린 채 저장이 실패하면 그 토스트가 안 보인다. 오버레이를 한 루트 호스트로 모으면 풀리고, 그것은 화면 배선의 결정이라 미리 정하지 않았다 / 탭바 높이 `4rem` 가정은 [[ADR-099]] 가 웹에서 실측으로 바꾼 그 지점이라 셸 단계에서 다시 잰다 |

### templates (4 → RN 3)

**셋을 옮기고 하나를 버렸다**(3단계 step 6, 2026-08-12 — `packages/app-rn/src/components/templates/`).
각 행의 ADR 을 다시 읽고 그 동작이 새 코드에 있음을 확인한 결과가 «확인» 열이고, RN 에서 갈린 자리는
컴포넌트 주석과 [README «3-6단계 결과»](./README.md) 에 있다.

**이 계층의 벽은 `position: fixed` 가 없다는 것이다.** 웹 셸 셋이 전부 그 위에 서 있었는데
(`PageHeader` 고정 헤더 · `ScreenScroll` 뷰포트 상자 · `StackScreen` 오버레이 레이어) RN 에는 문서도
뷰포트 기준 위치도 없다. 그래서 **웹이 `fixed` 로 흉내 내던 것을 각자 원래 수단으로 되돌린다** —
헤더는 형제 뷰, 스크롤 상자는 `ScrollView` 자신, 오버레이는 네이티브 스택. 딸려서 **[[ADR-112]] 실측
machinery 와 [[ADR-120]] 전환 machinery 가 통째로 사라진다**(둘 다 `fixed`/포털이 만든 문제를 푸는
코드였다).

| 컴포넌트 | ADR 계약 | 확인 |
|---|---|---|
| `PageHeader` | 047, 077, 085, 088, 094, 098, 112, 123 | 094 결정 1 취약 구조를 한 셸에 ✅ / 088 결정 5-1 배경 조각 자리·**첫 자식** 순서(RN 은 형제 순서가 곧 그리는 순서라 `z-index:-1` 이 필요 없다) ✅ / 123 블러 없음 — RN 엔 `backdrop-filter` 자체가 없어 **구조로** 지켜진다 ✅ / `below` 슬롯 계약 그대로 ✅ / **085 결정 1 · 098 결정 2 · 112 는 형태가 바뀐다**: `fixed` + 실측 spacer 가 **스크롤 뷰의 형제**가 되어, 그 셋이 지키려던 것(*"헤더 위치가 스크롤 오프셋의 함수가 아니다"* · *"spacer 가 헤더와 같은 프레임에 맞는다"*)을 코드가 아니라 레이아웃이 만족한다 — spacer 도 `useMeasuredHeight` 도 없다(회귀 가드 테스트로 고정) / **047 결정 3 은 다음 단계 확인 대상** — `ScrollView` 의 sticky 헤더는 스크롤포트 상단에 붙는데 그 상단이 이미 페이지 헤더 아래라 그 오프셋이 0 이 될 공산이 크다([[ADR-100]] 결정 3 도 함께) |
| `ScreenScroll` | 077, 088, 098, 099, 120 | 099 결정 1 화면이 스크롤을 소유 — **RN 기본값이라 공짜** ✅ / 결정 5 인디케이터 색을 모드에서(`indicatorStyle`, iOS 프롭 — 안드로이드는 JS 로 못 정한다) ✅ / 결정 6 인셋을 **콘텐츠 패딩이 아니라 상자**에(인디케이터는 스크롤포트 위에 그려진다) ✅ / 결정 7 탭바 실측 → **구조**(탭 내비게이터가 이미 뺀 상자를 준다 — 잴 것도 어긋날 것도 없다) ✅ / 088 배경색 안 칠함 ✅ / 120 결정 16·19 두 조각은 `bottom-inset.ts` 로 분리 — **RN 은 3버튼과 제스처를 구분 못 해**(`tappableElement` 인셋이 없다) 플랫폼으로 가르고 안드로이드는 보수적인 쪽 / **`header` 프롭이 새로 생겼다** — `fixed` 가 없어 헤더가 형제여야 하고, 둘을 나란히 놓는 일을 화면마다 하면 094 가 없앤 복붙이 한 겹 위에서 되살아난다 / `overscroll-y-none` 은 **안 옮긴다**(스크롤 체이닝은 RN 에 없고 러버밴드는 099 결정 3 이 확인한 원하는 동작) / **PTR 은 아직 어느 쪽도 배선하지 않았다**([[ADR-074]] vs `RefreshControl` — 제품 결정) |
| `StackScreen` | 077, 092, 094, 120 | **옮기지 않았다 — RN 파일 0개.** 그것이 갖던 일곱 중 여섯을 네이티브 스택이 이미 한다(오버레이 레이어 · 푸시/팝 · 가장자리 스와이프 · 층 스크림 · 경계 그림자 · `navigate(-1)`) — 2단계가 `RootNavigator` 에 세운 그대로다. 나머지 셋도 사라진다: `StackIndexContext`·`depth` 는 **스토어 자체가 삭제**됐고(`screen-stack/`), `overlays` 프롭은 RN 모달이 네이티브 윈도우라 **스태킹 컨텍스트에 갇힐 일이 없어** 필요가 없다(화면이 형제로 그리면 된다), `parentPath` 는 딥링크가 없어 도달 경로가 없다. **남긴 것은 `scroll` 프롭 하나**이고 그 자리는 `ScreenScroll` 의 `hasTabBar={false}` 다 — 프롭 하나를 넘기는 래퍼를 새로 만들면 *"JS 스택 레이어가 아직 있다"* 로 읽힌다 / 077·092 의 계약(부모 언마운트 금지 · 중첩 Suspense)은 **React 트리의 성질**이라 스택 구조가 바뀌어도 그대로 서고, 지키는 주체가 4단계 화면 배선으로 넘어간다 |
| `ThemeHeaderBackdrop` | 088 | 결정 5-1 의 **판정만 옮겼다**(`definition.background` 유무로 가른다) ✅ / **그리는 몸통은 미도착** — RN 번들에 테마 배경 에셋이 없어(`lib/rn-theme-backgrounds.ts`) 배경을 선언한 두 테마에서도 `null` 이다. `BossPortrait` 이 플레이스홀더 분기만 온 것과 **같은 벽**이고, 그 사실을 테스트가 적어 둔다 |

---

## 4. `core` 로 이식 (141 파일 중 117 무수정 · 15 포트 역전 · 2 수정 · 7 삭제)

### features/ (14 모듈, 39/41 파일 무수정)

`ads` · `boss-profit` · `boss-scheduler` · `content-scheduler` · `drop-effect` · `live-update` ·
`onboarding` · `schedule-sync` · `settings` · `theme` · `toast` · `tracking-mode` · `prehydrate.ts`

- **수정 필요 1개**: `onboarding/store.ts`
  - ~~`theme/store.ts`(`matchMedia` → `Appearance`)~~ → **`ColorSchemePort` 로 해결**(2026-08-11).
    store 는 `getColorSchemePort().get()` 만 부르고 `matchMedia`/`Appearance` 는 어댑터가 갖는다
    (`rn-color-scheme.ts`) — store 자체는 무수정이다
- **삭제 1개**: `screen-stack/` — react-navigation이 대체

### lib/ · data/ · types/ · nexon/

- `lib/` 49파일 중 **41개 무수정**, 7개는 DOM 의존(삭제 대상), 1개(`use-system-back.ts`)는 **Capacitor
  직접 import** 라 포트 역전 대상이다
- `data/` 13파일 · `types/` 9파일 · `nexon/` 8파일 — **DOM·Capacitor 참조 0, 전량 무수정**
- `storage/` 21파일 중 **14개가 플러그인을 직접 import** 한다(아래 §5). core 로 옮기기 전에 의존을
  뒤집어야 한다 — 이것이 전환 1단계의 실질적 작업이고 단순 파일 이동이 아니다

> `data/` 는 [[ADR-006]] 대상이다. 전환 중에도 **AI가 임의로 값을 바꾸지 않는다** — 파일을 옮기기만 한다.

---

## 5. 어댑터 — 시그니처 고정, 구현만 교체

### native/ (11 파일, 605줄)

| 파일 | ADR 계약 | RN 구현 |
|---|---|---|
| `ads.ts` | 005, 090 | `react-native-google-mobile-ads` **16.0.3 고정** — 아래 |
| `live-update.ts` | 022, 024, 026, 027, 117, 119, 126 | `expo-updates` — **재설계 필요**([[ADR-128]] 결정 7). 그때까지 **던지는 구현** |
| `back-gesture.ts` | 003, 120 | **삭제** — 네이티브 스택 기본. 3단계까지 **던지는 구현** |
| `splash-screen.ts` | 025, 027, 117 | `expo-splash-screen` **~57.0.6** — 아래 |
| `notifications.ts` | — | `notifee` — [data.md](./data.md) 결정 4 |
| `hunting-timer/` | 005 | **옮길 구현이 없다** — 아래 |
| `keyboard.ts` · `status-bar.ts` | — | RN 내장(`Keyboard`·`StatusBar`) — 아래 |
| `system-bars.ts` | 099 | **완료**(3단계 step 6) — 두 메서드의 사정이 갈렸다: `setNavigationBarStyle` 은 로컬 Expo 모듈(`modules/app-system-bars`, 웹뷰 플러그인의 그 한 줄), `refreshSafeAreaInsets` 는 **의도적 no-op**(safe-area-context 가 이미 자동으로 한다 — `rn-system-bars.ts`) |
| (`ThemeAppearancePort`) | 064, 099, 122 | **완료**(3단계 step 1) — `vars()` 로 렌더 트리에 값을 내린다(`rn-theme-appearance.ts` + `src/theme/`) |
| (`ColorSchemePort`) | 009, 104 | RN 내장 `Appearance` — 아래 |

`hunting-timer/` 는 **옮길 것이 없다**(2026-08-11 확인). [[ADR-005]] 가 정한 Android Foreground
Service·iOS Live Activity 커스텀 플러그인은 **작성된 적이 없다** — 저장소 전체에서 `HuntingTimer` 를
담은 `.java`/`.kt`/`.swift` 가 0건이고, Capacitor 쪽에 있는 것은 `registerPlugin('HuntingTimer',
{ web })` 한 줄뿐이다. `@capacitor/core` 를 따라가면 네이티브에는 등록된 구현도 `PluginHeaders`
항목도 없어 세 메서드가 **`UNIMPLEMENTED` 로 거부**되고, 인메모리 폴백(`HuntingTimerWeb`)은
브라우저에서만 쓰인다. 그래서 RN 어댑터도 **거부한다**(`rn-hunting-timer.ts`) — 인메모리 폴백을
옮기면 웹 전용 동작을 네이티브로 승격시키는 것이고, `start()` 가 조용히 resolve 하면 화면은 타이머가
도는 줄 아는데 알림도 소리도 없다. **[[ADR-005]] 를 실제로 구현할지는 전환과 별개 결정이다**(소비자도
없다 — `app/hunting-timer/`·`features/hunting-timer/` 는 디렉터리 자체가 없다).

`ads.ts` 는 **판정을 옮기지 않는다**(2026-08-11 구현). 광고 단위 ID·테스트 광고 여부는
`packages/core` 의 순수 함수 둘이 계속 갖고, RN 어댑터는 그것을 부르기만 한다 — 실 ID로 자기 광고를
누르면 AdMob 계정이 정지되는데 그 방어선이 플랫폼마다 두 벌이 되면 한쪽만 틀려도 사고가 난다.
어댑터가 새로 정한 것은 **인자를 무엇으로 채우는가** 하나이고(`EXPO_PUBLIC_*` + `__DEV__`,
`ads-env.ts`), 앱 ID(`~`)는 `app.json` 의 config plugin 인자에 두어 `expo prebuild` 가 두 네이티브
설정에 쓴다. 버전을 **16.0.3 으로 고정**한 이유는 최신 16.4.0 이 끌어오는 play-services-ads 25.4.0 이
Kotlin 메타데이터 2.3 이라 RN 0.86(Kotlin 2.1)에서 컴파일이 깨지기 때문이고, 16.0.3 의 24.9.0 은
지금 배포 중인 Capacitor 앱과 같은 라인이다. 자세한 내용은 [features/ads.md](../features/ads.md).

**시스템 어댑터 넷은 RN 내장으로 끝난다**(2026-08-11 구현 — `ColorSchemePort`·`KeyboardPort`·
`StatusBarPort`·`SplashScreenPort`). 새 의존성은 `expo-splash-screen` **하나**뿐이고 나머지 셋은
`Appearance`·`Keyboard`·`StatusBar` 다. 각 자리에서 실제로 정한 것:

- **`ColorSchemePort`** — `Appearance.getColorScheme()` 이 **`null` 을 줄 수 있어**(네이티브 모듈이
  없거나 OS가 판정을 안 준 경우) 라이트로 폴백한다. Capacitor 가 `matchMedia` 부재에 내린 것과 같은
  판단이고, 모르는 것을 다크로 읽으면 **저장된 테마가 없는 첫 실행이 통째로 다크로 열린다.**
  `addChangeListener` 는 **쓰지 않는다** — 이 값은 1회성 판정에만 쓰이고([[ADR-104]]) 부를 곳이 없는
  구독 API는 구현마다 죽은 코드가 된다(포트 주석의 판단).
- **`StatusBarPort`** — **다크 테마 → 밝은 글리프**(`'light-content'`). Capacitor 의
  `isDarkTheme ? Style.Dark : Style.Light` 와 같은 방향인데, 그 enum 이름은 글리프가 아니라 **배경**을
  가리키기 때문이다(`Style.Dark` = *"Light text for dark backgrounds"*). 이름만 보고 옮기면 정확히
  뒤집히고, 그러면 어두운 배경에 어두운 글자가 되어 **실기기에서만** 드러난다. `'default'` 는 OS
  설정을 따라가 앱이 고른 테마와 어긋나므로 쓰지 않는다.
- **`KeyboardPort`** — `keyboardDidShow`/`keyboardDidHide` 다. Capacitor 는 `will` 계열이었지만 RN 에서
  그 둘은 **iOS 에서만** 오고, 안드로이드에서 안 오는 이벤트에 매달리면 그 플랫폼에서 탭바가 키보드
  위에 남는다(둘 다 듣는 것도 답이 아니다 — iOS 에서 두 번 불린다). 안드로이드는 그마저도
  `windowSoftInputMode` 에 따라 안 올 수 있는데, 그때는 **아무것도 부르지 않는다** — 타이머·포커스
  추적으로 거짓 신호를 만들면 키보드가 없는데 탭바가 사라지고 원인을 못 짚는다.
- **`SplashScreenPort`** — `expo-splash-screen` 을 고른 것은 버전이 **SDK 에 묶이기** 때문이다
  (`bundledNativeModules.json` 이 SDK 57 짝으로 지정한 `~57.0.6`, 이미 있는 `expo-status-bar` 와 같은
  라인). 후보였던 `react-native-bootsplash`(같은 파일이 `^6.3.10`)는 SDK 와 독립적으로 움직이고 에셋
  생성 CLI 를 따로 돌려야 하는데, 바로 위 `ads.ts` 가 그 독립 버저닝 때문에 빌드를 깨뜨렸다. **둘 다
  다시 띄우는 API 가 없어** 그 축은 선택에 영향을 주지 않았다.
  - **`show()` 는 no-op 이다** — 웹뷰 리로드가 없어 덮을 구간 자체가 생기지 않는다([[ADR-117]] 결정
    1·8 이 덮으려던 그 구간). `preventAutoHideAsync()` 로 흉내 내면 **이미 내려간 스플래시에는 아무
    효과가 없어** 화면은 그대로인데 호출부만 덮였다고 믿는다. step 7 의 미구현 포트(거부)와 성격이
    다르다 — 이쪽은 *"이 플랫폼에 그 개념이 없다"* 라서 정당한 no-op 이다.
  - **DOM 커버는 옮기지 않는다** — `#boot-cover`·`[data-splash-cover]` 는 정의상 웹뷰 구현이고
    ([[ADR-117]] 결정 4) RN 에는 문서가 없다.
  - **스플래시를 계속 띄워 두는 일은 어댑터 밖이다.** Capacitor 에서 그것은 코드가 아니라 설정이었고
    (`launchAutoHide: false`), RN 짝은 앱 진입점 **전역 스코프**의 `preventAutoHideAsync()` 다
    (라이브러리 문서가 컴포넌트·훅 안에서 부르지 말라고 명시 — 늦으면 이미 내려간 뒤다). 부팅 흐름
    배선 단계의 몫이다.

`live-update.ts` 만 성격이 다르다. 다른 어댑터는 같은 일을 하는 다른 SDK로 바꾸는 것이지만, 이쪽은
**OTA 프로토콜 자체가 바뀐다**(@capgo 자체 호스팅 매니페스트 → expo-updates). [[ADR-022]]·[[ADR-026]]·
[[ADR-119]]·[[ADR-126]] 이 정한 매니페스트 형식(`highlights` · `minNativeVersion` · 채널)을 새 프로토콜에
어떻게 싣는지는 **별도 ADR이 필요하다.**

### 부팅 배선 — 포트 13종, 그중 셋은 «던지는 구현» (2026-08-11 · 테마 해소 2026-08-12)

주입은 `packages/app-rn/src/boot.ts` 의 `installPorts()` 한 함수이고, 진입점 `index.ts` 가
`registerRootComponent(App)` **앞에서** 부른다(웹 쪽 짝은 `main.tsx` + `native/adapters/index.ts`).
세터를 한 자리에 모으는 이유는 하나가 빠지면 **그 기능만** 던지고 나머지는 멀쩡히 돌아 발견이 늦기
때문이다.

포트는 **13종**이고 RN 구현이 있는 것은 열이다. 나머지 셋은 `native/adapters/not-implemented.ts`
가 채우되 **부르면 던진다** — 조용한 no-op 으로 두면 나중에 안전영역이 0 일 때 원인을 못 찾는다.
같은 «아무것도 안 함»이라도 둘은 구분해야 한다:

| | 예 | 처리 |
|---|---|---|
| 이 플랫폼에 개념이 없다 | `SplashScreenPort.show()` — RN 엔 웹뷰 리로드가 없어 덮을 구간이 안 생긴다 | **정당한 no-op** |
| 해야 하는데 아직 안 했다 | `LiveUpdatePort` (마지막 하나) | **던진다** — 무엇이·왜·어디를 보면 되는지를 담아서 |

- **`LiveUpdatePort` — 별도 ADR** 몫이다(위 문단). 그래서 이 하나만 메시지가 «3단계»가 아니라
  [[ADR-128]] 결정 7 을 가리킨다 — 3단계라고 말하면 틀린 안내가 된다. **3단계가 끝난 지금 이 목록에
  남은 것은 이것 하나다.**
- **`ThemeAppearancePort` 는 이 목록을 떠났다**(3단계 step 1, 2026-08-12). 진단은 맞았다 — 어댑터를 잘
  짜는 문제가 아니라 값이 흐르는 방향이 반대였고, 그래서 포트가 놓은 값을 React 가 구독하는 구조가
  됐다(아래 «3-1단계 결과»는 [README.md](./README.md)).
- **`BackGesturePort`·`SystemBarsPort` 도 떠났다**(step 2·6). 진단은 **절반씩 맞았다** — 둘 다 셋/둘
  중 일부만 프레임워크가 대신했고, 나머지는 *"어댑터를 잘 짜는 문제가 아니다"* 가 아니라 그냥 남는
  일이었다: `moveToBackground`([[ADR-120]] 결정 18)와 `setNavigationBarStyle`(창 설정)은 어느 쪽도
  뷰 레이어가 아니라 로컬 Expo 모듈로 갔다. 짝이 되는 나머지는 사유가 갈린다 — 뒤로가기 둘은
  *"이제 네이티브 스택이 소유한다"* 라 계속 던지고, `refreshSafeAreaInsets` 는 *"safe-area-context 가
  이미 자동으로 한다"* 라 **의도적 no-op** 이다(던지면 정상 동작을 고장으로 보고하는 셈이 된다).

> 매핑되지 않은 포트는 처음 **넷**이었다(9 + 4 = 13, step 사양의 «미구현 3종»은 `LiveUpdatePort` 를
> 빼고 센 것이다). `LiveUpdatePort` 를 빼 두면 `installPorts()` 가 *"전부를 한 자리에서 보장한다"* 는 자기 목적을 못
> 지키고, 그 자리는 슬롯의 일반 메시지(*"주입되지 않았습니다"*)로 떨어져 **왜** 없는지를 말하지
> 않는다. 기대 목록을 손으로 적지 않고 **core 가 내보내는 `get*Port` 전부와 대조**하는 테스트를 둔
> 것도 같은 이유다 — core 에 포트가 늘면 배선을 고칠 때까지 빨개진다.

### storage/ (21 파일, 1,554줄)

| 파일 | ADR 계약 |
|---|---|
| `sqlite/db.ts` | 027, 038, 050, 052, 069, 117, 124 |
| `boss-profit.ts` | 014, 054, 068, 069, 071 |
| `boss-drops.ts` | 038, 071, 124 |
| `character-basic-cache.ts` | 016, 017, 086 |
| `schedule-probe-ledger.ts` | 034, 067, 086 |
| `keys.ts` | 030, 035, 042, 086, 090, 126 |
| `cache-data.ts` | 023, 052, 058 |
| `last-run-bundle-version.ts` | 065, 117, 126 |
| `api-key.ts` | 007, 115 |
| `character-selection.ts` | 013, 042 |
| `tracking-mode.ts` | 035, 086 |
| `manual-tracked-content.ts` | 035 |
| `pending-notice.ts` | 065 |
| `drop-effect.ts` | 040 |
| `ads.ts` | 090 |
| `boss-party-settings.ts` · `boss-profit-period-checks.ts` · `scheduler-cache.ts` · `shared-progress-cache.ts` · `theme.ts` · `index.ts` | — |

---

## 6. 테스트 인벤토리 (197 파일)

| 위치 | 총 | DOM 의존 | 처리 |
|---|---|---|---|
| `app/` | 40 | **39** | 재작성 |
| `components/` | 31 | **30** | 재작성 |
| `features/` | 38 | 4 | 대체로 유지 |
| `lib/` | 40 | 3 | 대체로 유지 |
| `storage/` | 18 | 0 | 유지 |
| `native/` | 9 | 0 | 유지 |
| `nexon/` | 6 | 0 | 유지 |
| `data/` | 10 | 0 | 유지 |
| `__tests__/` | 5 | 2 | 일부 재작성 |
| **합계** | **197** | **78** | |

### DOM 스냅샷 3종 — 대체 장치를 먼저 정할 것

| 스냅샷 | 줄 |
|---|---|
| `BossProfitScreen.dom-snapshot.test.tsx.snap` | **725** |
| `ContentScreen.dom-snapshot.test.tsx.snap` | 195 |
| `BossScreen.dom-snapshot.test.tsx.snap` | 122 |
| `Modal.dom-snapshot.test.tsx.snap` | 31 |
| `PageHeader.test.tsx.snap` | 13 |
| (공용 `src/__tests__/dom-snapshot.helper.ts`) | — |

**이식이 불가능하다** — 스냅샷 내용이 DOM 트리다. 그런데 이 셋은 하필 **화면 셋 중 가장 복잡한
셋**이고, 이 전환이 가장 많이 하게 될 질문("예전과 같은가")에 기계적으로 답하던 유일한 장치다.

**결정(2026-08-11)**: RN 렌더 트리 스냅샷(`@testing-library/react-native` 의 `toJSON()`)을 **새
기준선**으로 잡고, 예전과의 대조는 두 앱을 나란히 띄워 **사람이 판정**한다.

완전한 대체가 아니라는 점을 분명히 해둔다 — RN 트리는 DOM 트리와 구조가 달라 기존 `.snap` 과 대조가
안 되고, 픽셀 비교도 폰트 래스터라이징 차이로 실패한다. 새 스냅샷이 답하는 것은 *"앞으로 안 바뀌는가"*
이지 *"예전과 같은가"* 가 아니다. 뒤엣것은 육안 검증의 몫이고, 그래서 **화면마다 두 앱을 나란히 본
기록을 남긴다**(`migration/README.md` «잃는 안전망»).

---

## 7. 위험 순위

재작성 순서를 정할 때 참고한다. 위험한 것을 먼저 하면 늦게 발견해서 생기는 손해가 줄고, 나중에 하면
앞선 작업으로 RN 숙련도가 올라간 상태로 만난다. **권장은 「가장 위험한 것을 3단계 직후에」** — 골격이
잡히자마자, 그러나 일정 여유가 남아 있을 때.

| 순위 | 대상 | 이유 |
|---|---|---|
| 1 | `BossProfitScreen.tsx` | ADR 32개. 단독 계획 필요 |
| 2 | `native/live-update.ts` | OTA 프로토콜 자체가 바뀜 — 별도 ADR 필요 |
| 3 | 데이터 보존 | 실패 시 복구 불가([data.md](./data.md)) |
| 4 | `BossScreen.tsx` | ADR 26개 |
| 5 | ~~CSS `@keyframes` 8종~~ → **7종 중 4종 이식 완료**(3단계 step 7) | 선언형 → 명령형 재구현, 판정이 주관적. 남은 셋(`valuable-drop-*`)은 **화면 계층**이라 4단계 몫이고, 판정(육안 대조)은 여전히 남았다 |
| 6 | `ContentScreen.tsx` | ADR 21개 |
| 7 | DOM 스냅샷 대체 장치 | 없으면 나머지 전부의 검증 근거가 사라짐 |
| 8 | `CharacterTrackingPicker` | ADR 11개 + 계정 전환 이력([[ADR-086]]) |

---

## 폐기된 정책 (history)

- (아직 없음 — 이 문서는 [[ADR-128]] 과 함께 신설됐다)
