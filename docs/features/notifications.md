# 알림

기기에 뜨는 알림 두 가지를 다룬다. 기기가 정한 시각에 스스로 띄우는 로컬 알림과, 서버가 보내는 공지 푸시다.
로컬 알림은 파티 약속 알림과 미완료 스케줄 알림 둘이다. 왜 이렇게 만들었는지는 [[ADR-056]] 에 있다. 공지의 내용과
화면은 [notice.md](./notice.md) 에, 파티 약속 알림의 시각과 문구는 [[ADR-051]] 에, 미완료 스케줄 알림의 시각 · 문구 ·
백그라운드 태스크는 [[ADR-056]] 결정 15 ~ 20 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `index.ts` | 꺼진 앱을 깨우는 핸들러 셋(`setBackgroundMessageHandler` · `notifee.onBackgroundEvent` · `defineBackgroundRefreshTask`)을 최상위에서 등록 |
| `native/ports.ts` 의 `NotificationsPort` · `PushPort` | 로컬 알림(권한 · 예약 · 취소 · 탭) · 푸시(토픽 구독 · 해제 · 수신) 포트 |
| `native/notifications.ts` · `native/push.ts` | 포트를 부르는 함수 |
| `native/adapters/rn-notifications.ts` | notifee 로 예약 · 취소 · 권한 · 탭 처리 |
| `native/adapters/notification-request.ts` | 채널 정의 · id 변환 · 예약 시각 검사 · 안드로이드 알람 종류 |
| `native/adapters/rn-push.ts` | FCM 토픽 구독 · 해제. iOS 는 APNs 토큰을 기다린다 |
| `features/local-notifications/registry.ts` | 로컬 알림 종류 목록(`NOTIFICATION_KINDS`) |
| `features/local-notifications/reconcile.ts` | 계획과 원장 비교 · 알림 id 계산 |
| `features/local-notifications/run.ts` | 재조정 실행 · 겹친 요청 처리 · 회차 쿼리와 자정 틱을 재조정에 잇는 `watchReconcileTriggers` |
| `features/local-notifications/use-notification-press.ts` | 로컬 알림 탭을 종류별로 나눈다 |
| `features/local-notifications/exact-alarm.ts` | 안드로이드 정확한 알람 권한을 읽는 스토어 · 권한 화면 열기 |
| `features/schedule-alert/notification.ts` · `notification-text.ts` | 레지스트리의 `schedule-alert` 계획 · 알림 문구 |
| `features/schedule-alert/alert-settings.ts` · `storage/schedule-alert-settings.ts` | `미완료 스케줄 알림` 스위치 |
| `features/schedule-alert/open-request.ts` | 알림을 눌러 열 today 의 남은 스케줄 주기 |
| `features/schedule-alert/background-refresh.ts` | 백그라운드 태스크 몸통. 회차를 받고 재조정 |
| `features/remaining-schedule/remaining-schedule.ts` | 남은 스케줄을 세는 함수. today 의 타일과 알림이 같이 쓴다 |
| `native/ports.ts` 의 `BackgroundTaskPort` · `native/background-task.ts` · `native/adapters/rn-background-task.ts` | 백그라운드 태스크 정의 · 등록 · 해제(expo-background-task) |
| `navigation/AppNavigation.tsx` | 알림 탭을 받아 파티 약속 화면이나 today 탭으로 보낸다 |
| `features/notice/topics.ts` | 공지 스위치 다섯과 FCM 토픽 이름 · 기본으로 켜는 묶음 |
| `features/notice/store.ts` | 공지 구독 상태 · 요청 대기열 · 재구독 |
| `features/notice/permission-gate.ts` | 캐릭터를 고른 직후 알림 권한을 한 번 묻는다 |
| `storage/notification-ledger.ts` | 예약해 둔 로컬 알림 원장 |
| `storage/notice-settings.ts` | 공지 구독 값 · 권한을 물었는지 |
| `app/AppShell.tsx` · `hooks/useReturnToForeground.ts` | 앱을 켤 때 · 포그라운드 복귀 · 배경으로 갈 때 재조정과 재구독, 백그라운드 태스크 등록 |
| `app/settings/SettingsNoticeAlertsScreen.tsx` | 알림 설정 화면 |
| `app/settings/notification-settings-link.ts` | 플랫폼별 OS 알림 설정 열기 |

## 로컬 알림

