# 디자인 시스템

여러 화면이 함께 쓰는 부품과 화면 틀을 다룬다. 공용 부품은 `components/` 의 계층 디렉터리 넷에 있다.
왜 이렇게 만들었는지는 다음 ADR 에 있다.

| ADR | 다루는 것 |
|---|---|
| [[ADR-060]] | 계층 규칙 · 기본 부품(버튼 · 배지 · 아이콘 · 세그먼트 · 스위치) · NativeWind 등록 |
| [[ADR-061]] | 빈 상태 · 로딩 · 실패 · 갱신 시각 줄 · 반복 모션 |
| [[ADR-062]] | 바텀시트 · 입력 카드 · 숫자 판 · 모달 · 팝오버 · 펼치는 ＋ |
| [[ADR-063]] | 화면 스크롤 셸 · 헤더 · 안전영역 · 글꼴과 글자 크기 |
| [[ADR-064]] | 당겨서 새로고침 · 갱신 진행률 |
| [[ADR-086]] | Figma 디자인 시스템 파일. 코드가 원본이고 Figma 는 사본이다 |

색 토큰과 테마 배경은 [[ADR-054]] · [[ADR-055]], 하단바와 화면 전환은 [[ADR-059]] 에 있다.

## 계층

| 디렉터리 | 들어가는 것 |
|---|---|
| `components/atoms/` | 상태가 없고 도메인을 모르는 부품. `atoms/index.ts` 배럴로 내보낸다 |
| `components/molecules/` | atoms 만 조합하는 부품. 다른 molecule 을 쓰지 않는다 |
| `components/organisms/` | 다른 molecule 을 조합하거나 열고 닫기 · 선택 · 애니메이션을 관리하는 부품 |
| `components/templates/` | 화면 셸(스크롤 · 헤더 · 배경) |

위 계층은 아래 계층만 가져다 쓴다. `components/__tests__/layer-dependencies.test.ts` 가 검사한다.

## 부품 목록

### atoms

| 부품 | 하는 일 |
|---|---|
| `Text` · `TextInput` | 글자와 입력 칸. 글꼴, 앱 글자 크기 배수, 입력 칸의 기본 상자를 채운다. `react-native` 의 `Text` · `TextInput` 은 이 둘만 가져온다 |
| `Button` | 외형만 갖는 버튼. 변형은 `primary` · `outline` · `text` · `primaryOutline` · `tint` · `danger` · `dangerText`, 크기는 기본 · `compact`. `busy` 면 라벨을 가리고 스피너를 겹친다 |
| `Badge` | 상태 · 카테고리 · 난이도 배지. 크기는 `default` · `mini` |
| `Card` | 카드 껍데기(반경 14 · 표면색). 테두리는 없다([[ADR-060]] 결정 16) |
| `CheckBox` | 체크박스 네모 |
| `Switch` | 스위치. 크기 `sm` · `lg`. iOS 는 시스템 스위치를 줄여 쓴다 |
| `ProgressBar` | 결정형 진행률 바. 두께 기본(`h-1.5`) · `thin`(`h-1`) |
| `ProgressRing` | 진행률 링. 캐릭터 초상화가 쓴다([[ADR-031]]) |
| `Skeleton` | 결과가 들어올 곳과 같은 크기의 회색 펄스 상자 |
| `Spinner` | `MapleSpinner`(버튼 안 16px) · `MapleSweepSpinner`(영역 · 화면) |
| `AnimatedNumber` | 값이 바뀌면 목표까지 굴러가는 숫자 |
| `Icon` | 커스텀 아이콘(`ProfitIcon` · `GearIcon` · `MapleLeaf`)과 lucide 아이콘 등록(`lucide.ts`) |

### molecules

