# 아키텍처 (Architecture)

> **범위**: 디렉토리 구조·레이어 패턴·시스템 데이터 흐름·상태 관리·네이티브 연동 개요·테스트 전략. 기능별 흐름 세부는 각 `features/*.md`, 에러 처리는 [error-resilience.md](./error-resilience.md), API는 [nexon-api.md](./nexon-api.md).
> **관련 소스**: `src/` 전체 레이어(`app/` `features/` `storage/` `native/` `nexon/` `components/` `lib/` `types/` `data/`).
> **관련 ADR**: [[ADR-001]] [[ADR-003]] [[ADR-005]] [[ADR-007]] [[ADR-013]]. **관련 문서**: [nexon-api.md](./nexon-api.md), [error-resilience.md](./error-resilience.md), [../persistence/README.md](../persistence/README.md).

## 핵심 규칙 (CRITICAL)
- `features/*` 코드는 로컬 저장소·네이티브 API에 **직접 접근하지 않는다**. 반드시 `storage/`·`native/` 어댑터를 거친다([[ADR-003]], [[ADR-005]]).
- 게임 레퍼런스 수치(`src/data/`)는 AI가 임의 추정해 하드코딩하지 않는다. 사용자(도메인 전문가) 확인 후 반영([[ADR-006]]).
- 화면은 `app/`, 기능 상태·로직은 `features/`, 공용 UI는 `components/`, 타입은 `types/`, 범용 유틸은 `lib/`.

## 디렉토리 구조
```
src/
├── app/                    # 라우트별 화면 (React Router)
│   ├── onboarding/         # API 키 입력 + 계정(메이플 ID) 선택
│   ├── content-scheduler/  # 일간 탭 + 주간 탭 (월간 탭 없음, [[ADR-013]])
│   ├── boss-scheduler/     # 주간 탭 + 월간 탭 (일간 탭 없음), 전체/솔로/파티 서브 필터
│   ├── hunting-timer/
│   ├── boss-profit/        # 주간/월간 탭 + 기간 네비게이터
│   ├── item-drop/
│   └── settings/
├── features/               # 기능별 도메인 로직(UI 상태 + 비즈니스 로직)
│   ├── onboarding/  content-scheduler/  boss-scheduler/  hunting-timer/
│   ├── boss-profit/  item-drop/  settings/  tracking-mode/  live-update/  drop-effect/
│   └── theme/              # 선택된 테마 상태, storage/theme.ts 영속화
├── data/                   # 게임 레퍼런스 데이터(버전 명시) — game-data.md 참고
├── nexon/                  # Nexon Open API 클라이언트([[ADR-007]]) — nexon-api.md 참고
│   ├── character/  schedule/  (client / normalize)
├── storage/                # 로컬 저장소 접근 레이어(SQLite/Preferences 어댑터) — persistence/ 참고
├── native/                 # Capacitor 플러그인 래퍼 + 커스텀 네이티브 플러그인
│   ├── hunting-timer/  notification-sync/  live-update.ts  network
├── components/             # 공용 UI (BossPortrait, CharacterTrackingPicker, Modal 등)
├── assets/                 # items/(+rings/) · bosses/ · maps/ · worlds/
├── lib/                    # 범용 유틸(reset-clock, item-icons, boss-icons, boss-matching,
│                           #   scheduler-merge, scheduler-content-scope, boss-profit-period,
│                           #   daily-quest-backgrounds, content-category, world-emblem, error-reporting)
└── types/
```

## 레이어 패턴
Feature 단위 구조. 각 `features/*` 폴더가 그 기능의 상태·로직을 소유하고, `storage/`·`native/`·`nexon/` 은 외부 의존성(로컬 저장소·네이티브 API·Nexon API)을 격리하는 공용 어댑터다. 덕분에 (1) feature 코드가 Capacitor/Nexon 응답 형식을 직접 몰라도 되고, (2) [[ADR-003]]이 바뀌거나 API 스펙이 바뀌어도 어댑터 내부만 교체하면 된다.

