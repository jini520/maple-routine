# Architecture Decision Records (인덱스)

결정 원장의 인덱스다. 전문은 [`adr/`](./adr/) 에 파일 하나씩 있다. 필요한 결정만 열고, 전체를
컨텍스트에 올리지 말 것. 아래 결정 목록에는 **한 파일에 한 줄**만 넣는다. 요약을 쌓으면 이 파일이
다시 불어난다(옛 인덱스는 507KB 까지 불었다).

## 파일 이름 규칙

```
ADR-{번호목록}_{카테고리}_{기능}.md

ADR-001_boss-profit_drop-records.md
ADR-001+010_boss-profit_drop-records.md    결정이 바뀌어 010 을 덧붙인 뒤
```

- **번호**는 세 자리다. 여러 개면 `+` 로 잇고, 처음 생긴 번호가 맨 앞에 온다. 그래서 정렬 순서가
  바뀌지 않는다.
- **카테고리**는 아래 카테고리 표의 slug 만 쓴다.
- **기능**은 그 카테고리 안에서 이 문서가 다루는 대상이다. 코드에 있는 이름을 영어 slug(소문자와
  `-`)로 쓴다.
- 대괄호 · 쉼표 · 공백 · 한글은 넣지 않는다. 대괄호는 zsh 의 패턴 문자라 매번 따옴표가 필요하다.
  한글은 macOS 와 GitHub 의 유니코드 정규화가 달라 같은 파일이 다른 이름으로 잡힌다.

**한 기능의 결정은 한 파일에 둔다.** 그 기능의 결정이 바뀌면 새 파일을 만들지 않는다. 새 번호를
파일 이름 끝에 `+NNN` 으로 덧붙이고 같은 파일에 이어 쓴다.

**문서끼리는 번호로 가리킨다**(`[[ADR-NNN]]`). 번호가 붙을 때마다 파일 이름이 바뀌므로 경로로
걸면 링크가 끊어진다. 번호는 파일 이름이 바뀌어도 남는다.

## 상태

| 배지 | 뜻 |
|---|---|
| 🟢 유효 | 지금 앱이 이 결정대로 돈다 |
| ⚪ 미구현 | 결정만 있고 코드가 없다. 착수 전에 다시 읽을 것 |

상태는 이 둘뿐이다. 결정 일부가 뒤집히면 죽은 결정을 본문에서 지우고, 남은 결정만으로 다시 쓴다.
결정이 전부 죽으면 파일을 지우고, 인덱스 행과 문서의 `[[…]]` 인용도 걷는다. 죽은 정책이 파일에
남아 있으면 다음 세션이 그것을 읽고 되살리기 때문이다. 옛 내용은 git 히스토리에 있다.

## 카테고리

카테고리 하나가 기능 문서 하나와 짝이다. 옛 ADR 을 나누다 맞지 않는 것이 나오면 이 표를 먼저
고친다.

