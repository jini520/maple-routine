# 아키텍처 (Architecture)

> **범위**: 디렉토리 구조·레이어 패턴·시스템 데이터 흐름·상태 관리·네이티브 연동 개요·테스트 전략. 기능별 흐름 세부는 각 `features/*.md`, 에러 처리는 [error-resilience.md](./error-resilience.md), API는 [nexon-api.md](./nexon-api.md).
> **관련 소스**: `src/` 전체 레이어(`app/` `features/` `storage/` `native/` `nexon/` `components/` `lib/` `types/` `data/`).
> **관련 ADR**: [[ADR-001]] [[ADR-003]] [[ADR-005]] [[ADR-007]] [[ADR-013]] [[ADR-092]] [[ADR-097]] [[ADR-101]]. **관련 문서**: [nexon-api.md](./nexon-api.md), [error-resilience.md](./error-resilience.md), [../persistence/README.md](../persistence/README.md).

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

## 라우트 구조 — 탭 넷 + 그 위에 얹히는 스택 ([[ADR-120]], **구현 완료 2026-08-09**, 이슈 #166)
```
/onboarding                     탭 밖 (완료 전에는 나머지가 전부 여기로 redirect)
/content   ├ manage             ┐
/boss      ├ manage             │ 하위 페이지는 **부모 탭의 중첩 라우트**다.
/profit    ├ drops              │ 형제 최상위 라우트로 두면 부모가 언마운트돼
/settings  ├ release-notes      │ 펼침·기간·스크롤을 잃는다([[ADR-077]]).
           ├ account-data       │ 화면은 공용 `StackScreen` 오버레이로 그려지고
           └ about              │ **포털로 탭 레이어 밖 DOM 에 붙는다**([[ADR-120]] 결정 3).
              └ privacy         ┘ ← 유일한 2단(그 화면의 행에서 열린다)
```
- **탭 화면 + 탭바 = `TabLayer`** 한 덩어리. 하위 페이지를 밀 때 이 래퍼째 `translateX` 되므로 탭바도 함께 밀려 나간다(하위 페이지엔 탭바가 없다).
- **`Suspense` 경계는 세 층**([[ADR-092]] 결정 3): 탭바 **바깥**(탭 전환에 탭바가 폴백에 안 덮이게) · 탭 화면 · 각 중첩 자식. `<Routes>` 를 통째로 감싼 경계 하나면 청크 로딩 동안 부모까지 폴백이 되어 [[ADR-077]] 이 막은 언마운트가 되살아난다.
- 전환·제스처의 시각 규약은 [design-system.md](./design-system.md) 「화면 스택」 절이 단일 진실 공급원이다.
- **안드로이드 시스템 뒤로가기는 커스텀 플러그인이 스택에 잇는다**([[ADR-120]] 결정 17) — `BackGesturePlugin.java` + `native/back-gesture.ts` + `lib/use-system-back.ts`. 스택이 열려 있는 동안에만 가로채고(탭 최상위는 시스템에 맡긴다), 제스처 진행률도 시스템에서 받는다. `android:enableOnBackInvokedCallback="true"` 가 없으면 콜백이 조용히 버려지므로 매니페스트에서 지우지 말 것.
- **청크는 라우트가 아니라 탭 단위**다([[ADR-120]] 결정 14, `vite.config.ts` 의 `manualChunks`) — 하위 페이지는 부모 탭에서만 열리므로 같은 청크에 둬 진입 시 추가 파일 읽기가 없게 한다. `lazy()` + 동적 `import()` 는 그대로 두고 번들 경계만 바꾼 것이라 [[ADR-092]] 의 첫 페인트 번들 축소는 유지된다(오히려 356 → 221 kB 로 줄었다).

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

**[이후 동기화 — 화면 진입(10분 TTL) · 명시적 새로고침 · 앱 재시작 후 첫 진입]**

> **트리거는 이 셋뿐이다.** 포그라운드 복귀 리스너(`appStateChange`)는 **없다** — 프로세스가 살아 있는 채 앱을 다시 열면 화면 진입 규칙만 적용된다.

**호출 게이트([[ADR-097]])** — 아래 흐름을 **탈지 말지**를 먼저 정한다. 세 탭 화면(컨텐츠·보스·보스 수익)은 마운트 시 `loadTrackedOcids()` 로 진입하는데, **그 자동 경로에만** 게이트가 걸린다.

```
건너뛴다 = 이번 실행에서 이미 동기화함  AND  가장 오래된 syncedAt 이 10분 안
```

