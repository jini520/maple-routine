# ADR-142+144 받은 값과 읽은 값을 TanStack Query 캐시 하나에 둔다

> 🟢 유효(세 단계와 #819 후속 모두 구현)
> 관련 소스: `features/query/`(`client.ts` · `keys.ts` · `meta.ts` · `freshness.ts` · `app-focus.ts` · `reset-timer.ts` · `persist.ts` · `invalidation.ts`) · `features/schedule-sync/schedule-query.ts` · `use-schedule-queries.ts` · `schedule-views.ts` · `read-schedule.ts` · `save-tracked.ts` · `features/refresh/pull.ts` · `features/refresh/freshness.ts` · `features/boss-profit/period-query.ts` · `round-record.ts` · `round-view.ts` · `store.ts` · `drop-history-query.ts` · `features/cashbook/ledger-query.ts` · `features/cashbook/meso-rate.ts` · `features/ledger/useLedgerData.tsx` · `features/content-scheduler/views.ts` · `use-content-schedule.ts` · `features/boss-scheduler/views.ts` · `use-boss-schedule.ts` · `manual-completed-query.ts` · `features/settlement/query.ts` · `features/manual-completion/query.ts` · `features/notice/notice-query.ts` · `features/party-appointments/query.ts` · `features/mvp-grade/character-list.ts` · `features/character-profile/resolve.ts` · `features/enhancement-history/event-world-names.ts` · `features/prehydrate.ts` · `storage/query-cache.ts` · `storage/legacy-cleanup.ts` · `storage/sqlite/query-cache-tables.ts` · `app/QueryCacheProvider.tsx` · `hooks/useRefetchStaleOnFocus.ts` · `hooks/useReturnToForeground.ts` · `index.ts`

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

`features/query/client.ts` 의 `queryClient` 하나가 앱 전체의 캐시다. 화면은 같은 열쇠로 같은 사본을 본다. 한 화면이
받은 값을 다른 화면이 바로 그리므로, 스토어 사이에서 결과를 옮기는 장치가 필요 없다. 화면은 `QueryClientProvider` 로
같은 인스턴스를 받고, React 밖 코드(회차 · 저장 · 예열 · 계산기)는 그 인스턴스를 직접 쓴다(`read-schedule.ts`).

기본값 셋이 이 앱의 사정이다. `retry: false`(넥슨 · 서버 실패는 종류마다 처방이 달라 화면이 가르고, 세 번 다시 부르면
429 를 스스로 만든다), `gcTime: Infinity`(보는 화면이 없어도 캐시를 버리지 않는다. 저장된 캐시를 올려 두고 5분 뒤 지우면
복원이 헛일이다), `refetchOnWindowFocus: false`(돌아올 때 다시 받는 것은 넥슨 · 서버 쿼리가 각자 켠다).

zustand 스토어에는 **화면 상태만** 남긴다. 고른 탭 · 보던 기간 · 추적 모드 · 테마 · 인증 · 진행률(`useRefreshProgress`)이다.
스토어가 응답을 사본으로 들면 이 결정을 다시 깨는 것이다.

게임 데이터 표는 여기서 뺀다. [[ADR-020]] 의 SQLite 사본과 잠금 화면 흐름이 그대로 맡는다.

### 결정 2. 쿼리 열쇠는 `features/query/keys.ts` 한 곳에서 만든다

열쇠를 호출부마다 배열로 적으면, 같은 데이터에 열쇠가 둘 생겨 무효화가 한쪽만 닿는다. 그래서 열쇠는 이 파일의 함수로만
만든다. 쿼리의 표식은 `features/query/meta.ts` 의 `QueryMeta` 다. 넥슨 쿼리는 `{ persist: true, source: 'nexon' }` 를 들고
저장과 자정 무효화가 그것을 본다. DB 읽기 쿼리는 읽는 표를 `tables` 에, 기대는 쿼리를 `dependsOn` 에 적고 결정 6 이 그것을 본다.

| 열쇠 | 드는 것 | 원천 | 기기에 저장 | 단계 |
|---|---|---|---|---|
| `trackedOcids()` | 추적 캐릭터 목록. 저장이 `setQueryData` 로 덮는다 | Preferences | 안 한다 | 1 |
| `schedule(ocid)` | 캐릭터 하나의 스케줄러 응답(정규화 뒤). 회차가 넣고 스스로 받지 않는다(`skipToken`) | 넥슨 `scheduler/character-state` | 한다 | 1 |
| `characterBasic(ocid)` | 캐릭터 하나의 기본 정보. `fetchCharacterBasicCached` 가 넣는다 | 넥슨 `character/basic` | 한다 | 1 |
| `scheduleRound()` | 마지막 회차의 받은 시각 · 덮은 캐릭터 · 캐릭터별 결과 종류 · 답하지 않은 캐릭터 | 결정 3 의 회차 | 한다 | 1 |
| `characterList(credentialKey)` | 자격 하나로 조회되는 전 계정의 캐릭터 목록. 5분 안에는 캐릭터 관리 · MVP 등급 · 회차 · 강화 수집이 같은 응답을 쓴다 | 넥슨 `character/list` | 안 한다 | 3 |
| `notices(kind)` | 분류 하나의 공지 목록. 기기 사본(`notices`)을 대신한다 | 우리 서버 `/notices` · 넥슨 `notice*` | 한다 | 3 |
| `settlement()` | 결산 중인지와 시작 시각. 닫은 기록은 기기 값이라 스토어가 든다 | 우리 서버 `/settlement` | 안 한다 | 3 |
| `manualCompletion()` | 직접 완료를 연 보스. 닫은 주는 기기 값이라 스토어가 든다 | 우리 서버 `manual-completion` | 안 한다 | 3 |
| `manualCompleted(weeklyKey, monthlyKey)` | 추적 캐릭터가 직접 적은 완료(`bossKey\|difficulty`). 기간 키가 열쇠라 목요일 · 1일을 넘기면 새 열쇠를 읽는다 | SQLite(`boss_profit_records`) | 안 한다 | 3 |
| `ledgerDays(from, to)` | 가계부의 날짜별 줄. today 의 이번 주 수입 · 가계부의 달 · 통계의 전 기간이 범위만 달리 든다 | SQLite(`loadMonthDays`) | 안 한다 | 2 |
| `bossProfitPeriod(tab, periodKey)` | 보스 수익 한 기간의 스냅샷(행 · 드롭 · 주차 소계 · 기간 상태 · 이전 화살표 · 조회 불가 카드). 결정 9 | SQLite + `schedule(ocid)` | 안 한다 | 2 |
| `dropHistory()` | 드롭 기록 전 기간 묶음과 가뭄 요약 | SQLite | 안 한다 | 2 |
| `enhancementToday()` | 오늘 강화 내역을 마지막으로 받은 시각. 머리의 `hh:mm:ss 기준` 이 회차 시각과 견준다 | 강화 수집기가 넣는다 | 안 한다 | 2 |
| `partyAppointments()` | 파티 약속. 저장이 `setQueryData` 로 덮는다 | Preferences | 안 한다 | 3 |
| `mesoRate(ocid)` | 캐릭터 하나의 메소 획득량(%) 마지막 성공값. 사냥 계산기가 못 읽었을 때 칸의 기본값이다. 결정 11 | 넥슨(`fetchMesoRate`) | 한다 | 후속 |
| `eventWorldNames()` | 이벤트 월드 캐릭터 이름 배열. 강화 수집기가 넣는다. 결정 11 | 넥슨 `character/list` | 한다 | 후속 |

프로필 스냅샷(`character-profiles`)에는 열쇠를 두지 않는다. 화면이 직접 읽지 않고 위 쿼리들의 `queryFn` 안에서 읽는다.

`meta` 는 옵저버가 붙거나 `fetchQuery` 가 돌 때 쿼리에 실린다. `mesoRate` · `eventWorldNames` 는 화면이 구독하지 않고 `setQueryData` 로만 들어가므로, 그대로 두면 `meta` 가 비어 저장기가 건너뛴다. 그래서 이 둘은 `features/query/client.ts` 의 `setQueryDefaults` 로 표식을 건다.

### 결정 3. 스케줄 회차는 쿼리 하나이고, 결과를 캐릭터 열쇠에 나눠 넣는다

[[ADR-021]] 결정 5 의 회차 규칙(첫 캐릭터를 먼저 부르고, 전역 실패면 나머지를 캐시로 채운다)은 캐릭터를 따로 부르면
지킬 수 없다. 그래서 `scheduleRound()` 쿼리 하나가 `syncSchedules` 를 부르고, 받은 결과를 `setQueryData` 로
`schedule(ocid)` · `characterBasic(ocid)` 에 나눠 넣는다(`features/schedule-sync/schedule-query.ts`). 화면은
`useScheduleQueries` 로 추적 목록 · 회차 · 캐릭터 열쇠를 한 스냅샷으로 받고, `buildContentViews` · `buildBossViews`
(순수 함수)가 그것을 두 스케줄러의 캐릭터 뷰로 만든다. 캐시로 채운 결과(`isStale`)는 든 값을 덮지 않고 결과 종류만
회차에 남긴다. 답하지 않은 캐릭터(`stranded`)도 회차가 들어, 화면이 자리를 남기고 조회 불가라고 말한다.

추적 목록 저장(`save-tracked.ts`)은 새로 든 캐릭터만 받아 넣고(`syncAddedCharacters`) 회차가 덮은 목록에 더한다.
전에는 컨텐츠 · 보스 스토어가 같은 저장을 각자 들고 있었고 월드 이전 안내는 한쪽만 불러 보스 탭이 옛 목록으로 남았다.

- 회차 안에서 **보스 수익 자동 기록과 처치 날짜 캐기까지** 차례로 한다. `runScheduleRound` 가 `syncSchedules` 뒤에
  `recordBossProfitFromRound`(`features/boss-profit/round-record.ts`. 지금 기간의 완료 보스를 기록하고 리프 중복과 고아
  드롭을 정리한다)와 `resolveDefeatDates` 를 부른다. 둘은 던져도 회차를 깨지 않는다. 쓴 기록은 표의 판을 올리고 결정 6
  이 그 표를 읽는 쿼리를 무효화한다. 전에는 자동 기록이 보스 수익 스토어의 `refresh` 안에 있고 처치 날짜 캐기는 13일
  창과 가계부 진입에만 있어, today 를 당기면 기록은 생기는데 날짜가 비어 이번 주 수입에 안 들었다(#812 B1). 새로 추적한
  캐릭터만 받는 `syncAddedCharacters` 도 같은 둘을 거친다.
- `resolveDefeatDates` 는 도는 회차가 있으면 합류하되, 그 회차가 시작한 뒤 보스 기록의 판이 올랐으면 끝난 뒤 한 번 더
  돈다. 창 회차가 후보를 읽은 뒤에 자동 기록이 오늘 기록을 쓰면 그 기록은 그 회차의 후보에 없다(#812 C1).
- 당겨서 새로고침은 `features/refresh/pull.ts` 의 `pullRefresh` 하나다. 회차 → 13일 창([[ADR-021]] 결정 8) → 오늘 강화
  내역 순이다(사용자 지정 2026-10-30). today 와 수익 · 지출 층이 이것을 부른다. 조회 원장에 적힌 날은 다시 부르지
  않으므로 평소에는 새로 생긴 날짜만 캐릭터 수만큼 나간다. 창까지 채워야 처치 날짜 소거법에 필요한 어제 관측이 있고
  (#812 C4), 기록이 아직 없는 지난 날이 비지 않는다. 오늘 강화는 하루치(4콜)라 어느 당김에나 든다. 전에는 today 와 보스
  수익의 당김이 강화를 안 받아 이번 주 지출이 그대로였다(#812 B2 · B4). 컨텐츠 · 보스 스케줄러의 당김은 회차만 받는다.
  그 두 화면은 창과 강화를 안 그린다.
- 수익 · 지출 층(`features/ledger/useLedgerData.tsx`)의 `live` 조각은 회차(`refreshSchedules`)와 오늘 강화
  (`collectTodayEnhancement`)다. 층의 마운트는 `prefetchSchedules` 로 만료된 회차를 먼저 받은 뒤 창을 채운다. 창 회차가 자동 기록보다 먼저 후보를 읽어 오늘 기록에
  날짜가 안 붙던 자리가 사라진다(#812 C2 · C5). 층은 진행률 · 모달 · 강화 범위만 들고 기록은 들지 않는다. 자식이 다시
  읽는 계기였던 `revision` 은 결정 6 이 대신한다.
- 보스 수익이 지난 기간을 보며 당기면 보던 기간에 머물고 데이터만 새로 받는다. 지금 동작 그대로다(사용자 지정
  2026-10-30). #812 D4 는 고치지 않는다.
- 머리의 `hh:mm:ss 기준` 은 `scheduleRound()` 데이터의 `receivedAt` 과 `enhancementToday()` 의 받은 시각 중 늦은 쪽이다
  (`features/refresh/freshness.ts` 의 `useRealtimeFetchedAt`). `receivedAt` 은 넥슨에서 실제로 받은 마지막 시각이다. 전원이
  캐시로 채워진 회차(401 · 429 · 점검)도 쿼리는 성공이라 `dataUpdatedAt` 은 오르는데, 그것을 그리면 아무것도 안 받은
  진입이 방금 받은 것처럼 보인다. 회차 쿼리는 기기에 저장되므로 앱을 다시 켜도 그 시각이 남는다. Preferences 의 `dataFetchedAt` 과 `storage/data-freshness.ts` 는 걷었다. 과거 기간의 강화 조회는 시각을 안
  움직인다. 이미 확정된 기록이라 그것으로 시각을 올리면 지난 달을 넘겨보기만 해도 방금 받은 데이터처럼 보인다.
- 회차가 실패해도 쿼리는 이전 데이터를 든다. 회차 자체가 던진 실패(키 없음 등)는 쿼리의 `error` 가 되고 화면이
  `toScheduleSyncError` 로 종류를 가른다.

### 결정 4. 신선한 시간은 10분이고, 초기화 시각을 넘으면 바로 만료다

`staleTime` 은 함수다(`features/query/freshness.ts` 의 `scheduleStaleTime`). 받은 지 10분(`SYNC_TTL_MS`) 안이고, 받은
뒤 처음 오는 KST 자정이 아직 안 지났고, 추적 캐릭터를 회차가 전부 덮었을 때만 신선하다. 일간 초기화가 매일 자정이고
주간(목요일) · 월간(1일) 초기화도 자정이라 자정 하나만 보면 셋을 다 넘긴다. 옛 `isSyncFresh` 는 나이만 봐서, 23:55 에
받으면 00:05 에도 어제 완료를 신선한 값으로 그렸다.

KST 자정에는 공용 타이머 하나(`features/query/reset-timer.ts`)가 `meta.source` 가 `nexon` 인 쿼리를 무효화하고 틱을
올린다. 보고 있는 화면이 있으면 그 자리에서 다시 받고, 화면은 `useResetBoundaryTick` 으로 다시 그린다. today 의 자정
타이머가 이 타이머로 옮겨 왔다. 화면마다 타이머를 두면 스케줄러 두 화면처럼 빠뜨린 화면이 어제에 머문다.

`character/basic` 의 5분 가드([[ADR-021]] 결정 7)는 회차 안의 규칙이라 그대로 둔다. 그래서 대표가 아닌 캐릭터가 5분 안에 당겨도 레벨이 안 바뀌는 것(#812 B5)은 이 리팩터링이 고치지 않는다.

### 결정 5. 다시 받는 계기는 넷이고, 각자 규칙이 다르다

| 계기 | 규칙 | 묶는 곳 |
|---|---|---|
| 앱 시작 | 저장된 캐시를 복원한 뒤 회차를 만료로 표시한다. 앱을 켜는 것은 지금 상태를 보겠다는 뜻이다 | `onQueryCacheRestored` |
| 앱 복귀(배경 → 활성) | **신선해도 한 번 받는다**(사용자 지정). `focusManager` 를 `AppState` 에 잇고 넥슨 · 서버 쿼리에 `refetchOnWindowFocus: 'always'` 를 준다 | `features/query/app-focus.ts` |
| 화면 포커스 | 만료된 쿼리만 받는다. 탭을 오가는 동선은 10분 안이라 캐시로 끝난다. 컨텐츠 · 보스 · 보스 수익 · today 가 건다 | `hooks/useRefetchStaleOnFocus.ts` |
| 당겨서 새로고침 · 다시 시도 | 신선해도 받는다 | `refreshSchedules`. 화면이 `ScreenScroll` 의 `onRefresh` 와 토스트의 다시 시도에 넘긴다 |

- 복귀의 `inactive → active` 는 세지 않는다. iOS 알림 센터를 내렸다 올린 것은 배경에 간 적이 없기 때문이다.
- 복귀 신호는 `app-focus.ts` 하나다. 쿼리 밖의 일(게임 데이터 확인 · 알림 재구독 · 알림 재조정 · MVP 등급)은
  `hooks/useReturnToForeground` 를 쓰고, 이 훅은 `focusManager` 를 구독해 포커스가 켜질 때 콜백을 부른다. 전에는 훅이 `AppState`
  리스너를 따로 달아 같은 규칙이 두 벌이었다.
- 우리 서버 쿼리(결산 · 직접 완료 · 공지)도 `refetchOnWindowFocus: 'always'` 다. 새벽 결산 중 배경에 두었다가 돌아오면 결산
  줄이 걷히고(#812 A5), 더보기 · 공지 목록을 연 채 돌아오면 새 글이 서고(A7), 배경에서 온 운영자 공지는 today 배너가
  서버를 다시 물어 세운다(A8). `meta.source` 는 `server` 다. 자정 무효화는 `nexon` 만 본다.
- 넥슨 점검 배너(A6)는 따로 묻지 않는다. 복귀 회차가 스케줄러 · `character/basic` 경로를 다시 부르고 그 성공이 배너를
  내린다(`nexonMaintenanceReporter`). 강화 내역 경로만 막혔던 점검은 수익 · 지출 층에 들어갈 때 내려간다.
- 복귀마다 받으면 호출이 복귀 횟수만큼 는다. 늘어나는 것은 회차 하나(추적 캐릭터 수만큼의 스케줄러 호출)와 공지 · 결산
  조회다. 겹친 복귀는 진행 중인 쿼리를 함께 쓰고, 13일 창은 원장을 보고 부르므로 늘지 않는다.
- [[ADR-021]] 결정 6 은 이 결정을 가리키고 10분 값과 보스 수익의 옛 게이트만 남겼다.

### 결정 6. DB 읽기 쿼리는 그 표의 판이 오를 때 무효화된다

기록을 쓰는 쪽이 화면을 알 필요가 없게 한다. 저장 계층은 표마다 판을 올리고 구독 함수를 낸다
(`subscribeBossProfitRecordsRevision` · `subscribeBossDropRecordsRevision` · `subscribeIncomeRecordsRevision` ·
`subscribeSpendRecordsRevision` · `subscribeEnhancementTotalsRevision` · `subscribeScheduleProbeLedgerRevision`).
`features/query/invalidation.ts` 의 `startRecordInvalidation` 이 여섯을 구독해, `meta.tables` 에 그 표를 적은 쿼리를
무효화한다. 표 이름은 `features/query/meta.ts` 의 `RecordTable` 이다.

- 쿼리는 자기가 읽는 표를 `meta.tables` 에 적는다. `ledgerDays` 는 다섯 기록 표, `bossProfitPeriod` 는 보스 기록 · 드롭
  기록 · 조회 원장, `dropHistory` 는 드롭 기록 · 보스 기록이다. 조회 원장(`scheduleProbe:*`)이 든 것은 지난 기간의 상태
  (`notChecked` 에서 `confirmedEmpty` 로)가 기록 없이 원장만으로 바뀌기 때문이다.
- 다른 쿼리에 기대는 쿼리는 `meta.dependsOn` 에 그 열쇠의 이름을 적는다. `bossProfitPeriod` 의 지금 기간은
  `schedule(ocid)` 캐시에서 행을 만들므로 `schedule-round` 에 기댄다. 같은 모듈이 쿼리 캐시를 구독해, 회차가 새 데이터를
  들면(받았든 `setQueryData` 로 넣었든) 그 쿼리를 무효화한다.
- 판 알림은 `batchRecordWrites` 안에서는 끝날 때 한 번이다. 자동 기록 · 처치 날짜 · 창 채우기 · 강화 수집이 그 안에서
  돈다. 안 묶으면 첫 수집의 수백 번 쓰기가 수백 번 다시 읽게 한다. 지출 기록의 판은 쓰기 **뒤에** 오른다. 앞에 올리면
  무효화된 쿼리가 쓰기 전 값을 읽는다.
- 그래서 화면마다 있던 판 비교(`statsToken` · `isDropHistoryOutdated` · `cashbookDataRevision` · `statsDataRevision` ·
  `reloadToken` · `LedgerLayer` 의 `revision` · 기간 표의 `stamp`)를 걷었다. 쓰는 자리를 하나 더 만들어도 무효화를 빠뜨릴
  수 없다.
- 보고 있지 않은 화면의 쿼리는 무효 표시만 되고, 그 화면이 다시 보일 때 읽는다. 전에 포커스마다 판을 견주던 것과 같은
  비용이다.
- 보스 스케줄러의 직접 완료는 `manualCompleted(weeklyKey, monthlyKey)` 쿼리다(`features/boss-scheduler/manual-completed-query.ts`).
  보스 기록 표의 판과 추적 목록(`dependsOn: tracked-ocids`)에 매여 무효화되고, 기간 키가 열쇠라 목요일 · 1일을 넘기면 화면이
  새 열쇠를 읽는다. 전에는 스토어가 기록 판과 기간을 이어 붙인 표식을 포커스마다 견줬다.

### 결정 7. 넥슨 · 서버 응답 쿼리만 기기에 저장하고, 옛 캐시 키는 한 번 옮긴 뒤 지운다

`@tanstack/react-query-persist-client` 가 결정 2 의 `기기에 저장` 이 `한다` 인 쿼리만 SQLite 표 하나에 쓴다.

- Preferences 에 두지 않는다. 저장기는 캐시 전체를 키 하나로 자주 다시 쓰는데, iOS `UserDefaults` 는 켤 때 전체를
  메모리에 올리고 Android SharedPreferences 는 키 하나를 써도 파일 전체를 다시 쓴다([[ADR-020]] 결정 3 과 같은 이유).
- 저장 어댑터는 `storage/query-cache.ts` 가 SQLite 표 `query_cache` 로 만들고, `features/query/persist.ts` 가
  `query-async-storage-persister` 의 `getItem` · `setItem` · `removeItem` 에 채운다. `features/` 가 저장소를 직접 부르지
  않는 규칙([[ADR-004]] 결정 1) 때문이다. 저장소 실패는 삼킨다. 캐시는 다음 조회가 다시 채우는 값이라, 못 썼다고 화면이
  서지 않으면 안 된다. 표는 `persistence/sqlite.md` 에 있다.
- `maxAge` 는 무한이다. 오래된 데이터도 그 시각과 함께 그린다. 버리면 오프라인이나 점검 중에 켠 화면이 빈다.
- DB 읽기 쿼리는 저장하지 않는다. 원본이 SQLite 라서 저장하면 같은 기록이 두 벌이 되고, 둘이 어긋날 때 무엇이 맞는지
  가를 수 없다.
- 저장된 캐시의 `buster` 는 캐시 모양의 판이다. 정규화 모양을 바꾸면 판을 올려 옛 캐시를 버린다. 맞지 않는 모양을 읽어
  화면이 깨지는 것보다 한 번 다시 받는 것이 낫다.
- 복원이 끝나면 1.0.12 까지의 Preferences 캐시(`schedulerCache:{ocid}` · `characterBasicCache:{ocid}`) 중 추적 캐릭터의 것을,
  쿼리에 없는 캐릭터만 쿼리 캐시로 옮기고 **그 키를 지운다**(`seedScheduleQueriesFromLegacyCache`, 결정 12 가 한 번만 돌린다). 버리기만 하면 업데이트 직후
  오프라인이거나 넥슨 점검일 때 화면이 빈다. 동기화 · `character/basic` 조회 · 13일 창 · 캐릭터 관리 · 가계부는 이제 쿼리
  캐시만 읽는다(`read-schedule.ts` 의 `readCharacterBasic`). 캐릭터 관리의 첫 목록(`character/list` 를 기다리기 전에 그리는
  후보)은 쿼리 캐시에 든 `characterBasic` 을 계정 소속 기록으로 걸러 만든다. 소속 기록의 마지막 본 날이 그 계정의 가장 최근
  날과 같은 캐릭터만이다. 월드 리프로 목록에서 빠진 캐릭터를 세우면 열 때마다 떴다가 사라진다. 옛 인덱스 키는 결정 12 가
  지운다.
- 공지의 기기 사본(Preferences `notices`)도 걷었다. `notices(kind)` 쿼리가 저장되므로 같은 것이 두 벌이 된다. 상세 화면이
  목록에서 먼저 그리던 것은 쿼리 캐시에서 찾는다. 옛 키는 결정 12 가 지운다.
- 복원은 `app/QueryCacheProvider.tsx` 가 한다. 올리는 동안 화면의 쿼리는 기다리고(`useIsRestoring`), 부팅 예열
  (`features/prehydrate.ts`)은 `whenQueryCacheRestored` 를 기다린 뒤에 돈다. 복원 전에 회차를 돌리면 옛 캐시를 못 보고
  빈 캐시로 판단한다.

### 결정 9. 보스 수익의 기간은 `bossProfitPeriod(tab, periodKey)` 쿼리 하나이고, 스토어는 보던 기간만 든다

`features/boss-profit/period-query.ts` 의 `bossProfitPeriodOptions` 가 한 기간의 스냅샷(행 · 드롭 · 주차 소계 · 기간 상태 ·
집계 전 여부 · 이전 화살표 · 조회 불가 카드)을 만든다. 지금 기간의 행은 `schedule(ocid)` 캐시와 회차 결과에서, 지난 기간은
기록에서 만든다(`buildPeriodSnapshot`). 화면은 `useBossProfitPeriod(tab, periodKey)` 로 보고 today 는 이번 주 열쇠를 본다.

- 전에는 스토어가 `syncSchedules` 를 직접 부르고(10분 게이트 `isSyncFresh` 와 `sync-run-state`), 그 결과로 만든 행을
  `latestSyncSnapshot` 에 들고, 읽어 둔 기간을 `period-cache.ts` 의 표에 `stamp` 로 들었다. 셋 다 쿼리 캐시가 하는
  일이라 걷었다. 회차 · 기록 판 · 원장이 바뀌면 결정 6 이 기간 쿼리를 무효화한다.
- 기간 이동의 겹침은 열쇠가 가른다. 기간마다 쿼리가 따로라 느린 회차가 다른 기간의 화면을 덮을 수 없어 `requestGeneration`
  이 필요 없다. 화면은 `placeholderData` 로 앞 기간의 값을 새 값이 올 때까지 두고, `loadedTab` · `loadedPeriodKey` 로 그
  값이 어느 기간 것인지 안다.
- 기간을 미리 읽는 창(`period-window.ts`)은 그대로다. 한 기간이 서면 그 앞뒤 기간을 `prefetchQuery` 로 차례로 읽는다. 창
  동기화가 있어야 답이 나오는 기간은 건너뛴다. 배경에서 넥슨을 부르지 않는다.
- 스토어(`features/boss-profit/store.ts`)에는 `tab` · `periodKey` · `partyPlans` 와 쓰기(`setRowParty` ·
  `saveManualCompletion` · `cancelManualCompletion` · `setBossDrops`)만 남는다. 쓰기는 기록만 쓰고 화면은 무효화가
  맞춘다. 가격 입력 화면이 스토어에 알리던 `applyExternalDropEdit` 도 같은 이유로 걷었다.
- 회차의 실패 · 캐시로 채운 캐릭터 · 답하지 않은 캐릭터는 회차 쿼리가 들고(`round-view.ts`), 화면은 토스트와 배지를
  거기서 만든다. 스토어에 사본(`error` · `staleCharacterNames` · `characterIssues`)을 두지 않는다.
- `partyPlans` 는 파티 설정 표를 읽는데 그 표에는 판이 없다. 설정을 바꾸는 쓰기가 이 스토어 안에 있어 그 자리에서 맞춘다.

### 결정 8. 세 단계로 나눠 옮긴다

한 번에 옮기면 검증 범위가 앱 전체가 된다. 단계마다 PR 하나이고, 끝난 단계는 이슈 #812 의 해당 항목을 닫는다.

| 단계 | 옮기는 것 | 닫는 #812 항목 | 상태 |
|---|---|---|---|
| 1 | 결정 1 · 2 · 4 · 5 · 7 의 기반, 스케줄 회차(결정 3 중 스케줄과 basic), 컨텐츠 · 보스 스케줄러, today 의 스케줄 · 프로필 | A1 · A2 · A3 · B3 · B6 · B7 · D1 · D2 · D3 | 끝(2026-10-30) |
| 2 | 결정 3 의 자동 기록 · 처치 날짜 · 머리 시각, 결정 6, 결정 9, 가계부 · 통계 · today 의 이번 주 수입과 드롭 위젯, 보스 수익의 옛 게이트 걷기 | A4 · B1 · B2 · B4 · C1 ~ C5 · D5 | 끝(2026-10-30) |
| 3 | 공지 · 결산 · 직접 완료 · 캐릭터 목록 · 파티 약속 · 보스 스케줄러의 직접 완료, 옛 캐시 키 지우기 | A5 ~ A8 · D6 · E | 끝(2026-10-31) |

파티 스케줄 화면은 주가 바뀌면(D6) 보던 주가 지난 이번 주였을 때만 새 이번 주로 옮긴다. 다른 주를 보고 있었으면 그대로 둔다.
캐릭터 관리는 `character/list` 를 한 번만 부른다(E). 계정 목록과 후보 목록이 같은 `characterList` 쿼리를 5분 안에 나눠 쓴다.

### 결정 10. 프로필 조회는 표 → 쿼리 캐시 → 옛 Preferences 키 순으로 찾는다

`features/character-profile/resolve.ts` 의 `resolveDisplayProfiles` 가 세 곳을 이 순서로 본다. 표(`character_profiles`)는 지워지지
않는 스냅샷이라 먼저 본다. 쿼리 캐시에는 추적 중인 캐릭터만 든다.

옛 키(`characterBasicCache:{ocid}`)까지 보는 이유가 있다. 첫 실행 이관은 추적 중인 ocid 만 옮기므로, 2026-09-05(표가 생긴 날) 전에
추적을 뺐거나 월드를 옮겼고 그 뒤 기록 화면을 안 연 캐릭터는 이 키가 값이 남은 유일한 자리다. 이 키를 안 읽으면 보스 수익 지난
기간은 이름이 빈 채 뜨고, 가계부 · 드롭 이력처럼 프로필을 못 찾으면 행을 안 만드는 화면에서는 줄이 사라진다(#819 A).

- 옛 키에서 찾으면 `saveCharacterProfile` 로 표에 심고 그 키를 지운다. 값이 지워지지 않는 표로 옮겨졌으니 키는 더 필요 없다.
  표에 심지 못하면 키를 남겨 다음 조회가 다시 옮긴다.
- 남은 옛 키를 한꺼번에 지우지 않는다(사용자 결정 2026-10-31). 화면에 뜰 때 하나씩 옮겨지고, 사용자가 데이터 삭제의 `캐시` 를
  고르면 [[ADR-053]] 결정 1 이 프로필을 표에 옮긴 뒤 지운다.

### 결정 11. 메소 획득량과 이벤트 월드 이름도 쿼리 캐시가 든다

Preferences 에 남아 있던 넥슨 응답 캐시 둘(`mesoRateCache:{ocid}` · `eventWorldNames`)을 `mesoRate(ocid)` · `eventWorldNames()` 쿼리로
옮긴다. 받은 값을 쿼리 캐시 하나에 두기로 한 결정 1 의 남은 몫이다. 두 쿼리는 화면이 구독하지 않는다. `loadMesoRate` 와 강화
수집기가 `setQueryData` 로 넣고 읽는 쪽이 `getQueryData` 로 읽는다.

- 메소 획득량의 0 은 값이다. 메획을 안 두른 캐릭터가 실제로 있어 `null` 로 접지 않는다.
- 이벤트 월드 이름은 쿼리에 **배열**로 든다. 저장기가 JSON 으로 쓰므로 `Set` 을 넣으면 `{}` 로 저장되어 다음 실행에 값이 사라진다.
  `features/enhancement-history/event-world-names.ts` 가 읽을 때 `Set` 으로 바꾼다.
- 이벤트 월드 이름의 `null` 과 빈 집합은 다르다. `null` 은 아직 못 받았다는 뜻이고, 빈 집합은 스페셜 캐릭터가 없는 계정이라 답이
  난 것이다. `null` 을 빈 집합으로 읽으면 스페셜 지출이 그대로 샌다. 복원 전에 읽어도 `null` 이고, `ensureEnhancementTotals` 는
  그때 옮기지 않고 다음 호출이 다시 본다.
- 강화 수집은 계정 목록을 `fetchCharacterListCached` 로 받는다. 전에는 회차마다 `character/list` 를 따로 불렀다. 5분 안이면 캐릭터
  관리와 같은 응답을 쓴다.
- 캐시 판(`QUERY_CACHE_BUSTER`)을 올리면 둘도 사라진다. 메소 획득량은 칸의 기본값이 한 번 비고, 이벤트 월드 이름은 다음 수집이
  다시 채운다.

### 결정 12. 부팅 때 옛 키 정리는 한 자리에서 한 번만 돈다

`storage/legacy-cleanup.ts` 의 `runLegacyCleanupOnce` 가 옛 키를 지우고 Preferences 에 표식 `legacyCleanupDone` 을 둔다. 다음 부팅부터는
표식만 읽고 끝난다. 전에는 지우는 자리가 셋(`features/game-data/sync.ts` · `features/prehydrate.ts` · `seedScheduleQueriesFromLegacyCache`)이고
지울 것이 없어도 매 부팅 돌았다.

- 저장된 쿼리 캐시를 올린 뒤(`onQueryCacheRestored`) 돈다. 옛 값을 쿼리에 심어야 하므로 복원보다 먼저 돌 수 없다.
- 차례는 쿼리에 심기 → 지우기 → 표식이다. 쿼리에 이미 값이 있으면 덮지 않는다. `storage/` 는 쿼리를 모르므로 심는 일은
  `features/schedule-sync/schedule-query.ts` 가 함수로 넘긴다.
- 정리가 지우는 키는 `queryCache` · `bossCatalog` · `notices` · `characterBasicCache:index` · `characterBasicCache:index:{accountId}` ·
  `mesoRateCache:{ocid}` · `eventWorldNames` 다. 추적 캐릭터의 `schedulerCache:{ocid}` · `characterBasicCache:{ocid}` 는
  `seedScheduleQueriesFromLegacyCache` 가 옮기며 지운다. 추적하지 않는 캐릭터의 두 키는 남는다(결정 10).
- 어느 단계든 던지면 표식을 안 둔다. 다음 부팅이 처음부터 다시 돌고, 심기는 쿼리에 있는 값을 건너뛰며 지우기는 두 번 돌아도 같다.

## 테스트

| 파일 | 확인하는 것 |
|---|---|
| `features/query/__tests__/freshness.spec.ts` | 결정 4: 10분 경계, 받은 뒤 KST 자정이 끼면 자정까지만, 받은 적 없음과 회차가 덮지 않은 추적 캐릭터는 바로 만료 |
| `features/query/__tests__/app-focus.spec.ts` | 결정 5: 배경에서 활성으로 돌아올 때만 포커스를 알리고 `inactive → active` 는 안 세는지 |
| `features/query/__tests__/reset-timer.spec.ts` | 결정 4: KST 자정에 `source: nexon` 쿼리만 무효화하고 틱을 올린 뒤 다음 자정을 다시 거는지 |
| `features/query/__tests__/persist.spec.ts` | 결정 7: `meta.persist` 가 참이고 성공한 쿼리만 저장하는지, 어댑터가 `storage/query-cache` 를 부르는지, 판과 `maxAge` |
| `features/schedule-sync/__tests__/schedule-query.spec.ts` | 결정 3 · 5: 회차 하나가 캐릭터 열쇠를 다 채우고 캐시로 채운 캐릭터는 안 덮는지, 신선하면 자동 진입은 안 받고 당김은 받는지, 회차가 덮지 않은 캐릭터가 생기면 받는지, 던져도 캐릭터 열쇠가 그대로인지, 새 캐릭터만 받아 넣는지, 옛 캐시를 옮기고 앱 시작에 한 번 받는지 |
| `features/schedule-sync/__tests__/use-schedule-queries.spec.tsx` | 결정 3: 회차가 도는 동안 든 값이 그대로 보이는지, 상태와 실패 종류 |
| `features/schedule-sync/__tests__/save-tracked.spec.ts` | 결정 3: 저장 순서(수동 시드 → 목록 → 새 캐릭터 조회), 더한 것이 없으면 안 받는지, 실패 토스트 |
| `features/content-scheduler/__tests__/views.spec.ts` · `features/boss-scheduler/__tests__/views.spec.ts` | 결정 3: 스냅샷이 뷰가 되는 규칙. 조회 불가와 답하지 않은 캐릭터는 내용을 비우고 자리를 남기는지, 레벨 순서 |
| `features/__tests__/prehydrate.spec.ts` | 결정 7: 복원을 기다린 뒤 선택 · 회차 · 보스 수익을 순차로 예열하는지 |
| `storage/sqlite/__tests__/query-cache-real-sqlite.test.ts` | 결정 7: 같은 키는 값을 덮고 지우면 없는지 |
| `features/query/__tests__/invalidation.spec.ts` | 결정 6: 표의 판이 오르면 그 표를 적은 쿼리만 무효화되는지, 회차가 새 데이터를 들면 `dependsOn` 쿼리가 무효화되는지 |
| `features/schedule-sync/__tests__/schedule-query.spec.ts` | 결정 3: 회차가 동기화 뒤 자동 기록 · 처치 날짜 순으로 부르고, 둘이 던져도 회차는 서는지 |
| `features/refresh/__tests__/pull.spec.ts` | 결정 3: 당김이 회차 → 창 → 오늘 강화 순인지, 추적이 없으면 창을 안 부르는지 |
| `features/refresh/__tests__/freshness.spec.ts` | 결정 3: 회차 시각과 오늘 강화 시각 중 늦은 쪽을 내고 둘 다 없으면 빈지 |
| `features/boss-profit/__tests__/defeat-dates.spec.ts` | 결정 3: 합류한 회차가 시작한 뒤 기록 판이 올랐으면 한 번 더 도는지 |
| `features/boss-profit/__tests__/round-record.spec.ts` | 결정 3: 캐시로 채운 캐릭터는 기록 · 고아 정리에서 빼는지, 기록 조회가 실패하면 아무것도 안 쓰는지 |
| `features/boss-profit/__tests__/period-snapshot.spec.ts` | 결정 9: 지금 기간은 스케줄 캐시에서, 지난 기간은 기록에서 만드는지, 기록만 있는 조합과 추적에서 뺀 캐릭터의 기록이 남는지, 관측이 없는 지난 기간은 창을 채우는지 |
| `features/boss-profit/__tests__/period-query.spec.ts` | 결정 9: 미리 읽기가 창 동기화가 필요한 기간을 건너뛰는지, 회차가 새 데이터를 들면 기간 쿼리가 무효화되는지 |
| `features/boss-profit/__tests__/store.spec.ts` | 결정 9: 기간 이동이 기록이 있는 가장 가까운 기간으로 가는지, 쓰기가 기록만 쓰고 화면 사본을 안 드는지 |
| `features/boss-profit/__tests__/round-view.spec.ts` | 결정 9: 회차 결과에서 조회 불가 · 실패 배지를 가르고, 점검은 토스트 이름에서 빼며, 답하지 않은 캐릭터는 조회 불가로 두는지 |
| `features/cashbook/__tests__/ledger-query.spec.ts` | 결정 6: 범위가 열쇠이고 기록 표의 판이 오르면 다시 읽는지 |
| `features/settlement/__tests__/query.spec.ts` · `features/manual-completion/__tests__/query.spec.ts` | 결정 5: 복귀마다 받는 서버 쿼리인지, 닫은 기록이 서버 값과 따로 살아 다음 결산 · 다음 주에 다시 서는지 |
| `features/notice/__tests__/notice-query.spec.ts` | 결정 2 · 5 · 7: 분류마다 열쇠이고 저장되는지, 실패하면 든 값을 지키는지, 앱 공지를 받으면 닫은 기록을 정리하는지, 당김이 전부 실패했을 때만 그렇게 말하는지 |
| `features/mvp-grade/__tests__/character-list.spec.ts` | 결정 2: 5분 안의 두 호출이 `character/list` 를 한 번만 부르고 강제 조회는 다시 받는지, MVP 등급의 ID 표시가 같은 응답을 쓰는지 |
| `features/boss-scheduler/__tests__/manual-completed-query.spec.ts` | 결정 6: 기간 키가 열쇠이고 보스 기록 판 · 추적 목록에 매여 무효화되는지 |
| `features/party-appointments/__tests__/query.spec.ts` | 결정 2: 저장이 캐시를 덮고 알림 재조정을 부르는지 |
| `features/schedule-sync/__tests__/schedule-query.spec.ts` | 결정 7 · 12: 옛 캐시를 옮긴 뒤 그 키를 지우는지, 메소 획득량 · 이벤트 월드 이름을 쿼리에 심되 든 값은 안 덮는지, 표식이 있으면 옛 값을 다시 옮기지 않는지 |
| `hooks/__tests__/useReturnToForeground.spec.tsx` | 결정 5: `app-focus.ts` 의 신호로 배경에서 돌아올 때만 부르고, 언마운트하면 안 부르는지 |
| `features/character-profile/__tests__/resolve.spec.ts` | 결정 10: 표와 쿼리 캐시에 없고 옛 키에만 있는 캐릭터를 찾아 표에 심고 그 키를 지우는지, 표에 못 심으면 키를 남기는지 |
| `features/cashbook/__tests__/meso-rate.spec.ts` | 결정 11: 읽은 값을 쿼리에 남기고, 실패하면 마지막 성공값을 내며, 0 을 `null` 로 접지 않는지 |
| `features/enhancement-history/__tests__/event-world-names.spec.ts` | 결정 11: 배열로 들어 JSON 왕복 뒤에도 값이 남는지, 없음과 빈 집합이 다른지 |
| `features/enhancement-history/__tests__/collect.spec.ts` | 결정 11: 목록을 `fetchCharacterListCached` 로 받아 이름을 남기고, 못 받으면 날짜를 굳히지 않는지 |
| `features/query/__tests__/persist.spec.ts` | 결정 2 · 11: 옵저버 없이 `setQueryData` 로 넣은 두 쿼리가 저장 대상인지 |
| `storage/__tests__/legacy-cleanup.spec.ts` | 결정 12: 심기 → 지우기 → 표식 순서, 표식이 있으면 아무것도 안 하는지, 심기가 던지면 표식을 안 두는지, 지우는 목록 밖의 키가 남는지 |

## 번호 기록

- ADR-142 (2026-10-30): 처음 작성. 데이터를 드는 자리와 다시 받는 규칙을 쿼리 캐시 하나로 모은다(이슈 #812). 같은 날 1 · 2단계를, 이튿날 3단계를 구현했다
- ADR-144 (2026-10-31): 프로필 조회의 옛 키 폴백을 되살리고(결정 10), 넥슨 응답 캐시 둘을 쿼리로 옮기고(결정 11), 옛 키 정리를 한 자리로 모으고(결정 12), 복귀 신호를 하나로 줄였다(결정 5)(#819)
