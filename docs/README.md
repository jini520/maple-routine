# 문서 지도

메이플 루틴의 설계 문서다. 작업을 시작하기 전에 이 표에서 읽고 고칠 문서를 고른다.

## 구조

```
docs/
├── README.md       지금 이 파일
├── ADR.md          결정 목록 · ADR 파일 이름 규칙 · 카테고리 표 · 문서 형식
├── adr/            결정 하나에 파일 하나. 기능 하나의 결정은 파일 하나에 모은다
├── features/       화면과 기능마다 지금 무엇을 하는지
├── foundation/     여러 기능이 함께 따르는 규칙과 공용 부분
└── persistence/    기기에 무엇을 어디에 저장하는지
```

- **기능 문서**(`features/` · `foundation/`)에는 지금 앱이 무엇을 하는지만 적는다. 관련 소스 표와 동작 표가 중심이다. 왜 그렇게 만들었는지는 `[[ADR-NNN]]` 으로 ADR 에 넘긴다.
- **ADR**(`adr/`)에는 결정과 그 이유, 그리고 그 결정을 지키는 테스트를 적는다. 결정이 바뀌면 같은 파일에 새 번호를 덧붙여 다시 쓴다. 규칙은 [ADR.md](./ADR.md) 머리에 있다.
- 두 종류 모두 **지금 구현된 것만** 적는다. 바뀌기 전 내용은 git 히스토리에 있다.

## 기능

| 카테고리 | 문서 | 다루는 것 | 결정 |
|---|---|---|---|
| `today` | [features/today.md](./features/today.md) | 첫 화면 위젯 격자 · 빠른 이동 | [[ADR-058]] · [[ADR-089]] |
| `content-scheduler` | [features/content-scheduler.md](./features/content-scheduler.md) | 일간 · 주간 컨텐츠 진행 | [[ADR-032]] · [[ADR-033]] · [[ADR-034]] · [[ADR-035]] |
| `boss-scheduler` | [features/boss-scheduler.md](./features/boss-scheduler.md) | 보스 진행 · 파티 인원 · 보스 관리 | [[ADR-036]] · [[ADR-037]] · [[ADR-038]] · [[ADR-039]] · [[ADR-093]] |
| `boss-profit` | [features/boss-profit.md](./features/boss-profit.md) | 보스 수익 기록과 기간 | [[ADR-040]] · [[ADR-041]] · [[ADR-042]] · [[ADR-043]] · [[ADR-092]] |
| `item-drop` | [features/item-drop.md](./features/item-drop.md) | 드롭 기록 · 판매 가격 · 연출 | [[ADR-044]] · [[ADR-045]] |
| `cashbook` | [features/cashbook.md](./features/cashbook.md) | 수입 · 지출 캘린더와 손입력 | [[ADR-046]] · [[ADR-047]] · [[ADR-048]] · [[ADR-049]] · [[ADR-095]] · [[ADR-100]] · [[ADR-117]] · [[ADR-137]] |
| `stats` | [features/stats.md](./features/stats.md) | 기간별 수익 · 지출 통계 | [[ADR-002]] |
| `party-appointments` | [features/party-appointments.md](./features/party-appointments.md) | 파티 일정과 알림 | [[ADR-051]] |
| `utility` | [features/utility.md](./features/utility.md) | 도구 목록 · 판매 분배금 계산기 · 주간 보스 수익 계산기 | [[ADR-001]] · [[ADR-074]] |
| `mvp-grade` | [features/mvp-grade.md](./features/mvp-grade.md) | MVP 등급과 수수료 | [[ADR-050]] |
| `character` | [features/character.md](./features/character.md) | 추적 캐릭터 · 캐릭터 관리 · 선택 · 초상화 | [[ADR-028]] · [[ADR-029]] · [[ADR-030]] · [[ADR-031]] |
| `auth` | [features/auth.md](./features/auth.md) | API 키 · 넥슨 로그인 | [[ADR-024]] · [[ADR-025]] |
| `app-entry` | [features/app-entry.md](./features/app-entry.md) | 온보딩 · 첫 화면 | [[ADR-026]] · [[ADR-027]] |
| `settings` | [features/settings.md](./features/settings.md) | 더보기 · 설정 · 데이터 삭제 | [[ADR-052]] · [[ADR-053]] |
| `theme` | [features/theme.md](./features/theme.md) | 테마 · 색 토큰 · 배경 그림 | [[ADR-054]] · [[ADR-055]] |
| `notice` | [features/notice.md](./features/notice.md) | 운영자 공지 · 넥슨 공지 | [[ADR-057]] |
| `notifications` | [features/notifications.md](./features/notifications.md) | 로컬 알림 · 공지 푸시 | [[ADR-056]] |
| `live-update` | [features/live-update.md](./features/live-update.md) | OTA 업데이트 | [[ADR-011]] · [[ADR-012]] |
| `splash` | [features/splash.md](./features/splash.md) | 스플래시 · 앱 아이콘 | [[ADR-013]] |
| `ads` | [features/ads.md](./features/ads.md) | 광고 | [[ADR-014]] |
| `site` | [features/site.md](./features/site.md) | 안내 사이트 | [[ADR-015]] |

