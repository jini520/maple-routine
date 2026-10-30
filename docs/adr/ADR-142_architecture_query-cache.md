# ADR-142 받은 값과 읽은 값을 TanStack Query 캐시 하나에 둔다

> ⚪ 미구현
> 관련 소스: `features/query/`(새로 만든다) · `features/content-scheduler/store.ts` · `features/boss-scheduler/store.ts` · `features/boss-profit/store.ts` · `features/ledger/useLedgerData.tsx` · `features/refresh/freshness.ts` · `lib/scheduler/sync-freshness.ts` · `storage/scheduler-cache.ts` · `storage/character-basic-cache.ts` · `storage/data-freshness.ts` · `app/AppShell.tsx` · `app/today/TodayScreen.tsx`

## 배경

화면에 보이는 데이터가 앱 복귀 · 새로고침 · 초기화 시각에서 제때 바뀌지 않는다(이슈 #812). 원인을 따라가면
데이터를 드는 자리가 세 갈래로 나뉘어 있다.

- **기능마다 따로인 zustand 스토어.** 컨텐츠 스케줄러와 보스 스케줄러 스토어가 같은 `syncSchedules` 응답을
  각자 사본으로 든다. 한쪽에서 당기면 다른 쪽은 옛 값인데, 머리의 `hh:mm:ss 기준` 은 전역 값이라 방금 시각을 말한다.
- **화면 안 `useState`.** today 의 이번 주 수입(`statsDays`) · 대표 프로필(`profilesByOcid`), 가계부의
  `useMonthDays`, 통계의 `loadedDays`, 공지 목록, 캐릭터 관리의 `useAccountRosters` 가 화면 state 다. 다른 곳에서
  기록이 바뀌면 화면마다 판 번호(`statsDataRevision` · `isDropHistoryOutdated` · `LedgerLayer` 의 `revision`)를
  견주거나 토큰을 올려야 다시 읽는다. 이 장치를 빠뜨린 자리가 갱신 누락이 된다.
- **기기 캐시.** `schedulerCache:{ocid}` · `characterBasicCache:{ocid}` 가 화면과 화면 밖 코드(창 동기화 · 자동 기록 ·
  `isSyncFresh`)의 공용 원천이다.

다시 받는 계기도 화면마다 따로다. 자동 조회는 마운트 때만 돌고, 앱 복귀에는 스케줄 동기화가 없으며([[ADR-021]] 결정 6),
초기화 시각을 넘겨도 다시 받지 않는다. 누락을 하나씩 막으면 새 화면이 생길 때마다 같은 누락이 다시 생긴다. 그래서
데이터를 드는 자리와 다시 받는 규칙을 한 곳으로 모은다.

TanStack Query 는 게임 데이터 사본에 쓰다가 SQLite 사본으로 옮기며 걷었다([[ADR-020]] 결정 3). 그때 문제가 된 것은
사본을 둔 자리(Preferences `queryCache`)였다. 칸과 표식을 한 트랜잭션으로 써야 했고, Preferences 는 큰 값을 자주 쓰기에
맞지 않았다. 그래서 이 결정도 저장 자리를 SQLite 로 둔다(결정 7). 세 패키지
(`@tanstack/react-query` · `@tanstack/react-query-persist-client` · `@tanstack/query-async-storage-persister`)는
`package.json` 에 그대로 있고, `features/` 의 허용 목록에도 있다([[ADR-004]] 결정 1). 네이티브 코드가 없어 OTA 로 낼 수 있다.

## 결정

### 결정 1. 넥슨 · 서버에서 받은 값과 기기 DB 에서 읽은 값은 쿼리 캐시 하나가 든다

`features/query/client.ts` 의 `QueryClient` 하나가 앱 전체의 캐시다. 화면은 같은 열쇠로 같은 사본을 본다. 한 화면이
받은 값을 다른 화면이 바로 그리므로, 스토어 사이에서 결과를 옮기는 장치가 필요 없다.

zustand 스토어에는 **화면 상태만** 남긴다. 고른 탭 · 보던 기간 · 추적 모드 · 테마 · 인증 · 진행률(`useRefreshProgress`)이다.
스토어가 응답을 사본으로 들면 이 결정을 다시 깨는 것이다.

게임 데이터 표는 여기서 뺀다. [[ADR-020]] 의 SQLite 사본과 잠금 화면 흐름이 그대로 맡는다.

### 결정 2. 쿼리 열쇠는 `features/query/keys.ts` 한 곳에서 만든다

열쇠를 호출부마다 배열로 적으면, 같은 데이터에 열쇠가 둘 생겨 무효화가 한쪽만 닿는다. 그래서 열쇠는 이 파일의 함수로만
만든다. 처음 정하는 열쇠는 아래와 같고, 단계마다 구현하며 이 표를 맞춘다.

| 열쇠 | 드는 것 | 원천 | 기기에 저장 |
|---|---|---|---|
| `schedule(ocid)` | 캐릭터 하나의 스케줄러 응답(정규화 뒤) | 넥슨 `scheduler/character-state` | 한다 |
| `characterBasic(ocid)` | 캐릭터 하나의 기본 정보 | 넥슨 `character/basic` | 한다 |
| `scheduleRound()` | 마지막 회차의 받은 시각과 캐릭터별 결과 종류 | 결정 3 의 회차 | 한다 |
| `characterList(accountId)` | 계정의 캐릭터 목록 | 넥슨 `character/list` | 안 한다 |
| `notices(kind)` | 공지 목록 | 우리 서버 `/notices` · 넥슨 `notice*` | 한다 |
| `settlement()` | 결산 중인지 | 우리 서버 `/settlement` | 안 한다 |
| `manualCompletion()` | 직접 완료를 연 보스 | 우리 서버 `manual-completion` | 안 한다 |
| `ledgerDays(from, to)` | 가계부의 날짜별 줄 | SQLite(`loadMonthDays`) | 안 한다 |
| `bossProfitPeriod(tab, periodKey)` | 보스 수익 기간의 행 | SQLite + `schedule(ocid)` | 안 한다 |
| `dropHistory()` | 드롭 기록 묶음 | SQLite | 안 한다 |
| `profiles(ocids)` | 프로필 스냅샷 | SQLite(`character-profiles`) | 안 한다 |
| `partyAppointments()` | 파티 약속 | Preferences | 안 한다 |

### 결정 3. 스케줄 회차는 쿼리 하나이고, 결과를 캐릭터 열쇠에 나눠 넣는다

[[ADR-021]] 결정 5 의 회차 규칙(첫 캐릭터를 먼저 부르고, 전역 실패면 나머지를 캐시로 채운다)은 캐릭터를 따로 부르면
지킬 수 없다. 그래서 `scheduleRound()` 쿼리 하나가 `syncSchedules` 를 부르고, 받은 결과를 `setQueryData` 로
`schedule(ocid)` · `characterBasic(ocid)` 에 나눠 넣는다. 화면은 캐릭터 열쇠를 구독한다.

- 회차 안에서 **보스 수익 자동 기록과 처치 날짜 캐기까지** 차례로 한다. 지금은 자동 기록이 보스 수익 스토어의
  `refresh` 안에 있고 처치 날짜 캐기(`resolveDefeatDates`)는 13일 창과 가계부 진입에만 있다. 그래서 today 를 당기면
  기록은 생기는데 날짜가 비어 이번 주 수입에 안 든다. 한 회차에 순서대로 두면, 창 회차에 합류해 오늘 기록을 못 보는
  경합도 사라진다.
- 회차가 끝나면 쓴 기록의 판이 오르고, 결정 6 이 DB 읽기 쿼리를 무효화한다.
- 머리의 `hh:mm:ss 기준` 은 `scheduleRound()` 의 `dataUpdatedAt` 과 오늘 강화 수집의 받은 시각 중 늦은 쪽을 읽는다.
  `storage/data-freshness.ts` 와 `features/refresh/freshness.ts` 는 걷는다. 캐시로 채운 결과의 시각을 넣지 않는 규칙
  ([[ADR-021]] 결정 5)은 회차의 결과 종류로 지킨다.
- 회차가 실패해도 쿼리는 이전 데이터를 든다. 지금 `schedulerCache` 로 그리고 `isStale` 을 붙이는 동작과 같다.

### 결정 4. 신선한 시간은 10분이고, 초기화 시각을 넘으면 바로 만료다

`staleTime` 은 함수로 둔다. 받은 지 10분(`SYNC_TTL_MS`) 안이고, 받은 시각과 지금 사이에 일간 · 주간 · 월간 초기화
(`lib/scheduler/reset-clock.ts`)가 없을 때만 신선하다. 지금 `isSyncFresh` 는 나이만 봐서, 23:55 에 받으면 00:05 에도
어제 완료를 신선한 값으로 그린다.

초기화 시각에는 공용 타이머 하나가 넥슨 쿼리를 무효화한다. 보고 있는 화면이 있으면 그 자리에서 다시 받는다. today 의
자정 타이머가 이 타이머로 옮겨 간다. 화면마다 타이머를 두면 스케줄러 두 화면처럼 빠뜨린 화면이 어제에 머문다.

`character/basic` 의 5분 가드([[ADR-021]] 결정 7)는 회차 안의 규칙이라 그대로 둔다. 그래서 대표가 아닌 캐릭터가 5분 안에 당겨도 레벨이 안 바뀌는 것(#812 B5)은 이 리팩터링이 고치지 않는다.

### 결정 5. 다시 받는 계기는 넷이고, 각자 규칙이 다르다

| 계기 | 규칙 | 묶는 곳 |
|---|---|---|
| 앱 시작 | 저장된 캐시를 복원한 뒤 넥슨 쿼리를 한 번 무효화한다. 앱을 켜는 것은 지금 상태를 보겠다는 뜻이다 | 부팅 |
| 앱 복귀(배경 → 활성) | **신선해도 한 번 받는다**(사용자 지정). `focusManager` 를 `AppState` 에 잇고 넥슨 · 서버 쿼리에 `refetchOnWindowFocus: 'always'` 를 준다 | `features/query/client.ts` |
| 화면 포커스 | 만료된 쿼리만 받는다. 탭을 오가는 동선은 10분 안이라 캐시로 끝난다 | 화면 공용 훅 하나 |
| 당겨서 새로고침 · 다시 시도 | 신선해도 받는다 | `ScreenScroll` 의 `onRefresh` |

- 복귀의 `inactive → active` 는 세지 않는다. 지금 `useReturnToForeground` 와 같은 이유다(iOS 알림 센터를 내렸다 올린 것은
  배경에 간 적이 없다).
- 복귀마다 받으면 호출이 복귀 횟수만큼 는다. 늘어나는 것은 회차 하나(추적 캐릭터 수만큼의 스케줄러 호출)와 공지 · 결산
  조회다. 겹친 복귀는 진행 중인 쿼리를 함께 쓰고, 13일 창은 원장을 보고 부르므로 늘지 않는다.
- [[ADR-021]] 결정 6 의 `포그라운드로 돌아와도 조회하지 않는다` 는 1단계에서 이 결정으로 바뀐다.

### 결정 6. DB 읽기 쿼리는 그 표의 판이 오를 때 무효화된다

기록을 쓰는 쪽이 화면을 알 필요가 없게 한다. 저장 계층은 이미 표마다 판을 올린다(`bumpRecordsRevision` ·
`getEnhancementTotalsRevision` · `getSpendRecordsRevision` 등). `features/query/invalidation.ts` 한 곳이 그 판을 구독해,
그 표를 읽는 열쇠를 무효화한다.

- 그래서 화면마다 있던 판 비교(`statsToken` · `isDropHistoryOutdated` · `reloadManualCompleted` 의 판 · `LedgerLayer`
  의 `revision`)를 걷는다. 쓰는 자리를 하나 더 만들어도 무효화를 빠뜨릴 수 없다.
- 보고 있지 않은 화면의 쿼리는 무효 표시만 되고, 그 화면이 다시 보일 때 읽는다. 지금 포커스마다 판을 견주는 것과 같은
  비용이다.

### 결정 7. 넥슨 · 서버 응답 쿼리만 기기에 저장하고, 옛 캐시 키는 한 번 옮긴 뒤 지운다

`@tanstack/react-query-persist-client` 가 결정 2 의 `기기에 저장` 이 `한다` 인 쿼리만 SQLite 표 하나에 쓴다.

- Preferences 에 두지 않는다. 저장기는 캐시 전체를 키 하나로 자주 다시 쓰는데, iOS `UserDefaults` 는 켤 때 전체를
  메모리에 올리고 Android SharedPreferences 는 키 하나를 써도 파일 전체를 다시 쓴다([[ADR-020]] 결정 3 과 같은 이유).
- 저장 어댑터는 `storage/` 의 함수로 만들고 `query-async-storage-persister` 의 `getItem` · `setItem` · `removeItem` 을
  채운다. `features/` 가 저장소를 직접 부르지 않는 규칙([[ADR-004]] 결정 1) 때문이다. 표와 이관은 `persistence/sqlite.md` 에 적는다.
- DB 읽기 쿼리는 저장하지 않는다. 원본이 SQLite 라서 저장하면 같은 기록이 두 벌이 되고, 둘이 어긋날 때 무엇이 맞는지
  가를 수 없다.
- 저장된 캐시의 `buster` 는 캐시 모양의 판이다. 정규화 모양을 바꾸면 판을 올려 옛 캐시를 버린다. 맞지 않는 모양을 읽어
  화면이 깨지는 것보다 한 번 다시 받는 것이 낫다.
- 처음 켤 때 `schedulerCache:{ocid}` · `characterBasicCache:{ocid}` 를 쿼리 캐시로 옮기고 지운다. 버리기만 하면 업데이트
  직후 오프라인이거나 넥슨 점검일 때 화면이 빈다.
- 부팅은 복원이 끝난 뒤에 탭 예열을 연다. 복원 전에 읽는 화면 밖 코드(창 동기화 · 자동 기록)가 빈 캐시를 보면 기록을
  잘못 판단한다.
- 데이터 삭제([[ADR-053]])는 저장된 쿼리 캐시도 지운다.

### 결정 8. 세 단계로 나눠 옮긴다

한 번에 옮기면 검증 범위가 앱 전체가 된다. 단계마다 PR 하나이고, 끝난 단계는 이슈 #812 의 해당 항목을 닫는다.

| 단계 | 옮기는 것 | 닫는 #812 항목 |
|---|---|---|
| 1 | 결정 1 · 2 · 4 · 5 · 7 의 기반, 스케줄 회차(결정 3 중 스케줄과 basic), 컨텐츠 · 보스 스케줄러, today 의 스케줄 · 프로필 | A1 · A2 · A3 · B3 · B6 · B7 · D1 · D2 · D3 |
| 2 | 결정 3 의 자동 기록 · 처치 날짜, 결정 6, 보스 수익 · 가계부 · 통계 · today 의 이번 주 수입과 드롭 위젯 | A4 · B1 · B2 · B4 · C1 ~ C5 · D4 · D5 |
| 3 | 공지 · 결산 · 직접 완료 · 캐릭터 관리 · MVP 등급 설정 · 파티 약속 | A5 ~ A8 · D6 · E |

넥슨 점검 배너(A6)는 3단계에서 복귀 회차가 막힌 경로를 다시 부르는 것으로 걷히는지 확인하고, 안 걷히면 그때 정한다.

## 테스트

구현하며 쓴다. 단계마다 아래가 깨지면 실패해야 한다.

| 파일 | 확인하는 것 |
|---|---|
| `features/query/__tests__/freshness.spec.ts` | 결정 4: 10분 경계, 일간 · 주간 · 월간 초기화를 넘으면 만료, 미래 시각과 파싱 불가는 만료 |
| `features/query/__tests__/refetch-triggers.spec.ts` | 결정 5: 복귀는 신선해도 한 번, `inactive → active` 는 안 셈, 포커스는 만료일 때만, 당김은 항상 |
| `features/query/__tests__/schedule-round.spec.ts` | 결정 3: 회차 하나가 캐릭터 열쇠를 다 채우는지, 다른 화면이 같은 사본을 보는지, 실패해도 이전 데이터를 드는지, 자동 기록 뒤 처치 날짜가 붙는지 |
| `features/query/__tests__/invalidation.spec.ts` | 결정 6: 표의 판이 오르면 그 표를 읽는 열쇠만 무효화되는지 |
| `features/query/__tests__/persist.spec.ts` | 결정 7: 저장 대상만 쓰는지, 옛 캐시 키를 옮기고 지우는지, `buster` 가 다르면 버리는지 |

## 열린 질문

- today 당김이 13일 창 전체를 채울지, 회차의 처치 날짜 캐기만 할지. 창 전체는 어제 관측까지 채워 처치 날짜 소거법의
  구멍(#812 C4)을 줄이지만 호출이 캐릭터 수만큼 는다. 2단계 전에 정한다.
- 보스 수익이 지난 기간을 보며 당겼을 때 이번 기간으로 옮길지(#812 D4). 지금은 당김이 보던 기간을 안 떠난다. 2단계 전에 정한다.

## 번호 기록

- ADR-142 (2026-10-30): 처음 작성. 데이터를 드는 자리와 다시 받는 규칙을 쿼리 캐시 하나로 모은다(이슈 #812)
