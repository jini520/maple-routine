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
| `storage/legacy-cleanup.ts` | 부팅 때 옛 키를 한 번 지우는 정리와 옛 값 읽기([[ADR-142]] 결정 12) |
| `storage/*.ts` | 키마다 읽고 쓰는 어댑터 |
| `storage/preferences-conversion.ts` | 1.0.15 기기 변환의 Preferences 단계. 기록 키의 옛 모양을 서버 칸 이름 · 줄 id 로 한 번 옮긴다([[ADR-286]] 결정 7) |
| `storage/record-hold.ts` | 기기 변환이 끝날 때까지 기록 접근을 막는 약속. 기록 키의 어댑터가 기다린다 |

`keys()` 는 빠지면 안 된다. 데이터 삭제가 `수동 선택 항목` · `캐시` 의 접두사 키(`manualTrackedContent:*` · `schedulerCache:*` 등)를 찾고 옛 키 정리가 `mesoRateCache:*` 를 찾으려고 이 목록을 훑는다.

## 기록 키와 기기 변환

사용자가 적은 기록 키(수동 추적 항목 · 공유 진행 · 파티 약속 · 계산기 기록 · 빠른 이동 · 하단바 순서 · 대표 캐릭터 동작 · 추적 방식 ·
통계 누적 시작 · MVP 등급 확인 셋)는 JSON 안의 칸 이름과 값을 서버 칸과 같게 적는다([[ADR-099]] 결정 57). 어댑터가 그 모양과
화면이 드는 모양(key · 지금 칸 이름) 사이를 바꾼다. 1.0.15 전의 모양은 기기 변환이 한 번 옮기고, 옮긴 판을 `preferencesConversion`
에 적는다. 하단바 순서를 뺀 기록 키의 어댑터는 기기 변환이 끝나기를 기다린다. 옛 모양을 새 코드로 읽고 다시 적으면 읽지 못한
항목이 사라지기 때문이다. 하단바 순서는 셸이 변환보다 먼저 읽어서 두 모양을 다 읽는다([[ADR-286]] 결정 1).

## 서버로 올리는 기록 키

서버로 올리는 기록 키(약속 · 계산기 기록 · 수동 추적 항목 · 공유 진행 · 메이플 ID 이름 · 추적 목록과 대표 · 대표 캐릭터 동작 · 설정 일곱 키)는
저장 함수가 앞 값과 새 값을 견주어 바뀐 항목을 SQLite 대기 표 `server_sync_queue` 에 넣는다([[ADR-099]] 결정 8 · 15 · 67). 목록을
통째로 저장하는 함수가 많아, 견주지 않으면 지운 항목을 알 수 없다. 넣는 함수는 `storage/server-sync-queue.ts` 의
`enqueueChangedPreferenceRecords` 이고, 항목을 가리키는 값은 `foundation/server-sync.md` 의 `대기 표에 넣기` 에 있다.

| 키 | 서버 표 | 항목 |
|---|---|---|
| `partyAppointments` | `partyAppointments` | 약속 하나. uuid 인 id 만 넣는다. 옛 설치본의 id 는 읽을 때 uuid 로 바뀐다 |
| `bossProfitCalculatorRecords` | `bossProfitCalculatorRecords` | 기록 하나 |
| `manualTrackedContent:{ocid}` | `manualTrackedItems` | 캐릭터 · 종류 · 대상 하나 |
| `worldSharedProgress:*` · `accountSharedProgress:*` | `sharedContentProgress` | 메이플 ID · 월드 · 컨텐츠 하나. 계정 공유는 월드가 빈 값이다 |
| `mapleIdNames` | `mapleIdNames` | 메이플 ID 하나 |
| `trackedCharacters` · `representativeCharacter` | `trackedCharacters` | 캐릭터 하나. 차례와 대표 표시가 바뀐 캐릭터를 넣는다 |
| `figureMotions` | `representativeCharacterMotions` | 캐릭터 하나 |
| `trackingType` · `quickLinks` · `statsCumulativeStartDate` · `isMvpWeeklyCheckOff` · `mvpLastCheckedWeekCode` · `isMvpBulkApplyAsked` | `accountSettings` | 서버 칸 하나. `quickLinks` 는 줄 수와 화면 목록 두 칸이다 |
| `barOrder` | `accountSettings` · `bottomBarSubPageOrders` | 그룹 목록 칸 하나와 하위 페이지 차례의 그룹 하나 |

