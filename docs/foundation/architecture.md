# 아키텍처 (Architecture)

> **범위**: 디렉토리 구조·레이어 패턴·시스템 데이터 흐름·상태 관리·네이티브 연동 개요·테스트 전략. 기능별 흐름 세부는 각 `features/*.md`, 에러 처리는 [error-resilience.md](./error-resilience.md), API는 [nexon-api.md](./nexon-api.md).
> **관련 소스**: `src/` 전체 레이어(`app/` `features/` `storage/` `native/` `nexon/` `components/` `lib/` `types/` `data/`).
> **관련 ADR**: ADR-001 [[ADR-003]] [[ADR-005]] [[ADR-007]] [[ADR-013]] ADR-092 [[ADR-097]] [[ADR-101]]. **관련 문서**: [nexon-api.md](./nexon-api.md), [error-resilience.md](./error-resilience.md), [../persistence/README.md](../persistence/README.md).

## 핵심 규칙 (CRITICAL)
- `features/*` 코드는 로컬 저장소·네이티브 API에 **직접 접근하지 않는다**. 반드시 `storage/`·`native/` 어댑터를 거친다([[ADR-003]], [[ADR-005]]).
- 게임 레퍼런스 수치(`src/data/`)는 AI가 임의 추정해 하드코딩하지 않는다. 사용자(도메인 전문가) 확인 후 반영([[ADR-006]]).
- 화면은 `app/`, 기능 상태·로직은 `features/`, 공용 UI는 `components/`, 타입은 `types/`, 범용 유틸은 `lib/`.

## 디렉토리 구조
```
index.ts                    # 진입점: installPorts() → holdSplashUntilAppReady() → registerRootComponent
App.tsx · global.css        # 루트 컴포넌트 · NativeWind 진입 CSS
src/
├── app/                    # 화면 (탭·하위 페이지)
│   ├── today/              # 첫 화면: 위젯 격자([[ADR-147]]) + widgets/
│   ├── content-scheduler/  # 일간 탭 + 주간 탭 (월간 탭 없음, [[ADR-013]])
│   ├── boss-scheduler/     # 주간·월간 탭 + 보스 관리([[ADR-145]])
│   ├── boss-profit/        # 주간/월간 탭 + 기간 네비게이터 + 드롭 시트·히스토리·가격 입력
│   ├── onboarding/  settings/  hunting-profit/  spend/  utility/
│   ├── AppShell.tsx  prehydrate.ts  UpdatePromptModal.tsx
├── navigation/             # @react-navigation 배선: RootNavigator · Main(층 스택) · BottomBar
├── features/               # 기능별 도메인 로직(UI 상태 + 비즈니스 로직)
│   ├── onboarding/  content-scheduler/  boss-scheduler/  boss-profit/  schedule-sync/
│   ├── character-manage/  settings/  tracking-mode/  live-update/  drop-effect/  toast/
│   └── theme/              # 선택된 테마 상태, storage/theme.ts 영속화
├── data/                   # 게임 레퍼런스 데이터(버전 명시): game-data.md 참고
├── nexon/                  # Nexon Open API 클라이언트([[ADR-007]]): nexon-api.md 참고
│   ├── character/  schedule/  (client / normalize)
├── storage/                # 로컬 저장소 접근 레이어: persistence/ 참고
│   ├── adapters/           #   rn-preferences · rn-sqlite (+ capacitor-* 경로·키 계산 공유)
│   └── sqlite/db.ts
├── native/                 # 네이티브 능력의 포트 + RN 어댑터([[ADR-128]] 결정 4)
│   ├── ports.ts  adapters/rn-*.ts
├── theme/                  # ThemeProvider · theme-vars(NativeWind vars) · appearance-store
├── components/             # 아토믹 4계층([[ADR-094]]): atoms/ molecules/ organisms/ templates/
│                           #   molecules 는 잎, organisms 는 조합([[ADR-205]] 결정 1)
├── assets/                 # items/(+rings/) · bosses/ · maps/ · worlds/ · themes/ · generated/
├── lib/                    # 범용 유틸(reset-clock, item-icons, boss-icons, boss-matching,
│                           #   scheduler-merge, boss-profit-period, widget-layout, drop-history …)
└── types/
modules/                    # 로컬 Expo 모듈 셋: capacitor-storage · app-background · app-system-bars
```

