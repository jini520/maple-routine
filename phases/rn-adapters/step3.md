# Step 3: rn-notifications

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- `/docs/migration/data.md` — **결정 4(예약된 로컬 알림 재등록)**. 이 step 이 그 문제의 절반을 만든다
- `/docs/ADR.md` 에서 **[[ADR-128]] · [[ADR-004]]** 만 열어라
- `/docs/features/content-scheduler.md` · `/docs/features/boss-scheduler.md` (알림을 거는 쪽)
- `packages/core/src/native/ports.ts` (**`NotificationsPort` · `LocalNotificationRequest` 계약**)
- `packages/core/src/native/notifications.ts` (포트를 부르는 곳)
- `packages/app-capacitor/src/native/adapters/capacitor-notifications.ts` (**참조 구현**)
- **이전 step 산출물**: `packages/app-rn/src/storage/adapters/` 의 배치·명명 관례

## 배경

`NotificationsPort` 의 RN 구현을 만든다. 라이브러리는 **notifee** 를 기본으로 하되, Expo SDK 57 과의
호환을 확인하고 문제가 있으면 `expo-notifications` 로 가라. 고른 근거를 summary 에 남겨라.

```ts
export interface NotificationsPort {
  requestPermission(): Promise<boolean>
  hasPermission(): Promise<boolean>
  schedule(request: LocalNotificationRequest): Promise<void>   // { id, title, body, scheduleAt }
  cancel(id: number): Promise<void>
  getPendingCount(): Promise<number>
}
```

### 반드시 알아야 할 것 — ID 체계가 데이터다

`schedule` 의 `id` 는 **호출부가 정한 숫자**다. `cancel(id)` 가 같은 숫자로 취소한다. 즉 **ID 는 앱
전체에 걸친 계약**이고, 어댑터가 임의로 재해석하면(해시·문자열 변환 등) **취소가 동작하지 않는다.**

라이브러리가 문자열 ID 를 요구하면 **양방향으로 손실 없이** 변환하라(`String(id)` ↔ `Number(id)`).
해시나 접두사 조합처럼 **되돌릴 수 없는 변환을 쓰지 마라.**

## 작업

### 1. `NotificationsPort` 구현

`packages/app-rn/src/native/adapters/rn-notifications.ts`.

- **Android 채널**: notifee 는 채널을 요구한다. Capacitor 시절 채널과 같은 동작이 되게 하라
  (중요도·소리). 채널 ID 를 summary 에 남겨라 — 단계 2에서 옛 예약과의 충돌을 볼 때 필요하다
- **권한**: Android 13+ 는 `POST_NOTIFICATIONS` 런타임 권한이 필요하다. `requestPermission()` 이
  그것을 처리해야 한다
- **`getPendingCount()`**: 예약된(아직 발화 안 한) 알림 수. 라이브러리 API 로 세어라

### 2. 옛 예약 정리는 여기서 하지 마라

`data.md` 결정 4가 다루는 **"Capacitor 시절 예약을 취소하고 전부 재등록"** 은 이 step 의 범위가
**아니다.** 그건 앱 부팅 흐름의 1회성 처리이고 단계 2에서 실기기와 함께 설계한다.

다만 **그 문제가 존재한다는 것을 코드 주석에 남겨라** — 새 SDK 로는 옛 예약을 취소할 수 없어
중복 알림이 날 수 있다는 사실이 어댑터를 읽는 사람 눈에 보여야 한다.

### 3. 순수 로직을 jest 로 테스트하라

- `LocalNotificationRequest` → 라이브러리 요청 객체 변환 (특히 `scheduleAt: Date` → 트리거)
- ID 변환이 **왕복 손실이 없는지** (`id → 라이브러리 형식 → id`)
- 과거 시각이 들어왔을 때의 처리

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

**iOS**: best-effort. 막히면 `blocked` + 정확한 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ID 변환이 왕복 무손실인가? (`cancel` 이 `schedule` 한 알림을 실제로 지목하는가)
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**
   - Android 13+ 권한 요청이 있는가?
   - 옛 예약 문제가 주석에 남았는가?
3. `phases/rn-adapters/index.json` 의 step 3 을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "고른 라이브러리와 근거·Android 채널 ID·ID 변환 방식"`
   - 실패 → `"error"` + `error_message` / 개입 필요 → `"blocked"` + `blocked_reason`

## 금지사항

- **알림 ID 를 되돌릴 수 없게 변환하지 마라(해시 등).** 이유: `cancel(id)` 가 대상을 못 찾아 사용자가
  끈 알림이 계속 뜬다.
- **옛 Capacitor 예약을 취소하는 코드를 여기 넣지 마라.** 이유: 부팅 흐름의 1회성 처리라 단계 2에서
  실기기와 함께 설계한다. 여기서 넣으면 검증 못 하는 코드가 늘어난다.
- **`packages/core` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