| 부품 | 하는 일 |
|---|---|
| `EmptyState` | 빈 상태. 크기 `page` · `inline` |
| `LoadingState` | 목록이나 카드가 들어올 곳의 대기 카드 |
| `ErrorState` · `StaleBanner` | 실패 상태 · 낡은 목록 위의 실패 배너 |
| `DataFreshness` | 제목 아래 `hh:mm:ss 기준` 줄 |
| `UnavailableBadge` | 값 대신 보이는 `조회 불가` 알약 |
| `Segment` | 테두리 없는 세그먼트(크기 `sm` 23 · 기본 26 · `md` 31 · 화면 헤더 탭 `tab` 32) |
| `Popover` | `PopoverLayer` · `AnchoredPopover` |
| `NumberPad` | 짧은 화면에서 숫자 칸이 쓰는 앱 판 |
| `AmountFigure` | 시트의 큰 숫자. 칠 수 없다 |
| `BackButton` | 헤더의 `←` |
| `CalendarGrid` · `DateSelect` · `TimeWheel` | 달력 격자 · 날짜 선택 버튼 · 시각 휠 |
| `ShareField` · `PartyShareSummary` | 분배 비율 고르기 · 분배 요약 줄([[ADR-038]]) |
| `Stepper` | `−` · 숫자 · `+` 고르개. 크기 `sm` · `md`. 색은 세그먼트와 같아 어디에 놓여도 같다([[ADR-060]] 결정 14) |
| `BossPortrait` · `CharacterAvatar` | 보스 얼굴 · 캐릭터 얼굴 원 |
| `CharacterGroupLabel` | 캐릭터별 묶음 왼쪽의 얼굴 · 이름 열 |
| `DonutRing` | 비중 도넛. 조각 사이 틈 · 둥근 모서리, 조각이 없으면 회색 링([[ADR-074]] 결정 6) |
| `DifficultyExpander` | 난이도를 고르는 곳 모두가 쓰는 고르개. 고른 난이도 배지가 펼쳐져 모든 난이도가 된다. 오른쪽 끝에 붙으면 `align="end"` 로 왼쪽으로 펼친다([[ADR-074]] 결정 8, [[ADR-093]] 결정 2 · 3) |
| `FadedIllustration` | 카드 안 일러스트와 베일 |
| `MvpGradeGrid` · `MvpPlate` | MVP 등급 고르기 · 등급 명패([[ADR-050]]) |
| `NexonLoginButton` | 넥슨 로그인 버튼([[ADR-025]]) |
| `ValuableDropMark` | 고가 드롭 표시. 그림 셋과 나머지 `+N`([[ADR-092]]) |
| `AuroraText` | 오로라 그라디언트 글자([[ADR-092]]) |
| `PeriodStepper` | 기간 이동 줄. 다섯 화면이 함께 쓴다([[ADR-092]] 결정 10) |

### organisms

| 부품 | 하는 일 |
|---|---|
| `BottomSheet` | 바텀시트 껍데기. 다크에서 안쪽 표면을 한 칸 올린다 |
| `TopSheet` | 위에서 내려오는 떠 있는 시트. 끌면 늘어났다 돌아오고, 치는 칸을 직접 품는다([[ADR-062]] 결정 15) |
| `InputCard` | 키보드 위에 뜨는 입력 카드. `InputCardHost` 는 앱 셸에 한 번만 둔다. `unitKey` 를 넘기면 금액 단위 세그먼트(`기본` · `만` · `억`)가 선다([[ADR-082]] 결정 13). `multiline` 이면 세 줄로 열려 네 줄까지 자라는 글자 칸이다([[ADR-091]] 결정 14) |
| `MesoPad` | 숫자 칸의 글자 처리와 커서 계산, 금액 단위 환산(`meso-pad.ts` · `meso-caret.ts` · `meso-unit.ts`) |
| `BossPicker` | 보스 고르기의 본문 · 선택 줄 · 난이도 팝오버. 파티 스케줄과 주간 보스 수익 계산기가 쓴다([[ADR-051]] 결정 13) |
| `Modal` · `NoticeModal` | 가운데 모달 · 알림 모달 틀 |
| `LoadingModal` · `TaskProgressModal` · `TaskResumeModal` | 불러오는 중 모달 · 오래 걸리는 작업 진행률 · 이어서 하기([[ADR-023]]) |
| `CalendarPopover` · `WeekCalendarPopover` · `TimePopover` | 날짜 · 주 · 시각 팝오버 |
| `SelectField` · `ChainSelect` · `AccountSelect` | 드롭다운 · 값 여럿을 이어서 고르는 드롭다운 · 메이플 ID 드롭다운 |
| `FaqSheet` | 설명용 바텀시트 |
| `SpeedDial` | 펼치는 ＋ |
| `Toast` | 토스트와 쌓기(`ToastStack`) |
| `ErrorBoundary` | 렌더 예외 폴백([[ADR-022]]) |
| `BottomBar` | 하단바와 바 위 슬롯(`BottomBarOverlay`)([[ADR-059]]) |
| `CharacterPortrait` · `CharacterRail` · `CharacterRow` · `CharacterManage` · `CharacterUnavailable` | 캐릭터 초상화 · 레일 · 행 · 관리 격자 · 조회 불가 안내([[ADR-029]] · [[ADR-031]]) |
| `PartySizeModal` · `FeeRow` | 파티 인원 모달 · 수수료 줄([[ADR-038]] · [[ADR-050]]) |
| `DropEffectOverlay` | 고가 드롭 연출([[ADR-045]]) |
| `HologramSheen` | 고가 드롭 카드 · 보스 행 면 위를 도는 오로라 빛. 폰 기울기(`TiltPort`)가 빛을 더 민다([[ADR-092]]) |