두 조건이 사는 곳은 각각 **`lib/sync-freshness`**(`SYNC_TTL_MS` · `isSyncFresh(syncedAts, trackedCount, now)` — 무의존 순수 모듈. 추적 캐릭터 총수를 함께 받아 **캐시가 없는 캐릭터를 만료로** 판정한다)와 **`features/schedule-sync/sync-run-state`**(모듈 수준 플래그. 영속화하지 않는 것이 곧 "재시작하면 한 번은 다시 받는다"는 정책이고, 성공이 아니라 **시도**를 기록해 오프라인에서 탭마다 재시도하지 않게 한다)다. `SYNC_TTL_MS` 는 **잠정값이라 한 파일에서만 정의한다** — 이 정책의 근거는 값이 아니라 "새로고침 수단이 있는데도 페이지 이동마다 같은 API 를 부르는 방식이 틀렸다"이고, 값은 그 위에서 움직인다.

세 화면의 네트워크는 **서로 다르지 않고**(아래 2번의 `syncSchedules` 하나를 공유한다) 결과가 **같은 캐시**에 쌓이므로, 판정 기준은 화면이 아니라 `storage/scheduler-cache` 의 `syncedAt` 이다 — 한 화면이 방금 받았으면 나머지 두 화면의 첫 진입은 네트워크 0회다. `refresh()`(헤더 새로고침·당겨서 새로고침·재시도)는 게이트 밖이라 **항상** 조회하고, 건너뛴 진입에서 캐시는 신선한 값으로 취급한다(`isStale: false` — 그러지 않으면 탭 이동마다 "오래된 데이터" 토스트가 뜬다).

1. **캐시 우선 표시([[ADR-016]], [[ADR-017]])**: `refresh()` 는 재검증 *전에* `storage/scheduler-cache` 값으로 화면을 먼저 그린다(보스 수익 포함)
2. `nexon/schedule` 이 저장된 키 + **추적 대상 캐릭터** ocid로만 `scheduler/character-state` 호출([[ADR-012]] — 계정 전체 순차 호출 아님). 병렬 정책은 [[ADR-008]] 정정(첫 캐릭터 프리플라이트 1건 + 나머지 `Promise.allSettled`). 같은 회차에 그 캐릭터들의 `character/basic` 도 **편승 갱신**한다([[ADR-097]] 결정 7 — 프리플라이트 이후 병렬, best-effort. 실패해도 스케줄 결과를 `isStale` 로 만들지 않는다)
3. 실패 시 [[ADR-008]] 분기 → 마지막 캐시 유지, 흐름 중단
4. 응답의 `daily_contents`/`weekly_contents`/`boss_contents` 를 방어적 파싱. `boss_contents` 는 `cycle` 이 `bossWeekly`/`bossMonthly` 인 것만 사용(`bossDaily` 무시)
5. 보스명·난이도 정규화(난이도 영↔한 = `nexon/normalize`, 보스명 공백제거 비교·`apiAlias` = `lib/boss-matching`, [[ADR-007]]). 매핑 실패는 "알 수 없는 콘텐츠"
6. 컨텐츠 스케줄러 캐시 병합([[ADR-030]])은 [features/content-scheduler.md](../features/content-scheduler.md) 참고
7. `storage/` 에 캐시 + 동기화 시각 저장 → 각 feature 가 읽기 전용 표시. 이 **동기화 시각(`syncedAt`)이 위 게이트의 판정 근거**다 — 성공한 동기화에서만 갱신되므로([[ADR-097]] 결정 2) 실패가 TTL 을 갱신해 조회를 막는 일이 없다

**[알림 발송 판단 — 실시간 재확인, [[ADR-004]]]**
알림 예정 시각 도달 → 백그라운드 트리거(Android WorkManager / iOS BGAppRefreshTask) → `nexon/schedule` 실시간 재호출 → 미완료면 로컬 알림(64개 한도 초과 시 우선순위 정책). 재호출 실패 시 마지막 캐시 폴백. iOS는 정확 시각 미보장(베스트 에포트).

