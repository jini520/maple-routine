import { Platform } from 'react-native'

import type { HuntingTimerPort } from '@core/native/ports'

/**
 * `HuntingTimerPort` 의 RN 구현([[ADR-128]] 결정 4 — 밖으로 나가는 시그니처는 Capacitor 구현과
 * 한 글자도 다르지 않다). 정책은 [[ADR-005]](상시 표시 알림 + 주기적 사운드).
 *
 * ---
 *
 * ⚠️ **옮길 구현이 없다. 사냥 타이머는 어느 플랫폼에서도 구현된 적이 없다.**
 *
 * [[ADR-005]] 는 Android Foreground Service + `setUsesChronometer(true)` 와 iOS Live Activity 를
 * 정했지만 **그 커스텀 플러그인은 작성되지 않았다** — 저장소 전체에서 `HuntingTimer` 를 담은
 * `.java`/`.kt`/`.swift` 파일이 0건이다(node_modules 포함). Capacitor 쪽에 있는 것은 플러그인
 * 이름을 등록하는 한 줄뿐이다:
 *
 * ```ts
 * registerPlugin<HuntingTimerPort>('HuntingTimer', { web: () => new HuntingTimerWeb() })
 * ```
 *
 * `@capacitor/core` 의 `registerPlugin` 을 따라가면 **네이티브에서 이것이 무엇이 되는지**가 나온다:
 * `loadPluginImplementation()` 은 `platform in jsImplementations` 에서 갈리는데 등록된 것은 `web`
 * 하나뿐이라 android·ios 는 걸리지 않고, 두 번째 갈래(`capCustomPlatform !== null`)도 실제
 * 기기에서는 `null` 이라 구현이 `undefined` 로 남는다. 이어지는 `createPluginMethod` 는
 * `cap.PluginHeaders` 에서 `'HuntingTimer'` 를 찾는데 네이티브 등록이 0건이라 그것도 `undefined`
 * 이고, 그래서 마지막 `else` 로 떨어진다 —
 * `throw new CapacitorException('"HuntingTimer" plugin is not implemented on android', UNIMPLEMENTED)`.
 *
 * 즉 **실기기에서는 세 메서드가 전부 거부되고**, 인메모리 폴백(`HuntingTimerWeb`)은 브라우저
 * (`platform === 'web'`)에서만 쓰인다. 상시 알림도, 주기 사운드도, `soundIntervalMinutes` 를
 * 소비하는 코드도 존재하지 않는다. `getState()` 의 `startedAt` 이 사는 곳 역시 네이티브도
 * 저장소도 아닌 그 웹 폴백의 인스턴스 필드뿐이다. 소비자도 없다 — `app/hunting-timer/` ·
 * `features/hunting-timer/` 는 디렉터리 자체가 없다.
 *
 * 문서 넷이 같은 말을 한다: `docs/features/hunting-timer.md` «구현 현황» ·
 * `docs/persistence/README.md` · `docs/migration/parity-inventory.md`(*상시 알림 — 별도 확인 필요*) ·
 * `docs/migration/data.md` «미검증 항목». **이 파일이 그 «별도 확인»의 답이다.**
 *
 * ---
 *
 * **그래서 이 어댑터는 거부한다.** app-rn 이 빌드하는 타깃은 android·ios 둘뿐이고, 그 두
 * 플랫폼에서 지금 일어나는 일이 정확히 거부다. 고를 수 있었던 다른 둘은 이렇게 갈렸다:
 *
 * - **인메모리 폴백을 옮긴다** — 웹 전용이던 동작을 네이티브로 **승격**시키는 것이라 파리티가
 *   아니다. 게다가 `start()` 가 조용히 resolve 하면 화면은 "타이머가 돌고 있다"고 믿는데 알림도
 *   소리도 없다. 기능이 없는 것보다 나쁘다.
 * - **notifee 로 Foreground Service 를 짠다** — 없던 기능을 새로 만드는 것이다([[ADR-005]] 는
 *   설계이지 구현이 아니다). iOS 절반(Live Activity)은 위젯 익스텐션이 필요해 짝도 안 맞고,
 *   소비자가 없어 검증할 방법도 없다. 알림 SDK 는 step 3 의 notifee 하나로 족하고 **이 파일은
 *   어떤 SDK 도 새로 들이지 않는다.**
 *
 * `getState()` 까지 거부하는 것이 중요하다. `{ isRunning: false }` 를 돌려주면 호출부는 "정지
 * 상태"라는 **답을 받은 것**으로 읽어 시작 버튼을 그리고, 없다는 사실은 `start()` 가 실패하는
 * 순간에야 드러난다. 없는 것은 첫 호출에서 드러나야 한다.
 *
 * 되살릴 때 필요한 것은 이 파일이 아니라 **결정**이다 — [[ADR-005]] 를 실제로 구현할지, 두 플랫폼
 * 짝을 어떻게 맞출지. 그때 이 상수 셋을 실제 구현으로 갈아끼우면 된다.
 */

/**
 * Capacitor 가 던지던 것과 같은 모양의 메시지다(`"HuntingTimer" plugin is not implemented on
 * android`). 플랫폼을 담는 이유도 같다 — 어느 타깃에서 났는지가 로그의 첫 질문이다.
 */
export function huntingTimerUnimplementedMessage(method: string, platform: string): string {
  return `"HuntingTimer.${method}()" is not implemented on ${platform} — 사냥 타이머 상시 알림은 [[ADR-005]] 에 설계만 있고 네이티브 구현이 존재한 적이 없습니다.`
}

/**
 * `async` 인 것이 계약이다 — 동기 `throw` 로 두면 `await` 없이 `.catch()` 만 단 호출부에서 예외가
 * 그대로 터진다. Capacitor 도 `loadPluginImplementation().then(...)` 안에서 던져 **거부된
 * Promise** 로 나왔다.
 */
async function unimplemented(method: string): Promise<never> {
  throw new Error(huntingTimerUnimplementedMessage(method, Platform.OS))
}

export const rnHuntingTimerPort: HuntingTimerPort = {
  start: () => unimplemented('start'),
  stop: () => unimplemented('stop'),
  getState: () => unimplemented('getState'),
}
