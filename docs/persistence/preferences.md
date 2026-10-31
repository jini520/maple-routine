# Preferences

키 하나에 문자열 하나를 저장하는 저장소다. iOS 는 `UserDefaults`, Android 는 SharedPreferences 이고 암호화하지
않는다. 구조가 있는 값은 저장하는 쪽이 `JSON.stringify` 해서 넣는다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `storage/keys.ts` | 키 이름 전부. 고정 키는 `STORAGE_KEYS`, 캐릭터 · 계정 · 월드마다 달라지는 키는 함수 |
| `storage/ports.ts` | `PreferencesPort`(`get` · `set` · `remove` · `keys`)와 호출용 `preferences` |
| `storage/adapters/rn-preferences.ts` | 포트 구현. 로컬 모듈 `modules/capacitor-storage` 를 부른다 |
| `storage/adapters/capacitor-storage-keys.ts` | iOS 키 접두사 규칙(`capacitor-storage.md`) |
| `storage/cache-data.ts` | 데이터 삭제가 그룹마다 지우는 키 목록 |
| `storage/*.ts` | 키마다 읽고 쓰는 어댑터 |

`keys()` 는 빠지면 안 된다. 데이터 삭제가 `수동 선택 항목` · `캐시` 의 접두사 키(`manualTrackedContent:*` · `schedulerCache:*` 등)를 찾고 옛 키 정리가 `mesoRateCache:*` 를 찾으려고 이 목록을 훑는다.

## 데이터 삭제와 새 키

데이터 삭제는 그룹마다 적은 키만 지우고, 목록에 없는 키는 어떤 선택에서도 남긴다(`lifecycle.md`). 그래서 새 키는
따로 넣지 않으면 남는다. 사용자가 데이터 삭제 화면에서 지울 수 있어야 하는 기록이면 키를 만들 때 그 그룹의 목록에도
넣는다.

## 고정 키

`데이터 삭제` 칸은 데이터 삭제가 그 키를 지우는지다. `지운다` 뒤의 괄호는 그 키를 지우는 그룹이다.

