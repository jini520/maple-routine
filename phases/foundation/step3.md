# Step 3: native-adapter-stub

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ARCHITECTURE.md` — 특히 `native/` 레이어의 위치와 역할
- `/docs/ADR.md` — 특히 [[ADR-004]](서버 푸시 없이 로컬 알림만 사용, 64개 한도), [[ADR-005]](사냥 타이머는 상시 표시 알림 + 주기적 사운드 — 커스텀 네이티브 플러그인 필요), [[ADR-008]]의 "알림/타이머 네이티브 실패" 처리 정책
- `src/types/` — 이전 step(`core-types`)에서 정의한 타입. 이 step에서 새 도메인 타입이 필요하면 여기 추가해도 되지만, 우선 재사용 가능한 것부터 확인하라.

## 배경

`native/`는 Capacitor 플러그인을 감싸는 어댑터 레이어다. 이번 step은 두 가지 성격이 다른 기능을 다룬다 — **범위를 명확히 구분해서 작업하라**:

1. **알림(`notifications`)** — `@capacitor/local-notifications`라는 **공식 플러그인이 이미 존재**하므로, 이번 step에서 **실제로 동작하는 구현**을 만든다. 일간/주간 리셋 알림 예약, 사냥 타이머 폴백 알림 등 이후 features가 공통으로 쓸 것이다.
2. **사냥 타이머 상시 알림(`hunting-timer`)** — [[ADR-005]] 확정 사항: Android Foreground Service(Chronometer)와 iOS Live Activity는 공식 Capacitor 플러그인이 없어 **Swift/Kotlin 커스텀 네이티브 플러그인**이 있어야 한다. **이번 foundation task는 그 커스텀 네이티브 코드(Kotlin/Swift)를 작성하지 않는다** — 디바이스 빌드·테스트가 필요한 작업이라 별도 task로 분리한다. 대신 이번 step에서는 (a) TypeScript 쪽 플러그인 인터페이스 정의와 (b) 웹/개발 환경에서 동작하는 in-memory no-op 폴백 구현만 만든다. 실제 Android/iOS 네이티브 코드는 나중 task에서 이 인터페이스를 구현하는 형태로 채워 넣을 것이다.

**Capacitor 커스텀 플러그인의 표준 패턴**을 따르라(공식 문서 컨벤션): `registerPlugin<T>(pluginName, { web: () => Promise<T 구현체> })`으로 등록하고, 네이티브 구현이 없는 플랫폼(웹)에서는 `web` 폴백이 쓰인다. 이번 step은 `web` 폴백만 채우고, 실제 Android/iOS 네이티브 디렉토리(`android/`, `ios/`)에 플러그인 코드를 추가하지 않는다.

## 작업

1. `npm install @capacitor/local-notifications`로 의존성을 추가하라.

**`src/native/notifications.ts`** — 실제 구현 (공식 플러그인 사용)
```ts
export interface LocalNotificationRequest {
  id: number
  title: string
  body: string
  scheduleAt: Date
}
export async function requestNotificationPermission(): Promise<boolean>
export async function hasNotificationPermission(): Promise<boolean>
export async function scheduleLocalNotification(request: LocalNotificationRequest): Promise<void>
export async function cancelLocalNotification(id: number): Promise<void>
export async function getPendingNotificationCount(): Promise<number>
```
- `@capacitor/local-notifications`의 `LocalNotifications.requestPermissions`/`checkPermissions`/`schedule`/`cancel`/`getPending`을 감싸라.
- [[ADR-004]]의 "iOS 로컬 알림 64개 한도" 정책은 이 어댑터의 몫이 아니라 향후 스케줄링 로직(features 레이어)의 몫이다 — 이 step은 개수 제한 로직을 넣지 마라, 단순히 개별 알림 예약/취소/조회 API만 제공하라. `getPendingNotificationCount`는 그 상위 로직이 현재 몇 개가 예약돼 있는지 알기 위한 조회 함수로만 존재한다.

**`src/native/hunting-timer.ts`** — TS 인터페이스 + 플러그인 등록
```ts
export interface HuntingTimerState {
  isRunning: boolean
  startedAt: string | null // ISO 문자열
  soundIntervalMinutes: number | null
}
export interface HuntingTimerPlugin {
  start(options: { soundIntervalMinutes: number }): Promise<void>
  stop(): Promise<void>
  getState(): Promise<HuntingTimerState>
}
```
- `registerPlugin<HuntingTimerPlugin>('HuntingTimer', { web: () => import('./hunting-timer.web').then((m) => new m.HuntingTimerWeb()) })` 형태로 등록하고 default export하라.

**`src/native/hunting-timer.web.ts`** — 웹/개발용 in-memory 폴백 구현
```ts
export class HuntingTimerWeb implements HuntingTimerPlugin {
  start(options: { soundIntervalMinutes: number }): Promise<void>
  stop(): Promise<void>
  getState(): Promise<HuntingTimerState>
}
```
- 실제 Foreground Service/Live Activity 없이, 메모리에 `isRunning`/`startedAt`/`soundIntervalMinutes` 상태만 들고 있다가 `getState()`로 그대로 돌려주는 단순 구현이면 된다. 파일 상단에 "실제 Android Foreground Service / iOS Live Activity 네이티브 구현은 별도 task([[ADR-005]])" 라는 한 줄 주석만 남겨라.

## Acceptance Criteria

```bash
npm run build
npm run lint
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트를 확인한다:
   - `native/` 밖에 파일을 추가하지 않았는가?
   - `android/`, `ios/` 네이티브 프로젝트 디렉토리에 코드를 추가하지 않았는가(이번 step 범위 아님)?
   - 알림(`notifications.ts`)은 실제 플러그인 호출로 구현하고, 사냥 타이머(`hunting-timer.ts`/`.web.ts`)는 인터페이스+웹 폴백만 있는가(둘의 구현 깊이 차이가 의도적으로 다름을 확인)?
3. `src/native/__tests__/`에 테스트를 먼저 작성한 뒤(TDD) 구현하라. `@capacitor/local-notifications`는 `vi.mock`으로 모킹하라. 최소한 다음을 검증하라:
   - `scheduleLocalNotification`/`cancelLocalNotification`이 모킹된 `LocalNotifications.schedule`/`cancel`을 올바른 인자로 호출한다.
   - `HuntingTimerWeb`의 `start()` 이후 `getState()`가 `isRunning: true`와 요청한 `soundIntervalMinutes`를 반환한다.
   - `HuntingTimerWeb`의 `stop()` 이후 `getState()`가 `isRunning: false`를 반환한다.

## 금지사항

- `android/`, `ios/` 네이티브 프로젝트에 Kotlin/Swift 코드를 작성하지 마라. 이유: [[ADR-005]]의 커스텀 네이티브 플러그인 구현은 디바이스 빌드·테스트가 필요해 별도 task로 분리했다. 이번 step은 TS 인터페이스와 웹 폴백까지만이다.
- 사냥 타이머 알림의 64개 한도 우선순위 계산 로직을 이 어댑터에 넣지 마라. 이유: 그건 여러 캐릭터/알림 종류를 종합 판단해야 하는 features 레이어의 몫이다.
- 기존 테스트를 깨뜨리지 마라.
