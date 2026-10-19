# 문서 지도 (docs 인덱스)

이 저장소의 설계 문서는 **기능(feature) 단위**로 계층화돼 있다. 작업을 시작하기 전에 이 파일에서 "지금 하는 작업이 어떤 문서를 read/write 해야 하는지"를 먼저 판단하라.

## 구조

```
docs/
├── README.md              ← 지금 이 파일 (진입점·인덱스)
├── features/              기능별 설계 — 특정 화면·기능에 고유한 정책이 여기 산다
├── foundation/           기능을 가로지르는 공통 토대 — 여러 기능이 함께 지키는 규칙
├── ADR.md                결정 인덱스 · 파일 이름 규칙 · 카테고리 표. 결정의 이유와 트레이드오프는 adr/ 에
├── adr/README.md         **폐기된 결정을 주제별로** 묶은 목차 — «뭘 하려다 왜 죽었나»
├── persistence/          기기 영속 데이터 지도(저장 매체 축으로 조직 — feature 계층과 별개)
└── trouble/              날짜별 트러블슈팅 로그(네이티브·실기기 이슈)
```

- **features/** 와 **foundation/** 의 각 문서는 상단에 **인덱스 헤더**(범위 · 관련 소스 파일(read/write 대상) · 관련 ADR · 관련 문서)를 갖는다. 문서를 열면 그 헤더만 보고 어떤 소스를 만질지 알 수 있다.
- 문서 본문에는 **지금 구현된 정책만** 담는다. 정책이 바뀌면 옛 내용은 지운다(git 히스토리에 있다). 각 문서 하단의 `## 폐기된 정책 (history)` 섹션은 재작성하면서 걷는다.
- **ADR.md** 는 인덱스이고 전문은 `adr/` 에 파일 하나씩 있다. 파일 이름은 `ADR-{번호목록}_{카테고리}_{기능}.md` 이고, 한 기능의 결정은 한 파일에 둔다. 결정이 바뀌면 새 번호를 파일 이름에 `+NNN` 으로 덧붙이고 같은 파일에 이어 쓴다. 상태는 🟢 유효 · ⚪ 미구현 둘뿐이다. 규칙 · 카테고리 표 · 문서 형식은 `ADR.md` 머리에 있다. 지금은 재작성 중이라 옛 형식(`adr/ADR-NNN.md`)과 옛 배지(🟡 · ⛔)가 아직 남아 있다. 옛 파일을 근거로 쓸 땐 배지를 먼저 보고, ⛔ 는 배너의 🔗 줄에 적힌 결정만 살아 있다.
- **persistence/** 는 "무엇이 어디에 저장되는가"를 저장 매체(Preferences/SQLite/네이티브) 축으로 조직한 별개 문서다. feature 계층으로 편입하지 않는다 — 저장 스키마를 만질 때만 참고. 캐패시터 시절 저장소를 지금도 읽는 방법은 `persistence/capacitor-storage.md` 에 있다.

## 기능별 인덱스

| 기능 | 문서 | 주요 소스(read/write) |
|---|---|---|
| 로그인 (API 키 입력·검증·무효화. 프렌즈 승인이 나 **넥슨 Open ID 가 키 옆에 선다**. 대체가 아니라 병행이고 인증 수단이 목록이 된다, [[ADR-296]]. 메이플 ID 축은 [[ADR-297]]. 스토어 1.0.12 에는 꺼진 채로 나간다, [[ADR-334]]) | [features/auth.md](./features/auth.md) | `app/auth/` · `features/auth/` · `nexon/key-stage` · `nexon/character` · `storage/api-key` |
| 앱 진입 (앱을 켜면 어느 화면이 서나 · 캐릭터 설정 화면 · 시드. **계정 선택·예열은 없다**, [[ADR-143]]) | [features/app-entry.md](./features/app-entry.md) | `app/character-setup/` · `features/app-entry/` · `navigation/RootNavigator` · `storage/character-basic-cache` · `storage/character-selection` |
| 컨텐츠 스케줄러 | [features/content-scheduler.md](./features/content-scheduler.md) | `app/content-scheduler/` · `features/content-scheduler/` · `lib/scheduler/scheduler-merge` · `lib/scheduler/scheduler-content-scope` · `storage/scheduler-cache` · `storage/shared-progress-cache` |
| 보스 스케줄러 (파티 관리 포함) | [features/boss-scheduler.md](./features/boss-scheduler.md) | `app/boss-scheduler/` · `features/boss-scheduler/` · `storage/boss-party-settings` · 분배 비율 `lib/boss/party-shares` + `components/molecules/ShareField/` + `components/molecules/PartyShareSummary/`([[ADR-305]]) · 보스 표 조회 `lib/boss/bosses`([[ADR-280]] 결정 12. 표는 번들 `src/data/bosses.json` 으로 켜고 기기 사본 · 서버 `GET /v1/game-data` 가 덮는다, [[ADR-349]] 결정 5 · [[ADR-350]] 결정 4: 현재 표 `lib/boss/catalog` · 받기 · 사본 · 다시 그리기 `features/game-data/query`(TanStack Query, [[ADR-350]] 정정 7) · `server/game-data` · `storage/query-persister` · 빌드 전 동기화 `scripts/sync-game-data.mjs`) · `lib/assets/asset-lookup` · `lib/boss/boss-matching` |
| 보스 수익 | [features/boss-profit.md](./features/boss-profit.md) | `app/boss-profit/` · `features/boss-profit/` · `storage/boss-profit` · 미완료 행의 그 기간만의 파티 인원·비율 `storage/boss-party-period-overrides`([[ADR-313]]) · `storage/record-revision-batch`(판 알림을 반복 단위로, [[ADR-309]]) · `storage/sqlite` · `lib/boss/boss-profit-period` |
| 아이템 드랍 | [features/item-drop.md](./features/item-drop.md) | `app/item-drop/` · `features/item-drop/` · `lib/assets/asset-lookup` · 드롭 아이템 key 마스터 표 `src/data/drop-items.json` + `lib/drop/drop-items`([[ADR-280]] 결정 11) · `storage/boss-drop-records` · 전 기간 히스토리: `app/boss-profit/DropHistoryScreen`(`/profit/drops`) · `features/boss-profit/drop-history-store` · `lib/drop/drop-history` · 잎 램프(RN, today 와 공유) `constants/style/drought-tier-styles` |
| today (첫 화면 · 위젯 격자) | [features/today.md](./features/today.md) | `app/today/`(`TodayScreen` · `WidgetGrid` · `view-model` · `widgets/`{`types`·`registry`·`layout` + 위젯 여덟}) · `lib/today/widget-grid-metrics`(치수) · `lib/today/widget-layout`(좌표 검증) · `constants/style/drought-tier-styles`(히스토리 화면과 공유) · 결산 안내 줄 `app/SettlementBanner`(가계부 · 통계와 공용) + `features/settlement/`(`store`·`faq`·`banner-text`) + `server/settlement` + `storage/settlement-banner`([[ADR-284]]) · 원천은 전부 **읽기만** — 컨텐츠·보스·보스 수익·`drop-history` 스토어 + `character-basic-cache`·`character-selection`·`reset-clock`·`drop-history`·`drop-price` + 판정 둘(`features/boss-scheduler/displayed-bosses` · `app/content-scheduler/content-completion`, [[ADR-147]] 결정 8) |
| 유틸리티 (도구 목록 + 판매 분배금 계산기) | [features/utility.md](./features/utility.md) | `app/utility/`(`UtilityScreen` 목록 · `ItemSplitScreen` 계산기 · `tool-names`) · `lib/cashbook/item-split` · 비율 고르개 `components/molecules/ShareField/`([[ADR-305]]) · `navigation/routes`(`UtilityItemSplit` — 도구는 루트 스택 push, [[ADR-168]] 결정 6) |
| 가계부 (수익·지출 캘린더) | [features/cashbook.md](./features/cashbook.md) | `app/cashbook/`(`CashbookScreen`) · `lib/calendar`(격자·열지도) · `lib/cashbook/meso-compact`(좁은 칸 표기) · `components/molecules/CalendarGrid/` · `app/cashbook/useMonthDays`(달 읽기 하나가 격자와 그날 목록을 함께 낸다 · 창 다섯 달을 미리 든다 · `lib/calendar` 의 `monthBounds`) · `navigation/`(하위 탭 둘 — [[ADR-169]] 결정 1). **전부 섰다** — 캘린더([[ADR-169]]) · 손입력과 주간 보기([[ADR-170]]·[[ADR-166]], 참조 데이터 `src/data/spend-catalog.json`) · **심볼 강화**([[ADR-301]]. 비용 표 `src/data/symbol-costs.json` · `lib/cashbook/symbol-costs` · 폼 `app/cashbook/spend/SymbolForm` · 레벨 칸 슬라이더 `spend/LevelRangeSlider` · 심볼 레벨 `features/cashbook/symbol-levels` + `nexon/symbol-levels`) · **두 시트의 날짜 고르개** `sheet-fields` 의 `SheetDateField`(`DateSelect` + `CalendarPopover`, [[ADR-301]] 결정 7) · **기록이 이름 대신 key 로 카탈로그를 찾는다**([[ADR-280]] 결정 10. 갈래 · 종류 · 형태 표 `lib/cashbook/categories`, 옛 기록 이관 `storage/sqlite/migrations`) · 고치기·지우기([[ADR-171]]) · **보스 수익의 날짜**([[ADR-172]], #239 — `defeated_on` · `features/boss-profit/defeat-dates`) · **기간 이동이 고른 날을 함께 옮긴다**([[ADR-246]]). **사냥 갈래는 계산기다**([[ADR-175]] — `src/data/hunting-grounds.json` · `lib/cashbook/hunting-grounds` · `lib/cashbook/hunting-meso` · `lib/assets/asset-lookup` · `src/assets/force/`) 이고 **메소 획득량은 캐릭터에서 읽는다**([[ADR-177]] — `lib/cashbook/meso-rate` · `nexon/meso-rate` · `storage/meso-rate-cache`). 남은 원천은 사냥 타이머 자동 수익 하나다. 사냥 수익·지출 껍데기 탭 둘은 삭제됐다([[ADR-169]] 결정 2) |
| 통계 (수익·지출 그룹의 셋째 하위. 기간별 순수익 · 추이 · 캐릭터별 · 내역 · 보스별 · 누적을 읽기만 한다. 구현 완료 · 실기기 미검증, [[ADR-330]] · [[ADR-333]]) | [features/stats.md](./features/stats.md) | `app/stats/` · `features/stats/` · 보스 이름 `lib/boss/bosses`(`alias`) |
| MVP 등급 (메이플 ID 마다 등급을 시작 날짜와 함께 받아 수수료 기본값과 스타포스 할인에 쓴다. 구현 완료 · 실기기 미검증, [[ADR-306]]) | [features/mvp-grade.md](./features/mvp-grade.md) | `src/data/mvp-grades.json` · `lib/mvp/` · `features/mvp-grade/` · `app/mvp-grade/` · `app/settings/SettingsMvpGrade*` · `storage/mvp-grades` · `storage/character-accounts` · 명패 `src/assets/mvp/` · 비용 식 `lib/enhancement/cost` · 드롭 몫 `lib/drop/drop-price` |
| 서버 전송 (앱이 만든 값을 우리 서버로 보낸다. 지금 보내는 것은 **드롭 가격 기록 하나**이고 [[ADR-342]]·[[ADR-343]] 이 그 통로를 소유한다. 가격이 없는 기록도 상태(`pending` · `skipped`)를 달아 올리고 `DELETE` 는 기기에서 기록이 사라진 때만이다([[ADR-352]]). 전송은 저장하는 그 자리에서 한 건이고 실패한 것만 대기 표가 든다. 기준 기간(`SERVER_PRICE_FROM`)부터만 보낸다) | [[ADR-342]] · [[ADR-343]] · [[ADR-352]] · [[ADR-340]] | `features/server-sync/`(`registry` 종류 표 · `sweep` 고리 · `drop-price-sync` 첫 종류 · `run` 부팅 배선) · `storage/server-sync-queue` · `server/drop-price` · 서버에 자기를 밝히는 헤더 `features/auth/server-identity` + `lib/crypto/api-key-hash`(`@noble/hashes`) · `types/drop-price` |
| 이어서 하는 작업 (기존 기록을 다시 쓰는 작업의 진행률 · 앱이 중간에 닫힌 뒤의 재진행 확인. 구현 완료 · 실기기 미검증, [[ADR-307]]) | [foundation/error-resilience.md](./foundation/error-resilience.md) | `features/resumable-task/` · `app/resumable-task/` · `components/organisms/TaskProgressModal/` · `components/organisms/TaskResumeModal/` · `storage/pending-tasks` |
| 설정 | [features/settings.md](./features/settings.md) | `app/settings/`(`SettingsScreen` + 하위 화면 `SettingsReleaseNotesScreen`/`SettingsFeatureGuideListScreen`/`SettingsFeatureGuideScreen`/`SettingsAccountDataScreen`/`SettingsAboutScreen` — 라우트 `/settings/guide`·`/settings/release-notes`(둘 다 자식 `:guideId` — 같은 상세 화면)·`/settings/account-data`·`/settings/about`, `/settings` 의 **형제**) · 행 프리미티브 `SettingsRow`/`SettingsLinkRow`/`row-class.ts` · `src/data/release-notes.ts`·`src/data/feature-guides/`(안내 하나 = 파일 하나)(+`src/types/release-notes.ts`·`src/types/feature-guides.ts`, 이미지 `src/assets/guide/<안내 id>/`) · `features/settings/`(`cache-data`) · `storage/api-key` · `features/tracking-mode` |
| 테마 시스템 | [features/theme.md](./features/theme.md) | `features/theme/` · `storage/theme` · `src/theme/theme-vars.ts`(NativeWind `vars()` · 모드에서만 갈리는 토큰 `panel-border`·`card-body`·`stats-section`·`settlement-*`) · `global.css` · `src/data/job-themes.json` · `lib/theme/theme-derive` · `lib/assets/asset-lookup` · `src/assets/themes/`(+ `src/assets/generated/themes.ts`) · `lib/color` |
| 파티 약속 (파티 보스 약속을 주 단위로 적고 약속 전에 로컬 알림. 스케줄 층의 넷째 하위. 요일별 목록 · 시트 구현, 알림 레이어 미구현, [[ADR-331]]) | [features/party-appointments.md](./features/party-appointments.md) | `app/party-appointments/` · `features/party-appointments/` · `storage/party-appointments` · `types/party-appointment` · 알림 레이어 `features/notifications/` + `storage/notification-ledger` · `storage/notification-settings` |
| 광고 | [features/ads.md](./features/ads.md) | `native/ads.ts`(광고 단위 ID·판정 함수) · `native/adapters/ads-env.ts` · `native/adapters/rn-ads.ts` · `app.json`(앱 ID). 광고 포맷·노출 정책은 아직 없다 |
| 알림 (공지 푸시는 구현 완료. 로컬 알림 레이어는 [[ADR-331]] 이 첫 종류와 함께 세운다. [[ADR-146]]) | [features/notifications.md](./features/notifications.md) | `native/notifications.ts`(기존) · `native/push.ts`·`native/background-task.ts`(신설) · `features/notifications/` · `storage/notification-settings`·`notification-ledger` · RN 어댑터 `rn-notifications`(기존)·`rn-push`·`rn-background-task` · RN 진입점 `index.ts` · `workers/notice-push/` |
| Live Update (OTA) | [features/live-update.md](./features/live-update.md) | `native/live-update.ts` · `features/live-update/` · `app/UpdatePromptModal.tsx` · `storage/last-run-bundle-version.ts` · 어댑터 `src/native/adapters/rn-live-update.ts`(expo-updates) · 캐패시터 최종 매니페스트 `ota/`([[ADR-154]]·[[ADR-155]]) · `workers/ota-manifest/` · `scripts/publish-rn-ota.mjs` · `scripts/ota-runtime-version.mjs`(못박은 지문 · 심사 중 지문) |
| 스플래시 | [features/splash.md](./features/splash.md) | `app.json`(`expo-splash-screen` 플러그인) · `assets/splash-icon.png` · `src/native/adapters/rn-splash-screen.ts` · `src/boot-splash.ts` ([[ADR-138]]) |
| 안내 사이트 (mapleroutine.store) | [features/site.md](./features/site.md) | `site/` · `PRIVACY.md`(원본) · `scripts/build-site.mjs` · `.github/workflows/pages.yml` |

## 공통 토대 (foundation)

| 토대 | 문서 | 언제 참고 |
|---|---|---|
| 제품 정의 | [foundation/product.md](./foundation/product.md) | 목표·사용자·플랫폼·MVP 제외 범위·전역 미해결 질문 |
| 아키텍처 | [foundation/architecture.md](./foundation/architecture.md) | 디렉토리 구조·레이어 패턴·데이터 흐름·상태관리·네이티브 개요·테스트 전략 |
| Nexon Open API | [foundation/nexon-api.md](./foundation/nexon-api.md) | API 호출·인증·정규화·호출 제한을 만질 때 |
| 에러/복원력 | [foundation/error-resilience.md](./foundation/error-resilience.md) | 실패 처리·빈 상태·참조 무결성·멱등성·엣지 케이스 |
| 디자인 시스템 | [foundation/design-system.md](./foundation/design-system.md) | 색·시맨틱 토큰·기본 컴포넌트(카드/버튼/입력)·공유 UI 패턴(탭/스크롤/모달/팝오버 `components/molecules/Popover`)·타이포·아이콘 |
| 게임 레퍼런스 데이터 | [foundation/game-data.md](./foundation/game-data.md) | `src/data/*.json` 을 만질 때 ([[ADR-006]] — AI 임의 추정 금지) · 서버 표로 옮기는 통로와 차례([[ADR-350]]) |
| 스토어 릴리스 | [foundation/release.md](./foundation/release.md) | 스토어에 나갈 바이너리를 만들 때 — 서명·`versionCode`·빌드 커맨드·산출물 검증·콘솔 요건 |

## 작업 유형별 길잡이

- **새 화면·기능 구현** → 해당 `features/*.md` (정책) + `foundation/architecture.md` (레이어 규칙) + 관련 `foundation/design-system.md` 컴포넌트. TDD 원칙상 테스트 먼저([[ADR]] 프로세스).
- **게임 수치 데이터 변경** → `foundation/game-data.md` 먼저, 값은 반드시 사용자 확인([[ADR-006]]).
- **에셋(그림) 추가·삭제** → 파일을 `src/assets/` 에 넣거나 지운 뒤 **`npm run assets:gen`** ([[ADR-129]]). 목록(`assets/generated/*.ts`)은 커밋되는 생성물이라 안 돌리면 화면이 **에러 없이 폴백만** 그린다 — `assets/generated/__tests__/asset-manifest.test.ts` 가 그 낡음을 잡는다.
- **today 위젯 추가·크기 변경** → `features/today.md` 의 「격자」·「배치」·「위젯 규약」 셋. 만질 파일은 **셋이 짝**이다 — `widgets/registry.ts`(존재·크기·목적지) · `widgets/layout.ts`(좌표) · 위젯 컴포넌트. 좌표는 손으로 적고 `lib/today/widget-layout.ts` 의 검증 다섯이 지키므로, `row` 를 밀지 않으면 **테스트가 먼저 막는다**.
- **저장 스키마 변경** → `persistence/` (해당 매체 문서) + 해당 `features/*.md`.
- **색·토큰·테마** → `foundation/design-system.md` (기본 팔레트·시맨틱 색) + `features/theme.md` (테마별 토큰·런타임 전환).
- **동기화·정규화·호출 제한** → `foundation/nexon-api.md` + `features/content-scheduler.md`/`boss-scheduler.md`.
- **화면·기능 설명을 어디에 쓸까** → 늘 떠 있어야 하는 말은 화면 문구, 물어봐야 나오는 말은 **FAQ 바텀시트**(`components/organisms/FaqSheet/`, [[ADR-285]]). 내용은 그 기능 폴더에 데이터로 둔다.
- **에러/빈 상태/엣지 처리** → `foundation/error-resilience.md`.
- **스토어 배포·서명·버전 올리기** → `foundation/release.md` (OTA 갱신은 `features/live-update.md` — 별개 축이다).
- **알림을 더하거나 고칠 때** → `features/notifications.md`. 손대기 전에 그 문서의 «층» 표에서 **바이너리 / JS / 서버** 중 어디를 만지는지부터 판정할 것 — 왼쪽 칸은 스토어 심사를 기다린다([[ADR-146]] 결정 1).
- **기존 사용자 데이터를 만질 때** → `persistence/capacitor-storage.md`(RN 이 캐패시터 시절 저장소를 읽는 방법 — 이름에 `capacitor` 가 붙은 파일을 지우면 안 되는 이유가 거기 있다).
- **설계 결정의 배경이 궁금할 때** → `ADR.md` 에서 `[[ADR-NNN]]` 조회.
