# 내비게이션

화면이 어떻게 쌓이고 오가는지, 하단바가 무엇을 보여 주는지를 다룬다. 이렇게 만든 이유는 [[ADR-059]] 에 있다.
화면 안의 스크롤과 하단 여백은 [[ADR-063]], 화면마다 배경을 그리는 방법은 [[ADR-055]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `navigation/AppNavigation.tsx` | `NavigationContainer`. 알림을 눌렀을 때 공지 상세와 파티 약속 화면으로 보내고, 업데이트 안내와 월드 이전 안내 모달을 띄운다 |
| `navigation/RootNavigator.tsx` | 루트 스택. 진입 전에는 온보딩 화면 넷, 진입 뒤에는 `Main`(`LayerStack`)과 하위 페이지 스물둘 |
| `navigation/LayerStack.tsx` | 그룹 행과 하위 행을 레이어로 하나씩 쌓는 스택. `layout` 에서 하단바와 `BottomBarOverlayHost` 를 그리고, 렌즈가 뜰 화면 상자를 둔다 |
| `navigation/bar-capture.ts` | 렌즈가 뜰 화면 상자 · 가림 여부 · 다시 뜨기 함수를 `LayerStack` 과 바가 나눠 쓰는 자리 |
| `navigation/tab-layer-props.tsx` | 레이어 안 탭 내비게이터 셋이 함께 쓰는 props(`backBehavior="none"`, 바 숨김, 배경) |
| `navigation/push-screen-options.ts` | `PUSH_SCREEN_OPTIONS`. 두 스택이 같은 전환과 제스처를 쓰게 하는 상수 |
| `navigation/routes.ts` | `ROUTE_TABLE` 과 라우트 이름 타입, `INITIAL_TAB_ROUTE`, `LAYER_STACK_ID` |
| `navigation/bar-groups.ts` | `BAR_GROUPS` 표(칸과 기본 순서) · `BarOrder` 와, 누름을 `BarIntent` 로 바꾸는 순수 함수 |
| `navigation/page-from-layer-state.ts` | `LayerStack` 상태에서 지금 페이지를 읽는다 |
| `navigation/tab-navigate.ts` | 페이지 이름을 두 단계로 중첩된 이동 인자로 바꾼다 |
| `navigation/scroll-to-top.ts` | 라우트 이름별 맨 위 스크롤 함수 표 |
| `navigation/navigation-theme.ts` | react-navigation 이 칠하는 배경 · 카드 · 테두리 색을 테마에서 가져온다 |
| `navigation/LedgerLoadingModal.tsx` | 수입·지출 레이어가 데이터를 오래 불러올 때 띄우는 모달 |
| `components/organisms/BottomBar/BottomBar.tsx` | 하단바 그리기와 누르기 · 끌기 처리 |
| `components/organisms/BottomBar/bar-motion.ts` | 누르기 · 끌기 · 놓기 판정과 스프링 값 |
| `components/organisms/BottomBar/BarLens.tsx` | iOS 의 렌즈 캔버스(Skia 셰이더) |
| `components/organisms/BottomBar/lens-images.tsx` | 렌즈가 휘는 그림(항목 줄 · 뒤 화면)을 뜨는 훅 |
| `components/organisms/BottomBar/lens-snapshot.ts` | 렌즈 그림을 언제 뜨고 언제 쓰는지의 판정 |
| `components/organisms/BottomBar/bar-symbol.ios.tsx` · `bar-symbol.android.tsx` | 일곱 칸의 플랫폼 그림. iOS 는 SF Symbols(`assets/bar-sf/`), 안드로이드는 lucide 와 직접 그린 아이콘 |
| `components/organisms/BottomBar/BarGlyph.tsx` | 칸 하나의 아이콘 · 라벨. 바와 미리보기가 같이 쓴다 |
| `components/organisms/BottomBar/BarPreview.tsx` | 설정의 하단 탭 순서 페이지가 그리는 바 한 행의 그림 |
| `components/organisms/BottomBar/bar-shape.ts` | 바와 미리보기가 같이 쓰는 그림자 |
| `components/organisms/BottomBar/bar-colors.ts` | 테마에서 바 색을 계산한다 |
| `components/organisms/BottomBar/bar-store.ts` | 그룹마다 마지막으로 보던 하위(`lastSub`) |
| `features/bar-order/config.ts` · `features/bar-order/store.ts` | 사용자가 정한 바 순서를 표에 맞춰 읽고 저장한다([[ADR-152]]) |
| `components/organisms/BottomBar/double-tap.ts` | 두 번 누름 판정(`isSecondTap`, 300ms) |
| `components/organisms/BottomBar/BottomBarOverlay.tsx` | 화면이 띄우는 것을 바 위에 그리는 포털([[ADR-062]]) |
| `lib/bottom-bar-metrics.ts` | 창 폭과 3버튼 내비게이션 바 여부에서 바 치수를 계산한다. 행의 칸 · 알약 배치와 오른쪽 레일 화면의 세로 막대 치수도 여기서 계산한다 |
| `patches/expo-glass-effect+57.0.5.patch` | 유리의 색 · 명암을 애니메이션 없이 바꾸는 패치. 테마를 고르는 순간 바도 바뀐다 |
| `hooks/useButtonNavigation.ts` | 아래에 3버튼 내비게이션 바가 있는지 낸다. 로컬 모듈 `app-system-bars` 가 안드로이드에 묻는다 |
| `hooks/useOpenTab.ts` | 화면이 페이지 이름으로 탭을 연다 |
| `hooks/useScreenNavigation.ts` · `hooks/useSettingsNavigation.ts` | 화면이 하위 페이지를 열고 닫는다(둘은 같은 훅) |
| `hooks/useScrollToTop.ts` | 맨 위 스크롤 함수를 등록하거나 부른다 |
| `hooks/useRootBackToBackground.ts` | 안드로이드에서 되돌아갈 화면이 없을 때 뒤로 가기를 받아 백그라운드로 보낸다 |
| `hooks/useScreenFocused.ts` | 이 화면이 지금 보이는지. 내비게이터 밖이면 늘 `true` |
| `hooks/useRunAfterTransition.ts` | 담은 스택의 다음 전환이 끝난 뒤 일을 한 번 부른다. 전환 이벤트가 없으면 시간 제한 뒤에 부르고, 내비게이터 밖이면 바로 부른다 |
| `hooks/useUnsavedChangesGuard.ts` | 저장하지 않은 초안이 있는 동안 이 화면을 빼는 이동을 `usePreventRemove` 로 막고 확인 창을 띄운다. 보스 관리 · 컨텐츠 관리가 쓴다([[ADR-034]] 결정 10) |
| `native/haptics.ts` | `tapFeedback()` · `selectionFeedback()` |

## 화면 구조

```
RootStack
├─ (진입 전) SignIn · CharacterSetup · MvpGradePick · MvpGradeConfirm
└─ (진입 뒤)
   ├─ Main (LayerStack)
   │   ├─ Groups        Today · Utility · Settings
   │   ├─ ScheduleSubs  Appointments · Content · Boss
   │   ├─ LedgerSubs    Profit · Cashbook · Stats · Inventory
   │   └─ BottomBar
   └─ 하위 페이지 스물둘
```

진입 전과 진입 뒤에는 `useAppEntryStore` 의 `stage` 에 따라 화면 목록 자체가 바뀐다. 진입한 뒤에는 온보딩으로 돌아가는
히스토리가 없다([[ADR-026]]). 앱은 `Groups` 의 `Today` 에서 시작한다.

| 하위 페이지 | 라우트 |
|---|---|
| 컨텐츠 관리 · 보스 관리 | `ContentManage` · `BossManage` |
| 드롭 히스토리 · 아이템 가격 입력 | `DropHistory` · `DropPrice` |
| 거래 내역(가계부 머리의 `거래 내역`) | `TradeHistory` |
| 개발 노트 | `SettingsReleaseNotes` |
| 앱 정보 및 계정 | `SettingsAbout` |
| 캐릭터 관리 | `SettingsCharacters` |
| 테마 · 글자 크기 · 하단 탭 순서 | `SettingsTheme` · `SettingsTextSize` · `SettingsBarOrder` |
| 공지 목록 · 알림 설정 · 공지 상세 | `SettingsNotices` · `SettingsNoticeAlerts` · `SettingsNoticeDetail` |
| MVP 등급 · 등급 이력 | `SettingsMvpGrade` · `SettingsMvpGradeHistory` |
| 설정(더보기 머리의 톱니바퀴) | `AppSettings` |
| 판매 분배금 계산기 | `UtilityItemSplit` |
| 주간 보스 수입 계산기 · 계산 기록 | `UtilityBossProfitCalculator` · `UtilityBossProfitCalculatorRecords` |

## 하단바

| 그룹 | 라벨 | 하위 행 |
|---|---|---|
| `today` | today | 없음 |
| `schedule` | 스케줄러 | 파티 스케줄 · 컨텐츠 · 보스 |
| `ledger` | 수입·지출 | 보스 수입 · 가계부 · 통계 · 인벤토리 |
| `utility` | 유틸리티 | 없음 |
| `settings` | 더보기 | 없음 |

표의 순서는 기본 순서다. today 는 맨 왼쪽, 더보기는 맨 오른쪽에 고정이고, 가운데 세 그룹과 두 하위 행의 순서는
설정의 `하단 탭 순서` 에서 바꾼다. 앱은 순서와 관계없이 today 에서 시작한다([[ADR-152]]).

| 누른 것 | 지금 위치 | 일어나는 일 |
|---|---|---|
| 하위가 있는 그룹 | 그룹 행 | 그 레이어가 오른쪽에서 밀려 들어오고 바가 하위 행으로 바뀐다. 마지막으로 보던 하위가 열리고, 없으면 사용자가 정한 순서의 맨 왼쪽 하위가 열린다 |
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
| 다른 탭 열기 | `useOpenTab()(페이지, 파라미터)`. 그룹 페이지로 가면 `Groups` 까지 되돌아간 뒤 연다. 하위 페이지에서 부르면 그 하위 페이지를 빼고 아래의 `Main` 으로 되돌아간다(`pop`) |
| 화면 안 버튼으로 맨 위 스크롤 | `useScrollToTop()` |
| 컨테이너 밖에서 이동(알림 탭) | `AppNavigation` 의 `navigationRef`. 목적지가 화면 목록에 생긴 뒤에 push 한다 |

하위 페이지를 더할 때 고칠 곳은 `routes.ts` 의 `ROUTE_TABLE` 한 줄과 `RootNavigator.tsx` 의 `STACK_SCREENS` 한
줄이다. `STACK_SCREENS` 가 `Record<StackRouteName, …>` 이어서 하나만 고치면 컴파일이 안 된다.

## 하단바 치수

| 값 | 계산 |
|---|---|
| 폭 | `min(창 폭 − 42, 420)`, 남는 폭은 좌우로 나눈다 |
| 높이 | 62 |
| 위치 | 하단 안전영역 바로 위. 안드로이드는 안전영역 최소 34. 3버튼 내비게이션 바 위에서는 좌우 최소 여백과 같은 21 을 더 띄운다 |
| 안쪽 여백 · 알약 | 여백 4, 알약 높이 54, 알약 폭은 그룹 행 칸 폭 + 9. 칸 폭은 `(폭 − 17) ÷ 5` |
| 하위 행 | ← 원(지름 54)이 바 왼쪽에 간격 8 로 따로 서고, 바는 남은 폭을 네 칸으로 나눈다 |
| 아이콘 · 라벨 | 아이콘 칸 25, 간격 3, 라벨 10pt · 600(시스템 글자 크기를 따르지 않는다) |

오른쪽 레일 화면(`design-system.md` 의 `화면 크기`)에서는 바를 세로 막대로 세워 오른쪽 안전영역에 둔다. 가로 바의 왼쪽에서
오른쪽 순서가 막대의 위에서 아래 순서이고, 하위 행은 ← 원이 막대 위에 따로 선다([[ADR-191]] 결정 4).

| 값 | 계산 |
|---|---|
| 폭 · 칸 | 폭 64, 막대 길이는 칸 56 다섯과 여백(56 × 5 + 4 × 2 = 288) |
| 위치 | 가로는 오른쪽 안전영역의 가운데, 세로는 아래 끝이 아래쪽 안전영역 바로 위 |
| 안쪽 여백 · 알약 | 여백 4, 알약 두께 56. 알약 길이와 칸 간격은 가로 바와 같은 식(`(길이 − 17) ÷ 5`, 알약은 + 9)이다 |
| 하위 행 | ← 원(지름 54)이 막대 위에 간격 8 로 서고, 막대는 남은 길이를 네 칸으로 나눈다 |
| 아이콘 · 라벨 | 가로 바와 같다 |

재질은 iOS 26 이상에서 바 `GlassView`(`regular`) · ← 원 `clear` 이고, 그 밖에서는 불투명 판에 그림자다. 쉬는 알약은 iOS
26 이상에서 옅은 테마 색 판, 그 밖에서는 테마 `pill` 색 판이다. 색은 `resolveBarColors` 가 테마에서 계산한다. 아이콘은
iOS 가 일곱 자리에 SF Symbols 를, 안드로이드가 같은 자리에 lucide 와 직접 그린 아이콘을 쓴다.

누르면 알약이 누른 칸으로 바로 가고, 3 넘게 끌면 손가락을 따라오다 놓은 자리에서 가장 가까운 칸에 앉는다. 하위가 있는
그룹은 손을 뗄 때 행이 통째로 바뀐다. iOS 는 누르고 끄는 동안 알약을 Skia 렌즈로 그린다. 안드로이드는 렌즈 없이 알약
이동과 행 전환 페이드만 있다. 세로 막대도 같다. 자세한 규칙은 [[ADR-059]] 결정 11 ~ 15 에 있다.
