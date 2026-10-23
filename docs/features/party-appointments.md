# 파티 스케줄

파티로 잡는 보스 일정을 주 단위로 적고, 시작 전에 로컬 알림을 받는 기능이다. 코드에서는 일정을 약속(`Appointment`)이라 부르고
화면에서는 `스케줄` 이라고 쓴다. 왜 이렇게 만들었는지는 [[ADR-051]] 에, 알림 예약의 공통 규칙은 [[ADR-056]] 에 있다.

결정석을 나누는 파티 인원은 보스 스케줄러에서 설정하며, 이 기능과는 별개다.

## 관련 소스

| 파일 | 하는 일 |
|---|---|
| `types/party-appointment.ts` | 스케줄 · 보스 · 파티원 · 주별 예외 · 회차 |
| `storage/party-appointments.ts` | Preferences `partyAppointments` 읽기 · 쓰기. 깨진 항목만 버린다 |
| `storage/party-appointment-settings.ts` · `features/party-appointments/alarm-settings.ts` | `파티 스케줄 알림` 스위치 |
| `features/party-appointments/store.ts` | 목록을 가지고 있고, 저장한 뒤 알림 재조정을 부른다 |
| `features/party-appointments/occurrences.ts` | 한 주의 회차 펼치기 |
| `features/party-appointments/draft.ts` | 시트의 처음 값 · 시각 계산 · 저장 조건 · 스케줄로 바꾸기 |
| `features/party-appointments/edit.ts` | 수정 · 삭제 |
| `features/party-appointments/agenda.ts` | 요일별 묶기 · 종료 표기 · 이번 주로 돌아가는 방향 |
| `features/party-appointments/boss-groups.ts` · `boss-picker.ts` | 캐릭터 묶음 · 보스 추가의 타일 묶음과 고르기 |
| `features/party-appointments/alarm-gate.ts` | 알림을 켤 때 · 저장할 때 권한과 스위치 확인 |
| `features/party-appointments/notification.ts` · `notification-text.ts` | 레지스트리의 `party-appointment` 계획 · 알림 문구 |
| `features/party-appointments/open-request.ts` | 알림이나 위젯에서 열 회차 · today 위젯이 고른 새 스케줄 갈래 |
| `features/party-appointments/upcoming.ts` | 다음 회차들(today 위젯이 쓴다) |
| `app/party-appointments/AppointmentsScreen.tsx` · `AppointmentAgenda.tsx` | 주 이동 줄 · 요일별 목록 · ＋ |
| `app/party-appointments/AppointmentSheet.tsx` | 추가 · 상세 · 수정 시트와 보스 추가 단계 |
| `app/party-appointments/AppointmentTimeBand.tsx` · `AppointmentWeekdayTile.tsx` | 날짜 · 요일 · 시작 · 종료 타일 |
| `app/party-appointments/AppointmentBossList.tsx` · `AppointmentAlarmField.tsx` · `AppointmentSummaryTiles.tsx` | 보스 목록 · 알림 칸 · 상세의 알림 · 반복 타일 |
| `components/organisms/BossPicker/` | 보스 추가 단계의 본문 · 선택 줄 · 난이도 팝오버. 주간 보스 수익 계산기와 함께 쓴다 |
| `app/party-appointments/useBossPicker.ts` · `PickerCharacterSelect.tsx` | 보스 추가 단계의 상태 · 캐릭터 드롭다운 |
| `navigation/bar-groups.ts` · `navigation/LayerStack.tsx` | 스케줄러의 첫째 하위 탭 `Appointments` |

## 스케줄의 형식