| 언제 | 하는 일 |
|---|---|
| 앱을 켤 때 · 포그라운드로 돌아올 때 · 배경으로 갈 때 | 재조정 |
| 파티 약속을 저장하거나 지울 때 | 재조정 |
| 파티 스케줄 알림 · 미완료 스케줄 알림 스위치를 바꿀 때 | 재조정 |
| 스케줄 회차 쿼리가 새 데이터를 들 때 · KST 자정 | 재조정 |
| 백그라운드 태스크가 돌 때 | 회차를 받고 재조정 |
| 재조정 | 알림 권한이 없으면 원장의 예약을 모두 취소. 있으면 울릴 시각 순으로 앞 64개만 예약하고 나머지 원장 항목은 취소. 안드로이드 정확한 알람 권한을 한 번 읽어 예약 방식을 정한다 |
| 알림을 탭할 때 | 파티 약속은 그 약속을, 미완료 스케줄은 today 탭을 그 주기로 연다 |

| 안드로이드 채널 | 이름 | 중요도 | 쓰는 곳 |
|---|---|---|---|
| `default` | `Default` | `DEFAULT` | 채널을 고르지 않은 로컬 알림 |
| `party` | `파티 스케줄` | `HIGH` | 파티 약속 알림 |
| `schedule` | `스케줄` | `HIGH` | 미완료 스케줄 알림 |

공지 푸시는 채널을 따로 만들지 않아 FCM 기본 채널로 뜬다.

안드로이드는 로컬 알림을 알람으로 예약한다. WorkManager 로 예약하면 Doze 에서 몇 시간씩 늦기 때문이다.

| 정확한 알람 권한(`알람 및 리마인더`) | 예약 방식 | 울리는 때 |
|---|---|---|
| 있음 · 안드로이드 12 미만 | `SET_EXACT_AND_ALLOW_WHILE_IDLE` | 정한 시각 |
| 없음 · 읽기 실패 | `SET_AND_ALLOW_WHILE_IDLE` | 정한 시각에서 최대 1시간 늦을 수 있다 |

권한 없이 정확한 알람을 요청하면 notifee 가 에러 없이 예약을 건너뛰므로, 권한을 확인한 뒤에만 정확한 알람을 쓴다.
권한이 바뀌면 원장의 `exact` 와 달라져 다음 재조정이 다시 예약한다. 예약 전에는 같은 id 의 옛 예약을 지운다. notifee 가
알람으로 예약할 때 같은 id 의 WorkManager 작업을 지우지 않아서다.

iOS 는 로컬 알림과 공지 푸시 모두 기본 알림음(`default`)을 싣는다. 소리가 없으면 무음 알림이 되어 애플워치가 진동하지 않는다.

## 미완료 스케줄 알림

초기화 전에 아직 안 한 것이 있으면 알린다. 매일 21:00 KST 에 하루 한 장이고, 추적 캐릭터 전체를 한 장으로 접는다.

| 날 | 드는 주기 |
|---|---|
| 매일 | 일간 컨텐츠 |
| 수요일 | 일간 · 주간(주간 컨텐츠와 주간 보스). 목요일 00:00 에 초기화된다 |
| 그 달의 마지막 날 | 일간 · 월간(월간 보스). 1일 00:00 에 초기화된다 |

세는 규칙은 today 의 남은 스케줄 타일과 같은 함수(`remainingScheduleOf`)다. 공유 컨텐츠 · 요구 레벨 미달 · 완료한
항목은 세지 않는다. 앞으로 7일 안의 날마다 한 장을 예약하고 재조정 때 다시 채운다.

문구는 마지막으로 아는 상태를 단정하지 않는다. 수는 싣지 않는다.

| 상태 | 제목 | 본문 |
|---|---|---|
| 마지막으로 확인했을 때 남은 것이 있다 | `일간 스케줄이 남은 것 같아요` | `마지막으로 확인했을 때 기준이에요. 끝냈다면 앱을 열어 갱신해 주세요. 자정에 초기화돼요` |
| 초기화 뒤에 확인한 적이 없다 | 같다 | `초기화 뒤에 확인하지 못했어요. 앱을 열면 갱신돼요. 자정에 초기화돼요` |

제목의 주기는 그날 드는 주기 중 남았거나 모르는 것만 `일간 · 주간` 처럼 잇는다. 드는 주기를 전부 다 한 것으로
확인되면 그날은 보내지 않는다. 앱 안에서 스케줄이 갱신되면 재조정이 돌아 문구가 바뀌거나 예약이 취소된다. 마지막 상태는 계획한 때와 같은
기간(일간은 같은 날, 주간은 같은 리셋 주, 월간은 같은 달)일 때만 믿고, 다른 기간은 모르는 것으로 본다.