## 화면 구조: **스택 두 겹** + 떠 있는 바 ([[ADR-132]] · [[ADR-145]] · [[ADR-167]])

배선은 `src/navigation/` 이 소유한다. 스택이 **두 겹**이고 둘이 같은 상수로 열린다
(`stack-presentation.ts`. 그래서 ‘하위 페이지처럼 열린다’가 우연이 아니라 구조다):

```
RootNavigator (스택)
├── Main                          # 탭 레이어 자리
│   ├── 층 스택 (Groups · ScheduleSubs · LedgerSubs)
│   │     └── 각 층은 탭 내비게이터: 옆걸음은 안 쌓이고 언마운트도 없다
│   ├── BottomBar                 # 층 스택의 `layout` 이 그린다 → 층이 밀려도 안 밀린다
│   └── AboveBarHost              # 같은 `layout` 의 **바 뒤**: 화면이 소유한 오버레이가 여기 뜬다
└── 하위 페이지 열하나            # `Main` **통째**를 밀어낸다 → 바도 함께 나간다
```

**떠 있는 것의 층은 형제 순서가 정한다**([[ADR-180]]). RN 에는 문서도 전역 z-index 도 없고 `zIndex`
는 같은 부모 안에서만 겨루므로, ‘누가 위인가’는 이 트리에서 누가 **뒤에** 서는가와 같은 말이다. 아래에서 위로: 벽지 → 화면 → **바** → 바 위 슬롯(펼침판) → API 키 안내 → 토스트 → **시트**.
시트가 맨 위인 것은 `PortalProvider` 가 `{children}` 뒤에 루트 호스트를 붙이기 때문이고, 바 위 슬롯은
그 기구(`@gorhom/portal`)를 한 번 더 쓴 것이다. 슬롯에 그린 것은 화면이 숨어도 안 숨으므로
**슬롯이 초점을 판정한다**(`components/organisms/AboveBar`).