## 상태 관리
- Nexon 스케줄러 데이터는 사용자 본인 계정 데이터이지만 앱 입장에선 "외부 동기화 읽기 전용 데이터"로 다룬다 — 동기화 상태(로딩/성공/실패)·마지막 동기화 시각·캐시 응답을 `nexon/schedule` 이 노출하고 `storage/` 에 영속화.
- 전역 클라이언트 상태(현재 선택 캐릭터, 선택 테마, API 키 등록 여부, 타이머 진행 등)는 **Zustand**로 관리([[ADR-009]] 테마 포함).
- 영속 데이터(API 키·동기화 캐시·보스 기록·드랍 히스토리·선택 테마)는 `storage/` 에 저장하고 앱 시작 시 hydration. 상세 스키마는 [persistence/](../persistence/README.md).
- **탭 화면 스토어는 부팅 때 미리 하이드레이션한다**([[ADR-101]] 결정 2~6, `features/prehydrate.ts`) — 세 탭 스토어(컨텐츠·보스·보스 수익)의 `loadTrackedOcids()` 를 앱 셸 마운트 직후 백그라운드로 돌린다. 그러지 않으면 탭 첫 진입이 저장소 읽기(Preferences N회 + SQLite 오픈)를 사용자가 보는 앞에서 치러 로딩 프레임이 낀다. 지켜야 하는 성질 넷:
  - **순차다.** [[ADR-097]] 게이트의 신선도 조건은 앞 회차가 캐시를 **쓴 뒤에야** 참이 되므로, 병렬로 띄우면 셋 다 게이트를 통과해 같은 응답을 3번 받는다.
  - **동적 `import()` 로 가져온다.** 정적 import 면 스토어·`src/data/*.json` 이 메인 청크로 돌아와 [[ADR-092]] 가 무효가 된다.
  - **`loadTrackedOcids()` 는 동시 호출을 한 회차로 합친다**(single-flight) — 선하이드레이션과 화면 마운트가 반드시 겹친다. "평생 한 번"이 아니라 "동시에 하나만"이다(영구 메모면 [[ADR-097]] 10분 TTL 이 죽는다).
  - **온보딩 완료 상태에서만 돈다** — `syncSchedules` 가 API 키·계정 없이 던진다.

## 네이티브 연동 개요 ([[ADR-001]])
- `@capacitor/local-notifications`: 일간/주간 미완료 알림 예약([[ADR-004]]).
- **커스텀 플러그인**(Swift/Kotlin): 사냥 타이머 상시 알림(Android Foreground Service + Chronometer / iOS Live Activity) + 주기 사운드([[ADR-005]]) → [features/hunting-timer.md](../features/hunting-timer.md).
- `@capacitor-community/sqlite`(+ 웹 테스트용 `jeep-sqlite`): 보스 수익 기록 등([[ADR-003]]).
- `@capgo/capacitor-updater`: Live Update([[ADR-022]]) → [features/live-update.md](../features/live-update.md).
- `@capacitor/network`: 셀룰러 감지([[ADR-027]]).
- 플랫폼별 백그라운드 정책 차이(특히 iOS Live Activity 16.1+ 제약)는 `native/` 레이어에서 흡수해 `features/*` 가 플랫폼 분기를 모르게 한다.

## 번들·코드 분할 ([[ADR-092]])
초기 청크 크기는 **첫 페인트 속도이자 OTA 다운로드 크기**다([[ADR-022]] 가 웹 번들을 통째로 내려받으므로).