백그라운드 태스크(`expo-background-task`)가 돌면 스케줄 회차를 받고 같은 재조정을 한 번 더 한다. iOS 는 OS 가 때를
정하고 기기가 쉴 때 도는 일이 많다. 안드로이드는 최소 15분 간격이다. 태스크가 한 번도 안 돌아도 알림은 뜬다. 등록은
스위치가 켜져 있을 때 앱을 켜면 하고(최소 간격 120분), 스위치를 끄면 푼다.

## 공지 구독

| 스위치 | FCM 토픽 | 권한을 허용하면 |
|---|---|---|
| 앱 공지 사항 | `notice` | 켬 |
| 게임 공지 사항 | `notice-game` | 켬 |
| 썬데이 메이플 | `notice-event` | 켬 |
| 게임 업데이트 안내 | `notice-update` | 꺼둠 |
| 캐시 아이템 업데이트 | `notice-cashshop` | 꺼둠 |

| 언제 | 하는 일 |
|---|---|
| 캐릭터를 고른 직후(온보딩 · 캐릭터 관리) | 권한을 물은 적이 없으면 묻는다. 허용하면 위 표의 기본 셋을 켠다 |
| 스위치를 켤 때 | 권한이 있으면 구독. 물은 적이 없으면 묻고, 거부했었으면 `기기에서 알림이 꺼져 있어요` 카드 |
| 스위치를 끌 때 | 권한과 상관없이 해제 |
| 앱을 켤 때 · 포그라운드로 돌아올 때 | 권한이 있으면 켜 둔 토픽을 다시 구독. 실패해도 알리지 않는다 |

공지 푸시는 자체 호스팅 서버가 서버 자신의 넥슨 키로 공지 목록을 받아 토픽으로 보낸다. 기기는 등록 토큰을 서버에 보내지 않는다.

## 알림 설정 화면

`더보기 > 설정 > 알림 설정` 이다.

| 항목 | 동작 |
|---|---|
| `기기 설정`(머리) | OS 의 이 앱 알림 설정을 연다. 안드로이드는 알림 설정 화면, iOS 는 앱 설정 화면 |
| `알림 받기` | 공지 스위치 하나라도 켜져 있거나 파티 스케줄 알림 · 미완료 스케줄 알림이 켜져 있으면 켜짐. 누르면 공지 기본 셋 · 파티 알림 · 미완료 스케줄 알림을 함께 켜거나, 전부 끈다. 꺼져 있으면 아래 항목을 그리지 않는다 |
| `알림을 켜지 못했어요` 카드 | 스위치 요청이 실패한 이유 |
| `기기에서 알림이 꺼져 있어요` 카드 | 켜려다 권한에 막혔거나, 켜 둔 것이 있는데 기기 권한이 없을 때. 누르면 OS 알림 설정 |
| `알림이 늦게 올 수 있어요` 카드 | 안드로이드에서 정확한 알람 권한이 꺼져 있고 파티 스케줄 알림이나 미완료 스케줄 알림이 켜져 있을 때. 위 카드가 떠 있으면 숨는다. 누르면 이 앱의 `알람 및 리마인더` 권한 화면 |
| 일반 | 공지 스위치 다섯. 누르면 스위치가 바로 바뀌고 요청은 차례로 처리한다 |
| 스케줄러 | `파티 스케줄 알림` · `미완료 스케줄 알림` 스위치, `주간 결산 알림` 은 `준비 중` |

## 저장

| 키 | 값 | 데이터 삭제 |
|---|---|---|
| `notificationLedger` | 예약해 둔 로컬 알림 `{ id, kind, fireAt, title, body, exact }[]` | 남긴다 |
| `noticeSubscriptions` | 공지 스위치 다섯 `{ app, game, update, event, cashshop }` | 남긴다 |
| `noticeSubscribed` | 스위치가 하나였던 때의 값(`on` · `off`). 앱 공지 스위치와 함께 적는다 | 남긴다 |
| `notificationPermissionAsked` | 권한을 물었는지(`yes`) | 남긴다 |
| `partyAlarmEnabled` | 파티 스케줄 알림 스위치 | 남긴다 |
| `scheduleAlertEnabled` | 미완료 스케줄 알림 스위치 | 남긴다 |