### templates

| 부품 | 하는 일 |
|---|---|
| `ScreenScroll` | 탭 화면과 하위 페이지의 스크롤 셸. 안전영역 페이드 · 하단 인셋 · 당겨서 새로고침을 맡는다 |
| `EntryScroll` | 앱 진입 전 화면의 셸. 헤더 줄과 고정 액션 바가 있다 |
| `PageHeader` · `PageHeaderTitleRow` | 헤더 셸 · 제목 줄과 갱신 시각 줄 |
| `ThemeBackdrop` | 화면마다 함께 그리는 배경 이미지([[ADR-055]]) |

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `lib/nativewind-interop.ts` | 써드파티 컴포넌트의 `className` 등록(`Svg` · `LinearGradient` · `AnimatedView` · `withIconInterop`) |
| `typography.cjs` | 글자 크기 · 줄 높이 · 굵기 표 |
| `components/atoms/Text/font-scaling.ts` · `app-font.ts` | 글자 크기 · 줄 높이에 앱 배수 곱하기 · 글꼴 이름과 기본 글자 스타일 |
| `lib/text-size.ts` · `theme/text-scale.ts` | 글자 크기 네 단계와 배수 · 지금 배수를 담는 한 칸 저장소(`useTextScale`) |
| `lib/safe-area.ts` | 화면이 쓰는 위아래 안전영역 값(안드로이드 하한 48 · 34) |
| `lib/image-aspect.ts` · `lib/image-crop.ts` | 이미지 두 축 지정 · 크롭 배치 |
| `lib/modal-metrics.ts` · `lib/number-pad-metrics.ts` · `lib/place-dropdown.ts` · `lib/popover-anchor.ts` | 모달 상한 · 숫자 판 판정 · 드롭다운과 팝오버 위치 · 꼬리 위치 |
| `lib/shadow.ts` · `lib/fab-metrics.ts` | `boxShadow` 변환 · 떠 있는 원의 위치와 그림자 |
| `hooks/useLoopedValue.ts` · `useSlidingThumb.ts` · `usePopoverPlacement.ts` · `usePullRefresh.ts` | 반복 모션 · 세그먼트 상자 · 팝오버 위치 · 당긴 회차 |
| `features/refresh/freshness.ts` · `storage/data-freshness.ts` | 갱신 시각 값과 저장(Preferences `dataFetchedAt`) |
| `features/refresh/progress.ts` | 갱신 진행률(`useRefreshProgress`) |
| `features/input-card/store.ts` · `keyboard-height.ts` · `storage/keyboard-height.ts` | 입력 카드 열기 · 기기 키보드 높이 저장 |
| `features/input-card/meso-unit.ts` · `storage/meso-unit.ts` | 금액 칸마다 고른 단위 기억 |
| `theme/ThemeProvider.tsx` | 앱 루트 바탕색 |
| `android/.../PreparedTextFlags.kt` | 안드로이드 `enablePreparedTextLayout` |

## 화면 틀

| 항목 | 동작 |
|---|---|
| 스크롤 | 화면마다 `ScreenScroll` 하나. 헤더도 함께 스크롤되고 고정 영역이 없다 |
| 헤더 | 제목 줄 + 갱신 시각 줄 + 다른 페이지로 가는 것. 주기 · 필터 탭은 제목 덩어리 오른쪽(`trailing`) |
| 간격 | 헤더와 콘텐츠, 블록끼리 `gap-2`(8). 헤더는 아래 여백이 없다 |
| 상단 안전영역 | 헤더가 패딩으로 차지한다. 헤더가 없으면 셸이 상자를 내린다 |
| 안전영역 페이드 | 위는 상단 안전영역, 아래는 하단 안전영역 + 하단바 몫의 절반에서 콘텐츠가 투명해진다 |
| 하단 인셋 | 탭 화면은 하단바 몫까지 콘텐츠 여백. 안드로이드 하위 페이지는 내비 바 위에서 스크롤 상자가 끝난다 |
| 글자 크기 | 시스템 배수는 끈다. 앱 설정의 배수(0.9 · 1.0 · 1.1 · 1.2)를 모든 글자의 크기와 줄 높이에 곱한다 |
| 글꼴 | Pretendard. 굵기는 400 · 500 · 600 · 700 |

