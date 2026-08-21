# 알림 (Notifications)

> **범위**: 알림 레이어 구조·레지스트리·예약 재조정(reconcile)·푸시 경로·권한·실패 처리. 결정의 배경과 기각안은 [[ADR-146]], 옛 정책은 [[ADR-004]].
> **관련 소스(read/write)**: `core/native/ports.ts`(`NotificationsPort` **기존** · `PushPort`·`BackgroundTaskPort` **신설**) · `core/native/notifications.ts`·`push.ts`·`background-task.ts` · `core/features/notifications/`(레지스트리·계획·재조정·스토어) · `core/storage/notification-settings.ts`·`notification-ledger.ts`·`keys.ts` · RN 어댑터 `src/native/adapters/rn-notifications.ts`(기존)·`rn-push.ts`·`rn-background-task.ts` · RN 진입점 `index.ts`(모듈 최상위 핸들러 셋) · `app.json` · `workers/notice-push/`(발송 Worker).
> **관련 ADR**: [[ADR-146]] [[ADR-004]] [[ADR-008]] [[ADR-003]] [[ADR-128]] [[ADR-137]]. **관련 문서**: [../foundation/architecture.md](../foundation/architecture.md), [../foundation/error-resilience.md](../foundation/error-resilience.md), [../foundation/nexon-api.md](../foundation/nexon-api.md), [../foundation/release.md](../foundation/release.md), [../persistence/preferences.md](../persistence/preferences.md), [settings.md](./settings.md), [live-update.md](./live-update.md).

> **현재 상태 (2026-08-17)**: **설계 완료, 구현 전.** 지금 저장소에 있는 것은 `NotificationsPort` 와 두 어댑터뿐이고 **그 포트를 부르는 `features/` 코드는 없다.** 이 문서는 만들 것을 적은 것이지 있는 것을 적은 것이 아니다.

## 이 기능이 지키려는 한 문장

> **알림을 하나 더하는 일이 스토어 심사를 기다리지 않는다.**

[[ADR-128]] 전환 릴리스에는 OTA 안전망이 없고, 바이너리에 안 들어간 네이티브 능력은 다음 심사까지
못 쓴다. 그래서 이 기능의 설계 목표는 «좋은 알림» 이 아니라 **«알림이 전부 JS 에 살게 하는 것»** 이다.

## 층 — 무엇이 어디에 사는가

```
바이너리(스토어 심사)          │  JS(OTA)                       │  서버(Worker 배포)
───────────────────────────────┼────────────────────────────────┼──────────────────
notifee 런타임                 │  알림 종류 레지스트리          │  넥슨 공지 폴링
FCM 런타임 + 자격증명          │  문구·기본 시각·활성 기본값    │  발송 문구
백그라운드 태스크 런타임       │  미완료 판정·계획(plan)        │  발송 조건·주기
채널을 만드는 «코드 경로»      │  재조정(reconcile)·원장        │  마지막 발송 공지 id
진입점 셋의 «등록 한 줄»       │  설정 화면·탭 이동 목적지      │
```

**판정 규칙 한 줄** — *네이티브에 적히는 순간 OTA 로 못 고친다.* 그래서 위 왼쪽 칸에는 «능력» 만
있고 «정책» 이 없다.

### 진입점 셋은 «위치» 만 네이티브 요건이다

백그라운드 태스크 핸들러 · 푸시 백그라운드 핸들러 · 알림 이벤트(탭) 핸들러는 **앱 모듈 최상위에
등록돼 있어야** OS 가 죽은 앱을 깨울 수 있다. 등록을 나중에 OTA 로 더할 수 없다 — 그때는 OS 가 그
앱에 그런 진입점이 있다는 것을 모른다.

**등록만 바이너리에 박고 본문은 core 를 부른다.** 이 한 줄이 이 문서 전체의 지렛대다.

## 포트 (시그니처 수준)

`NotificationsPort` 는 **한 글자도 안 바꾼다**([[ADR-128]] 원칙 1) — 이 설계가 필요로 하는 것을 이미
준다. 부족한 것은 포트가 아니라 그 위층이었다.

```ts
// 신설 — 원격 푸시. 토큰은 앱 밖으로 나가지 않는다([[ADR-146]] 결정 2).
export interface PushPort {
  isSupported(): boolean            // 동기 — 구독을 시작하기 전에 판정해야 한다
  subscribe(topic: string): Promise<void>
  unsubscribe(topic: string): Promise<void>
  addMessageListener(handler: (message: PushMessage) => void): () => void
}
export interface PushMessage {
  /** 서버가 실은 임의 데이터(공지 id·링크 등). 표시 자체는 OS 가 이미 했다. */
  data: Record<string, string>
}

// 신설 — 백그라운드 태스크. **간격은 힌트다** — 실제 주기는 OS 가 정한다.
export interface BackgroundTaskPort {
  isSupported(): boolean
  register(options: { minimumIntervalMinutes: number }): Promise<void>
  unregister(): Promise<void>
}
```