| 칸 | 뜻 |
|---|---|
| `bosses` | 보스 한 판마다 `bossKey` · `difficulty` · `ocid`. 하나 이상이고 캐릭터 묶음 순서로 펼친 줄 |
| `members` | 파티원. 입력 화면이 없어 새 스케줄은 빈 배열 |
| `timeKst` | 시작 시각 `HH:mm`(KST) |
| `durationMinutes` | 시작부터 종료까지의 분. 1 이상 |
| `leadMinutes` | 몇 분 전에 알릴지. `null` 은 알림 없음, 0 은 정각 |
| `schedule` | `{ type: 'once', dateKey }` 또는 `{ type: 'weekly', weekday, fromWeek, untilWeek }`. `weekday` 는 0(일) ~ 6(토), 주는 리셋 주의 목요일이고 `untilWeek` 는 그 주를 포함하지 않는다 |
| `exceptions` | 반복 스케줄의 주별 예외. 키는 그 주의 목요일이고 값은 그 주 회차의 날짜 · 시각 · 길이 · 보스 · 알림 전체 |

## 화면

| 부분 | 내용 | 누르면 |
|---|---|---|
| 주 이동 줄 | `←` · 주 이름과 날짜 범위 · `→`, 이번 주로 돌아가는 `≪` · `≫` | 주 이동 |
| 요일별 목록 | 스케줄 있는 날만 요일 머리, 시각 줄과 캐릭터별 보스 카드 | 카드: 상세 시트 |
| 빈 상태 | `{주 이름} 파티 스케줄이 없어요` | |
| ＋ | `매주 반복` · `한 번만` 두 항목 | 그 종류의 추가 시트 |

## 시트

| 시트 | 제목 | 내용 |
|---|---|---|
| 추가(한 번만) | `스케줄 추가` | 날짜 · 시작 · 종료 타일, 보스 목록, 알림, `저장` |
| 추가(매주 반복) | `반복 스케줄 추가` | 날짜 대신 요일 세그먼트(목 → 수) |
| 상세 | `스케줄` | 읽기 모드. 알림 · 반복 타일, `수정` · `삭제`. 지난 주면 `지난 주 스케줄은 볼 수만 있어요` |
| 수정 | `스케줄 수정` | 추가와 같고, 반복이면 `이 주만 적용하기` 체크박스 |
| 보스 추가 | `보스 추가` | 캐릭터 드롭다운 · 그 아랫줄 `모든 보스` 토글 · `파티` · `스케줄러` · `모든 보스` 타일, `n개 선택됨` 줄 · `n개 추가` |

- 처음 시각은 다음 정각, 종료는 그 30분 뒤다. 시작을 바꾸면 종료가 다시 시작 + 30분이 된다.
- 종료가 시작보다 이르면 다음 날이다. 같은 시각은 저장할 수 없다.
- 날짜는 오늘부터 365일 뒤까지 고른다.
- 알림은 `정각 · 10분 전 · 30분 전 · 1시간 전 · 직접` 이고, 켜면 처음 값은 `10분 전` 이다.
- 알림을 켤 때와 알림을 단 채 저장할 때 기기 권한과 `파티 스케줄 알림` 스위치를 확인한다.

## 알림

| 항목 | 값 |
|---|---|
| 종류 | `party-appointment` |
| 범위 | 지금부터 7일 안에 울릴 회차 |
| 울리는 시각 | 회차 시작 − `leadMinutes` |
| 채널 | 안드로이드 `party`(`파티 스케줄`, `HIGH`) |
| 문구 | `낟낟 파티 보스 스케줄이 곧 시작해요` / `21:00 낟낟 하드 림보 외 2마리 파티 10분 전이에요` |
| 누르면 | 파티 스케줄 탭에서 그 회차가 속한 주를 열고 상세를 연다. 회차가 없으면 그 주만 연다 |

today 의 `다음 파티 스케줄` 위젯도 시작 전인 가장 가까운 회차를 보여 주고, 누르면 같은 방법으로 상세를 연다. 회차가 없으면
위젯이 맨 아래 줄에서 `매주 반복` · `한 번만` 칸을 보여 주고, 누르면 이 탭에서 그 갈래의 새 스케줄 시트가 열린다.

## 저장

| 키 | 값 | 캐시 삭제 |
|---|---|---|
| `partyAppointments` | `PartyAppointment[]` | 남긴다 |
| `partyAlarmEnabled` | `on` · `off`(없으면 켜짐) | 남긴다 |