**그룹 행 → 하위 행이 스택 한 단**이라는 것이 [[ADR-167]] 이다. 전환 애니메이션과 iOS 가장자리
스와이프가 ‘만드는 것’이 아니라 ‘단이 있으면 OS 가 주는 것’이라, 그 단이 없던 동안은 안드로이드
백만 되고 iOS 스와이프는 걸릴 자리가 아예 없었다(#240).

하단바는 떠 있는 캡슐 2층이고 첫 화면은 `today` 다([[ADR-132]]). 바가 드는 상태는 ‘마지막으로 보던
하위’(`lastSub`) **하나뿐**이다. 층과 뒤로가기는 스택이 든다.

- **하위 페이지는 스택이라 아래 화면이 언마운트되지 않는다**. 펼침·기간·스크롤을 잃지 않는다는
  계약(⛔ ADR-077 에서 살아남은 부분)을 스택이 구조적으로 지킨다. 웹에서 그것을 중첩 라우트 +
  `fixed` 오버레이로 흉내 내던 구현은 사라졌다.
- **전환·제스처(가장자리 스와이프 백)는 라이브러리가 준다**. 자체 구현 955줄이 전환과 함께
  삭제됐다(🟡 [[ADR-120]]). 시각 규약은 [design-system.md](./design-system.md) ‘화면 스택’ 절이 단일
  진실 공급원이다.
- **고정되는 영역을 두지 않는다**([[ADR-131]]). 헤더까지 함께 스크롤한다. 화면 루트는 공용 셸
  `components/templates/ScreenScroll` 이다.

## 레이어 패턴
Feature 단위 구조. 각 `features/*` 폴더가 그 기능의 상태·로직을 소유하고, `storage/`·`native/`·`nexon/` 은 외부 의존성(로컬 저장소·네이티브 API·Nexon API)을 격리하는 공용 어댑터다. 덕분에 (1) feature 코드가 네이티브 SDK·Nexon 응답 형식을 직접 몰라도 되고, (2) [[ADR-003]]이 바뀌거나 API 스펙이 바뀌어도 어댑터 내부만 교체하면 된다.

- `content-scheduler`·`boss-scheduler` 는 로컬 쓰기 상태를 직접 소유하지 않고, `nexon/schedule` 이 반환하는 동기화 캐시를 **읽기 전용**으로 구독한다. `boss-scheduler` 는 캐시의 `bossContents` 를 `cycle`(weekly/monthly)로 갈라 화면 탭에 전달한다.
- `boss-profit`·`item-drop` 은 **혼합 패턴**. 보스 목록은 동기화 캐시를 읽기 전용 구독하고([[ADR-007]], [[ADR-011]]), 그 위 사용자 기록(파티원 수·아이템 획득·수익)은 `storage/` 에 직접 쓴다. "무엇을 기록할 수 있는지"는 동기화 데이터가 결정하고, "실제로 기록한 값"은 로컬 소유.

### 런타임 import 사이클을 만들지 않는다
**심볼은 정의처에서 직접 가져온다.** 사이클은 대개 재수출을 거쳐 자기 뒤로 돌아갈 때 생긴다. 파일이 이웃에게서 값을 쓰는데 그 이웃의 `index`·상위 모듈이 다시 자기를 부르는 모양이다. 정의처를 직접 가리키면 그 고리가 애초에 안 생긴다.

**드러나는 곳이 RN 뿐이라 웹만 보면 안 보인다.** Metro 는 부팅 때 `Require cycle: …` 을 경고로 내고, 그것이 콜드 스타트마다 LogBox 배너로 뜬다(모듈 그래프 평가가 JS 런타임 시작마다 일어나기 때문이다. 웜 복귀에는 안 뜬다). Vite/Rollup 은 같은 사이클을 보고하지 않는다.

`import type` 은 컴파일에 지워지므로 사이클을 만들지 않는다. 타입만 필요하면 재수출을 거쳐도 된다.


## 시스템 데이터 흐름 (cross-cutting)
기능별 상세 흐름은 각 `features/*.md`. 여기서는 여러 기능이 공유하는 골격만 정리한다.

**[온보딩: 최초 1회, [[ADR-007]]]** → 상세 [features/onboarding.md](../features/onboarding.md)
1. 설정에서 개인 API 키 입력 → `storage/` 보안 영역 저장
2. `nexon/character` 가 `character/list` 호출 → `account_list` 가 2개↑면 계정 선택 UI
3. `storage/` 에는 `apiKey` 와 선택된 `accountId` 만 저장(캐릭터 목록은 캐싱하지 않고 매번 재조회한다. 개명·전직·레벨업을 반영해야 하기 때문이다)
4. **예열(ADR-016)**: 계정 확정 즉시 전체 캐릭터에 대해 `character/basic` → (`access_flag: true`만) `scheduler/character-state` 를 병렬 파이프라인으로 예열하고, 하나 끝날 때마다 `storage/character-basic-cache`·`storage/scheduler-cache` 에 기록 + 진행률 갱신

**[이후 동기화: 화면 진입(10분 TTL) · 명시적 새로고침 · 앱 재시작 후 첫 진입]**

> **트리거는 이 셋뿐이다.** 포그라운드 복귀 리스너(`appStateChange`)는 **없다**. 프로세스가 살아 있는 채 앱을 다시 열면 화면 진입 규칙만 적용된다.

**호출 게이트([[ADR-097]])**. 아래 흐름을 **탈지 말지**를 먼저 정한다. 세 탭 화면(컨텐츠·보스·보스 수익)은 마운트 시 `loadTrackedOcids()` 로 진입하는데, **그 자동 경로에만** 게이트가 걸린다.

```
건너뛴다 = 이번 실행에서 이미 동기화함  AND  가장 오래된 syncedAt 이 10분 안
```

두 조건이 사는 곳은 각각 **`lib/scheduler/sync-freshness`**(`SYNC_TTL_MS` · `isSyncFresh(syncedAts, trackedCount, now)`. 무의존 순수 모듈. 추적 캐릭터 총수를 함께 받아 **캐시가 없는 캐릭터를 만료로** 판정한다)와 **`features/schedule-sync/sync-run-state`**(모듈 수준 플래그. 영속화하지 않는 것이 곧 "재시작하면 한 번은 다시 받는다"는 정책이고, 성공이 아니라 **시도**를 기록해 오프라인에서 탭마다 재시도하지 않게 한다)다. `SYNC_TTL_MS` 는 **잠정값이라 한 파일에서만 정의한다**. 이 정책의 근거는 값이 아니라 "새로고침 수단이 있는데도 페이지 이동마다 같은 API 를 부르는 방식이 틀렸다"이고, 값은 그 위에서 움직인다.

세 화면의 네트워크는 **서로 다르지 않고**(아래 2번의 `syncSchedules` 하나를 공유한다) 결과가 **같은 캐시**에 쌓이므로, 판정 기준은 화면이 아니라 `storage/scheduler-cache` 의 `syncedAt` 이다. 한 화면이 방금 받았으면 나머지 두 화면의 첫 진입은 네트워크 0회다. `refresh()`(헤더 새로고침·당겨서 새로고침·재시도)는 게이트 밖이라 **항상** 조회하고, 건너뛴 진입에서 캐시는 신선한 값으로 취급한다(`isStale: false`. 그러지 않으면 탭 이동마다 "오래된 데이터" 토스트가 뜬다).

1. **캐시 우선 표시(ADR-016, [[ADR-017]])**: `refresh()` 는 재검증 *전에* `storage/scheduler-cache` 값으로 화면을 먼저 그린다(보스 수익 포함)
2. `nexon/schedule` 이 저장된 키 + **추적 대상 캐릭터** ocid로만 `scheduler/character-state` 호출한다([[ADR-012]]. 계정 전체를 순차 호출하지 않는다). 병렬 정책은 [[ADR-008]] 정정(첫 캐릭터 프리플라이트 1건 + 나머지 `Promise.allSettled`). 같은 회차에 그 캐릭터들의 `character/basic` 도 **편승 갱신**한다([[ADR-097]] 결정 7. 프리플라이트 이후 병렬, best-effort. 실패해도 스케줄 결과를 `isStale` 로 만들지 않는다)
3. 실패 시 [[ADR-008]] 분기 → 마지막 캐시 유지, 흐름 중단
4. 응답의 `daily_contents`/`weekly_contents`/`boss_contents` 를 방어적 파싱. `boss_contents` 는 `cycle` 이 `bossWeekly`/`bossMonthly` 인 것만 사용(`bossDaily` 무시)
5. 보스명·난이도 정규화(난이도 영↔한 = `nexon/normalize`, 보스명 공백제거 비교·`apiAlias` = `lib/boss/boss-matching`, [[ADR-007]]). 매핑 실패는 "알 수 없는 콘텐츠"
6. 컨텐츠 스케줄러 캐시 병합([[ADR-030]])은 [features/content-scheduler.md](../features/content-scheduler.md) 참고
7. `storage/` 에 캐시 + 동기화 시각 저장 → 각 feature 가 읽기 전용 표시. 이 **동기화 시각(`syncedAt`)이 위 게이트의 판정 근거**다. 성공한 동기화에서만 갱신되므로([[ADR-097]] 결정 2) 실패가 TTL 을 갱신해 조회를 막는 일이 없다

**[알림: 하이브리드 판정, [[ADR-146]]]** → 상세 [features/notifications.md](../features/notifications.md) (**설계 완료, 구현 전**)
① 앱 진입·동기화 완료·백그라운드 태스크가 **같은 재조정 함수**를 부른다 → 레지스트리의 `plan()`(순수 함수)이 앞으로 7일치 계획을 만들고, **원장과의 차집합**만 예약·취소한다(멱등). ② 백그라운드에서 재확인이 되면 최신 상태로, 실패하면 마지막 캐시로 판정한다([[ADR-008]]). ③ **태스크가 한 번도 안 돌아도 알림은 뜬다**. 사전 예약이 아래 깔려 있고, 그 비대칭이 iOS 대비다. ④ 알림은 캐릭터를 말하지 않고 계정 단위 한 줄로 접히므로 동시 예약이 **캐릭터 수와 무관하게 10개 안쪽**이다(iOS 64개 한도가 구조적으로 사라진다). ⑤ 공지 알림만 **FCM 토픽 푸시**이고 판정이 서버에 있다.

## 상태 관리
- Nexon 스케줄러 데이터는 사용자 본인 계정 데이터이지만 앱 입장에선 "외부 동기화 읽기 전용 데이터"로 다룬다. 동기화 상태(로딩/성공/실패)·마지막 동기화 시각·캐시 응답을 `nexon/schedule` 이 노출하고 `storage/` 에 영속화.
- 전역 클라이언트 상태(현재 선택 캐릭터, 선택 테마, API 키 등록 여부, 타이머 진행 등)는 **Zustand**로 관리([[ADR-009]] 테마 포함).
- 영속 데이터(API 키·동기화 캐시·보스 기록·드랍 히스토리·선택 테마)는 `storage/` 에 저장하고 앱 시작 시 hydration. 상세 스키마는 [persistence/](../persistence/README.md).
- **탭 화면 스토어는 부팅 때 미리 하이드레이션한다**([[ADR-101]] 결정 2~6, `features/prehydrate.ts`). 세 탭 스토어(컨텐츠·보스·보스 수익)의 `loadTrackedOcids()` 를 앱 셸 마운트 직후 백그라운드로 돌린다. 그러지 않으면 탭 첫 진입이 저장소 읽기(Preferences N회 + SQLite 오픈)를 사용자가 보는 앞에서 치러 로딩 프레임이 낀다. 지켜야 하는 성질 넷:
  - **순차다.** [[ADR-097]] 게이트의 신선도 조건은 앞 회차가 캐시를 **쓴 뒤에야** 참이 되므로, 병렬로 띄우면 셋 다 게이트를 통과해 같은 응답을 3번 받는다.
  - **동적 `import()` 로 가져온다.** Metro 는 단일 번들이라 ‘청크’ 이득은 없지만, 부팅 경로가 스토어·`src/data/*.json` 을 **평가하는 시점**을 늦추는 효과는 그대로다(🗑 ADR-092 가 웹에서 고른 형태의 잔존 이유).
  - **`loadTrackedOcids()` 는 동시 호출을 한 회차로 합친다**(single-flight). 선하이드레이션과 화면 마운트가 반드시 겹친다. "평생 한 번"이 아니라 "동시에 하나만"이다(영구 메모면 [[ADR-097]] 10분 TTL 이 죽는다).
  - **온보딩 완료 상태에서만 돈다**. `syncSchedules` 가 API 키·계정 없이 던진다.

## 네이티브 연동 개요 ([[ADR-128]] 결정 4: 포트 + 어댑터)
- **알림**([[ADR-146]], 설계 완료·구현 전): 바이너리엔 **능력 셋**(로컬 알림 표시 `@notifee/react-native` / 원격 푸시 FCM / 백그라운드 태스크)만 들어가고, **무엇을 언제 왜 띄우는가는 네이티브에 한 줄도 없다**(전부 JS = OTA). 딸림이 있다. 백그라운드 태스크·푸시 백그라운드·알림 탭 **핸들러 셋은 모듈 최상위에 ‘등록’ 돼 있어야** OS 가 죽은 앱을 깨울 수 있어 그 한 줄만 바이너리에 박힌다.
- **로컬 Expo 모듈** `modules/` 셋: `capacitor-storage`(기존 사용자 저장소를 그대로 연다. `migration/data.md`) · `app-background`(앱을 백그라운드로) · `app-system-bars`(시스템 바).
- `@op-engineering/op-sqlite`: 보스 수익 기록 등([[ADR-003]]).
- `expo-updates`: Live Update([[ADR-137]]) → [features/live-update.md](../features/live-update.md).
- **셀룰러 감지는 없다**. RN 에 내장 API 가 없고 `@react-native-community/netinfo` 는 새 네이티브 의존이라, `getNetworkType()` 이 `'unknown'` 을 돌리고 호출부가 경고를 생략한다(ADR-027 결정 6 의 폴백, `rn-live-update.ts`).
- 플랫폼별 백그라운드 정책 차이(특히 iOS Live Activity 16.1+ 제약)는 `native/` 레이어에서 흡수해 `features/*` 가 플랫폼 분기를 모르게 한다.

## 번들·자산 ([[ADR-129]])

Metro 는 **단일 번들**이라 라우트 분할이라는 축이 없다. 웹 시절의 `React.lazy` + `manualChunks`
전략(🗑 ADR-092 · 🟡 [[ADR-120]] 결정 14)은 전제째 사라졌다. 남은 지렛대는 **자산**이고, 그것이 곧
OTA 다운로드 크기다.

- **자산 목록은 빌드가 아니라 커밋 시점에 만든다**([[ADR-129]]). `src/assets/generated/*.ts` 가
  슬러그→에셋 맵을 들고 있고, `npm run assets:gen` 이 `src/assets/asset-groups.ts` 의 표대로
  디렉터리를 훑어 그 파일들을 다시 쓴다. **그림을 넣거나 지웠으면 반드시 돌릴 것**. 안 돌리면 화면이
  에러 없이 폴백만 그린다(`src/assets/generated/__tests__/asset-manifest.test.ts` 가 그 낡음을 잡는다).
- **목록에 든 자산은 참조 여부와 무관하게 전부 앱에 실린다**. 참조 0건 2.65 MB 고아가 실제로 있었다.
  그래서 자산에서 듣는 지렛대는 **안 쓰는 파일을 지우는 것과 쓰는 파일을 작게 만드는 것** 둘뿐이다.
- **자산 조회 키는 디렉터리마다 다르다**. `bosses/` `maps/` `maps/icons/` `themes/` 는 **확장자를 뗀
  슬러그**라 포맷을 바꿔도 코드가 안 바뀌지만, `items/`(+`rings/`)는 **확장자를 포함한 전체 파일명**
  ([[ADR-011]] 의 `iconFile`)이라 포맷을 바꾸면 게임 데이터까지 고쳐야 한다(🟡 [[ADR-093]] 결정 1).
- **조정용 디버그 화면은 조정이 끝나면 지운다**. 값을 눈으로 맞추는 일회성 도구는 남겨두면 그대로
  앱에 실려 나간다. 실제로 5개 2,033 LOC 가 그렇게 쌓였다. 다시 필요해지면 그때 만들고, 옛 구현은
  `git log` 로 참고한다.
- 검증은 추론이 아니라 **산출물로** 한다. 자산 최적화는 **코드를 안 바꾸므로 조용히 깨진다**(슬러그가
  안 풀려도 폴백이 뜰 뿐 에러가 없다). `lib/__tests__/asset-slug-coverage.test.ts` 가 선언된 슬러그
  전수를 해석해 그 사고를 막는다.

## 테스트 전략
- **러너는 jest 하나다**([[ADR-157]]). `npm test` 가 261스위트를 한 번에 돈다. 파일 이름 둘은 러너가 아니라 **성질**을 말한다: `*.spec.ts(x)` 는 RN 을 렌더하지 않는 순수 로직·데이터·저장소, `*.test.ts(x)` 는 RN 을 렌더하거나 RN 모듈을 목하는 것.
- **목 팩토리는 멱등이어야 한다**([[ADR-157]] 결정 3). `jest.resetModules()` 뒤 팩토리가 다시 불릴 때 새 목을 만들면 테스트가 붙들고 있던 인스턴스와 조용히 갈라진다. `jest.requireMock` 으로 꺼내 쓰거나, `mock` 접두 변수를 팩토리 안에서 ‘한 번만’ 채운다.
- **vitest 에 있고 jest 에 없던 것 셋은 `jest.setup.js` 가 만든다**. `expect(값, '메시지')`(두 번째 인자를 실패 메시지에 붙인다) · `toHaveBeenCalledOnce` · `toHaveBeenCalledExactlyOnceWith`.
- **렌더 트리 스냅샷을 쓰지 않는다**([[ADR-156]]). 스냅샷은 ‘달라졌다’만 말하고 ‘무엇이 맞는지’는 안 말한다. 맞는 값이 정해져 있으면 **그 값을 단언한다**([[ADR-064]] 결정 11 이 먼저 고른 방법).
- 신규 기능은 **테스트 먼저(TDD)** 작성 후 통과 구현.
- `lib/scheduler/reset-clock`: KST 자정/목요일/월·연 경계 단위 테스트(기기 타임존 무관 KST 계산 검증).
- `nexon/schedule` 파싱/정규화: 실제 응답 fixture로 확인한다. 문자열 flag 파싱, 영↔한 난이도, 양방향 공백 정규화, `apiAlias`, `bossDaily` 필터, 미매핑 폴백.
- `nexon/schedule` 에러 경로 / `nexon/client` 큐잉·백오프 / `nexon/character` dedup·동률 대표 선정: [[ADR-008]] 표 각 행 대응 단위 테스트.
- 컨텐츠 스케줄러 캐시 병합([[ADR-030]]): `lib/scheduler/scheduler-merge.test.ts`(폴백·shareScope 저장소 분기·원장 active 유지·리셋 진행값 리셋·maxCountOverride) + `features/schedule-sync/__tests__`(캐시·원장 읽기/쓰기).
- 보스 수익 포뮬러(`floor(priceMeso / partySize)`) / 파티원 자동 기록(기본값 소스 [[ADR-019]]) / 파티 관리 upsert / 드롭다운 합계 / 물욕 환산 합산: 각 기능 구현 시 단위 테스트.
- 라우트 가드(온보딩 미완료 리다이렉트), 데이터 정합성(`src/data/__tests__`).
- 알림([[ADR-146]]): `plan()` 순수 함수 전수(지평선·리셋 경계·설정 꺼짐) · **재조정 멱등성**(두 번째 회차에 `schedule`/`cancel` 0회) · **레지스트리에서 사라진 kind 가 취소되는가**(OTA 제거 시나리오의 회귀 가드다. 원장이 왜 필요한지를 이 테스트가 고정한다).
- 런타임 import 사이클 0건: `src/__tests__/require-cycle-policy.test.ts`. Metro 가 실제로 번들하는 그래프(`src/` 전체)를 훑는다. `src/` 에 두는 것은 이 경고를 내는 번들러가 Metro 하나라서다.
- 네이티브 플러그인(상시 알림·Live Activity·백그라운드 재확인)은 유닛 테스트 곤란 → 실기기 수동 QA 체크리스트(백그라운드 전환·강제종료 재실행·배터리 최적화·iOS 16.1 미만 폴백).
- 골든 패스 수동 시나리오: 최초 실행 → 키 입력 → 캐릭터 조회 → 동기화 → 스케줄러 표시 → 보스 완료 감지 → 파티원 입력 → 수익 확인.

## 폐기된 정책 (history)
- ~~알림 예정 시각에 백그라운드 트리거로 API 를 실시간 재호출해 **미완료일 때만** 발송하고, iOS 64개 한도를 넘으면 우선순위 정책으로 자른다([[ADR-004]])~~ → **하이브리드 + 계정 단위 한 줄**([[ADR-146]], 2026-08-17). 재확인은 살아 있되 **사전 예약이 그 아래 깔린다**. 원안은 오탐이 0 이지만 iOS 태스크가 안 돌면 조용히 아예 안 떴다. 한도는 정책이 아니라 **구조로** 사라졌다(캐릭터별로 예약하지 않는다).
- ~~자산 목록을 `import.meta.glob`(eager)으로 빌드마다 만든다~~ → **커밋된 생성물**(`src/assets/generated/*.ts` + `npm run assets:gen`)([[ADR-129]], 2026-08-12). glob 은 Vite 전용이라 Metro(RN)에 짝이 없었다. 딸려 온 정정: *"`eager` 여부와 무관하게 전부 emit 된다"*([[ADR-093]] 결정 3)는 관찰은 여전히 맞지만 **판정 주체가 glob 이 아니라 생성물의 import 목록**이 됐다.
- ~~선택된 계정의 `character_list` 를 `storage/` 에 캐싱~~ → 캐싱 안 함, 매번 `nexon/character` 재조회(2026-07-11). 개명/전직/레벨업이 언제든 바뀌기 때문.
- ~~스케줄 동기화를 계정 전체 캐릭터 대상으로 호출~~ → 추적 대상 캐릭터로 범위 제한([[ADR-012]], 2026-07-11).
- ~~`syncSchedules` 완전 순차 호출~~ → 첫 캐릭터 프리플라이트 1건 + 나머지 병렬(`Promise.allSettled`)([[ADR-008]] 정정, 2026-07-17, 서비스 단계 키 기준).
- ~~추적 목록이 일간/주간 화면별 독립(`trackedCharacters:daily`/`:weekly`)~~ → 컨텐츠/보스로 재편(`trackedCharacters:content`/`:boss`), 1회 마이그레이션([[ADR-013]]).
- ~~보스명 정규화를 `nexon/` 이 전부 수행~~ → 난이도 변환만 `nexon/normalize`, 보스명 매칭은 `lib/boss/boss-matching`(`nexon/` 이 `src/data/` 를 모르게 하는 레이어 분리).