포트 구현은 부팅 시 주입한다(`src/boot.ts` 의 관례 그대로). **Capacitor 구현은
`isSupported(): false` 인 no-op** 이다([[ADR-146]] 결정 8) — 없애지 않는 이유는 주입 전 접근이 던지는
계약(`native/ports.ts` 머리말)을 깨지 않기 위해서다.

## 레지스트리 — 알림 하나 = 정의 하나

```ts
export interface NotificationDefinition {
  kind: NotificationKind                 // OTA 로 는다
  channel: 'notice' | 'schedule' | 'general'
  defaultEnabled: boolean
  defaultTimeKst: string | null          // 'HH:mm'. 시각 개념이 없는 종류는 null
  /** 순수 함수 — 저장소·네이티브·시계를 모른다. */
  plan(input: PlanInput): PlannedNotification[]
}

export interface PlanInput {
  now: Date
  horizonEnd: Date                       // now + 7일([[ADR-146]] 결정 4)
  settings: NotificationSettings         // 사용자가 켠 것·고른 시각
  snapshot: ScheduleSnapshot             // 스케줄 캐시 요약(읽기 전용 데이터)
}

export interface PlannedNotification {
  id: number                             // (kind, 범위키, 회차키) 에서 결정적으로 계산
  kind: NotificationKind
  fireAt: Date
  title: string
  body: string
}
```

**`plan()` 이 순수한 것이 이 설계의 전부다** — 종류를 더하는 일이 «표에 한 줄 + 순수 함수 하나 + 그
테스트» 가 되고, 그 셋이 전부 JS 라 OTA 로 온다. 저장소·네이티브를 만지는 코드는 재조정 한 곳에만
있다.

## 재조정 (reconcile) — 차집합으로만 움직인다

OS 는 예약을 들고 있는데 앱은 **개수만** 조회할 수 있다([../persistence/lifecycle.md](../persistence/lifecycle.md)).
그래서 «우리가 예약해 둔 것» 을 **원장**(`notificationLedger`)에 우리가 적는다.

```
권한 없음  → 계획은 빈 목록 (예약하지 않고 원장에 있는 것을 전부 취소)
계획 = 켜진 정의들의 plan() 을 모은 것
취소 대상 = 원장에 있고 계획에 없는 것  ∪  kind 가 레지스트리에 없는 것
예약 대상 = 계획에 있고 원장에 없는 것  ∪  fireAt 이 달라진 것
둘 다 있고 fireAt 이 같으면 → 아무것도 안 한다
```

지켜야 하는 성질 넷:

- **멱등이다.** 몇 번을 돌려도 결과가 같다 — 앱 진입·동기화 완료·백그라운드 태스크가 전부 같은
  함수를 부르기 때문에 이것이 성립하지 않으면 예약이 흔들린다.
- **원장에 있는데 레지스트리에 없는 `kind` 는 무조건 취소한다.** ← **원장이 존재하는 유일한 이유다.**
  OTA 가 알림 종류를 지우면 그 예약이 유령으로 남는 사고를 여기서 막는다(`migration/data.md` 결정 4 가
  프레임워크 전환에서 겪은 것과 같은 사고이고, 이번엔 OTA 마다 일어날 수 있었다).
- **순서는 «예약 → 원장 쓰기», «취소 → 원장 지우기» 다.** 둘 다 중간에 죽으면 «다음에 한 번 더 한다»
  쪽으로 넘어진다. 반대로 하면(원장 먼저) 크래시 뒤 원장이 *"예약돼 있다"* 고 말해 **다시 예약할
  기회를 영영 잃는다.**
- **ID 는 결정적이다.** 같은 알림은 몇 번을 계획해도 같은 id 라 재예약이 덮어쓰기가 되고, 그것이 위
  «한 번 더 해도 안전» 의 근거다.

### 언제 도는가

| 트리거 | 무엇이 다른가 |
|---|---|
| 앱 포그라운드 진입 | 마지막으로 아는 상태로 계획 |
| `syncSchedules` 성공 직후 | 방금 받은 상태로 계획 |
| 백그라운드 태스크 | 동기화가 되면 최신으로, 실패하면 캐시로([[ADR-008]] 폴백) |
| 설정 변경(켬/끔·시각) | 즉시 |
| 권한 상태 변화 감지 | 꺼졌으면 전부 취소 |

