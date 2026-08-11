# 패리티 인벤토리 — 옮길 대상 전수 목록

**범위**: 전환 대상 전 파일의 목록과 **각 파일에 걸린 ADR 계약**. 전략·단계는 [README.md](./README.md),
데이터 보존은 [data.md](./data.md).

**관련 소스(read/write)**: `src/**` 전체

**관련 ADR**: [[ADR-127]] · 아래 표에 나열된 113개

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
| `/settings/privacy` | `SettingsPrivacyScreen` | 탭 4 위 push | |

**보존해야 할 라우팅 동작**

- 온보딩 미완료 시 모든 탭이 `/onboarding` 으로 `replace` (완료 시 그 반대)
- 탭 이동은 `NavLink` 가 아니라 **인터셉터**가 책임진다(`App.tsx:196`) — 전면광고 게이트([[ADR-090]])가
  거기 걸려 있다. RN에서는 탭 `listeners` 로 옮긴다
- `/settings/guide/:guideId` 와 `/settings/release-notes/:guideId` 가 **같은 화면**을 그린다([[ADR-125]])

---

## 2. `app/` — 전면 재작성 (9.7k줄)

### 2.1 최상위

| 파일 | ADR 계약 |
|---|---|
| `App.tsx` (573줄) | 스택·탭·라우팅·광고 인터셉터 — **분해 대상**, 아래 참조 |
| `ApiKeyNoticeModal.tsx` | 114, 115, 116 |
| `UpdatePromptModal.tsx` | 027, 061, 065, 117, 119, 125, 126 |

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

| 컴포넌트 | ADR 계약 |
|---|---|
| `AnimatedMeso` | 046, 087 |
| `Badge` | 094 |
| `Button` (+ `variants.ts`) | 094 |
| `Card` | 094 |
| `DifficultyBadge` | — |
| `MapleSpinner` | — |
| `MapleSweepSpinner` | 061 |
| `ProfitIcon` | 066 |
| `ProgressBar` | 061, 094 |

### molecules (11)

| 컴포넌트 | ADR 계약 |
|---|---|
| `BossPortrait` | — |
| `CharacterSelectDropdown` | 001, 096 |
| `DifficultySegment` | 121 |
| `EmptyState` (+ `UnavailableNotice`) | 060, 066 / 060, 067, 068 |
| `ErrorState` (+ `StaleBanner`) | 060, 061, 062, 114, 116 / 016, 017, 062, 094, 114 |
| `LoadingState` | 016, 061 |
| `PartySizeStepper` | 121 |
| `PullToRefreshIndicator` | 047, 061, 073, 074 |
| `ValuableDropBadge` | 045, 046, 071 |

### organisms (10)

| 컴포넌트 | ADR 계약 |
|---|---|
| `BottomSheet` | 038, 039 |
| `CharacterTrackingPicker` (+ `CharacterTrackingGrid`) | 016, 017, 043, 053, 062, 067, 086, 107, 114, 115, 122 / 015, 035, 054, 068, 107 |
| `DropEffectOverlay` | 038, 039, 048, 064, 103 |
| `ErrorBoundary` | 065, 117 |
| `Modal` | 065, 094, 122 |
| `PartySizeModal` | 018, 064, 121, 122 |
| `ProgressModal` | 016 |
| `Toast` (+ `ToastStack`) | 063, 064 |

### templates (4)

| 컴포넌트 | ADR 계약 | 비고 |
|---|---|---|
| `PageHeader` | 047, 077, 085, 088, 094, 098, 112, 123 | |
| `ScreenScroll` | 077, 088, 098, 099, 120 | RN `ScrollView`/`FlashList` 로 |
| `StackScreen` | 077, 092, 094, 120 | **대부분 삭제** — 네이티브 스택이 대체 |
| `ThemeHeaderBackdrop` | 088 | |

---

## 4. `core` 로 이식 (141 파일 중 117 무수정 · 15 포트 역전 · 2 수정 · 7 삭제)

### features/ (14 모듈, 39/41 파일 무수정)

`ads` · `boss-profit` · `boss-scheduler` · `content-scheduler` · `drop-effect` · `live-update` ·
`onboarding` · `schedule-sync` · `settings` · `theme` · `toast` · `tracking-mode` · `prehydrate.ts`

