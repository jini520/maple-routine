import type {
  BackGesturePort,
  LiveUpdatePort,
  SystemBarsPort,
  ThemeAppearancePort,
} from '@core/native/ports'

/**
 * **RN 으로 아직 매핑되지 않은 포트 넷** — 부팅 배선이 이것들도 주입하되, 부르면 **던진다**.
 *
 * 조용한 no-op 이 아닌 이유는 `native/ports.ts` 헤더가 이미 정해 두었다: *"no-op 으로 두면 '이
 * 플랫폼엔 그 기능이 없다'와 '포트가 없다'가 구분되지 않아, 스플래시가 안 걷히거나 광고가 안 뜨는
 * 것이 정상 동작처럼 보인다."* 여기서는 한 겹 더 갈린다 — **"이 플랫폼에 그 개념이 없다"와 "해야
 * 하는데 아직 안 했다"는 다르다.**
 *
 * | | 예 | 처리 |
 * |---|---|---|
 * | 이 플랫폼에 개념이 없다 | `SplashScreenPort.show()` — RN 엔 웹뷰 리로드가 없어 덮을 구간이 안 생긴다 | **정당한 no-op** |
 * | 해야 하는데 아직 안 했다 | 이 파일의 넷 | **던진다** |
 *
 * 그래서 `rn-splash-screen.ts` 의 `show()` 는 조용하고 이 파일은 시끄럽다. 나중에 테마가 안 먹히거나
 * 안전영역이 0 일 때, 원인이 "구현이 아직 없다"는 것이 **첫 호출에서** 드러나야 한다.
 *
 * ---
 *
 * ## 왜 매핑이 안 되는가 — 셋은 뷰 레이어의 문제다
 *
 * 이 셋은 어댑터를 잘 짜면 되는 종류가 아니다. **웹뷰에서 side-effect 였던 것이 RN 에서는 렌더
 * 트리의 일부**라, 지금 어댑터로 흉내 내 봐야 뷰가 붙는 3단계에 전부 버려진다
 * (`docs/migration/README.md` — 3단계 «내비게이션 + `components/`»).
 *
 * - **`ThemeAppearancePort`** — 웹뷰 구현은 34토큰을 `<style>` 하나로 주입하고
 *   `data-theme`/`data-mode`·`color-scheme`·`scrollbar-color` 를 문서에 건다([[ADR-064]] 결정 10 ·
 *   [[ADR-099]] · [[ADR-122]]). RN 에는 CSS 도 DOM 도 없고, **테마는 side-effect 가 아니라 React
 *   상태로 적용된다** — 값이 흐르는 방향 자체가 반대다.
 * - **`SystemBarsPort`** — `refreshSafeAreaInsets()` 가 하는 일은 `--safe-area-inset-*` **CSS 변수를
 *   주입**하는 것이다([[ADR-099]] 가 스크롤포트를 그 값에 맞췄다). RN 은
 *   `react-native-safe-area-context` 가 같은 값을 컴포넌트로 내려준다 — **주입할 대상이 없다.**
 * - **`BackGesturePort`** — [[ADR-120]] 결정 17·18 이 손으로 만든 것(진행률·가장자리·3버튼 수렴)을
 *   react-navigation 네이티브 스택이 **OS 수준에서** 한다. 어댑터가 아니라 내비게이션 구조의
 *   문제이고, `parity-inventory.md` 도 이 자리를 *"삭제 — 네이티브 스택 기본"* 으로 적어 두었다.
 *
 * **다만 버리는 것은 구현이지 결정이 아니다.** [[ADR-120]] 이 정한 동작(탭바 동반 이동·시차·3버튼
 * 수렴)은 새 구조에서도 성립해야 하고, 기본값이 그것과 다르면 기본값이 아니라 [[ADR-120]] 을 따른다.
 *
 * ## 넷째는 성격이 다르다 — `LiveUpdatePort`
 *
 * 이쪽은 뷰 레이어가 아니라 **프로토콜**이 없다. 다른 어댑터는 같은 일을 하는 다른 SDK 로 바꾸는
 * 것이지만 OTA 는 @capgo 자체 호스팅 매니페스트 → `expo-updates` 로 **형식 자체가 바뀌고**,
 * [[ADR-022]]·[[ADR-026]]·[[ADR-119]]·[[ADR-126]] 이 정한 매니페스트 항목(`highlights` ·
 * `minNativeVersion` · 채널)을 새 프로토콜에 어떻게 싣는지는 **[[ADR-127]] 결정 7 이 별도 ADR 로
 * 미뤄 둔 결정**이다. 그래서 3단계가 아니라 그 ADR 을 가리킨다.
 *
 * (step 사양은 "미구현 3종"이라고 적었지만 실제로 매핑되지 않은 포트는 넷이다 — 어댑터 9종 +
 * 이 파일의 4종 = 포트 13종. 하나를 빼 두면 `installPorts()` 가 *"전부를 한 자리에서 보장한다"* 는
 * 자기 목적을 못 지키고, 그 자리는 슬롯의 일반 메시지(*"주입되지 않았습니다"*)로 떨어져 **왜**
 * 없는지를 말하지 않는다.)
 */

