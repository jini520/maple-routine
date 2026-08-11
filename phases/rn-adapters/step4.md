# Step 4: rn-hunting-timer

## 읽어야 할 파일

- `/docs/README.md` (문서 인덱스)
- **`/docs/features/hunting-timer.md`** (기능 정책)
- `/docs/ADR.md` 에서 **[[ADR-127]] · [[ADR-005]]** 만 열어라 — **[[ADR-005]] 가 이 기능의 근거 결정이다**
- `packages/core/src/native/ports.ts` (**`HuntingTimerPort` · `HuntingTimerState` 계약**)
- `packages/core/src/native/hunting-timer/hunting-timer.ts` · `hunting-timer.web.ts`
- `packages/app-capacitor/src/native/adapters/capacitor-hunting-timer.ts` (**참조 구현**)
- **이전 step 산출물**: `packages/app-rn/src/native/adapters/rn-notifications.ts` — **같은 알림
  라이브러리를 쓴다. 설정을 중복하지 말고 재사용하라**

## 배경

```ts
export interface HuntingTimerPort {
  start(options: { soundIntervalMinutes: number }): Promise<void>
  stop(): Promise<void>
  getState(): Promise<HuntingTimerState>   // { isRunning, startedAt, soundIntervalMinutes }
}
```

[[ADR-005]] 가 정한 것은 **상시 표시 알림 + 주기적 사운드**다. 예약 알림(step 3)과 성격이 다르다 —
이쪽은 **앱이 백그라운드로 가도 계속 살아 있어야 하는 지속 알림**이다.

- **Android**: foreground service + ongoing notification. notifee 의 foreground service API 를 쓴다.
  `FOREGROUND_SERVICE` 권한과 매니페스트 선언이 필요하다
- **iOS**: 백그라운드 실행 제약이 Android 와 완전히 다르다. 원래 구현이 iOS 에서 무엇을 했는지
  `capacitor-hunting-timer.ts` 와 `features/hunting-timer.md` 로 먼저 확인하라 — **없던 기능을
  새로 만들지 마라**

## 작업

### 1. 먼저 현재 동작을 파악하라

`capacitor-hunting-timer.ts` 와 `hunting-timer.web.ts` 를 읽고 **플랫폼별로 실제 무엇을 하는지**
적어 두고 시작하라. 특히:

- iOS 에서 상시 알림이 실제로 되는가, 아니면 다른 방식인가
- `soundIntervalMinutes` 주기 사운드를 무엇이 울리는가
- `getState()` 의 `startedAt` 이 어디에 보관되는가 (네이티브인가 저장소인가)

**여기서 파악한 것과 다르게 구현하지 마라.** 이 task 는 같은 동작을 다른 SDK 로 옮기는 것이다.

### 2. `HuntingTimerPort` 구현

`packages/app-rn/src/native/adapters/rn-hunting-timer.ts`.

step 3 에서 도입한 알림 라이브러리를 **재사용**하라. 같은 앱에 알림 SDK 두 개를 넣지 마라 — 채널·권한·
초기화가 갈라져 서로를 덮어쓴다.

### 3. `getState()` 의 진실 원천을 유지하라

`isRunning`·`startedAt` 을 어디서 읽느냐가 동작을 가른다. 원래 구현이 네이티브에서 읽는다면 RN 에서도
네이티브에서 읽어라 — 저장소로 옮기면 **앱이 죽었다 살아난 뒤 상태가 갈린다.**

### 4. iOS 에서 안 되는 것은 안 된다고 하라

원래 구현이 iOS 에서 제한적이었다면 **그 제한을 그대로 유지하라.** 없던 기능을 만들지 말고, 되는 척
하는 no-op 도 두지 마라 — 사용자가 타이머를 켰다고 믿는데 안 울리는 것이 최악이다.

### 5. jest 로 테스트할 것

- `soundIntervalMinutes` → 라이브러리 반복 설정 변환
- `getState()` 반환이 `HuntingTimerState` 모양인가
- `start` 후 `stop` 의 멱등성 (두 번 불러도 안전한가)

## Acceptance Criteria

```bash
npm test           # vitest 3044 + jest 전부 통과
npm run build
npm run lint       # 0 errors
cd packages/app-rn && npx tsc --noEmit -p tsconfig.json
cd packages/app-rn && npx expo prebuild --no-install --platform android && cd android && ./gradlew assembleDebug
```

매니페스트 확인:

```bash
grep -n "FOREGROUND_SERVICE\|foregroundService" packages/app-rn/android/app/src/main/AndroidManifest.xml
```

**iOS**: best-effort. 막히면 `blocked` + 사유.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - step 3 과 **같은 알림 라이브러리**를 쓰는가? (SDK 두 벌이 아닌가)
   - 원래 구현의 플랫폼별 동작을 그대로 옮겼는가? (없던 기능을 만들지 않았는가)
   - `getState()` 의 진실 원천이 원래와 같은가?
   - `packages/core` 를 수정했는가? **했다면 잘못된 것이다**
3. `phases/rn-adapters/index.json` 의 step 4 를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "파악한 원래 동작·플랫폼별 구현 방식·iOS 제한 여부"`
   - 실패 → `"error"` / 개입 필요 → `"blocked"`

## 금지사항

- **알림 SDK 를 새로 추가하지 마라. step 3 것을 재사용하라.** 이유: 채널·권한·초기화가 갈라져 서로를
  덮어쓴다.
- **iOS 에서 안 되는 것을 되는 것처럼 no-op 으로 두지 마라.** 이유: 사용자가 타이머를 켰다고 믿는데
  안 울리면, 그 기능이 있는 것보다 나쁘다.
- **원래 없던 기능을 추가하지 마라.** 이유: 이 task 는 같은 동작을 옮기는 것이다. 개선은 전환 후.
- **`packages/core` 를 수정하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