- `content-scheduler`·`boss-scheduler` 는 로컬 쓰기 상태를 직접 소유하지 않고, `nexon/schedule` 이 반환하는 동기화 캐시를 **읽기 전용**으로 구독한다. `boss-scheduler` 는 캐시의 `bossContents` 를 `cycle`(weekly/monthly)로 갈라 화면 탭에 전달한다.
- `hunting-timer` 는 `storage/`·`native/` 에 직접 쓰는 독립 feature.
- `boss-profit`·`item-drop` 은 **혼합 패턴** — 보스 목록은 동기화 캐시를 읽기 전용 구독하고([[ADR-007]], [[ADR-011]]), 그 위 사용자 기록(파티원 수·아이템 획득·수익)은 `storage/` 에 직접 쓴다. "무엇을 기록할 수 있는지"는 동기화 데이터가 결정하고, "실제로 기록한 값"은 로컬 소유.

## 시스템 데이터 흐름 (cross-cutting)
기능별 상세 흐름은 각 `features/*.md`. 여기서는 여러 기능이 공유하는 골격만 정리한다.

**[온보딩 — 최초 1회, [[ADR-007]]]** → 상세 [features/onboarding.md](../features/onboarding.md)
1. 설정에서 개인 API 키 입력 → `storage/` 보안 영역 저장
2. `nexon/character` 가 `character/list` 호출 → `account_list` 가 2개↑면 계정 선택 UI
3. `storage/` 에는 `apiKey` 와 선택된 `accountId` 만 저장(캐릭터 목록은 캐싱하지 않고 매번 재조회 — 개명/전직/레벨업 반영)
4. **예열([[ADR-016]])**: 계정 확정 즉시 전체 캐릭터에 대해 `character/basic` → (`access_flag: true`만) `scheduler/character-state` 를 병렬 파이프라인으로 예열하고, 하나 끝날 때마다 `storage/character-basic-cache`·`storage/scheduler-cache` 에 기록 + 진행률 갱신

**[이후 동기화 — 앱 실행/포그라운드 복귀/새로고침]**
1. **캐시 우선 표시([[ADR-016]], [[ADR-017]])**: `refresh()` 는 재검증 *전에* `storage/scheduler-cache` 값으로 화면을 먼저 그린다(보스 수익 포함)
2. `nexon/schedule` 이 저장된 키 + **추적 대상 캐릭터** ocid로만 `scheduler/character-state` 호출([[ADR-012]] — 계정 전체 순차 호출 아님). 병렬 정책은 [[ADR-008]] 정정(첫 캐릭터 프리플라이트 1건 + 나머지 `Promise.allSettled`)
3. 실패 시 [[ADR-008]] 분기 → 마지막 캐시 유지, 흐름 중단
4. 응답의 `daily_contents`/`weekly_contents`/`boss_contents` 를 방어적 파싱. `boss_contents` 는 `cycle` 이 `bossWeekly`/`bossMonthly` 인 것만 사용(`bossDaily` 무시)
5. 보스명·난이도 정규화(난이도 영↔한 = `nexon/normalize`, 보스명 공백제거 비교·`apiAlias` = `lib/boss-matching`, [[ADR-007]]). 매핑 실패는 "알 수 없는 콘텐츠"
6. 컨텐츠 스케줄러 캐시 병합([[ADR-030]])은 [features/content-scheduler.md](../features/content-scheduler.md) 참고
7. `storage/` 에 캐시 + 동기화 시각 저장 → 각 feature 가 읽기 전용 표시

**[알림 발송 판단 — 실시간 재확인, [[ADR-004]]]**
알림 예정 시각 도달 → 백그라운드 트리거(Android WorkManager / iOS BGAppRefreshTask) → `nexon/schedule` 실시간 재호출 → 미완료면 로컬 알림(64개 한도 초과 시 우선순위 정책). 재호출 실패 시 마지막 캐시 폴백. iOS는 정확 시각 미보장(베스트 에포트).

## 상태 관리
- Nexon 스케줄러 데이터는 사용자 본인 계정 데이터이지만 앱 입장에선 "외부 동기화 읽기 전용 데이터"로 다룬다 — 동기화 상태(로딩/성공/실패)·마지막 동기화 시각·캐시 응답을 `nexon/schedule` 이 노출하고 `storage/` 에 영속화.
- 전역 클라이언트 상태(현재 선택 캐릭터, 선택 테마, API 키 등록 여부, 타이머 진행 등)는 **Zustand**로 관리([[ADR-009]] 테마 포함).
- 영속 데이터(API 키·동기화 캐시·보스 기록·드랍 히스토리·선택 테마)는 `storage/` 에 저장하고 앱 시작 시 hydration. 상세 스키마는 [persistence/](../persistence/README.md).