- **라우트 화면은 `React.lazy` 로 분할한다.** `App.tsx` 가 화면을 정적 import 하면 8개 화면·모든 store·`src/data/*.json` 이 첫 페인트에 함께 평가된다. 새 라우트를 더할 때도 `lazy(() => import(...))` 형태를 유지할 것.
- **다만 청크 경계는 라우트가 아니라 탭이다**([[ADR-120]] 결정 14, 2026-08-09) — `vite.config.ts` 의 `manualChunks` 가 `src/app/<탭>/` 을 청크 하나로 묶는다. 하위 페이지는 부모 탭에서만 열리는데 따로 쪼개 두면 밀어 넣을 때 파일을 한 번 더 읽어 **실기기에서 전환이 늦게 시작됐다**. `lazy()` 는 그대로 두고 번들 경계만 바꾼 것이라 이 절의 목적은 유지된다 — 오히려 진입 청크가 356 → 221 kB, 총 JS 1,440 → 1,324 kB, 청크 59 → 15개로 전부 좋아졌다.
- **Suspense 경계는 라우트별로 둔다. `<Routes>` 전체를 하나로 감싸지 말 것** — 중첩 라우트(`/profit/drops`)가 로드되는 동안 부모(`BossProfitScreen`)까지 폴백으로 대체돼 [[ADR-077]] 이 막은 언마운트 증상이 되살아난다. 중첩 자식은 `<Outlet />` 자리에서 자기 element 만 감싼다.
- **조정용 디버그 화면(`/debug/*`)은 조정이 끝나면 지운다** — 값을 눈으로 맞추는 일회성 도구(크롭·배경·로딩 표현)는 남겨두면 프로덕션 번들에 그대로 실려 나간다. 실제로 5개 2,033 LOC 가 그렇게 쌓였다([[ADR-092]] 에서 삭제). 다시 필요해지면 그때 만들고, 옛 구현은 `git log` 로 참고한다. **남겨야 한다면 라우트를 등록하기 전에 번들에서 빠지는 경로부터 정할 것.**
- **자산 목록은 빌드가 아니라 커밋 시점에 만든다**([[ADR-129]]) — `src/assets/generated/*.ts` 가 슬러그→에셋 맵을 들고 있고, `npm run assets:gen` 이 `src/assets/asset-groups.ts` 의 표대로 디렉터리를 훑어 그 파일들을 다시 쓴다. **그림을 넣거나 지웠으면 반드시 돌릴 것** — 안 돌리면 화면이 에러 없이 폴백만 그린다(`src/assets/generated/__tests__/asset-manifest.test.ts` 가 그 낡음을 잡는다). 목록은 웹·RN 이 한 벌을 함께 쓰고, 값의 타입만 갈린다(웹 = URL 문자열 / RN = 에셋 id, `src/types/image-asset.ts` ↔ `.native.ts`).
- **목록에 든 자산은 참조 여부와 무관하게 전부 dist 로 나간다** — `src/assets/*` 에 파일을 떨어뜨리면 아무도 안 쓰는 파일도 앱에 실린다(참조 0건 2.65 MB 고아가 실제로 있었다). 그래서 자산에서 듣는 지렛대는 **안 쓰는 파일을 지우는 것과 쓰는 파일을 작게 만드는 것** 둘뿐이다.
- **자산 조회 키는 디렉터리마다 다르다** — `bosses/` `maps/` `maps/icons/` `themes/` 는 **확장자를 뗀 슬러그**라 포맷을 바꿔도 코드가 안 바뀌지만, `items/`(+`rings/`)는 **확장자를 포함한 전체 파일명**([[ADR-011]] 의 `iconFile`)이라 포맷을 바꾸면 게임 데이터까지 고쳐야 한다. 자산 포맷을 만지기 전에 어느 쪽인지 확인할 것([[ADR-093]] 결정 1).
- 검증은 추론이 아니라 **산출물로** 한다 — `npm run build` 실측 + `dist/assets/*.js` grep. 자산 최적화는 **코드를 안 바꾸므로 조용히 깨진다**(슬러그가 안 풀려도 폴백이 뜰 뿐 에러가 없다) — `lib/__tests__/asset-slug-coverage.test.ts` 가 선언된 슬러그 전수를 해석해 그 사고를 막는다.

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
- ~~자산 목록을 `import.meta.glob`(eager)으로 빌드마다 만든다~~ → **커밋된 생성물**(`src/assets/generated/*.ts` + `npm run assets:gen`)([[ADR-129]], 2026-08-12). glob 은 Vite 전용이라 Metro(RN)에 짝이 없었다. 딸려 온 정정: *"`eager` 여부와 무관하게 전부 emit 된다"*([[ADR-093]] 결정 3)는 관찰은 여전히 맞지만 **판정 주체가 glob 이 아니라 생성물의 import 목록**이 됐다.
- ~~선택된 계정의 `character_list` 를 `storage/` 에 캐싱~~ → 캐싱 안 함, 매번 `nexon/character` 재조회(2026-07-11). 개명/전직/레벨업이 언제든 바뀌기 때문.
- ~~스케줄 동기화를 계정 전체 캐릭터 대상으로 호출~~ → 추적 대상 캐릭터로 범위 제한([[ADR-012]], 2026-07-11).
- ~~`syncSchedules` 완전 순차 호출~~ → 첫 캐릭터 프리플라이트 1건 + 나머지 병렬(`Promise.allSettled`)([[ADR-008]] 정정, 2026-07-17, 서비스 단계 키 기준).
- ~~추적 목록이 일간/주간 화면별 독립(`trackedCharacters:daily`/`:weekly`)~~ → 컨텐츠/보스로 재편(`trackedCharacters:content`/`:boss`), 1회 마이그레이션([[ADR-013]]).
- ~~보스명 정규화를 `nexon/` 이 전부 수행~~ → 난이도 변환만 `nexon/normalize`, 보스명 매칭은 `lib/boss-matching`(`nexon/` 이 `src/data/` 를 모르게 하는 레이어 분리).
