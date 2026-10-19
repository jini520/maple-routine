# 알림

기기에 뜨는 알림 두 가지를 다룬다. 기기가 정한 시각에 스스로 띄우는 로컬 알림과, 서버가 보내는 공지 푸시다.
지금 로컬 알림은 파티 약속 알림 하나뿐이다. 왜 이렇게 만들었는지는 [[ADR-056]] 에 있다. 공지의 내용과 화면은
[notice.md](./notice.md) 에, 파티 약속 알림의 시각과 문구는 [[ADR-051]] 에 있다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `index.ts` | 꺼진 앱을 깨우는 핸들러 둘(`setBackgroundMessageHandler` · `notifee.onBackgroundEvent`)을 최상위에서 등록 |
| `native/ports.ts` 의 `NotificationsPort` · `PushPort` | 로컬 알림(권한 · 예약 · 취소 · 탭) · 푸시(토픽 구독 · 해제 · 수신) 포트 |
| `native/notifications.ts` · `native/push.ts` | 포트를 부르는 함수 |
| `native/adapters/rn-notifications.ts` | notifee 로 예약 · 취소 · 권한 · 탭 처리 |
| `native/adapters/notification-request.ts` | 채널 정의 · id 변환 · 예약 시각 검사 |
| `native/adapters/rn-push.ts` | FCM 토픽 구독 · 해제. iOS 는 APNs 토큰을 기다린다 |
| `features/local-notifications/registry.ts` | 로컬 알림 종류 목록(`NOTIFICATION_KINDS`) |
| `features/local-notifications/reconcile.ts` | 계획과 원장 비교 · 알림 id 계산 |
| `features/local-notifications/run.ts` | 재조정 실행 · 겹친 요청 처리 |
| `features/local-notifications/use-notification-press.ts` | 로컬 알림 탭을 종류별로 나눈다 |
| `features/notice/topics.ts` | 공지 스위치 다섯과 FCM 토픽 이름 · 기본으로 켜는 묶음 |
| `features/notice/store.ts` | 공지 구독 상태 · 요청 대기열 · 재구독 |
| `features/notice/permission-gate.ts` | 캐릭터를 고른 직후 알림 권한을 한 번 묻는다 |
| `storage/notification-ledger.ts` | 예약해 둔 로컬 알림 원장 |
| `storage/notice-settings.ts` | 공지 구독 값 · 권한을 물었는지 |
| `app/AppShell.tsx` · `hooks/useReturnToForeground.ts` | 앱을 켤 때와 포그라운드 복귀 때 재조정과 재구독 |
| `app/settings/SettingsNoticeAlertsScreen.tsx` | 알림 설정 화면 |
| `app/settings/notification-settings-link.ts` | 플랫폼별 OS 알림 설정 열기 |

## 로컬 알림

| 언제 | 하는 일 |
|---|---|
| 앱을 켤 때 · 포그라운드로 돌아올 때 | 재조정 |
| 파티 약속을 저장하거나 지울 때 | 재조정 |
| 파티 스케줄 알림 스위치를 바꿀 때 | 재조정 |
| 재조정 | 알림 권한이 없으면 원장의 예약을 모두 취소. 있으면 울릴 시각 순으로 앞 64개만 예약하고 나머지 원장 항목은 취소 |
| 알림을 탭할 때 | 그 약속을 연다 |

| 안드로이드 채널 | 이름 | 중요도 | 쓰는 곳 |
|---|---|---|---|
| `default` | `Default` | `DEFAULT` | 채널을 고르지 않은 로컬 알림 |
| `party` | `파티 스케줄` | `HIGH` | 파티 약속 알림 |

공지 푸시는 채널을 따로 만들지 않아 FCM 기본 채널로 뜬다.

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
| `알림 받기` | 공지 스위치 하나라도 켜져 있거나 파티 스케줄 알림이 켜져 있으면 켜짐. 누르면 공지 기본 셋과 파티 알림을 함께 켜거나, 전부 끈다. 꺼져 있으면 아래 항목을 그리지 않는다 |
| `알림을 켜지 못했어요` 카드 | 스위치 요청이 실패한 이유 |
| `기기에서 알림이 꺼져 있어요` 카드 | 켜려다 권한에 막혔거나, 켜 둔 것이 있는데 기기 권한이 없을 때. 누르면 OS 알림 설정 |
| 일반 | 공지 스위치 다섯. 누르면 스위치가 바로 바뀌고 요청은 차례로 처리한다 |
| 스케줄러 | `파티 스케줄 알림` 스위치, `미완료 스케줄 알림` · `주간 결산 알림` 은 `준비 중` |

## 저장

| 키 | 값 | 캐시 삭제 시 |
|---|---|---|
| `notificationLedger` | 예약해 둔 로컬 알림 `{ id, kind, fireAt, title, body }[]` | 남긴다 |
| `noticeSubscriptions` | 공지 스위치 다섯 `{ app, game, update, event, cashshop }` | 남긴다 |
| `noticeSubscribed` | 스위치가 하나였던 때의 값(`on` · `off`). 앱 공지 스위치와 함께 적는다 | 남긴다 |
| `notificationPermissionAsked` | 권한을 물었는지(`yes`) | 남긴다 |
| `partyAlarmEnabled` | 파티 스케줄 알림 스위치 | 남긴다 |