**백그라운드 태스크는 «있으면 좋은 것» 이다** — 한 번도 안 돌아도 알림은 뜬다([[ADR-146]] 결정 3).
이 비대칭이 iOS 대비이고, 그래서 태스크 실패를 사용자에게 알리지 않는다.

## 알림 셋 (계획 — 전부 OTA 로 온다)

| 알림 | 채널 | 경로 | 판정 |
|---|---|---|---|
| 메이플스토리 공지 | `notice` | **FCM 토픽 푸시** | 서버가 판정 |
| 일간 스케줄 미완료 | `schedule` | 로컬 예약 | 하이브리드 |
| 주간 보스 미완료 | `schedule` | 로컬 예약 | 하이브리드 |

- **알림은 캐릭터를 말하지 않는다** — *"아직 안 끝낸 것이 있어요"* 한 줄로 접는다. 어느 캐릭터인지는
  앱을 열면 초상화 레일의 진행 링이 이미 말한다([[ADR-142]]). 이 결정으로 동시 예약 수가 **캐릭터 수와
  무관하게 10개 안쪽**이 되어 iOS 64개 한도가 구조적으로 사라진다([[ADR-146]] 결정 4).
- **문구는 마지막으로 아는 상태를 단정하지 않는다.** *"3개 남았어요"* 는 확인 시점의 값이라 발화
  시점에 거짓일 수 있다. 수를 싣는 것은 **발화 직전 재확인이 성공한 경우로 한정**한다.
- 주간 리셋은 KST 목요일 00:00 ([boss-scheduler.md](./boss-scheduler.md)), 일간은 KST 00:00 —
  `lib/reset-clock` 이 이미 그 계산을 갖고 있다. **기본 시각은 미정**(아래 «열린 질문»).

## 공지 푸시 — 토픽이고 토큰을 저장하지 않는다

```
Cron ─▶ Worker ─▶ 넥슨 공지 API(서버 자기 키)
                    │  마지막 발송 id 보다 새로운 것이 있으면
                    ▼
                  FCM HTTP v1 ─▶ topic ─▶ 기기(구독만 한다)
```

- **토큰이 앱 밖으로 나가지 않는다.** 기기는 토픽을 구독할 뿐이라 서버가 드는 상태는 «마지막으로
  발송한 공지 id» **하나**다([[ADR-137]] 결정 2 의 무상태 원칙을 깨는 최소값 — KV 키 1개).
- **사용자 개인 API 키는 여전히 기기 밖으로 나가지 않는다**([[ADR-003]] 유지). 서버로 옮겨 가는 것은
  «공개 정보를 긁는 일» 이지 사용자 데이터가 아니다.
- **문구는 Worker 가 만들어 `notification` 페이로드로 싣는다.** data-only 로 보내면 앱이 죽어 있을 때
  iOS 가 배달을 보장하지 않아 «안 뜨는 것» 과 같아진다. 문구가 서버에 있는 것이 «OTA 로 고친다» 는
  요구를 어기지 않는 이유는 **Worker 가 심사를 안 받아 OTA 보다 빨리 고쳐지기 때문**이다.
- `data` 에는 공지 id·링크만 싣는다 — **탭 이동과 중복 억제는 JS 가 맡는다.**

## 권한

- **부팅 때 묻지 않는다.** iOS 는 한 번 거부하면 다시 묻지 못하고 설정 앱으로 보내는 수밖에 없다.
  요청 시점은 **사용자가 알림을 켜는 순간** 하나다([[ADR-146]] 결정 7).
- 예약 직전에 항상 다시 확인한다 — 사용자가 OS 설정에서 언제든 끌 수 있다([[ADR-008]]).
- Android 13+ `POST_NOTIFICATIONS` 는 notifee 가 자기가 처리한다(`rn-notifications.ts` 머리말).

## 실패 처리

| 실패 | 어디서 | 처방 |
|---|---|---|
| 알림 권한 거부(최초) | 켜기 시도 시 | 켜지지 않은 채로 두고, 다시 켜려면 OS 설정으로 보낸다 |
| 권한 런타임 취소 | 재조정 시작 | 계획을 비우고 원장의 예약을 전부 취소 |
| 재확인 API 실패 | 백그라운드 태스크 | 마지막 캐시로 판정([[ADR-008]]) |
| 백그라운드 태스크가 안 돎 | — | **알리지 않는다** — 사전 예약이 이미 떠 있다 |
| 푸시 런타임 없음 | 구독 시도 | `isSupported()` 가 false 면 조용히 넘어간다(웹·일부 시뮬레이터) |
| 원장과 OS 가 어긋남 | — | 결정적 id + 멱등 재조정이 다음 회차에 흡수한다 |
| 기기 재부팅 | — | **미확인** — Android 는 `BOOT_COMPLETED` 재예약이 필요하다(열린 질문) |