- 로그인할 때 추적 목록과 대표를 비우는 일(`clearTrackedCharacterOcids`)은 넣지 않는다. 넣으면 새 기기의 로그인이 서버의 추적 목록을
  지운다. 대표는 추적 목록 안의 표시라, 목록을 먼저 비운 뒤의 대표 지우기는 바뀐 항목이 없다.
- 동기화의 받기는 저장 함수를 거치지 않고 키에 바로 적는다(`storage/server-sync-pull-preferences.ts`). 받은 값을 대기 표에 넣지
  않으려는 것이다. 다른 기기의 캐릭터와 메이플 ID 가 이 기기의 `character_accounts` 에 없으면 원문 대신 `#` 를 붙인 해시를 적는다
  (`manualTrackedContent:#…` · `accountSharedProgress:#…` 의 키, 약속 · 계산기 기록의 `ocid`, `mapleIdNames` · `figureMotions` 의 열쇠).
  추적 목록과 대표에는 적지 않는다. 짝이 생기면 받기가 원문으로 바꾼다(`storage/server-sync-unmatched.ts`, [[ADR-099]] 결정 15 · 67).
- 기기 변환(`preferences-conversion.ts`)과 옛 키 합치기는 Preferences 를 직접 써서 넣지 않는다. 변환 전 기록은 처음 동기화가
  넣는다(`storage/server-sync-first.ts`). 항목마다 저장 함수와 같은 대기 줄 id 를 짓는 함수가 어댑터에 함께 있다. 설정은 키에 값이
  적힌 칸만 넣는다. 고른 적이 없는 칸을 기본값으로 올리면 다른 기기가 고른 값을 덮는다.
- `server_sync_pause` 에 줄이 있는 동안은 넣지 않는다. 받은 값을 저장하는 동안이다.
- 대기 줄이 이미 있는 항목이 또 바뀌면 그 줄의 넣은 시각만 지금으로 고친다. 처음 올리기의 줄을 사용자가 고친 뒤에도 처음 동기화의
  받기가 서버 값으로 덮지 않게 하려는 것이다(`foundation/server-sync.md` 의 `처음 동기화`).

## 데이터 삭제와 새 키

데이터 삭제는 그룹마다 적은 키만 지우고, 목록에 없는 키는 어떤 선택에서도 남긴다(`lifecycle.md`). 그래서 새 키는
따로 넣지 않으면 남는다. 사용자가 데이터 삭제 화면에서 지울 수 있어야 하는 기록이면 키를 만들 때 그 그룹의 목록에도
넣는다.

## 고정 키

`데이터 삭제` 칸은 데이터 삭제가 그 키를 지우는지다. `지운다` 뒤의 괄호는 그 키를 지우는 그룹이다.