| slug | 다루는 것 | 기능 문서 |
|---|---|---|
| `auth` | API 키 입력 · 검증 · 넥슨 로그인 | `features/auth.md` |
| `app-entry` | 앱을 켜면 서는 화면 · 캐릭터 설정 | `features/app-entry.md` |
| `character` | 추적 캐릭터 · 캐릭터 관리 · 캐릭터 선택 · 초상화 | (재작성 때 정한다) |
| `content-scheduler` | 일간 · 주간 컨텐츠 진행 | `features/content-scheduler.md` |
| `boss-scheduler` | 보스 진행 · 파티 인원 · 분배 비율 | `features/boss-scheduler.md` |
| `boss-profit` | 보스 수익 기록 · 기간 | `features/boss-profit.md` |
| `item-drop` | 드롭 아이템 기록 · 드롭 히스토리 | `features/item-drop.md` |
| `today` | 첫 화면 위젯 격자 | `features/today.md` |
| `utility` | 도구 목록 · 판매 분배금 계산기 | `features/utility.md` |
| `cashbook` | 수익 · 지출 캘린더 · 손입력 | `features/cashbook.md` |
| `stats` | 기간별 수익 · 지출 통계 | `features/stats.md` |
| `mvp-grade` | MVP 등급 · 수수료 · 할인 | `features/mvp-grade.md` |
| `party-appointments` | 파티 약속 · 약속 알림 | `features/party-appointments.md` |
| `settings` | 설정 화면 · 안내 · 계정 데이터 | `features/settings.md` |
| `theme` | 테마 · 색 토큰 · 배경 | `features/theme.md` |
| `notifications` | 로컬 알림 · 공지 푸시 | `features/notifications.md` |
| `live-update` | OTA 업데이트 | `features/live-update.md` |
| `splash` | 스플래시 | `features/splash.md` |
| `ads` | 광고 | `features/ads.md` |
| `site` | 안내 사이트 | `features/site.md` |
| `notice` | 운영자 공지 · 넥슨 공지 | (재작성 때 정한다) |
| `navigation` | 하단바 · 스택 · 화면 전환 | (재작성 때 정한다) |
| `server` | 서버 자체 · 서버 계정 · 서버 배포 | (재작성 때 정한다) |
| `server-sync` | 앱이 서버로 보내는 값 | (기능 문서 없음, 재작성 때 정한다) |
| `architecture` | 디렉터리 · 레이어 · 어댑터 경계 · 테스트 | `foundation/architecture.md` |
| `nexon-api` | 넥슨 Open API 호출 · 정규화 · 호출 제한 | `foundation/nexon-api.md` |
| `error-resilience` | 실패 처리 · 빈 상태 · 이어서 하는 작업 | `foundation/error-resilience.md` |
| `design-system` | 공용 컴포넌트 · 시트 · 타이포 · 아이콘 | `foundation/design-system.md` |
| `game-data` | 보스 표 · 드롭 표 등 게임 수치 데이터 | `foundation/game-data.md` |
| `release` | 스토어 빌드 · 서명 · 버전 | `foundation/release.md` |
| `persistence` | 기기 저장소 · SQLite 스키마 · 옛 저장소 읽기 | `persistence/` |
| `docs` | 문서 · 주석 · ADR 자체의 규칙 | `README.md` |

## 문서 형식

```markdown
# ADR-001+010 보스 수익 드롭 기록

> 🟢 유효
> 옛 번호: ADR-067 · ADR-113 · ADR-127
> 관련 소스: `features/boss-profit/` · `storage/boss-profit`

## 배경
이 결정이 왜 필요했는지.

## 결정

### 결정 1. 한 줄로 쓴 결정
이유를 같은 자리에 쓴다.

## 테스트
| 파일 | 확인하는 것 |
|---|---|
| `features/boss-profit/__tests__/store.test.ts` | 이 결정이 깨지면 무엇이 실패하는지 |

## 열린 질문
반드시 풀어야 하는 것만 남긴다.

## 번호 기록
- ADR-001 (2026-10-20): 처음 작성
- ADR-010 (2026-11-02): 결정 3 을 바꿨다. 이유 한 줄
```

- `### 결정 N.` 제목 형식을 지킨다. 그래야 `[[ADR-NNN]] 결정 3` 같은 인용을 테스트가 검사할 수 있다.
  결정 번호는 파일 안에서 하나씩 늘린다. 덧붙인 번호도 같은 줄을 잇는다.
- **테스트** 표에는 이 결정을 지키는 테스트만 적는다. 값 하나를 그대로 비교하거나 입력과 출력이
  뻔한 테스트는 코드에서 지운다.
- **번호 기록**은 파일 이름의 번호마다 무엇을 더하거나 바꿨는지 한 줄씩 적는다. 지운 결정의 본문은
  남기지 않는다.

## 결정 목록

파일 하나에 한 줄이다. 행 형식은 `| [ADR-001+010](./adr/ADR-001+010_boss-profit_drop-records.md) | 🟢 | boss-profit | 보스 수익 드롭 기록 |` 이다.

