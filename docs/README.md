# 문서 지도 (docs 인덱스)

이 저장소의 설계 문서는 **기능(feature) 단위**로 계층화돼 있다. 작업을 시작하기 전에 이 파일에서 "지금 하는 작업이 어떤 문서를 read/write 해야 하는지"를 먼저 판단하라.

## 구조

```
docs/
├── README.md              ← 지금 이 파일 (진입점·인덱스)
├── features/              기능별 설계 — 특정 화면·기능에 고유한 정책이 여기 산다
├── foundation/           기능을 가로지르는 공통 토대 — 여러 기능이 함께 지키는 규칙
├── ADR.md                결정 원장(연대기). 개별 결정의 "왜/트레이드오프"는 항상 여기
├── persistence/          기기 영속 데이터 지도(저장 매체 축으로 조직 — feature 계층과 별개)
├── migration/            **완료된 RN 전환의 기록**([[ADR-128]]) — `data.md` 만 지금도 유효
└── trouble/              날짜별 트러블슈팅 로그(네이티브·실기기 이슈)
```

- **features/** 와 **foundation/** 의 각 문서는 상단에 **인덱스 헤더**(범위 · 관련 소스 파일(read/write 대상) · 관련 ADR · 관련 문서)를 갖는다. 문서를 열면 그 헤더만 보고 어떤 소스를 만질지 알 수 있다.
- 각 문서 하단에는 **`## 폐기된 정책 (history)`** 섹션이 있다. 본문은 항상 **현재 유효한 정책만** 담고, 대체·폐기된 결정은 `~~옛 정책~~ → 새 정책 (ADR-N)` 한 줄로 이 섹션에 모은다. 정책을 바꿀 때 옛 내용을 지우지 말고 이 섹션으로 내려라.
- **ADR.md** 는 **슬림 인덱스**이고 전문은 `adr/ADR-NNN.md` 파일 하나씩이다. `[[ADR-NNN]]` 은 경로가 아니라 논리적 참조이므로 문서 위치와 무관하게 그대로 쓴다. 새 결정은 `adr/` 에 파일을 추가하고 인덱스에 **한 줄**만 넣는다(요약을 인덱스에 쌓지 말 것). **ADR 을 근거로 인용하기 전에 상태 배지를 볼 것** — 🟢 유효 / 🟡 부분 폐기 / ⛔ 폐기 / ⚪ 미구현 / 🗑 삭제. **⛔·🗑 의 본문은 요약 몇 줄로 줄여 두었고**(정책 전문은 git 히스토리) 이 문서들 본문에서 그리로 가는 인용도 끊었다. ⛔ 파일에 **🔗 줄**이 있으면 거기 적힌 결정만 현행 코드가 따른다.
- **persistence/** 는 "무엇이 어디에 저장되는가"를 저장 매체(Preferences/SQLite/네이티브) 축으로 조직한 별개 문서다. feature 계층으로 편입하지 않는다 — 저장 스키마를 만질 때만 참고.
- **migration/** 은 React Native 전환([[ADR-128]])의 실행 문서였고 **전환은 끝났다**(2026-08-21 — 캐패시터 소스 삭제와 모노레포 해체까지, [[ADR-154]]·[[ADR-155]]). 이제 `README.md`·`parity-inventory.md` 는 **기록**이라 그 안의 경로는 그때의 것이다(문서 머리에 그 사실을 못박아 뒀다) — **작업의 근거로 읽지 말 것.** 예외는 `data.md` 하나로, RN 앱이 캐패시터 시절 저장소를 **지금도** 읽는 방법이라 계속 유효하다.

## 기능별 인덱스

| 기능 | 문서 | 주요 소스(read/write) |
|---|---|---|
| 온보딩 (API 키·계정 선택·예열 — **RN 은 계정 선택·예열이 없다**, [[ADR-143]]) | [features/onboarding.md](./features/onboarding.md) | `app/onboarding/` · `features/onboarding/` · `nexon/character` · `storage/character-basic-cache` · `storage/character-selection` |
| 컨텐츠 스케줄러 | [features/content-scheduler.md](./features/content-scheduler.md) | `app/content-scheduler/` · `features/content-scheduler/` · `lib/scheduler-merge` · `lib/scheduler-content-scope` · `storage/scheduler-cache` · `storage/shared-progress-cache` |
| 보스 스케줄러 (파티 관리 포함) | [features/boss-scheduler.md](./features/boss-scheduler.md) | `app/boss-scheduler/` · `features/boss-scheduler/` · `storage/boss-party-settings` · `lib/boss-icons` · `lib/boss-matching` |
| 보스 수익 | [features/boss-profit.md](./features/boss-profit.md) | `app/boss-profit/` · `features/boss-profit/` · `storage/boss-profit` · `storage/sqlite` · `lib/boss-profit-period` |
| 아이템 드랍 | [features/item-drop.md](./features/item-drop.md) | `app/item-drop/` · `features/item-drop/` · `lib/item-icons` · `storage/boss-drop-records` · 전 기간 히스토리: `app/boss-profit/DropHistoryScreen`(`/profit/drops`) · `features/boss-profit/drop-history-store` · `lib/drop-history` · 잎 램프(RN, today 와 공유) `lib/drought-tier-styles` |
| 사냥 타이머 | [features/hunting-timer.md](./features/hunting-timer.md) | `app/hunting-timer/` · `features/hunting-timer/` · `native/hunting-timer` |
| today (첫 화면 · 위젯 격자) | [features/today.md](./features/today.md) | `app/today/`(`TodayScreen` · `WidgetGrid` · `view-model` · `widgets/`{`types`·`registry`·`layout` + 위젯 여덟}) · `lib/widget-grid-metrics`(치수) · `lib/widget-layout`(좌표 검증) · `lib/drought-tier-styles`(히스토리 화면과 공유) · 원천은 전부 **읽기만** — 컨텐츠·보스·보스 수익·`drop-history` 스토어 + `character-basic-cache`·`character-selection`·`reset-clock`·`drop-history`·`drop-price` + 판정 둘(`features/boss-scheduler/displayed-bosses` · `app/content-scheduler/content-completion`, [[ADR-147]] 결정 8) |
| 유틸리티 (도구 목록 + 판매 분배금 계산기) | [features/utility.md](./features/utility.md) | `app/utility/`(`UtilityScreen` 목록 · `ItemSplitScreen` 계산기 · `tool-names`) · `lib/item-split` · `navigation/routes`(`UtilityItemSplit` — 도구는 루트 스택 push, [[ADR-168]] 결정 6) |
| 가계부 (수익·지출 캘린더) | [features/cashbook.md](./features/cashbook.md) | `app/cashbook/`(`CashbookScreen`) · `lib/calendar-month`(격자·열지도) · `lib/meso-compact`(좁은 칸 표기) · `components/molecules/CalendarMonth/` · `navigation/`(하위 탭 둘 — [[ADR-169]] 결정 1). **코드는 캘린더까지** — 기록·입력·주간 보기는 설계만 끝났다([[ADR-170]] 결정 12건, 코드 0줄 · 지출 스키마는 [[ADR-166]] · 참조 데이터 `src/data/spend-catalog.json` 24항목). 보스 수익의 날짜는 #239 가 가져온다. 사냥 수익·지출 껍데기 탭 둘은 삭제됐다([[ADR-169]] 결정 2) |
| 설정 | [features/settings.md](./features/settings.md) | `app/settings/`(`SettingsScreen` + 하위 화면 `SettingsReleaseNotesScreen`/`SettingsFeatureGuideListScreen`/`SettingsFeatureGuideScreen`/`SettingsAccountDataScreen`/`SettingsAboutScreen` — 라우트 `/settings/guide`·`/settings/release-notes`(둘 다 자식 `:guideId` — 같은 상세 화면)·`/settings/account-data`·`/settings/about`, `/settings` 의 **형제**) · 행 프리미티브 `SettingsRow`/`SettingsLinkRow`/`row-class.ts` · `src/data/release-notes.ts`·`src/data/feature-guides/`(안내 하나 = 파일 하나)(+`src/types/release-notes.ts`·`src/types/feature-guides.ts` · `lib/guide-route.ts`, 이미지 `src/assets/guide/<안내 id>/`) · `features/settings/`(`cache-data`) · `storage/api-key` · `features/tracking-mode` |
| 테마 시스템 | [features/theme.md](./features/theme.md) | `features/theme/` · `storage/theme` · `src/theme/theme-vars.ts`(NativeWind `vars()`) · `global.css` · `src/data/job-themes.json` · `lib/theme-derive` · `lib/theme-backgrounds` · `src/assets/themes/`(+ `src/assets/generated/themes.ts`) · `lib/color` |
| 광고 | [features/ads.md](./features/ads.md) | `native/ads.ts` · `features/ads/` · `storage/ads.ts` · `App.tsx`(탭 전환 훅) |
| 알림 (**설계 완료, 구현 전** — [[ADR-146]]) | [features/notifications.md](./features/notifications.md) | `native/notifications.ts`(기존) · `native/push.ts`·`native/background-task.ts`(신설) · `features/notifications/` · `storage/notification-settings`·`notification-ledger` · RN 어댑터 `rn-notifications`(기존)·`rn-push`·`rn-background-task` · RN 진입점 `index.ts` · `workers/notice-push/` |
| Live Update (OTA) | [features/live-update.md](./features/live-update.md) | `native/live-update.ts` · `features/live-update/` · `app/UpdatePromptModal.tsx` · `storage/last-run-bundle-version.ts` · 어댑터 `src/native/adapters/rn-live-update.ts`(expo-updates) · 캐패시터 최종 매니페스트 `ota/`([[ADR-154]]·[[ADR-155]]) · `workers/ota-manifest/` · `scripts/publish-rn-ota.mjs` |
| 스플래시 | [features/splash.md](./features/splash.md) | `app.json`(`expo-splash-screen` 플러그인) · `assets/splash-icon.png` · `src/native/adapters/rn-splash-screen.ts` · `src/boot-splash.ts` ([[ADR-138]]) |
| 안내 사이트 (mapleroutine.store) | [features/site.md](./features/site.md) | `site/` · `PRIVACY.md`(원본) · `scripts/build-site.mjs` · `.github/workflows/pages.yml` |

## 공통 토대 (foundation)

| 토대 | 문서 | 언제 참고 |
|---|---|---|
| 제품 정의 | [foundation/product.md](./foundation/product.md) | 목표·사용자·플랫폼·MVP 제외 범위·전역 미해결 질문 |
| 아키텍처 | [foundation/architecture.md](./foundation/architecture.md) | 디렉토리 구조·레이어 패턴·데이터 흐름·상태관리·네이티브 개요·테스트 전략 |
| Nexon Open API | [foundation/nexon-api.md](./foundation/nexon-api.md) | API 호출·인증·정규화·호출 제한을 만질 때 |
| 에러/복원력 | [foundation/error-resilience.md](./foundation/error-resilience.md) | 실패 처리·빈 상태·참조 무결성·멱등성·엣지 케이스 |
| 디자인 시스템 | [foundation/design-system.md](./foundation/design-system.md) | 색·시맨틱 토큰·기본 컴포넌트(카드/버튼/입력)·공유 UI 패턴(탭/스크롤/모달)·타이포·아이콘 |
| 게임 레퍼런스 데이터 | [foundation/game-data.md](./foundation/game-data.md) | `src/data/*.json` 을 만질 때 ([[ADR-006]] — AI 임의 추정 금지) |
| 스토어 릴리스 | [foundation/release.md](./foundation/release.md) | 스토어에 나갈 바이너리를 만들 때 — 서명·`versionCode`·빌드 커맨드·산출물 검증·콘솔 요건 |

## 작업 유형별 길잡이

- **새 화면·기능 구현** → 해당 `features/*.md` (정책) + `foundation/architecture.md` (레이어 규칙) + 관련 `foundation/design-system.md` 컴포넌트. TDD 원칙상 테스트 먼저([[ADR]] 프로세스).
- **게임 수치 데이터 변경** → `foundation/game-data.md` 먼저, 값은 반드시 사용자 확인([[ADR-006]]).
- **에셋(그림) 추가·삭제** → 파일을 `src/assets/` 에 넣거나 지운 뒤 **`npm run assets:gen`** ([[ADR-129]]). 목록(`assets/generated/*.ts`)은 커밋되는 생성물이라 안 돌리면 화면이 **에러 없이 폴백만** 그린다 — `assets/generated/__tests__/asset-manifest.test.ts` 가 그 낡음을 잡는다.
- **today 위젯 추가·크기 변경** → `features/today.md` 의 「격자」·「배치」·「위젯 규약」 셋. 만질 파일은 **셋이 짝**이다 — `widgets/registry.ts`(존재·크기·목적지) · `widgets/layout.ts`(좌표) · 위젯 컴포넌트. 좌표는 손으로 적고 `lib/widget-layout.ts` 의 검증 다섯이 지키므로, `row` 를 밀지 않으면 **테스트가 먼저 막는다**.
- **저장 스키마 변경** → `persistence/` (해당 매체 문서) + 해당 `features/*.md`.
- **색·토큰·테마** → `foundation/design-system.md` (기본 팔레트·시맨틱 색) + `features/theme.md` (테마별 토큰·런타임 전환).
- **동기화·정규화·호출 제한** → `foundation/nexon-api.md` + `features/content-scheduler.md`/`boss-scheduler.md`.
- **에러/빈 상태/엣지 처리** → `foundation/error-resilience.md`.
- **스토어 배포·서명·버전 올리기** → `foundation/release.md` (OTA 갱신은 `features/live-update.md` — 별개 축이다).
- **알림을 더하거나 고칠 때** → `features/notifications.md`. 손대기 전에 그 문서의 «층» 표에서 **바이너리 / JS / 서버** 중 어디를 만지는지부터 판정할 것 — 왼쪽 칸은 스토어 심사를 기다린다([[ADR-146]] 결정 1).
- **기존 사용자 데이터를 만질 때** → `migration/data.md`(RN 이 캐패시터 시절 저장소를 읽는 방법 — 이름에 `capacitor` 가 붙은 파일을 지우면 안 되는 이유가 거기 있다). 전환 자체는 끝났고 그 기록은 `migration/README.md`·`parity-inventory.md` 다([[ADR-128]]·[[ADR-155]]).
- **설계 결정의 배경이 궁금할 때** → `ADR.md` 에서 `[[ADR-NNN]]` 조회.