- **수정 필요 2개**: `theme/store.ts`(`matchMedia` → `Appearance`) · `onboarding/store.ts`
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
| `ads.ts` | 005, 090 | `react-native-google-mobile-ads` |
| `live-update.ts` | 022, 024, 026, 027, 117, 119, 126 | `expo-updates` — **재설계 필요** |
| `back-gesture.ts` | 003, 120 | **삭제** — 네이티브 스택 기본 |
| `splash-screen.ts` | 025, 027, 117 | `react-native-bootsplash` |
| `notifications.ts` | — | `notifee` — [data.md](./data.md) 결정 4 |
| `hunting-timer/` | 005 | **옮길 구현이 없다** — 아래 |
| `keyboard.ts` · `status-bar.ts` · `system-bars.ts` | — | 대부분 내장으로 대체 |

`hunting-timer/` 는 **옮길 것이 없다**(2026-08-11 확인). [[ADR-005]] 가 정한 Android Foreground
Service·iOS Live Activity 커스텀 플러그인은 **작성된 적이 없다** — 저장소 전체에서 `HuntingTimer` 를
담은 `.java`/`.kt`/`.swift` 가 0건이고, Capacitor 쪽에 있는 것은 `registerPlugin('HuntingTimer',
{ web })` 한 줄뿐이다. `@capacitor/core` 를 따라가면 네이티브에는 등록된 구현도 `PluginHeaders`
항목도 없어 세 메서드가 **`UNIMPLEMENTED` 로 거부**되고, 인메모리 폴백(`HuntingTimerWeb`)은
브라우저에서만 쓰인다. 그래서 RN 어댑터도 **거부한다**(`rn-hunting-timer.ts`) — 인메모리 폴백을
옮기면 웹 전용 동작을 네이티브로 승격시키는 것이고, `start()` 가 조용히 resolve 하면 화면은 타이머가
도는 줄 아는데 알림도 소리도 없다. **[[ADR-005]] 를 실제로 구현할지는 전환과 별개 결정이다**(소비자도
없다 — `app/hunting-timer/`·`features/hunting-timer/` 는 디렉터리 자체가 없다).

`live-update.ts` 만 성격이 다르다. 다른 어댑터는 같은 일을 하는 다른 SDK로 바꾸는 것이지만, 이쪽은
**OTA 프로토콜 자체가 바뀐다**(@capgo 자체 호스팅 매니페스트 → expo-updates). [[ADR-022]]·[[ADR-026]]·
[[ADR-119]]·[[ADR-126]] 이 정한 매니페스트 형식(`highlights` · `minNativeVersion` · 채널)을 새 프로토콜에
어떻게 싣는지는 **별도 ADR이 필요하다.**

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

| 파일 |
|---|
| `app/boss-profit/__tests__/BossProfitScreen.dom-snapshot.test.tsx` |
| `app/boss-scheduler/__tests__/BossScreen.dom-snapshot.test.tsx` |
| `app/content-scheduler/__tests__/ContentScreen.dom-snapshot.test.tsx` |
| (공용 `src/__tests__/dom-snapshot.helper.ts`) |

**이식이 불가능하다** — 스냅샷 내용이 DOM 트리다. 그런데 이 셋은 하필 **화면 셋 중 가장 복잡한
셋**이고, 이 전환이 가장 많이 하게 될 질문("예전과 같은가")에 기계적으로 답하던 유일한 장치다.

3단계 시작 **전에** 무엇이 그 자리를 대신할지 정한다. 후보:

- RN 렌더 트리 스냅샷(`@testing-library/react-native` 의 `toJSON()`) — 성격이 가장 가깝다
- 화면 스크린샷 회귀(실기기/시뮬레이터) — 시각 패리티까지 잡지만 운용 비용이 크다
- 둘 다 안 하기 — **그럼 패리티 주장에 근거가 없다는 것을 문서에 남길 것**

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
| 5 | CSS `@keyframes` 8종 | 선언형 → 명령형 재구현, 판정이 주관적 |
| 6 | `ContentScreen.tsx` | ADR 21개 |
| 7 | DOM 스냅샷 대체 장치 | 없으면 나머지 전부의 검증 근거가 사라짐 |
| 8 | `CharacterTrackingPicker` | ADR 11개 + 계정 전환 이력([[ADR-086]]) |

---

## 폐기된 정책 (history)

- (아직 없음 — 이 문서는 [[ADR-127]] 과 함께 신설됐다)
