# 내비게이션

화면이 어떻게 쌓이고 오가는지, 하단바가 무엇을 보여 주는지를 다룬다. 이렇게 만든 이유는 [[ADR-059]] 에 있다.
화면 안의 스크롤과 하단 여백은 [[ADR-063]], 화면마다 배경을 그리는 방법은 [[ADR-055]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `navigation/AppNavigation.tsx` | `NavigationContainer`. 알림을 눌렀을 때 공지 상세와 파티 약속 화면으로 보내고, 업데이트 안내와 월드 이전 안내 모달을 띄운다 |
| `navigation/RootNavigator.tsx` | 루트 스택. 진입 전에는 온보딩 화면 넷, 진입 뒤에는 `Main`(`LayerStack`)과 하위 페이지 열아홉 |
| `navigation/LayerStack.tsx` | 그룹 행과 하위 행을 레이어로 하나씩 쌓는 스택. `layout` 에서 하단바와 `BottomBarOverlayHost` 를 그린다 |
| `navigation/tab-layer-props.tsx` | 레이어 안 탭 내비게이터 셋이 함께 쓰는 props(`backBehavior="none"`, 바 숨김, 배경) |
| `navigation/push-screen-options.ts` | `PUSH_SCREEN_OPTIONS`. 두 스택이 같은 전환과 제스처를 쓰게 하는 상수 |
| `navigation/routes.ts` | `ROUTE_TABLE` 과 라우트 이름 타입, `INITIAL_TAB_ROUTE`, `LAYER_STACK_ID` |
| `navigation/bar-groups.ts` | `BAR_GROUPS` 표와, 누름을 `BarIntent` 로 바꾸는 순수 함수 |
| `navigation/page-from-layer-state.ts` | `LayerStack` 상태에서 지금 페이지를 읽는다 |
| `navigation/tab-navigate.ts` | 페이지 이름을 두 단계로 중첩된 이동 인자로 바꾼다 |
| `navigation/scroll-to-top.ts` | 라우트 이름별 맨 위 스크롤 함수 표 |
| `navigation/navigation-theme.ts` | react-navigation 이 칠하는 배경 · 카드 · 테두리 색을 테마에서 가져온다 |
| `navigation/LedgerLoadingModal.tsx` | 수익·지출 레이어가 데이터를 오래 불러올 때 띄우는 모달 |
| `components/organisms/BottomBar/BottomBar.tsx` | 하단바 그리기와 누름 처리 |
| `components/organisms/BottomBar/bar-colors.ts` | 테마에서 바 색을 계산한다 |
| `components/organisms/BottomBar/bar-store.ts` | 그룹마다 마지막으로 보던 하위(`lastSub`) |
| `components/organisms/BottomBar/double-tap.ts` | 두 번 누름 판정(`isSecondTap`, 300ms) |
| `components/organisms/BottomBar/BottomBarOverlay.tsx` | 화면이 띄우는 것을 바 위에 그리는 포털([[ADR-062]]) |
| `lib/bottom-bar-metrics.ts` | 창 폭에서 바 치수를 계산한다 |
| `hooks/useOpenTab.ts` | 화면이 페이지 이름으로 탭을 연다 |
| `hooks/useScreenNavigation.ts` · `hooks/useSettingsNavigation.ts` | 화면이 하위 페이지를 열고 닫는다(둘은 같은 훅) |
| `hooks/useScrollToTop.ts` | 맨 위 스크롤 함수를 등록하거나 부른다 |
| `hooks/useRootBackToBackground.ts` | 안드로이드에서 되돌아갈 화면이 없을 때 뒤로 가기를 받아 백그라운드로 보낸다 |
| `hooks/useScreenFocused.ts` | 이 화면이 지금 보이는지. 내비게이터 밖이면 늘 `true` |
| `native/haptics.ts` | `tapFeedback()` · `selectionFeedback()` |

## 화면 구조

```
RootStack
├─ (진입 전) SignIn · CharacterSetup · MvpGradePick · MvpGradeConfirm
└─ (진입 뒤)
   ├─ Main (LayerStack)
   │   ├─ Groups        Today · Utility · Settings
   │   ├─ ScheduleSubs  Appointments · Content · Boss
   │   ├─ LedgerSubs    Profit · Cashbook · Stats
   │   └─ BottomBar
   └─ 하위 페이지 열아홉
```

진입 전과 진입 뒤에는 `useAppEntryStore` 의 `stage` 에 따라 화면 목록 자체가 바뀐다. 진입한 뒤에는 온보딩으로 돌아가는
히스토리가 없다([[ADR-026]]). 앱은 `Groups` 의 `Today` 에서 시작한다.

| 하위 페이지 | 라우트 |
|---|---|
| 컨텐츠 관리 · 보스 관리 | `ContentManage` · `BossManage` |
| 드롭 히스토리 · 아이템 가격 입력 | `DropHistory` · `DropPrice` |
| 기능 설명 목록 · 상세 | `SettingsFeatureGuideList` · `SettingsFeatureGuide` |
| 개발 노트 목록 · 상세 | `SettingsReleaseNotes` · `SettingsReleaseNoteGuide` |
| 계정 및 데이터 · 앱 정보 | `SettingsAccountData` · `SettingsAbout` |
| 캐릭터 관리 | `SettingsCharacters` |
| 공지 목록 · 알림 설정 · 공지 상세 | `SettingsNotices` · `SettingsNoticeAlerts` · `SettingsNoticeDetail` |
| MVP 등급 · 등급 이력 | `SettingsMvpGrade` · `SettingsMvpGradeHistory` |
| 설정(더보기 머리의 톱니바퀴) | `AppSettings` |
| 판매 분배금 계산기 | `UtilityItemSplit` |
| 주간 보스 수익 계산기 · 계산 기록 | `UtilityBossProfitCalculator` · `UtilityBossProfitCalculatorRecords` |

기능 설명 상세와 개발 노트 상세는 라우트 이름이 다르지만 같은 화면(`SettingsFeatureGuideScreen`)을 그린다.

## 하단바

| 그룹 | 라벨 | 하위 행 |
|---|---|---|
| `today` | today | 없음 |
| `schedule` | 스케줄러 | 파티 스케줄 · 컨텐츠 · 보스 |
| `ledger` | 수익·지출 | 보스 수익 · 가계부 · 통계 |
| `utility` | 유틸리티 | 없음 |
| `settings` | 더보기 | 없음 |

| 누른 것 | 지금 위치 | 일어나는 일 |
|---|---|---|
| 하위가 있는 그룹 | 그룹 행 | 그 레이어가 오른쪽에서 밀려 들어오고 바가 하위 행으로 바뀐다. 마지막으로 보던 하위가 열린다 |
| 하위가 없는 그룹 | 그룹 행 | 같은 레이어 안에서 바로 바뀐다. 전환 없음 |
| 하위 | 하위 행 | 같은 레이어 안에서 바로 바뀐다. 스택이 자라지 않는다 |
| ← | 하위 행 | 그 그룹에 들어오기 전 화면으로 돌아간다. iOS 가장자리 스와이프와 안드로이드 뒤로 가기도 같다 |
| 활성 항목 두 번(300ms 안) | 어디서나 | 그 화면을 맨 위로 스크롤한다 |
| 활성 항목 한 번 | 어디서나 | 아무 일도 없다 |

탭 이동과 ← 는 `tapFeedback()` 햅틱을 낸다. 활성 항목을 누를 때와 맨 위로 스크롤할 때는 내지 않는다.

하위 페이지가 열리면 바는 아래 화면과 함께 왼쪽으로 밀려 나간다. 키보드가 떠 있는 동안에는 바를 그리지 않는다.

## 이동 방법

| 하려는 것 | 쓰는 것 |
|---|---|
| 하위 페이지 열기 · 닫기 | `useScreenNavigation()` 의 `navigate(라우트)` · `goBack()` |
| 다른 탭 열기 | `useOpenTab()(페이지, 파라미터)`. 그룹 페이지로 가면 `Groups` 까지 되돌아간 뒤 연다 |
| 화면 안 버튼으로 맨 위 스크롤 | `useScrollToTop()` |
| 컨테이너 밖에서 이동(알림 탭) | `AppNavigation` 의 `navigationRef`. 목적지가 화면 목록에 생긴 뒤에 push 한다 |

하위 페이지를 더할 때 고칠 곳은 `routes.ts` 의 `ROUTE_TABLE` 한 줄과 `RootNavigator.tsx` 의 `STACK_SCREENS` 한
줄이다. `STACK_SCREENS` 가 `Record<StackRouteName, …>` 이어서 하나만 고치면 컴파일이 안 된다.

## 하단바 치수

| 값 | 계산 |
|---|---|
| 폭 | `min(창 폭 − 28, 420)`, 남는 폭은 좌우로 나눈다 |
| 높이 | `round(폭 × 72 / 374)`, 최소 64 |
| 위치 | 하단 안전영역 바로 위. 안드로이드는 안전영역 최소 34 |
| 안쪽 여백 · 알약 | 여백 3, 알약 높이는 바 높이 − 6, 알약 폭은 칸 폭 + 23 |
| 아이콘 · 라벨 | 아이콘 25, 선 굵기 1.5, 간격 4, 라벨 10.5px |

재질은 iOS 26 이상에서 `GlassView`(바 `regular` · 알약 `clear`), 그 밖에서는 불투명 캡슐이다. 색은
`resolveBarColors` 가 테마에서 계산한다. 자세한 규칙은 [[ADR-059]] 결정 11 · 12 에 있다.