const MIGRATION_DOC = 'docs/migration/README.md'

/**
 * 메시지 한 벌을 여기서 만든다 — 포트마다 손으로 쓰면 어느 하나가 안내를 빠뜨려도 아무도 모른다.
 *
 * 담는 것 셋: **무엇이**(포트·메서드) · **왜**(해당 사유) · **어디를 보면 되는지**(문서).
 */
function notImplementedMessage(port: string, method: string, reason: string): string {
  return `${port}.${method}() 는 RN 에서 아직 구현되지 않았습니다 — ${reason} ${MIGRATION_DOC} 참고.`
}

const THEME_REASON =
  '테마 적용은 단계 3(뷰 레이어)에서 React 상태로 재설계됩니다(RN 에는 CSS 도 DOM 도 없습니다).'
const SYSTEM_BARS_REASON =
  '안전영역·시스템 바는 단계 3(뷰 레이어)에서 react-native-safe-area-context 가 컴포넌트로 값을 내려줍니다(주입할 CSS 변수가 없습니다).'
const BACK_GESTURE_REASON =
  '시스템 뒤로가기는 단계 3(뷰 레이어)에서 react-navigation 네이티브 스택이 OS 수준으로 처리합니다([[ADR-120]] 동작은 그대로 지켜야 합니다).'
const LIVE_UPDATE_REASON =
  'OTA 는 프로토콜 자체가 바뀌어(@capgo → expo-updates) [[ADR-127]] 결정 7 이 별도 ADR 로 미뤄 둔 결정입니다.'

/**
 * 동기 시그니처(`apply` · `isSupported` · `openStore`)는 **동기로** 던진다. 여기서 Promise 를 쓸
 * 방법이 없기도 하지만, `isSupported()` 가 동기인 것 자체가 계약이다 — 매니페스트를 받기 **전에**
 * 판정해야 지원하지 않는 환경에서 네트워크가 안 나간다(`native/ports.ts`).
 */
function throwSync(port: string, method: string, reason: string): never {
  throw new Error(notImplementedMessage(port, method, reason))
}

/**
 * 비동기 시그니처는 **거부된 Promise** 로 준다(`rn-hunting-timer.ts` 와 같은 판단). 동기 `throw` 로
 * 두면 `await` 없이 `.catch()` 만 단 호출부에서 예외가 그대로 터진다.
 */
async function throwAsync(port: string, method: string, reason: string): Promise<never> {
  throw new Error(notImplementedMessage(port, method, reason))
}

export const notImplementedThemeAppearancePort: ThemeAppearancePort = {
  apply: () => throwSync('ThemeAppearancePort', 'apply', THEME_REASON),
}

export const notImplementedSystemBarsPort: SystemBarsPort = {
  setNavigationBarStyle: () =>
    throwAsync('SystemBarsPort', 'setNavigationBarStyle', SYSTEM_BARS_REASON),
  refreshSafeAreaInsets: () =>
    throwAsync('SystemBarsPort', 'refreshSafeAreaInsets', SYSTEM_BARS_REASON),
}

export const notImplementedBackGesturePort: BackGesturePort = {
  setEnabled: () => throwAsync('BackGesturePort', 'setEnabled', BACK_GESTURE_REASON),
  moveToBackground: () => throwAsync('BackGesturePort', 'moveToBackground', BACK_GESTURE_REASON),
  addListeners: () => throwAsync('BackGesturePort', 'addListeners', BACK_GESTURE_REASON),
}

export const notImplementedLiveUpdatePort: LiveUpdatePort = {
  isSupported: () => throwSync('LiveUpdatePort', 'isSupported', LIVE_UPDATE_REASON),
  notifyAppReady: () => throwAsync('LiveUpdatePort', 'notifyAppReady', LIVE_UPDATE_REASON),
  getCurrent: () => throwAsync('LiveUpdatePort', 'getCurrent', LIVE_UPDATE_REASON),
  httpGet: () => throwAsync('LiveUpdatePort', 'httpGet', LIVE_UPDATE_REASON),
  download: () => throwAsync('LiveUpdatePort', 'download', LIVE_UPDATE_REASON),
  applyBundle: () => throwAsync('LiveUpdatePort', 'applyBundle', LIVE_UPDATE_REASON),
  getNetworkType: () => throwAsync('LiveUpdatePort', 'getNetworkType', LIVE_UPDATE_REASON),
  openStore: () => throwSync('LiveUpdatePort', 'openStore', LIVE_UPDATE_REASON),
}