| 키 | 값 | 어댑터 | 데이터 삭제 | 메모 |
|---|---|---|---|---|
| `authMethods` | JSON. 넥슨 로그인 0 ~ 1개 + 이름 붙은 API 키 목록. 수단마다 `type`(`login` · `key`)과 넥슨 계정 id(`id`, uuid)를 든다 | `api-key.ts` | 남긴다 | 저장된 인증 수단 전부. `kind` 와 id 가 없는 옛 칸은 읽을 때 id 를 붙여 한 번 다시 적는다([[ADR-098]] 결정 5 · 7) |
| `apiKey` | 문자열 | `api-key.ts` | 남긴다 | 옛 설치본의 API 키 하나. `authMethods` 가 없을 때만 읽어 목록에 넣고, 읽은 뒤에도 지우지 않는다. 지우는 곳은 로그아웃뿐이다 |
| `selectedAccountId` | 문자열 | `api-key.ts` | 남긴다 | 옛 키. 아무도 쓰지 않고, 로그아웃이 지운다 |
| `theme` | 테마 이름(`job-themes.json` 의 키) | `theme.ts` | 남긴다 | |
| `textSize` | `'small'` · `'default'` · `'large'` · `'xlarge'` | `text-size.ts` | 남긴다 | 없거나 모르는 값이면 `기본` |
| `mapleIdNames` | JSON `{ [메이플 ID]: 이름 }`. 깨진 값은 빈 값으로 읽는다 | `maple-id-names.ts` | 남긴다 | 사용자가 바꾼 메이플 ID 이름만 든다. 없는 ID 는 기본 이름(`메이플ID-` 와 ID 앞 8자)이다([[ADR-101]] 결정 8) |
| `todaySharedMapleId` | 메이플 ID 글자 | `today-shared-maple-id.ts` | 남긴다 | today 공유 컨텐츠 위젯에서 마지막에 고른 메이플 ID. 고를 목록에 없으면 첫 메이플 ID 를 보인다([[ADR-101]] 결정 9) |
| `quickLinks` | JSON `{ rowCount, keys }`. `rowCount` 는 1 · 2, `keys` 는 위젯에 놓이는 화면 이름의 차례 그대로 | `quick-links.ts` | 남긴다 | today 빠른 이동의 구성. 깨졌으면 기본 구성이다 |
| `figureMotions` | JSON `{ [ocid]: { actions, emotions, durationMs, restsBetweenActions } }`. 행동은 `A00`~`A41` 3개까지, 표정은 깜빡임(`E06`)을 뺀 `E00`~`E24` 5개까지 | `figure-motions.ts` | 남긴다 | today 대표 캐릭터가 할 행동 · 표정. 모르는 값은 버리고, 행동이나 표정이 안 남는 캐릭터 몫은 고르지 않은 것으로 본다([[ADR-147]] 결정 9) |
| `barOrder` | JSON `{ groupKeys, subPageKeys }`. 그룹 다섯과, 하위가 있는 그룹마다 하위 페이지의 차례 | `bar-order.ts` | 남긴다 | 하단바 순서. 읽을 때 표에 맞추고, 깨졌으면 기본 순서다([[ADR-152]] 결정 5). 기기 변환 전의 `{ groups, subs }` 도 읽는다 |
| `trackingType` | `'auto'` · `'manual'` | `tracking-mode.ts` | 남긴다 | 없으면 `null`(아직 안 골랐다) |
| `dropEffect` | `'on'` · `'off'` | `drop-effect.ts` | 남긴다 | 없으면 켜짐 |
| `overFrame` | `'on'` · `'off'` | `over-frame.ts` | 남긴다 | 오버 프레임. 없으면 켜짐([[ADR-219]] 결정 13) |
| `noticeSubscribed` | `'on'` · `'off'` | `notice-settings.ts` | 남긴다 | 토글이 하나이던 때의 공지 구독. `noticeSubscriptions` 가 없을 때 `app` 값으로 물려받는다 |
| `noticeSubscriptions` | JSON `{ app, game, updateEvent, cashshop }` | `notice-settings.ts` | 남긴다 | 공지 토픽 구독 넷. 지워지면 FCM 구독은 남았는데 스위치는 꺼진 상태가 된다 |
| `notificationPermissionAsked` | `'yes'` | `notice-settings.ts` | 남긴다 | 알림 권한을 물어본 적 있는지. OS 상태로는 알 수 없다 |
| `partyAlarmEnabled` | `'on'` · `'off'` | `party-appointment-settings.ts` | 남긴다 | 파티 약속 알림 스위치. 없으면 켜짐 |
| `scheduleAlertEnabled` | `'on'` · `'off'` | `schedule-alert-settings.ts` | 남긴다 | 미완료 스케줄 알림 스위치. 없으면 켜짐 |
| `partyAppointments` | JSON 약속 배열. 칸은 서버 `party_appointments` 와 같고(`time` · `alarmMinutesBefore` · `schedule.date` · `fromWeekCode` · `untilWeekCode`), 주는 주차 값, 보스 판은 `{ bossDifficultyId, ocid }` 다 | `party-appointments.ts` | 남긴다 | 사용자가 적은 파티 약속([[ADR-051]] 결정 12). `id` 는 uuid 이고, 옛 `시각 + 난수` id 는 읽을 때 uuid 로 바꿔 다시 저장한다([[ADR-098]] 결정 4) |
| `serverAccounts` | JSON `{ reported: { [넥슨 계정 id]: 메이플 ID 해시[] }, registered: '로그인 계정 id:키 해시'[] }`. 깨진 값은 빈 값으로 읽는다 | `server-accounts.ts` | 남긴다 | 서버가 메인 계정에 마지막으로 돌려준 메이플 ID 와, 서버에 등록한 부계정 키. 이미 아는 것은 다시 보내지 않는다. 부계정을 지우면 서버가 해제를 받은 뒤 그 키의 값을 뺀다([[ADR-101]] 결정 14 · 25) |
| `serverSyncCursors` | JSON `{ nexonAccount: { id, changeSeq } \| null, mapleIds: { [메이플 ID 해시]: changeSeq } }`. 깨진 값은 빈 번호로 읽는다 | `server-sync-cursors.ts` | 남긴다 | 동기화의 받기가 주인마다 마지막으로 받은 변경 번호. 받은 줄을 다 넣은 뒤 응답의 번호로 갈아 끼운다. 메이플 ID 열쇠는 앞 받기의 메이플 ID 목록이라, 다른 기기가 부계정을 해제했는지 견주는 데도 쓴다. 지워지면 처음부터 다시 받고, 같은 줄을 다시 넣어도 한 번 넣은 것과 같다([[ADR-099]] 결정 9 · 67) |
| `serverSyncSignIn` | JSON `{ previousMapleIds: 메이플 ID 해시[] }`. 깨진 값은 표시가 없는 것으로 읽는다 | `server-sync-cursors.ts` | 남긴다 | 로그인 화면의 로그인과 메인 키 바꾸기가 저장한 뒤 적는다. 있으면 다음 받기의 첫 응답이 그 목록에 없는 메이플 ID 의 기록을 비우고, 앞 계정의 메이플 ID 와 하나도 겹치지 않으면 사람의 기록도 비운 뒤 지운다([[ADR-099]] 결정 14 · 67) |
| `serverSyncSkippedMapleIds` | JSON `{ [메이플 ID 해시]: 'unknown' \| 'discarded' }`. 깨진 값은 빈 목록으로 읽는다 | `server-sync-skipped.ts` | 남긴다 | 받기가 줄을 넣지 않고 건너뛰는 메이플 ID. `unknown` 은 이 기기가 모르는 메이플 ID(새 기기의 키 없는 부계정)이고 알게 되면 번호를 0 으로 적고 뺀다. `discarded` 는 흐린 기록의 `기록 삭제` 로 이 기기에서 지운 메이플 ID 이고 그 계정에 쓸 수 있는 키가 생기면 번호를 0 으로 적고 뺀다. 그 메이플 ID 를 비우면 함께 뺀다([[ADR-099]] 결정 68) |
| `serverSyncUnmatchedCleared` | `'1'` | `server-sync-skipped.ts` | 남긴다 | 메이플 ID 를 모르고 `#` 로 넣은 옛 기록을 한 번 비우고 메이플 ID 번호를 0 으로 적었다는 표시. 있으면 다시 비우지 않는다([[ADR-099]] 결정 68) |
| `firstServerSync` | JSON `{ queuedAt, pulled }`. `queuedAt` 은 ISO 시각, `pulled` 는 참 거짓. 깨진 값은 처음 동기화를 마친 것으로 읽는다 | `server-sync-first.ts` | 남긴다 | 처음 동기화가 기기의 기록을 모두 대기 표에 넣은 시각과 그 뒤 받기를 끝냈는지. 있으면 다시 넣지 않는다. 다시 넣으면 받은 기록까지 서버로 되돌아간다. `queuedAt` 까지 대기 표에 들어간 줄이 처음 올리기다([[ADR-099]] 결정 13 · 67) |
| `legacyCleanupDone` | `'1'` | `legacy-cleanup.ts` | 남긴다 | 옛 키 정리가 끝났다는 표식. 있으면 부팅이 정리를 건너뛴다([[ADR-142]] 결정 12) |
| `enhancementTotalsMoved` | `'1'` | `enhancement-totals-moved.ts` | 남긴다 | 옛 강화 원본(`enhancement_history`)을 합계로 옮겼는지. 옮기면 원본 표를 지운다([[ADR-100]] 결정 3) |
| `legacySpaceReclaimed` | `'1'` | `legacy-space.ts` | 남긴다 | 옛 표를 다 지운 뒤 사본 파일을 지우고 `VACUUM` 했다는 표식. 있으면 다시 돌지 않는다([[ADR-078]] 결정 11) |
| `worldSharedProgressSplit` | ISO 시각 | `preferences-conversion.ts` | 남긴다 | 월드로만 묶던 옛 월드 공유 원장을 메이플 ID 마다 나눴는지. 나누기는 한 번만 돈다([[ADR-101]] 결정 23) |
| `preferencesConversion` | 판 번호 문자열(`'1'`) | `preferences-conversion.ts` | 남긴다 | 1.0.15 기기 변환이 기록 키를 새 모양으로 바꾼 판. 지워져도 변환이 이미 바꾼 키를 건너뛰어 결과가 같다([[ADR-286]] 결정 1) |
| `appReview` | JSON `{ firstLaunchAt, saveCount, lastRequestedAt }`. 시각은 ISO, `lastRequestedAt` 은 요청 전이면 `null` | `app-review.ts` | 남긴다 | 앱 안 리뷰 요청의 기록([[ADR-052]] 결정 10). 지워지면 90일 간격을 처음부터 다시 센다 |
| `partyScheduleView` | `'list'` · `'board'` | `party-schedule-view.ts` | 남긴다 | 파티 스케줄 화면에서 마지막으로 고른 보기. 없으면 목록 |
| `bossProfitCalculatorRecords` | JSON 기록 배열. 보스는 `{ bossDifficultyId, splitType, partySize, splitShareMillipercent, splitFeePercent, splitFeeFollowsMvpGrade }` | `boss-profit-calculator-records.ts` | 남긴다 | 주간 보스 수익 계산기에서 저장한 기록. 금액 없이 보스 · 난이도 · 파티 값만 남긴다([[ADR-074]] 결정 13) |
| `notificationLedger` | JSON `{ id, kind, fireAt, title, body }[]` | `notification-ledger.ts` | 남긴다 | 지금 예약해 둔 로컬 알림. OS 의 예약 목록은 읽을 수 없어서 따로 적는다 |
| `notices` | JSON `Notice[]` | `legacy-cleanup.ts` | 켤 때 지운다 | 1.0.12 까지의 키. 공지는 이제 쿼리 `notices(kind)` 가 SQLite `query_cache` 에 든다([[ADR-142]] 결정 7). 안 읽고 옛 키 정리가 지운다([[ADR-142]] 결정 12) |
| `dismissedNotices` | JSON 공지 id 배열(최근 50) | `notice-banner.ts` | 남긴다 | today 배너에서 닫은 공지. 닫았다는 사실은 기기에만 있다 |
| `dismissedSettlement` | ISO 시각 | `settlement-banner.ts` | 남긴다 | 닫은 결산 안내의 시작 시각. 다음 결산은 시각이 달라 다시 보인다 |
| `dismissedManualCompletion` | 주간 기간 키(목요일 `YYYY-MM-DD`) | `manual-completion-banner.ts` | 남긴다 | 닫은 직접 완료 안내의 주 |
| `statsCumulativeStartDate` | KST `YYYY-MM-DD` | `stats-cumulative-start.ts` | 남긴다 | 통계 누적 순수익의 시작 날짜 |
| `isMvpWeeklyCheckOff` | `'true'`(끄면 키를 지운다) | `mvp-grade-prefs.ts` | 남긴다 | 등급 주간 확인을 끈 체크박스 |
| `mvpLastCheckedWeekCode` | 주차 값(`W202647`) | `mvp-grade-prefs.ts` | 남긴다 | 마지막으로 등급을 확인한 주 |
| `isMvpBulkApplyAsked` | `'true'` | `mvp-grade-prefs.ts` | 남긴다 | 지난 기록 일괄 적용을 물어봤는지 |
| `mvpOnboardingPending` | `'true'` | `mvp-grade-prefs.ts` | 남긴다 | 온보딩의 MVP 등급 화면에 들어갔다는 표시. 시작하기를 마치면 지운다 |
| `pendingTasks` | JSON `PendingTask[]` | `pending-tasks.ts` | 남긴다 | 끝나지 않은 기록 다시 쓰기 작업([[ADR-023]]) |
| `keyboardHeight` | 숫자 문자열(px) | `keyboard-height.ts` | 남긴다 | 이 기기의 OS 키보드 높이 |
| `mesoUnits` | JSON `{ [unitKey]: 'base' \| 'man' \| 'eok' }` | `meso-unit.ts` | 남긴다 | 금액 칸마다 마지막으로 고른 단위([[ADR-082]] 결정 13). 모르는 칸 · 값은 `기본` 으로 읽는다 |
| `lastPointRate` | 숫자 문자열 | `last-point-rate.ts` | 지운다 (수동 선택 항목) | 마지막으로 넣은 메이플 포인트 시세(1억 메소당) |
| `lastHunts` | JSON `{ [ocid]: { groundKey, boosts, unionTier? } }` | `last-hunts.ts` | 지운다 (수동 선택 항목) | 캐릭터마다 마지막 사냥 |
| `hexaStorageChecks` | JSON `{ useStorage, storageAsSpend }` | `hexa-storage-checks.ts` | 지운다 (수동 선택 항목) | 헥사 폼의 두 체크. 새 헥사 기록을 저장할 때만 적는다 |
| `lastBossIncomeTransfers` | JSON `{ [보내는 ocid]: { receiverOcid, feeAuto, feePercent, fillsWeek } }` | `last-boss-income-transfers.ts` | 지운다 (수동 선택 항목) | 보내는 캐릭터마다 마지막 `주간 보스 수입 이전` 의 받는 캐릭터 · 수수료 · 체크. 새 기록을 저장할 때만 적는다([[ADR-047]] 결정 19) |
| `lastEpicDungeonRewards` | JSON `{ [던전 타일 key]: { last, characters: { [ocid]: 형태별 항목 key }, accounts: { [메이플 ID]: 형태별 항목 key } } }` | `last-epic-dungeon-rewards.ts` | 지운다 (수동 선택 항목) | 던전마다 마지막에 적은 캐릭터나 메이플 ID(`last`)와 그 주인마다 고른 단계. 새 기록을 저장할 때만 적는다([[ADR-048]] 결정 13) |
| `lastHuntSelection` · `lastHuntToggles` | JSON | `last-hunts.ts` | 지운다 (수동 선택 항목) | 옛 키. `lastHunts` 가 없을 때 한 번 읽어 옮기고 지운다 |
| `eventWorldNames` | JSON 이름 배열 | `legacy-cleanup.ts` | 지운다 (캐시) | 1.0.12 까지의 이벤트 월드 캐릭터 이름. 첫 실행이 쿼리 `eventWorldNames()` 로 옮긴 뒤 지운다([[ADR-142]] 결정 11) |
| `lastRunBundleVersion` | 버전 문자열 | `last-run-bundle-version.ts` | 남긴다 | 마지막으로 실행한 OTA 번들 버전. 방금 업데이트했는지 판단한다 |
| `pendingNotice` | `'cacheClearFailed'` | `pending-notice.ts` | 남긴다 | 데이터 삭제가 실패했다는 표시. 삭제가 끝난 뒤에 쓰고, 다시 띄운 앱이 읽으면서 지운다([[ADR-053]] 결정 5) |
| `queryCache` · `bossCatalog` | JSON | `legacy-cleanup.ts` | 남긴다 | 1.0.13 전 게임 데이터 사본의 옛 키. 읽지 않고 옛 키 정리가 지운다([[ADR-142]] 결정 12). 사본은 이제 SQLite 에 있다([[ADR-020]] 결정 3) |

