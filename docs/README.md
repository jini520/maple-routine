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
└── trouble/              날짜별 트러블슈팅 로그(네이티브·실기기 이슈)
```

- **features/** 와 **foundation/** 의 각 문서는 상단에 **인덱스 헤더**(범위 · 관련 소스 파일(read/write 대상) · 관련 ADR · 관련 문서)를 갖는다. 문서를 열면 그 헤더만 보고 어떤 소스를 만질지 알 수 있다.
- 각 문서 하단에는 **`## 폐기된 정책 (history)`** 섹션이 있다. 본문은 항상 **현재 유효한 정책만** 담고, 대체·폐기된 결정은 `~~옛 정책~~ → 새 정책 (ADR-N)` 한 줄로 이 섹션에 모은다. 정책을 바꿀 때 옛 내용을 지우지 말고 이 섹션으로 내려라.
- **ADR.md** 는 쪼개지 않는다. `[[ADR-NNN]]` 은 경로가 아니라 논리적 참조이므로 문서 위치와 무관하게 그대로 쓴다. 새 결정은 ADR.md 말미에 append 한다.
- **persistence/** 는 "무엇이 어디에 저장되는가"를 저장 매체(Preferences/SQLite/네이티브) 축으로 조직한 별개 문서다. feature 계층으로 편입하지 않는다 — 저장 스키마를 만질 때만 참고.

## 기능별 인덱스

| 기능 | 문서 | 주요 소스(read/write) |
|---|---|---|
| 온보딩 (API 키·계정 선택·예열) | [features/onboarding.md](./features/onboarding.md) | `app/onboarding/` · `features/onboarding/` · `nexon/character` · `storage/character-basic-cache` |
| 컨텐츠 스케줄러 | [features/content-scheduler.md](./features/content-scheduler.md) | `app/content-scheduler/` · `features/content-scheduler/` · `lib/scheduler-merge` · `lib/scheduler-content-scope` · `storage/scheduler-cache` · `storage/shared-progress-cache` |
| 보스 스케줄러 (파티 관리 포함) | [features/boss-scheduler.md](./features/boss-scheduler.md) | `app/boss-scheduler/` · `features/boss-scheduler/` · `storage/boss-party-settings` · `lib/boss-icons` · `lib/boss-matching` |
| 보스 수익 | [features/boss-profit.md](./features/boss-profit.md) | `app/boss-profit/` · `features/boss-profit/` · `storage/boss-profit` · `storage/sqlite` · `lib/boss-profit-period` |
| 물욕 아이템 드랍 | [features/item-drop.md](./features/item-drop.md) | `app/item-drop/` · `features/item-drop/` · `lib/item-icons` · `storage/boss-drop-records` · 전 기간 히스토리: `app/boss-profit/DropHistoryScreen`(`/profit/drops`) · `features/boss-profit/drop-history-store` · `lib/drop-history` |
| 사냥 타이머 | [features/hunting-timer.md](./features/hunting-timer.md) | `app/hunting-timer/` · `features/hunting-timer/` · `native/hunting-timer` |
| 설정 | [features/settings.md](./features/settings.md) | `app/settings/`(`SettingsScreen` + 하위 화면 `SettingsReleaseNotesScreen`/`SettingsFeatureGuideScreen`/`SettingsAccountDataScreen`/`SettingsAboutScreen` — 라우트 `/settings/release-notes`(+자식 `:guideId`)·`/settings/account-data`·`/settings/about`, `/settings` 의 **형제**) · 행 프리미티브 `SettingsRow`/`SettingsLinkRow`/`row-class.ts` · `src/data/release-notes.ts`·`src/data/release-note-guides.ts`(+`src/types/release-notes.ts`, 이미지 `src/assets/guide/`) · `features/settings/`(`cache-data`) · `storage/api-key` · `features/tracking-mode` |
| 테마 시스템 | [features/theme.md](./features/theme.md) | `features/theme/` · `storage/theme` · `src/index.css` · `src/data/job-themes.json` · `lib/theme-derive` · `lib/theme-backgrounds` · `src/assets/themes/` · `lib/color` · `scripts/theme-gen.ts` |
| 광고 | [features/ads.md](./features/ads.md) | `native/ads.ts` · `features/ads/` · `storage/ads.ts` · `App.tsx`(탭 전환 훅) |
| Live Update (OTA) | [features/live-update.md](./features/live-update.md) | `native/live-update.ts` · `features/live-update/` · `native/network` |
| 스플래시 | [features/splash.md](./features/splash.md) | `android/…/SplashActivity` · iOS 스토리보드 · `capacitor.config.ts` · `index.html` |
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
- **저장 스키마 변경** → `persistence/` (해당 매체 문서) + 해당 `features/*.md`.
- **색·토큰·테마** → `foundation/design-system.md` (기본 팔레트·시맨틱 색) + `features/theme.md` (테마별 토큰·런타임 전환).
- **동기화·정규화·호출 제한** → `foundation/nexon-api.md` + `features/content-scheduler.md`/`boss-scheduler.md`.
- **에러/빈 상태/엣지 처리** → `foundation/error-resilience.md`.
- **스토어 배포·서명·버전 올리기** → `foundation/release.md` (OTA 갱신은 `features/live-update.md` — 별개 축이다).
- **설계 결정의 배경이 궁금할 때** → `ADR.md` 에서 `[[ADR-NNN]]` 조회.