| ADR | 상태 | 카테고리 | 제목 |
|---|---|---|---|
| [ADR-001+084](./adr/ADR-001+084_utility_item-split.md) | 🟢 | utility | 판매 분배금 계산기 |
| [ADR-002+094](./adr/ADR-002+094_stats_overview.md) | 🟢 | stats | 통계 화면 |
| [ADR-003](./adr/ADR-003_docs_writing-rules.md) | 🟢 | docs | 문서 · 주석 · 앱 문구 쓰는 규칙 |
| [ADR-004+065](./adr/ADR-004+065_architecture_local-first-adapters.md) | 🟢 | architecture | 기기 저장소와 네이티브 어댑터 경계 |
| [ADR-005](./adr/ADR-005_architecture_react-native.md) | 🟢 | architecture | React Native 앱 하나로 만든다 |
| [ADR-006+069](./adr/ADR-006+069_architecture_testing.md) | 🟢 | architecture | 테스트 러너와 테스트 작성 규칙 |
| [ADR-007+077](./adr/ADR-007+077_persistence_sqlite.md) | 🟢 | persistence | SQLite 커넥션 · 스키마 진화 · 기본키 |
| [ADR-008](./adr/ADR-008_release_android-signing.md) | 🟢 | release | Android 릴리스 서명 |
| [ADR-009](./adr/ADR-009_release_binary-size.md) | 🟢 | release | 에셋과 스토어 바이너리 크기 |
| [ADR-010](./adr/ADR-010_release_ios-scene.md) | 🟢 | release | 화면 회전 잠금과 iOS 씬 |
| [ADR-011](./adr/ADR-011_live-update_protocol.md) | 🟢 | live-update | OTA 발행과 프로토콜 |
| [ADR-012](./adr/ADR-012_live-update_prompt.md) | 🟢 | live-update | 업데이트 동의 모달과 적용 |
| [ADR-013](./adr/ADR-013_splash_boot.md) | 🟢 | splash | 스플래시와 앱 아이콘 |
| [ADR-014](./adr/ADR-014_ads_inline.md) | 🟢 | ads | 광고 배선 |
| [ADR-015](./adr/ADR-015_site_guide.md) | 🟢 | site | 안내 사이트 |
| [ADR-016](./adr/ADR-016_server_platform.md) | 🟢 | server | 서버 구성 |
| [ADR-017](./adr/ADR-017_server_users.md) | 🟢 | server | 서버의 사용자와 신원 |
| [ADR-018](./adr/ADR-018_server-sync_drop-price.md) | 🟢 | server-sync | 드롭 가격 서버 전송 |
| [ADR-019](./adr/ADR-019_game-data_reference.md) | 🟢 | game-data | 게임 데이터의 규칙 |
| [ADR-020+097+103](./adr/ADR-020+097+103_game-data_server-catalog.md) | 🟢 | game-data | 게임 데이터 서버 표와 기기 사본 |
| [ADR-021](./adr/ADR-021_nexon-api_sync.md) | 🟢 | nexon-api | 넥슨 API 호출과 스케줄러 동기화 |
| [ADR-022+081](./adr/ADR-022+081_error-resilience_failure-states.md) | 🟢 | error-resilience | 실패를 알리는 방법과 기간 데이터 상태 |
| [ADR-023](./adr/ADR-023_error-resilience_resumable-task.md) | 🟢 | error-resilience | 이어서 하는 작업과 기록 판 알림 |
| [ADR-024](./adr/ADR-024_auth_api-key.md) | 🟢 | auth | API 키 로그인과 키 재입력 |
| [ADR-025+068+083+105](./adr/ADR-025+068+083+105_auth_nexon-login.md) | 🟢 | auth | 넥슨 로그인 |
| [ADR-026](./adr/ADR-026_app-entry_onboarding.md) | 🟢 | app-entry | 온보딩 흐름 |
| [ADR-027](./adr/ADR-027_app-entry_cold-start.md) | 🟢 | app-entry | 콜드 스타트 첫 화면 |
| [ADR-028](./adr/ADR-028_character_tracking.md) | 🟢 | character | 추적 캐릭터 |
| [ADR-029+108](./adr/ADR-029+108_character_manage.md) | 🟢 | character | 캐릭터 관리 화면 |
| [ADR-030](./adr/ADR-030_character_selection.md) | 🟢 | character | 캐릭터 선택 |
| [ADR-031](./adr/ADR-031_character_portrait.md) | 🟢 | character | 캐릭터 초상화 |
| [ADR-032](./adr/ADR-032_content-scheduler_cache.md) | 🟢 | content-scheduler | 스케줄러 응답 병합과 캐시 |
| [ADR-033](./adr/ADR-033_content-scheduler_cards.md) | 🟢 | content-scheduler | 컨텐츠 카드와 완료 판정 |
| [ADR-034](./adr/ADR-034_content-scheduler_tracking-mode.md) | 🟢 | content-scheduler | 자동 · 수동 추적 모드와 컨텐츠 관리 |
| [ADR-035](./adr/ADR-035_content-scheduler_layout.md) | 🟢 | content-scheduler | 스케줄러 화면의 레일 아래 간격 |
| [ADR-036](./adr/ADR-036_boss-scheduler_boss-list.md) | 🟢 | boss-scheduler | 보스 스케줄러 목록과 보스 관리 화면 |
| [ADR-037](./adr/ADR-037_boss-scheduler_completion.md) | 🟢 | boss-scheduler | 보스 완료 판정과 주간 한도 |
| [ADR-038](./adr/ADR-038_boss-scheduler_party.md) | 🟢 | boss-scheduler | 보스 파티 인원과 결정석 분배 비율 |
| [ADR-039](./adr/ADR-039_boss-scheduler_card.md) | 🟢 | boss-scheduler | 보스 카드 |
| [ADR-093](./adr/ADR-093_boss-scheduler_manage-redesign.md) | 🟢 | boss-scheduler | 보스 관리 화면 리디자인과 난이도 고르개 통일 |
| [ADR-040](./adr/ADR-040_boss-profit_records.md) | 🟢 | boss-profit | 보스 수익 기록 |
| [ADR-041](./adr/ADR-041_boss-profit_period.md) | 🟢 | boss-profit | 보스 수익 기간 |
| [ADR-042](./adr/ADR-042_boss-profit_amounts.md) | 🟢 | boss-profit | 보스 수익 금액 표시 |
| [ADR-043](./adr/ADR-043_boss-profit_layout.md) | 🟢 | boss-profit | 보스 수익 화면 배치 |
| [ADR-092](./adr/ADR-092_boss-profit_redesign.md) | 🟢 | boss-profit | 보스 수익 리디자인과 고가 드롭 홀로그램 강조 |
| [ADR-044+066+076+111](./adr/ADR-044+066+076+111_item-drop_records.md) | 🟢 | item-drop | 드롭 기록 · 가격 · 히스토리 |
| [ADR-045](./adr/ADR-045_item-drop_effect.md) | 🟢 | item-drop | 고가 드롭 연출과 강조 |
| [ADR-046](./adr/ADR-046_cashbook_calendar.md) | 🟢 | cashbook | 가계부 캘린더 |
| [ADR-047](./adr/ADR-047_cashbook_entries.md) | 🟢 | cashbook | 가계부 기록과 금액 |
| [ADR-048+070](./adr/ADR-048+070_cashbook_entry-sheet.md) | 🟢 | cashbook | 가계부 입력 시트 |
| [ADR-049](./adr/ADR-049_cashbook_hunting.md) | 🟢 | cashbook | 사냥 수입 |
| [ADR-095](./adr/ADR-095_cashbook_redesign.md) | 🟢 | cashbook | 가계부 고른 날 목록과 기간 이동 줄 리디자인 |
| [ADR-050+110](./adr/ADR-050+110_mvp-grade_fees.md) | 🟢 | mvp-grade | MVP 등급과 수수료 · 스타포스 비용 |
| [ADR-051+075+090](./adr/ADR-051+075+090_party-appointments_schedule.md) | 🟢 | party-appointments | 파티 스케줄 |
| [ADR-052+104](./adr/ADR-052+104_settings_screen.md) | 🟢 | settings | 더보기 · 설정 화면과 안내 · 앱 안 리뷰 요청 |
| [ADR-053+067](./adr/ADR-053+067_settings_cache-data.md) | 🟢 | settings | 캐시 데이터 삭제 |
| [ADR-054](./adr/ADR-054_theme_tokens.md) | 🟢 | theme | 테마와 색 토큰 |
| [ADR-055](./adr/ADR-055_theme_backdrops.md) | 🟢 | theme | 테마 배경 그림 |
| [ADR-056+072](./adr/ADR-056+072_notifications_local.md) | 🟢 | notifications | 알림 예약과 공지 구독 |
| [ADR-057](./adr/ADR-057_notice_feed.md) | 🟢 | notice | 운영자 공지와 넥슨 공지 |
| [ADR-058+087](./adr/ADR-058+087_today_widgets.md) | 🟢 | today | today 위젯 격자 |
| [ADR-089](./adr/ADR-089_today_quick-links.md) | 🟢 | today | today 빠른 이동 |
| [ADR-059](./adr/ADR-059_navigation_stack.md) | 🟢 | navigation | 화면 스택과 하단바 |
| [ADR-060+073+079+085+088+107+109](./adr/ADR-060+073+079+085+088+107+109_design-system_components.md) | 🟢 | design-system | 공용 부품의 계층과 기본 부품 |
| [ADR-061](./adr/ADR-061_design-system_states.md) | 🟢 | design-system | 빈 상태 · 로딩 · 실패 · 갱신 시각 표시 |
| [ADR-062+082+091+106](./adr/ADR-062+082+091+106_design-system_sheets.md) | 🟢 | design-system | 시트 · 상단 시트 · 모달 · 팝오버 · 입력 카드 |
| [ADR-063+080](./adr/ADR-063+080_design-system_layout.md) | 🟢 | design-system | 화면 틀 · 헤더 · 안전영역 · 글자 |
| [ADR-064](./adr/ADR-064_design-system_refresh.md) | 🟢 | design-system | 당겨서 새로고침 |
| [ADR-071](./adr/ADR-071_server_drop-price-market.md) | 🟢 | server | 드롭 시세 · 잘못 적은 값 빼기 · 관리 화면 |
| [ADR-074](./adr/ADR-074_utility_boss-profit-calculator.md) | 🟢 | utility | 주간 보스 수익 계산기 |
| [ADR-078](./adr/ADR-078_persistence_boss-tables.md) | 🟢 | persistence | 보스 기록 테이블 재설계 |
| [ADR-096](./adr/ADR-096_persistence_cashbook-tables.md) | 🟢 | persistence | 가계부 기록 테이블 재설계 |
| [ADR-098](./adr/ADR-098_persistence_record-keys.md) | 🟢 | persistence | 남은 표의 기본키 · 파티 약속 id · 넥슨 계정 id |
| [ADR-099](./adr/ADR-099_server-sync_records.md) | 🟢 | server-sync | 보스 처치 · 가계부 · 강화 합계의 최종값 서버 전송 |
| [ADR-100](./adr/ADR-100_cashbook_enhancement-totals.md) | 🟢 | cashbook | 강화 합계 저장과 재계산 요청 |
| [ADR-101](./adr/ADR-101_auth_multi-account.md) | ⚪ | auth | 다계정 |
| [ADR-102](./adr/ADR-102_server-sync_anomaly-reports.md) | 🟢 | server-sync | 예상하지 못한 상황의 서버 로그 |
| [ADR-086](./adr/ADR-086_design-system_figma-library.md) | 🟢 | design-system | Figma 디자인 시스템 파일 |