## 상태 표시

| 상황 | 부품 | 모습 |
|---|---|---|
| 캐릭터를 고르지 않은 화면 | `EmptyState` `page` | 64px 배지에 단풍잎, 카드 없음 |
| 목록이 비었다 | `EmptyState` `inline` | 카드 안 48px 배지에 내용 아이콘. 갈 곳이 앱 안에 있을 때만 CTA |
| 목록 · 카드를 기다린다 | `LoadingState` | 결과와 같은 카드 안에 스윕 스피너와 `~하고 있어요` |
| 버튼 동작을 기다린다 | `Button` `busy` | 라벨을 가리고 16px 스피너를 겹친다 |
| 몇 개 중 몇 개를 끝냈다 | `ProgressBar` | 얇은 바 하나 |
| 받아 오지 못했다(대신 보여 줄 내용 없음) | `ErrorState` | 경고 아이콘 · 제목 · 설명 · 원인을 푸는 버튼 |
| 받아 오지 못했다(낡은 목록 있음) | `StaleBanner` | 목록 위 한 줄 |
| 받아 오지 못했다(다른 내용이 남음) | 토스트 | `일부 캐릭터를 불러오지 못했습니다 (2명)` 처럼 한 줄 |
| 데이터가 언제 것인가 | `DataFreshness` | 제목 아래 `14:03:22 기준`. 넥슨 실시간 조회가 끝날 때만 바뀐다 |

문구는 대기가 `~하고 있어요`, 실패가 `~습니다` 로 끝난다.

## 당겨서 새로고침

| 화면 | 당기면 다시 받는 것 |
|---|---|
| today | 컨텐츠 · 보스 · 보스 수익 · 드롭 히스토리 · 공지 배너(`Promise.allSettled`), 끝나면 대표 캐릭터 프로필을 다시 읽는다 |
| 컨텐츠 · 보스 스케줄러 | `refresh(trackedOcids)` |
| 보스 수익 | 원장 `live` · `window` |
| 가계부 · 통계 | 원장 `live` · `window` · `enhancement` |
| 설정 · 공지 목록 | 그 화면의 재조회 |

인디케이터는 OS 것이고 사용자가 당긴 동안만 돈다. 상단 페이드 아래로 내려 그린다(iOS 페이드 높이 ·
안드로이드 페이드 높이 − 24). 화면에 그릴 것이 없을 때만 400ms 뒤 로딩 모달이 뜬다.

## 떠 있는 것

| 부품 | 열기 | 닫기 | 높이 |
|---|---|---|---|
| `BottomSheet` | 부모가 마운트 | 스크림 탭 · 끌어 내리기 | 내용, 상한은 상단 안전영역 아래 |
| `TopSheet` | 부모가 마운트 | 스크림 탭 · 위로 밀기 · 뒤로가기 | 내용, 상한은 키보드 위에 남은 높이 |
| `InputCard` | 시트 칸을 누르면 `openInputCard` | `✕` · 뒤로 가기(값 버림), 확인(값 넘김). 스크림 탭은 키보드만 내림 | 키보드 위 |
| `NumberPad` | 판 경로에서 값 칸을 누름 | 판 `확인` · 판 바깥 탭(판만 내림) | 104 |
| `Modal` · `NoticeModal` | 부모가 `visible` | `onClose` 가 정한다 | 안전영역 안 상한, 버튼 줄 고정 |
| `Popover` | 앵커를 누름 | 화면 어디든 탭 | 앵커 위아래 중 넓은 쪽, 안 되면 가운데 |
| `SpeedDial` | ＋ | 스크림 탭 · `×` · 항목 고르기 | ＋ 위로 항목 수만큼 알약 |

그리는 순서는 아래에서 위로 `화면 < 하단바 < 바 위 슬롯 < 안내 · 토스트 < 시트 < 입력 카드` 다.

## 누름 표시

누를 수 있는 카드는 누르는 동안 흐려지지 않는다(`active:opacity` 금지, 사용자 지정, [[ADR-095]] 결정 5). 카드 하나가
통째로 흐려지면 그 카드만 다른 카드와 따로 논다. 작은 버튼 · 글자 링크 · 입력 칸은 카드가 아니라서 누름 표시를 그대로 둔다.

