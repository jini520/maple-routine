# 파티 약속 (Party Appointments)

> **범위**: 파티로 잡는 보스의 약속을 주 단위로 적는 화면과, 약속 시간 전에 뜨는 로컬 알림.
> **여기 없는 것**: 알림 레이어(레지스트리 · 원장 · 재조정)의 일반 규칙은 [notifications.md](./notifications.md) 에 있다. 결정석을 나누는 파티 인원은 [boss-scheduler.md](./boss-scheduler.md) 의 `파티 인원` 이고 이 기능과 따로 산다.
> **관련 ADR**: [[ADR-331]](이 기능의 결정 전부) · [[ADR-146]](알림 레이어) · [[ADR-170]](리셋 주)
> **상태**: 설계 진행 중 · 보드 · 추가 · 상세 · 수정 · 삭제 구현, 알림 레이어 미구현(2026-10-02, 이슈 #380).
>
> **이 문서의 `화면` · `시트` 는 처음 설계다.** 그 뒤 결정이 [[ADR-331]] 정정 1~6 에 있다. 화면은 세로 간트(`@howljs/calendar-kit`)이고, 등록 시트 · 보스 추가 화면이 새로 정해졌다. `약속의 모양` · `한 주를 펼친다` · `보드 블록` 은 정정대로 고쳐 썼다(2026-10-01). 나머지도 구현이 이어질 때 고쳐 쓴다.

## 관련 소스 (만들 것)

| 구분 | 파일 | 하는 일 |
|---|---|---|
| 타입 | `types/party-appointment.ts` | 약속 · 파티원 · 주별 예외 |
| 저장 | `storage/party-appointments.ts` | Preferences `partyAppointments` 읽기 · 쓰기 |
| 로직 | `features/party-appointments/occurrences.ts` | 약속 목록에서 한 주의 약속 회차를 펼친다(순수 함수) |
| 로직 | `features/party-appointments/edit.ts` | 수정할 값 채우기 · 이 주만 적용 · 앞으로 모두 수정 · 삭제(순수 함수) |
| 로직 | `features/party-appointments/guards.ts` | 하루 알림 세 개 세기(순수 함수) |
| 상태 | `features/party-appointments/store.ts` | 목록을 들고, 바꾸면 저장한 뒤 알림 재조정을 부른다 |
| 알림 | `features/party-appointments/notification.ts` · `notification-text.ts` | 레지스트리에 들어가는 `party-appointment` 정의(`plan()`) · 문구(구현됨) |
| 화면 | `app/party-appointments/AppointmentsScreen.tsx` | 세로 간트 보드 · FAB |
| 화면 | `app/party-appointments/AppointmentSheet.tsx` | 추가 · 상세(읽기 모드) · 수정 시트. 보스 추가는 같은 시트의 다음 단계(`stepKey`) |
| 화면 | `app/party-appointments/AppointmentSummaryTiles.tsx` | 상세의 알림 · 반복 타일 |
| 화면 | `app/party-appointments/AppointmentTimeBand.tsx` · `AppointmentBossList.tsx` · `AppointmentAlarmField.tsx` | 시트의 시작 · 종료 타일 넷 · 보스 목록 · 알림 칸 |
| 화면 | `app/party-appointments/BossPickerBody.tsx` · `BossPickerTray.tsx` · `BossDifficultyPopover.tsx` · `useBossPicker.ts` | 보스 추가 단계(타일 묶음 · 선택 줄과 날아오는 초상 · 난이도 팝오버) |
| 로직 | `features/party-appointments/draft.ts` · `boss-picker.ts` | 저장 전 약속 · 보스 묶음 나누기와 고르기(순수 함수) |
| 부품 | `components/organisms/TimePopover/TimePopover.tsx` | 5분 휠 팝오버. 휠 3줄 · 폭은 휠에 맞춤(아래가 모자라면 위로 뒤집힌다) |
| 탭 | `navigation/routes.ts` · `navigation/bar-groups.ts` · `navigation/LayerStack.tsx` | 스케줄 층의 넷째 하위 |

## 자리

```
[ 스케줄 ]
 컨텐츠 | 보스 | 보스 관리 | 약속
```

[[ADR-331]] 결정 5.

## 약속의 모양

[[ADR-331]] 정정 2(보스 목록) · 정정 5(종료)를 따른다.

```ts
type PartyMember =
  | { type: 'text'; name: string }          // 다른 사용자의 캐릭터. 앱이 모른다
  | { type: 'character'; ocid: string }     // 내 다른 캐릭터

/** 약속이 도는 보스 한 판. 캐릭터 · 보스 · 난이도는 판마다 다를 수 있다 */
interface PartyAppointmentBoss {
  bossKey: string
  difficulty: string
  ocid: string                              // 이 판에 가는 내 캐릭터
}

interface PartyAppointment {
  id: string
  bosses: PartyAppointmentBoss[]            // 1개 이상. 도는 차례대로
  members: PartyMember[]                    // 약속 전체가 같다
  timeKst: string                           // 시작 'HH:mm'
  durationMinutes: number                   // 시작부터 종료까지. 1 이상
  leadMinutes: number | null                // null = 알림 없음, 0 = 정각
  schedule:
    | { type: 'once'; dateKey: string }     // 시작 날짜 'YYYY-MM-DD' (KST)
    | { type: 'weekly'; weekday: number; fromWeek: string; untilWeek: string | null }
  /** 반복 약속의 주별 예외. 키는 그 주의 목요일 dateKey */
  exceptions: Record<string, PartyAppointmentOverride>
}

/** `이 주만 적용하기` 로 그 주 회차만 바꾼 것. 그 주의 약속 전체를 담는다 */
interface PartyAppointmentOverride {
  type: 'override'
  dateKey: string
  timeKst: string
  durationMinutes: number
  bosses: PartyAppointmentBoss[]
  leadMinutes: number | null
}
```

- 종료는 날짜 · 시각을 따로 두지 않고 **시작부터의 분**(`durationMinutes`)으로 둔다. 종료가 다음 날이어도
  시작에 더하기만 하면 되고, 종료가 시작보다 이르거나 같은 약속은 `durationMinutes ≤ 0` 이라 저장 검사에서 걸린다.
  시트는 이 값을 종료 날짜 · 시각으로 풀어 보여 준다. 처음 열 때는 30 이다.
- `weekday` 는 `Date.getUTCDay` 와 같은 0(일)~6(토)이다. 시작의 요일이다.
- 건너뛰기(`skip`)는 없다. 반복 약속을 한 주만 빼는 화면이 없어서다([[ADR-331]] 정정 10). 한 주 예외는 `이 주만 적용하기` 의
  `override` 하나뿐이고, 보스 · 알림까지 그 주만 바꿀 수 있게 그 주의 약속 전체를 담는다.
- `fromWeek` · `untilWeek` 는 리셋 주의 목요일 dateKey 다. `untilWeek` 는 **그 주를 포함하지 않는다.**
  `null` 이면 끝이 없다.
- 파티원 칸의 내 캐릭터는 이름을 저장하지 않고 `ocid` 로 가리킨다. 이름은 화면이 추적 캐릭터 캐시에서
  읽는다. 추적을 풀어 이름을 못 찾으면 그 칸을 뺀다.
- **월간 보스는 `once` 만 된다**([[ADR-331]] 결정 2). 시트가 월간 보스를 고르면 반복 스위치를 숨긴다.

## 한 주를 펼친다 (`occurrences.ts`)

주 W(목요일 dateKey)의 회차는 이렇게 모은다. 회차는 **시작 날짜**로 주에 들어간다. 수요일 23:30 에 시작해
목요일로 넘어가는 약속은 W 의 회차다([[ADR-331]] 정정 5).

1. `once` 약속 중 `dateKey` 가 W 안(목~수)인 것.
2. `weekly` 약속 중 `fromWeek ≤ W < untilWeek` 인 것. W 안에서 `weekday` 가 맞는 날이 그 회차의 날짜다.
   `exceptions[W]` 가 있으면 그 주 회차는 그 예외의 날짜 · 시각 · 길이 · 보스 · 알림으로 선다.
3. 시작 순으로 정렬한다.

회차 하나는 `{ appointment, dateKey, timeKst, startsAt, endsAt, bosses, leadMinutes, overridden }` 다. 보드 · 알림 · 하루 알림 수는
약속이 아니라 **회차의** `bosses` · `leadMinutes` 를 본다(이 주만 바꾼 회차가 있다). `startsAt` 은 KST 벽시계를 UTC 로
바꾼 순간이다(KST 는 +09:00 고정). `endsAt = startsAt + durationMinutes`.

## 보드 블록 (`calendar-events.ts`)

- 블록은 시작부터 종료까지 그린다. 보스 수와 상관없다.
- 보스가 하나면 그 캐릭터의 색이고, 글자는 시각 · 캐릭터 · 보스와 난이도 세 줄이다.
- 보스가 둘 이상이면 묶음 전용 색(`#3B3F46`)이다. 머리 줄에 시각, 그 아래에 캐릭터마다 한 묶음(`낟낟 (3)` 과 보스 줄)을
  처음 나온 차례대로 쌓는다. 묶음 왼쪽 줄이 그 캐릭터의 색이다.
- 시간이 겹친 블록은 나란히 쪼개지 않는다. 모두 칸 전체 폭이고 시작이 늦은 블록이 위에 그려진다([[ADR-331]] 정정 6).
  calendar-kit 패치가 더한 `overlapType="stack"` 이 한다. 보스 하나짜리 블록의 글자도 묶음처럼 위에 붙여, 덮이지 않는
  윗부분에 남게 한다.
- 자정을 넘는 블록은 calendar-kit 이 두 조각으로 자른다. **다음 날 조각에는 글자 · 아이콘을 두지 않고 색만** 칠한다.
  다음 날 조각은 그 날 0분에서 시작하고 약속 시작은 0시가 아닌 조각이다.

- 날짜 머리 위의 달 띠는 칸마다 그 달 색을 칠하고, 달 이름은 띠 위에 따로 하나씩 얹는다(`AppointmentsScreen` 의 `MonthLabels`).
  이름은 라이브러리의 가로 스크롤 값(`useCalendar().offsetX`)을 읽어 그 달이 보이는 동안 화면 왼쪽 끝에 붙고,
  다음 달에 밀려 나간다([[ADR-331]] 정정 11).

## 수정 · 삭제 (`edit.ts`)

누른 회차가 든 리셋 주를 W 라 한다. W 가 오늘이 든 주보다 앞이면(지난 주) 상세는 읽기만 하고 수정 · 삭제가 없다([[ADR-331]] 결정 4).

| 동작 | `once` | `weekly` |
|---|---|---|
| 수정 | 같은 id 로 덮는다 | `이 주만 적용하기` 켬: `exceptions[W] = override`(그 주의 날짜 · 시각 · 길이 · 보스 · 알림). 끔(앞으로 모두): `fromWeek < W` 면 옛 것을 `untilWeek = W` 로 끝내고 새 id 로 W 부터 여는 약속을 적는다. `fromWeek ≥ W` 면 같은 id 로 덮는다 |
| 삭제 | 지운다 | `fromWeek < W` 면 `untilWeek = W`(지난 주는 남는다). 아니면 통째로 지운다 |

- 앞으로 모두로 덮거나 새로 열 때 **옛 주별 예외는 가져가지 않는다.** 시각 · 보스를 바꿨으면 옛 예외가 뜻을 잃기 때문이다.
- 앞으로 모두에서 `매주 반복` 을 끄면 새 약속은 W 안의 그 날짜 한 번뿐인 약속이 된다.
- 수정 시트를 열 때 값은 누른 **회차**에서 온다(이 주만 바꾼 회차면 그 값). 알림이 없던 회차는 체크 상자가 꺼진 채 `10분 전` 이 골라져 있다.
- 하루 알림 수는 고치는 약속 자신을 빼고 센다(`alarmsOnDate` 의 `excludeId`).

## 화면

- 머리: 제목 `파티 약속` · 오른쪽 `추가` 버튼(지난 주에서는 숨긴다).
- 주 이동 줄: 보스 수익 · 가계부와 같은 기간 스테퍼(이전 · 다음 · 이번 주로 겹화살표, [[ADR-326]]).
  가운데 글자는 `9/25 ~ 10/1`.
- 목록: 요일(목 → 수)마다 묶고 시각 순으로 쌓는다. 약속이 없는 요일은 안 그린다.
- 행: 시각 · 보스 초상 · `스우(하드)` · 내 캐릭터 · 파티원 · 반복이면 반복 표시 · 알림이 있으면
  `10분 전`.
- 빈 상태: `이번 주 약속이 없어요` 와 추가 버튼.

### 시트 (`AppointmentSheet.tsx`)

[[ADR-331]] 정정 3 · 5 · 7 · 8 · 11 을 따른다. FAB 를 누르면 열린다. 한 장이고, 가운데만 스크롤하며 저장은 바닥에 고정한다.

위에서부터 이렇다.

1. **시작 · 종료 타일 넷(2 × 2).** `시작 날짜 · 시작 시각 / 종료 날짜 · 종료 시각`. 알림 · 반복 타일과 같은 모양이고 테두리가 없다.
   날짜는 `CalendarPopover`, 시각은 5분 `TimeWheel` 이고 둘 다 `확인` 을 눌러야 반영된다. 바꿀 수 있는 값은 주황에 `⌄` 가 붙고, 고르개가 열린 타일은 주황 바탕이다.
   - 처음 열면 시작은 오늘 다음 5분 칸, 종료는 시작 + 30분이다. 시작 날짜는 오늘 이전을 막는다.
   - 종료 고르개는 시작보다 이르거나 같은 칸을 흐리게 막는다.
   - 시작을 종료와 같거나 뒤로 옮기면 종료 값이 빨갛게 되고 저장이 비활성이다. 종료를 다시 늦추면 풀린다.
2. **보스 목록.** `보스 n` 아래에 테두리 없는 줄마다 손잡이 · 차례 · 초상 · 보스 이름 · 난이도 배지 · 캐릭터 · `✕`.
   손잡이를 끌어 차례를 바꾸고 `✕` 로 뺀다. 맨 아래 보스 줄 크기의 점선 빈 칸 `+ 보스 추가` 가 보스 추가 단계를 연다.
3. **알림.** `알림` 체크 상자와 오른쪽의 사용량(`10/1 알림 1/3`). 알약 `정각 · 10분 전 · 30분 전 · 1시간 전 · 직접`
   은 늘 서 있고, 알림이 꺼져 있으면 흐리게 막힌다. 켜면 기본은 `10분 전` 이다. `직접` 은 그 알약 아래에 `시간 | 분 전` 휠 팝오버(`TimePopover`)를 띄우고 `확인` 하면 알약이 `직접 · 1시간 15분 전` 이 된다.
   사용량은 시작 날짜에 이 약속을 뺀 알림 수다. 셋이면 붉게 쓰고 체크 상자를 켤 수 없다(결정 13).
4. **매주 반복.** 알림 아래의 체크 상자. 켜면 옆에 `목요일마다`.
5. **바닥.** `저장`. 수정 시트는 반복 약속일 때 그 위에 `이 주만 적용하기` 체크 상자가 더 선다([[ADR-331]] 정정 10).

저장 버튼은 보스가 하나 이상이고 종료가 시작보다 늦을 때만 켜진다. 같은 캐릭터 · 같은 보스의 약속이 있어도 묻지 않는다
(정정 8). 파티원 입력은 이번 시트에 없다(정정 7).

상세는 이 시트의 읽기 모드다(정정 10): 시작 · 종료 타일은 검은 값에 `⌄` 가 없고, 고르개 · 손잡이 · `✕` · 보스 추가 칸이 없고, 알림 · 반복은 아이콘 원 타일 둘이며,
바닥은 `수정` 아래 빨간 `삭제` 다. 건너뛰기는 없다. 반복 약속의 알림 한도 모달 · 권한 모달은 아직 시안 검토 중이다.

## 알림

알림 레이어의 한 종류다(`kind: 'party-appointment'`). 레이어의 규칙은 [notifications.md](./notifications.md).

- `plan()` 은 지금부터 7일 안에 있는 회차 중 `leadMinutes` 가 있는 것마다 알림 하나를 낸다.
  `fireAt = startsAt − leadMinutes`. `fireAt` 이 이미 지났으면 안 낸다.
- 설정의 `파티 약속 알림` 이 꺼져 있으면 빈 목록이다.
- id 는 `party-appointment:<약속 id>:<회차 dateKey>` 의 32비트 해시다. 같은 회차는 몇 번을 계획해도 같은
  id 라 재예약이 덮어쓰기가 된다.
- 안드로이드 채널은 `party`(`파티 약속`, 중요도 `HIGH`)다([[ADR-331]] 결정 7).
- 문구([[ADR-331]] 정정 9, `notification-text.ts`):

  ```
  제목: 낟낟 파티 보스 스케줄이 곧 시작해요        (캐릭터가 여럿이면 '낟낟 외 1캐릭터 …')
  본문: 21:00 낟낟 하드 림보 외 2마리 파티 10분 전이에요   (정각이면 '… 파티가 지금 시작해요')
  ```

  보스 이름은 `alias` 다. 보스가 하나면 `외 n마리` 가 없다. 60 의 배수는 `1시간 전이에요` 처럼 시간으로 적는다.
  파티원은 넣지 않는다.

## 저장

| 키 | 값 | 캐시 삭제 시 |
|---|---|---|
| `partyAppointments` | `PartyAppointment[]`(JSON) | **보존**. 사용자가 적은 것이라 아무도 복원해 주지 않는다 |

깨진 JSON 이면 빈 목록으로 읽는다. 모양이 틀린 항목 하나는 그 항목만 버린다.

## 테스트

- `occurrences`: 리셋 주 경계(수요일 23:59 · 목요일 00:00) · `fromWeek` · `untilWeek` 포함 여부 · `skip` ·
  `move` · 정렬.
- `edit`: 표의 칸마다 하나.
- `guards`: 하루 셋 경계 · 반복 약속의 앞으로의 주.
- `plan()`: 7일 지평선 · 지난 `fireAt` · `leadMinutes` null · 설정 꺼짐 · 결정적 id.
- 화면: 주 이동 · 지난 주에서 추가가 숨는다 · 행을 누르면 시트가 열린다.

## 열린 질문

- 알림을 눌렀을 때 약속 화면으로 보낼지(지금은 앱만 연다, [[ADR-331]] 결정 6).

## 폐기된 정책 (history)

### 시작 · 종료 톤 띠 두 줄 (2026-10-01 ~ 10-02, [[ADR-331]] 정정 11 이 대체)

시트 폭 끝까지 깐 톤 띠 두 줄(`시작 | 날짜 | 시각`, `종료 | 날짜 | 시각`)이었다. 칸 사이는 시트 바탕이 비치는 2px 틈이었고,
값은 검정이라 추가 시트와 상세가 같아 보였다. 보스 줄에는 테두리가 있었다.

### 처음 설계의 시트 (2026-09-30, [[ADR-331]] 정정 3 · 5 · 7 · 8 이 대체)

보스 · 난이도 · 내 캐릭터 · 날짜(반복이면 요일) · 시각 · 반복 스위치 · 파티원 · 알림 순서의 한 장이었다. 알림은
`없음 · 정각 · 10분 · 30분 · 1시간 · 직접` 칩이었고, 저장할 때 같은 캐릭터 · 같은 보스 겹침 모달(결정 12)을 먼저 띄웠다.

### 약속 하나가 보스 한 판, 20분 고정 (2026-09-30 ~ 10-01, [[ADR-331]] 정정 2 · 5 가 대체)

처음 설계의 약속은 `bossKey` · `difficulty` · `ocid` 를 한 벌만 들고 종료를 적지 않았다. 보드는 시작 + 20분(보스 한 판)으로 그렸다.

> **옛 `약속의 모양`**
>
> ```ts
> type PartyMember =
>   | { type: 'text'; name: string }          // 다른 사용자의 캐릭터. 앱이 모른다
>   | { type: 'character'; ocid: string }     // 내 다른 캐릭터
>
> interface PartyAppointment {
>   id: string
>   bossKey: string
>   difficulty: string
>   ocid: string                              // 내가 가는 캐릭터. 반드시 고른다
>   members: PartyMember[]
>   timeKst: string                           // 'HH:mm'
>   leadMinutes: number | null                // null = 알림 없음, 0 = 정각
>   schedule:
>     | { type: 'once'; dateKey: string }     // 'YYYY-MM-DD' (KST)
>     | { type: 'weekly'; weekday: number; fromWeek: string; untilWeek: string | null }
>   /** 반복 약속의 주별 예외. 키는 그 주의 목요일 dateKey */
>   exceptions: Record<string, { type: 'skip' } | { type: 'move'; dateKey: string; timeKst: string }>
> }
> ```
>
> - `weekday` 는 `Date.getUTCDay` 와 같은 0(일)~6(토)이다.
> - `fromWeek` · `untilWeek` 는 리셋 주의 목요일 dateKey 다. `untilWeek` 는 **그 주를 포함하지 않는다.**
>   `null` 이면 끝이 없다.
> - 파티원 칸의 내 캐릭터는 이름을 저장하지 않고 `ocid` 로 가리킨다. 이름은 화면이 추적 캐릭터 캐시에서
>   읽는다. 추적을 풀어 이름을 못 찾으면 그 칸을 뺀다.
> - **월간 보스는 `once` 만 된다**([[ADR-331]] 결정 2). 시트가 월간 보스를 고르면 반복 스위치를 숨긴다.