## 공통 토대

| 카테고리 | 문서 | 다루는 것 | 결정 |
|---|---|---|---|
| `product` | [foundation/product.md](./foundation/product.md) | 앱이 무엇이고 누구를 위한 것인지 | - |
| `architecture` | [foundation/architecture.md](./foundation/architecture.md) | 디렉터리 · 계층 · 어댑터 경계 · 쿼리 캐시 · 테스트 | [[ADR-004]] · [[ADR-005]] · [[ADR-006]] · [[ADR-142]] |
| `navigation` | [foundation/navigation.md](./foundation/navigation.md) | 화면 스택 · 하단바 | [[ADR-059]] |
| `design-system` | [foundation/design-system.md](./foundation/design-system.md) | 공용 부품 · 시트 · 화면 틀 · 글자 | [[ADR-060]] · [[ADR-061]] · [[ADR-062]] · [[ADR-063]] · [[ADR-064]] |
| `nexon-api` | [foundation/nexon-api.md](./foundation/nexon-api.md) | 넥슨 Open API 호출과 동기화 | [[ADR-021]] |
| `error-resilience` | [foundation/error-resilience.md](./foundation/error-resilience.md) | 실패 처리 · 이어서 하는 작업 | [[ADR-022]] · [[ADR-023]] |
| `game-data` | [foundation/game-data.md](./foundation/game-data.md) | 보스 · 드롭 · 지출 목록 같은 게임 수치 | [[ADR-019]] · [[ADR-020]] |
| `server` | [foundation/server.md](./foundation/server.md) | 우리 서버의 경로와 인증 · 드롭 시세 | [[ADR-016]] · [[ADR-017]] · [[ADR-071]] |
| `server-sync` | [foundation/server-sync.md](./foundation/server-sync.md) | 앱이 서버로 올리는 값 | [[ADR-018]] · [[ADR-099]] · [[ADR-102]] |
| `persistence` | [persistence/README.md](./persistence/README.md) | 기기 저장소 · SQLite 스키마 · 데이터 수명 | [[ADR-007]] · [[ADR-078]] · [[ADR-096]] |
| `release` | [foundation/release.md](./foundation/release.md) | 스토어 빌드 · 서명 · 버전 | [[ADR-008]] · [[ADR-009]] · [[ADR-010]] |
| `docs` | [foundation/writing.md](./foundation/writing.md) | 문서 · 주석 · 앱 문구 쓰는 규칙 | [[ADR-003]] |

## 작업마다 볼 문서

- **화면이나 기능을 만들거나 고칠 때**: 그 기능 문서와 ADR, 그리고 [foundation/architecture.md](./foundation/architecture.md) 의 계층 규칙과 [foundation/design-system.md](./foundation/design-system.md) 의 공용 부품.
- **게임 수치를 바꿀 때**: [foundation/game-data.md](./foundation/game-data.md). 값은 반드시 사용자에게 확인받는다.
- **저장 형식을 바꿀 때**: [persistence/](./persistence/README.md) 의 해당 문서와 그 기능 문서.
- **기존 사용자의 기기 데이터를 다룰 때**: [persistence/capacitor-storage.md](./persistence/capacitor-storage.md). 이름에 `capacitor` 가 붙은 파일을 지우면 안 되는 이유가 여기 있다.
- **스토어에 올릴 바이너리를 만들 때**: [foundation/release.md](./foundation/release.md). OTA 발행은 [features/live-update.md](./features/live-update.md) 를 본다.
- **문서 · 주석 · 앱 문구를 쓸 때**: [foundation/writing.md](./foundation/writing.md).