| 키 | 값 | 어댑터 | 데이터 삭제 | 메모 |
|---|---|---|---|---|
| `authMethods` | JSON. 넥슨 로그인 0 ~ 1개 + 이름 붙은 API 키 목록. 수단마다 `type`(`login` · `key`)과 넥슨 계정 id(`id`, uuid)를 든다 | `api-key.ts` | 남긴다 | 저장된 인증 수단 전부. `kind` 와 id 가 없는 옛 칸은 읽을 때 id 를 붙여 한 번 다시 적는다([[ADR-098]] 결정 5 · 7) |
| `apiKey` | 문자열 | `api-key.ts` | 남긴다 | 옛 설치본의 API 키 하나. `authMethods` 가 없을 때만 읽어 목록에 넣고, 읽은 뒤에도 지우지 않는다. 지우는 곳은 연결 해제뿐이다 |
| `selectedAccountId` | 문자열 | `api-key.ts` | 남긴다 | 옛 키. 아무도 쓰지 않고, 연결 해제가 지운다 |
| `theme` | 테마 이름(`job-themes.json` 의 키) | `theme.ts` | 남긴다 | |
| `trackingMode` | `'auto'` · `'manual'` | `tracking-mode.ts` | 남긴다 | 없으면 `null`(아직 안 골랐다) |
| `dropEffect` | `'on'` · `'off'` | `drop-effect.ts` | 남긴다 | 없으면 켜짐 |
| `noticeSubscribed` | `'on'` · `'off'` | `notice-settings.ts` | 남긴다 | 토글이 하나이던 때의 공지 구독. `noticeSubscriptions` 가 없을 때 `app` 값으로 물려받는다 |
| `noticeSubscriptions` | JSON `{ app, game, updateEvent, cashshop }` | `notice-settings.ts` | 남긴다 | 공지 토픽 구독 넷. 지워지면 FCM 구독은 남았는데 스위치는 꺼진 상태가 된다 |
| `notificationPermissionAsked` | `'yes'` | `notice-settings.ts` | 남긴다 | 알림 권한을 물어본 적 있는지. OS 상태로는 알 수 없다 |
| `partyAlarmEnabled` | `'on'` · `'off'` | `party-appointment-settings.ts` | 남긴다 | 파티 약속 알림 스위치. 없으면 켜짐 |
| `partyAppointments` | JSON `PartyAppointment[]` | `party-appointments.ts` | 남긴다 | 사용자가 적은 파티 약속. `id` 는 uuid 이고, 옛 `시각 + 난수` id 는 읽을 때 uuid 로 바꿔 다시 저장한다([[ADR-098]] 결정 4) |
| `serverBackfill` | JSON. 종류(`dropPrice`)마다 마지막으로 보낸 기록 id 와 끝났는지. 옛 앱이 적은 다른 종류의 값은 읽지 않는다 | `server-backfill.ts` | 남긴다 | 업데이트 전 드롭을 서버로 어디까지 올렸나([[ADR-099]] 결정 3) |
| `legacyCleanupDone` | `'1'` | `legacy-cleanup.ts` | 남긴다 | 옛 키 정리가 끝났다는 표식. 있으면 부팅이 정리를 건너뛴다([[ADR-142]] 결정 12) |
| `enhancementTotalsMoved` | `'1'` | `enhancement-totals-moved.ts` | 남긴다 | 옛 강화 원본(`enhancement_history`)을 합계로 옮겼는지. 지워지면 다시 옮기며 업데이트 뒤 새로 받은 날의 합계를 옛 원본으로 덮는다([[ADR-100]] 결정 3) |
| `appReview` | JSON `{ firstLaunchAt, saveCount, lastRequestedAt }`. 시각은 ISO, `lastRequestedAt` 은 요청 전이면 `null` | `app-review.ts` | 남긴다 | 앱 안 리뷰 요청의 기록([[ADR-052]] 결정 10). 지워지면 90일 간격을 처음부터 다시 센다 |
| `partyScheduleView` | `'list'` · `'board'` | `party-schedule-view.ts` | 남긴다 | 파티 스케줄 화면에서 마지막으로 고른 보기. 없으면 목록 |
| `bossProfitCalculatorRecords` | JSON `BossProfitCalculatorRecord[]` | `boss-profit-calculator-records.ts` | 남긴다 | 주간 보스 수익 계산기에서 저장한 기록. 금액 없이 보스 · 난이도 · 파티 값만 남긴다 |
| `notificationLedger` | JSON `{ id, kind, fireAt, title, body }[]` | `notification-ledger.ts` | 남긴다 | 지금 예약해 둔 로컬 알림. OS 의 예약 목록은 읽을 수 없어서 따로 적는다 |
| `notices` | JSON `Notice[]` | `legacy-cleanup.ts` | 켤 때 지운다 | 1.0.12 까지의 키. 공지는 이제 쿼리 `notices(kind)` 가 SQLite `query_cache` 에 든다([[ADR-142]] 결정 7). 안 읽고 옛 키 정리가 지운다([[ADR-142]] 결정 12) |
| `dismissedNotices` | JSON 공지 id 배열(최근 50) | `notice-banner.ts` | 남긴다 | today 배너에서 닫은 공지. 닫았다는 사실은 기기에만 있다 |
| `dismissedSettlement` | ISO 시각 | `settlement-banner.ts` | 남긴다 | 닫은 결산 안내의 시작 시각. 다음 결산은 시각이 달라 다시 보인다 |
| `dismissedManualCompletion` | 주간 기간 키(목요일 `YYYY-MM-DD`) | `manual-completion-banner.ts` | 남긴다 | 닫은 직접 완료 안내의 주 |
| `statsCumulativeStart` | KST `YYYY-MM-DD` | `stats-cumulative-start.ts` | 남긴다 | 통계 누적 순수익의 시작 날짜 |
| `mvpWeeklyCheckOff` | `'true'`(끄면 키를 지운다) | `mvp-grade-prefs.ts` | 남긴다 | 등급 주간 확인을 끈 체크박스 |
| `mvpLastCheckedWeek` | 주간 기간 키 | `mvp-grade-prefs.ts` | 남긴다 | 마지막으로 등급을 확인한 주 |
| `mvpBulkApplyAsked` | `'true'` | `mvp-grade-prefs.ts` | 남긴다 | 지난 기록 일괄 적용을 물어봤는지 |
| `mvpOnboardingPending` | `'true'` | `mvp-grade-prefs.ts` | 남긴다 | 온보딩의 MVP 등급 화면에 들어갔다는 표시. 시작하기를 마치면 지운다 |
| `pendingTasks` | JSON `PendingTask[]` | `pending-tasks.ts` | 남긴다 | 끝나지 않은 기록 다시 쓰기 작업([[ADR-023]]) |
| `keyboardHeight` | 숫자 문자열(px) | `keyboard-height.ts` | 남긴다 | 이 기기의 OS 키보드 높이 |
| `mesoUnits` | JSON `{ [unitKey]: 'base' \| 'man' \| 'eok' }` | `meso-unit.ts` | 남긴다 | 금액 칸마다 마지막으로 고른 단위([[ADR-082]] 결정 13). 모르는 칸 · 값은 `기본` 으로 읽는다 |
| `lastPointRate` | 숫자 문자열 | `last-point-rate.ts` | 지운다 (수동 선택 항목) | 마지막으로 넣은 메이플 포인트 시세(1억 메소당) |
| `lastHunts` | JSON `{ [ocid]: { groundKey, boosts, unionTier? } }` | `last-hunts.ts` | 지운다 (수동 선택 항목) | 캐릭터마다 마지막 사냥 |
| `lastHuntSelection` · `lastHuntToggles` | JSON | `last-hunts.ts` | 지운다 (수동 선택 항목) | 옛 키. `lastHunts` 가 없을 때 한 번 읽어 옮기고 지운다 |
| `eventWorldNames` | JSON 이름 배열 | `legacy-cleanup.ts` | 지운다 (캐시) | 1.0.12 까지의 이벤트 월드 캐릭터 이름. 첫 실행이 쿼리 `eventWorldNames()` 로 옮긴 뒤 지운다([[ADR-142]] 결정 11) |
| `lastRunBundleVersion` | 버전 문자열 | `last-run-bundle-version.ts` | 남긴다 | 마지막으로 실행한 OTA 번들 버전. 방금 업데이트했는지 판단한다 |
| `pendingNotice` | `'cacheClearFailed'` | `pending-notice.ts` | 남긴다 | 데이터 삭제가 실패했다는 표시. 삭제가 끝난 뒤에 쓰고, 다시 띄운 앱이 읽으면서 지운다([[ADR-053]] 결정 5) |
| `queryCache` · `bossCatalog` | JSON | `legacy-cleanup.ts` | 남긴다 | 1.0.13 전 게임 데이터 사본의 옛 키. 읽지 않고 옛 키 정리가 지운다([[ADR-142]] 결정 12). 사본은 이제 SQLite 에 있다([[ADR-020]] 결정 3) |