## 저장

| 키 | 값 | 캐시 삭제 시 |
|---|---|---|
| `notificationSettings` | 종류별 `{enabled, timeKst}` (JSON) | **보존** — 사용자가 고른 설정이다 |
| `notificationLedger` | `{id, kind, fireAt}[]` (JSON) | 삭제 가능 — 다음 재조정이 다시 쓴다 |

- **원장이 지워져도 안전한 이유**: 계획이 다시 예약하면 **결정적 id 라 같은 예약을 덮어쓴다.** 남는
  위험은 «지금 레지스트리에 없는 옛 kind 의 예약» 뿐인데, 그것은 원장 없이는 애초에 못 지운다.
- 상세는 [../persistence/preferences.md](../persistence/preferences.md).

## 테스트 전략

- **`plan()` 전수 단위 테스트** — 순수 함수라 시계·저장소 없이 돈다. 지평선 경계·리셋 경계(KST 목요일
  00:00 · 자정)·설정 꺼짐·스냅샷 없음.
- **재조정 멱등성** — 같은 입력으로 두 번 돌려 두 번째에 `schedule`·`cancel` 호출이 **0회**임을 검증.
- **레지스트리에서 사라진 kind 가 취소되는가** — OTA 제거 시나리오의 회귀 가드. 이 테스트가 원장의
  존재 이유를 못 박는다.
- **크래시 창** — 예약 후 원장 쓰기 전에 죽은 상태에서 다시 돌면 «덮어쓰기 1회» 로 수렴하는가.
- 네이티브(실제 발화·재부팅·배터리 최적화·iOS 백그라운드 실행)는 **실기기 수동 QA** —
  [../foundation/architecture.md](../foundation/architecture.md) 테스트 전략의 관례 그대로.

## 열린 질문

- **넥슨 공지 API** — 실제 경로·응답 형태를 **아직 실측하지 않았다**(`scripts/probe-nexon-api.mjs`).
  개발자 키로 서버가 주기 폴링하는 것이 이용약관상 허용되는지도 확인 전이다.
- **기본 알림 시각** — 일간 몇 시, 주간 보스는 리셋 몇 시간 전인가. 게임 생활 패턴에 달린 값이라
  사용자 확인 대상([[ADR-006]] 취지).
- **공지 알림의 범위** — 공지·업데이트·이벤트·캐시샵 중 무엇을 보낼 것인가. 전부 보내면 알림 피로가
  곧 앱 삭제다.
- **재확인 성공 시 수를 싣는가** — 문구가 두 갈래가 되는 대가.
- **기기 재부팅 후 재예약** — notifee 가 어디까지 해 주는지 실기기 확인 전.
- **의존성 확정** — 푸시·백그라운드 태스크 라이브러리는 `expo prebuild` → 빌드로 «실제로 붙는 것» 을
  본 뒤에 이름을 적는다(notifee 를 고를 때의 관례).

## 폐기된 정책 (history)

- ~~서버 푸시를 일절 쓰지 않는다([[ADR-004]])~~ → **공지 알림에 한해 FCM 토픽 푸시**([[ADR-146]] 결정 2,
  2026-08-17). 로컬 예약만으로 충족된다는 전제가 «공지» 에서 깨졌다 — 기기 폴링은 iOS 에서 사실상 안
  돌고, 전 사용자가 각자 개인 키로 같은 공개 정보를 캔다. 미완료 알림은 **여전히 로컬 예약**이다.
- ~~캐릭터 수 × (일간 1 + 주간 1) 을 예약하고, iOS 64개 한도를 넘으면 «임박한 순 → 마지막으로 연
  캐릭터 순» 으로 자르고 설정에 *"일부 알림이 예약되지 않았습니다"* 를 표시한다([[ADR-004]])~~ →
  **계정 단위 한 줄로 접어 한도 자체를 안 만든다**([[ADR-146]] 결정 4). 우선순위 정책과 미예약 안내가
  함께 폐기된다 — 안 일어나는 일을 위한 UI 를 만들지 않는다.
- ~~발송 시각에 백그라운드로 재확인해 **미완료일 때만** 발송한다([[ADR-004]])~~ → **하이브리드**
  ([[ADR-146]] 결정 3). 원안은 오탐이 0 이지만 iOS 에서 태스크가 안 돌면 **아예 안 뜬다** — 조용한
  실패가 오탐보다 나쁘다고 봤다. 재확인 자체는 살아 있고, 사전 예약이 그 아래 깔린다.