## 모서리

앱에는 뾰족한 모서리를 되도록 두지 않는다(사용자 지정). 색을 칠한 조각은 작아도 모서리를 둥글게 깎는다.
띠 · 세로선 · 막대처럼 사각형으로 그리기 쉬운 조각이 특히 그렇다. 시간표의 3시간 띠는 `rounded-md`,
지금 시각 선은 `rounded-full` 이다.

## 시안

아티팩트로 시안을 만들면 앱의 테마를 전부 함께 보여 준다. 지금은 `src/data/job-themes.json` 의
여섯(머쉬맘 · 혼테일 · 레테 · 렌 · 엔젤릭버스터 · 검은마법사)이다. 테마가 늘면 시안에도 더한다.

테마마다 라이트 · 다크와 색이 달라서, 한 테마에서 괜찮던 대비가 다른 테마에서 깨질 수 있다.
고르기 전에 그것을 보이려고 전부 놓는다. 색은 추정하지 않고 `job-themes.json` 의 토큰 값을 그대로 쓴다.

배경 그림이 있는 테마(혼테일 · 검은마법사)는 그 그림을 깔고 그 위에 시안을 놓는다. 그림은
`src/assets/themes/` 의 파일을 그대로 쓴다. 카드와 글자는 앱에서 그림 위에 보이므로, 색만 놓고
보면 그림 위에서의 대비를 확인할 수 없다.

낮은 화면에서 어떻게 보이는지 다루는 시안이면 아래 세 기기를 함께 그린다(사용자 지정). 셋 다 키보드가
올라오면 남는 높이가 작아서, 큰 화면에서 들어가던 것이 여기서 넘친다.

| 기기 | 화면 | 앱이 쓰는 크기 | 키보드 높이(한글 · 영문 / 숫자 패드) |
|---|---|---|---|
| 갤럭시 Z 폴드8 | 외부 화면 1248×1972 · 428ppi | 약 416×657dp. 배율 3 은 추정이다 | 아직 모른다(#759) |
| 아이폰 듀오 | 외부 화면 1398×2034 · 460ppi | 466×678pt(@3x) | 304.7 / 269.7pt |
| 아이폰 SE 2 | 750×1334 | 375×667pt | 260.5 / 235.5pt |

키보드 높이는 iOS 시뮬레이터(SE 2 는 27.0, 듀오는 27.1)에서 잰 값이다. 키보드 윗변부터 화면 바닥까지이고, 추천 단어 줄이 들어 있다.
듀오 외부 화면에는 위쪽 상태바가 없고, 오른쪽에 폭 약 84pt 의 세로 레일(시계 · 버튼)이 있다. 그래서 Safari 의 웹 화면 폭은 382 다. 네이티브 앱의 안전영역이 이 레일을 어떻게 내주는지는 아직 재지 않았다.

## 테스트

규칙이 문서에만 있으면 다음 화면에서 조용히 어긋난다. 그래서 화면 전체를 훑는 정책 테스트로 지킨다.

| 파일 | 지키는 규칙 |
|---|---|
| `src/__tests__/card-press-policy.test.ts` | 누를 수 있는 카드가 누르는 동안 흐려지지 않는가 |
| `components/__tests__/layer-dependencies.test.ts` | 계층 의존 방향 |
| `src/__tests__/require-cycle-policy.test.ts` | 배럴을 거친 순환 import |
| `src/__tests__/font-scaling-policy.test.ts` | `Text` · `TextInput` 직접 import 금지, SVG 글자의 배수 |
| `src/__tests__/typography-policy.test.ts` | 글자 크기 · 굵기 이름이 표에 있는가 |
| `src/__tests__/text-input-height-policy.test.ts` | 치는 칸의 높이 |
| `src/__tests__/sticky-policy.test.ts` | 고정 영역 금지 |
| `src/__tests__/page-header-title-row-policy.test.ts` | 제목 줄과 헤더 경계 |
| `src/__tests__/{top,bottom}-safe-area-policy.test.ts` | 화면이 인셋을 직접 읽지 않는가 |
| `src/__tests__/mask-policy.test.ts` | 마스크 라이브러리 패치 |
| `src/__tests__/period-stepper-policy.test.ts` | 기간 이동 줄을 화면이 직접 그리지 않는가 |

부품마다의 테스트는 각 ADR 의 `테스트` 표에 있다.