## 캐릭터 · 계정 · 월드마다 달라지는 키

`manualTrackedContent:*` · `worldSharedProgress:*` · `accountSharedProgress:*` 는 데이터 삭제의 `수동 선택 항목` 이 지운다.
`schedulerCache:*` · `characterBasicCache:*` · `mesoRateCache:*` 는 `캐시` 가 지운다. 나머지는 데이터 삭제가 남긴다. 조회 원장은 지우면 다시
띄우자마자 넥슨 API 를 한꺼번에 불러 호출 한도에 걸릴 수 있기 때문이다. 추적 캐릭터가 없으면 캐릭터 고르기부터 다시 해야 한다.

| 키 | 값 | 어댑터 | 메모 |
|---|---|---|---|
| `schedulerCache:{ocid}` | JSON `{ state, syncedAt, version: 4 }` | `scheduler-cache.ts` | 1.0.12 까지의 스케줄 캐시. 업데이트 뒤 첫 실행이 추적 캐릭터 중 쿼리 캐시 `schedule(ocid)` 에 없는 것만 옮긴 뒤 지운다(`seedScheduleQueriesFromLegacyCache`, [[ADR-142]] 결정 7). `version` 이 다르면 옮기지 않는다. 추적하지 않는 캐릭터의 키는 `캐시` 가 지울 때까지 남는다 |
| `characterBasicCache:{ocid}` | JSON `{ profile, cachedAt }` | `character-basic-cache.ts` | 1.0.12 까지의 기본 정보 캐시. 위와 같이 쿼리 캐시 `characterBasic(ocid)` 로 옮긴 뒤 지운다. 남은 키는 프로필 조회의 마지막 폴백이고, 조회가 표에 심은 뒤 지운다([[ADR-142]] 결정 10) |
| `characterBasicCache:index:{accountId}` · `characterBasicCache:index` | JSON ocid 배열 | `legacy-cleanup.ts` | 1.0.12 까지의 계정별 인덱스와 그 전의 전역 인덱스. 옮기지 않고 옛 키 정리가 지운다. 캐릭터 관리의 첫 후보 목록은 쿼리 캐시에 든 `characterBasic` 을 계정 소속 기록으로 걸러 센다 |
| `scheduleProbe:{ocid}` | JSON `{ unavailable?, dates, version: 2 }` | `schedule-probe-ledger.ts` | 캐릭터 · 날짜별 조회 기록. 조회할 수 없는 캐릭터 표시(`unavailable`)도 여기 있다 |
| `mesoRateCache:{ocid}` | 숫자 문자열(%) | `legacy-cleanup.ts` | 1.0.12 까지의 메소 획득량 마지막 성공값. 첫 실행이 쿼리 `mesoRate(ocid)` 로 옮긴 뒤 지운다([[ADR-142]] 결정 11) |
| `trackedCharacters` | JSON ocid 배열 | `character-selection.ts` | 추적 캐릭터. 배열 순서가 표시 순서다. `null`(설정 전)과 `[]`(모두 해제)은 다르다 |
| `lastSelectedCharacter` | ocid | `character-selection.ts` | 드롭다운에서 마지막으로 고른 캐릭터 |
| `representativeCharacter` | ocid | `character-selection.ts` | 사용자가 고른 대표 캐릭터. 고르지 않았으면 키가 없다 |
| `trackedCharacters:content` · `:boss` · `:daily` · `:weekly` · `lastSelectedCharacter:content` · `:boss` | | `character-selection.ts` | 옛 키. `trackedCharacters` 가 없을 때 합쳐 옮기고 지운다 |
| `manualTrackedContent:{ocid}` | JSON `ManualTrackedItem[]` | `manual-tracked-content.ts` | 수동 모드에서 그 캐릭터가 추적할 항목 |
| `worldSharedProgress:{worldKey}` | JSON `{ [contentKey]: SharedProgressEntry }` | `shared-progress-cache.ts` | 월드 단위로 완료가 공유되는 컨텐츠의 진행. 월드 이름을 쓰던 옛 키는 읽거나 쓸 때 옮기고 지운다 |
| `accountSharedProgress:{accountId}` | JSON `{ [contentKey]: SharedProgressEntry }` | `shared-progress-cache.ts` | 계정 단위로 공유되는 컨텐츠의 진행. `accountId` 는 그 캐릭터가 속한 계정이다 |