## 캐릭터 · 계정 · 월드마다 달라지는 키

`manualTrackedContent:*` · `worldSharedProgress:*` · `accountSharedProgress:*` 는 데이터 삭제의 `수동 선택 항목` 이 지운다.
`schedulerCache:*` · `characterBasicCache:*` · `mesoRateCache:*` 는 `캐시` 가 지운다. 나머지는 데이터 삭제가 남긴다. 조회 원장은 지우면 다시
띄우자마자 넥슨 API 를 한꺼번에 불러 호출 한도에 걸릴 수 있기 때문이다. 추적 캐릭터가 없으면 캐릭터 고르기부터 다시 해야 한다.

월드 리프를 이으면 `manualTrackedContent:{ocid}` 와 ocid 를 든 기록 키(`lastHunts` · `lastBossIncomeTransfers` · `lastEpicDungeonRewards` · `partyAppointments` ·
`bossProfitCalculatorRecords` · `figureMotions`)의 옛 ocid 를 새 ocid 로 옮긴다. 새 ocid 에 값이 있으면 새 것을 둔다([[ADR-101]] 결정 22).

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
| `manualTrackedContent:{ocid}` | JSON `{ type, targetId }[]`. `targetId` 는 일일 · 주간이면 컨텐츠 줄 id, 보스면 난이도 줄 id | `manual-tracked-content.ts` | 수동 모드에서 그 캐릭터가 추적할 항목([[ADR-034]] 결정 3) |
| `worldSharedProgress:{accountId}:{월드 줄 id}` | JSON `{ [컨텐츠 줄 id]: { isRegistered, nowCount, maxCount, questState, periodCode } }` | `shared-progress-cache.ts` | 월드 단위로 완료가 공유되는 컨텐츠의 진행. 같은 월드라도 메이플 ID 마다 따로다. 기간 값은 일일 `D20261119` · 주간 `W202647` 이다([[ADR-032]] 결정 9). 월드로만 묶던 옛 키(`worldSharedProgress:{worldKey}` · 월드 이름)는 추적 캐릭터가 있는 메이플 ID 마다 한 번 베끼고 지운다([[ADR-101]] 결정 23) |
| `accountSharedProgress:{accountId}` | JSON. 월드 원장과 같은 모양 | `shared-progress-cache.ts` | 계정 단위로 공유되는 컨텐츠의 진행. `accountId` 는 그 캐릭터가 속한 계정이다 |