## 네이티브 연동 개요 ([[ADR-001]])
- `@capacitor/local-notifications`: 일간/주간 미완료 알림 예약([[ADR-004]]).
- **커스텀 플러그인**(Swift/Kotlin): 사냥 타이머 상시 알림(Android Foreground Service + Chronometer / iOS Live Activity) + 주기 사운드([[ADR-005]]) → [features/hunting-timer.md](../features/hunting-timer.md).
- `@capacitor-community/sqlite`(+ 웹 테스트용 `jeep-sqlite`): 보스 수익 기록 등([[ADR-003]]).
- `@capgo/capacitor-updater`: Live Update([[ADR-022]]) → [features/live-update.md](../features/live-update.md).
- `@capacitor/network`: 셀룰러 감지([[ADR-027]]).
- 플랫폼별 백그라운드 정책 차이(특히 iOS Live Activity 16.1+ 제약)는 `native/` 레이어에서 흡수해 `features/*` 가 플랫폼 분기를 모르게 한다.

## 테스트 전략
- 신규 기능은 **테스트 먼저(TDD)** 작성 후 통과 구현.
- `lib/reset-clock`: KST 자정/목요일/월·연 경계 단위 테스트(기기 타임존 무관 KST 계산 검증).
- `nexon/schedule` 파싱/정규화: 실제 응답 fixture — 문자열 flag 파싱, 영↔한 난이도, 양방향 공백 정규화, `apiAlias`, `bossDaily` 필터, 미매핑 폴백.
- `nexon/schedule` 에러 경로 / `nexon/client` 큐잉·백오프 / `nexon/character` dedup·동률 대표 선정: [[ADR-008]] 표 각 행 대응 단위 테스트.
- 컨텐츠 스케줄러 캐시 병합([[ADR-030]]): `lib/scheduler-merge.test.ts`(폴백·shareScope 저장소 분기·원장 active 유지·리셋 진행값 리셋·maxCountOverride) + `features/schedule-sync/__tests__`(캐시·원장 읽기/쓰기).
- 보스 수익 포뮬러(`floor(priceMeso / partySize)`) / 파티원 자동 기록(기본값 소스 [[ADR-019]]) / 파티 관리 upsert / 드롭다운 합계 / 물욕 환산 합산: 각 기능 구현 시 단위 테스트.
- 라우트 가드(온보딩 미완료 리다이렉트), 데이터 정합성(`src/data/__tests__`), 알림 64개 한도 우선순위.
- 네이티브 플러그인(상시 알림·Live Activity·백그라운드 재확인)은 유닛 테스트 곤란 → 실기기 수동 QA 체크리스트(백그라운드 전환·강제종료 재실행·배터리 최적화·iOS 16.1 미만 폴백).
- 골든 패스 수동 시나리오: 최초 실행 → 키 입력 → 캐릭터 조회 → 동기화 → 스케줄러 표시 → 보스 완료 감지 → 파티원 입력 → 수익 확인.

## 폐기된 정책 (history)
- ~~선택된 계정의 `character_list` 를 `storage/` 에 캐싱~~ → 캐싱 안 함, 매번 `nexon/character` 재조회(2026-07-11). 개명/전직/레벨업이 언제든 바뀌기 때문.
- ~~스케줄 동기화를 계정 전체 캐릭터 대상으로 호출~~ → 추적 대상 캐릭터로 범위 제한([[ADR-012]], 2026-07-11).
- ~~`syncSchedules` 완전 순차 호출~~ → 첫 캐릭터 프리플라이트 1건 + 나머지 병렬(`Promise.allSettled`)([[ADR-008]] 정정, 2026-07-17, 서비스 단계 키 기준).
- ~~추적 목록이 일간/주간 화면별 독립(`trackedCharacters:daily`/`:weekly`)~~ → 컨텐츠/보스로 재편(`trackedCharacters:content`/`:boss`), 1회 마이그레이션([[ADR-013]]).
- ~~보스명 정규화를 `nexon/` 이 전부 수행~~ → 난이도 변환만 `nexon/normalize`, 보스명 매칭은 `lib/boss-matching`(`nexon/` 이 `src/data/` 를 모르게 하는 레이어 분리).
