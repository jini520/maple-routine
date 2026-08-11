/**
 * 네이티브 포트 — `native/*` 가 플랫폼 플러그인 대신 이 인터페이스에만 의존한다([[ADR-127]]).
 *
 * [[ADR-003]]·[[ADR-005]] 가 그은 경계는 "`features/*` 가 네이티브 API를 직접 만지지 않는다"였고 그
 * 규칙은 지켜져 왔다. 다만 어댑터 자신이 Capacitor 플러그인을 직접 import 하고 있어서 **어댑터를
 * 프레임워크 없는 패키지로 옮길 수 없었다** — 여기서 뒤집는 것이 그 방향 하나뿐이다. 밖으로 나가는
 * `native/*` 함수 시그니처는 한 글자도 안 바뀐다([[ADR-127]] 결정 4).
 *
 * **포트는 플랫폼을 모른다.** 지금 어댑터들이 `Capacitor.getPlatform()` 으로 웹이면 no-op 하는 그
 * 분기는 전부 구현(`native/adapters/*`) 안에 남는다. 이 인터페이스를 부르는 쪽이 아는 것은 "부르면
 * 알아서 된다"뿐이고, 그래서 `isSupported()`·`prepareInterstitial(): boolean` 처럼 **결과로 능력을
 * 말하는** 자리는 있어도 "지금 어느 플랫폼인가"를 묻는 자리는 없다.
 *
 * 포트 구현은 앱이 부팅 시 주입한다(`src/main.tsx`). 주입 전에 네이티브를 건드리면 **조용히 넘어가지
 * 않고 던진다** — no-op 으로 두면 "이 플랫폼엔 그 기능이 없다"와 "포트가 없다"가 구분되지 않아,
 * 스플래시가 안 걷히거나 광고가 안 뜨는 것이 정상 동작처럼 보인다(`storage/ports.ts` 와 같은 판단).
 */

/**
 * 전면광고 ([[ADR-090]] 결정 4).
 *
 * 광고 단위 ID·테스트 광고 판정은 `native/ads.ts` 의 순수 함수가 갖고 있고 어댑터가 그것을 쓴다 —
 * 그 게이트가 이 프로젝트에서 가장 비싼 실수(실 ID로 자기 광고 클릭)의 유일한 방어선이라 플랫폼
 * 구현마다 다시 쓰이면 안 된다.
 */
export interface AdsPort {
  /** SDK 초기화. 광고를 쓸 수 없는 환경이면 아무것도 하지 않는다. */
  initialize(): Promise<void>
  /**
   * 다음 전면광고를 미리 받아둔다. **준비됐으면 `true`** — 광고를 쓸 수 없는 환경이면 던지지 않고
   * `false` 다. 플러그인이 "로드됐는지" 묻는 API를 주지 않아 그 상태는 호출부가 들고 있는다.
   */
  prepareInterstitial(): Promise<boolean>
  /** 준비된 광고를 표시한다. **실제로 떴으면 `true`**(안 떴는데 기록하면 30분간 광고가 죽는다). */
  showInterstitial(): Promise<boolean>
}

/**
 * 스플래시 ([[ADR-025]]·[[ADR-027]]·[[ADR-117]]).
 *
 * 이 포트가 다루는 것은 "화면을 덮는다/되돌린다"이지 플러그인 호출이 아니다 — 웹뷰에서는 네이티브
 * 스플래시 + DOM 커버 두 장이 함께 그 일을 하고(`#boot-cover` · `[data-splash-cover]`), 그 두 장은
 * 정의상 웹뷰 구현이라 어댑터가 갖는다.
 */
export interface SplashScreenPort {
  /** 덮개를 전부 걷는다. 리로드가 실패해 남은 커버까지 포함해서다([[ADR-117]] 결정 4). */
  hide(): Promise<void>
  /** 리로드 직전에 화면을 덮는다. 덮을 것이 없는 환경이면 아무것도 하지 않는다. */
  show(): Promise<void>
}

/** 상태바 글리프 명암. */
export interface StatusBarPort {
  setStyle(isDarkTheme: boolean): Promise<void>
}

/** 하단 시스템 내비게이션 바와 안전영역 인셋. */
export interface SystemBarsPort {
  setNavigationBarStyle(isDarkTheme: boolean): Promise<void>
  refreshSafeAreaInsets(): Promise<void>
}

export interface KeyboardPort {
  /** 키보드 표시 여부를 구독하고 해제 함수를 돌려준다. 키보드가 없는 환경이면 no-op 해제 함수. */
  addVisibilityListener(onChange: (visible: boolean) => void): Promise<() => void>
}

export interface LocalNotificationRequest {
  id: number
  title: string
  body: string
  scheduleAt: Date
}

export interface NotificationsPort {
  requestPermission(): Promise<boolean>
  hasPermission(): Promise<boolean>
  schedule(request: LocalNotificationRequest): Promise<void>
  cancel(id: number): Promise<void>
  getPendingCount(): Promise<number>
}

export interface BackProgressEvent {
  /** 0~1. 시스템이 계산한 제스처 진행률. */
  progress: number
  /** 제스처가 시작된 가장자리. */
  edge: 'left' | 'right'
}

export interface BackGestureHandlers {
  /** 제스처가 시작됐다(제스처 내비에서만). */
  onStarted?: (event: BackProgressEvent) => void
  /** 손가락이 움직였다(제스처 내비에서만). */
  onProgress?: (event: BackProgressEvent) => void
  /** 뒤로가기가 확정됐다. **3버튼에서는 이것만 온다.** */
  onInvoked: () => void
  /** 제스처가 취소됐다(제스처 내비에서만). */
  onCancelled?: () => void
}

/** 시스템 뒤로가기 ([[ADR-120]] 결정 17·18). */
export interface BackGesturePort {
  setEnabled(enabled: boolean): Promise<void>
  moveToBackground(): Promise<void>
  /** 리스너를 붙이고 해제 함수를 돌려준다. 시스템 뒤로가기가 없는 환경이면 no-op 해제 함수. */
  addListeners(handlers: BackGestureHandlers): Promise<() => void>
}

export interface HuntingTimerState {
  isRunning: boolean
  startedAt: string | null
  soundIntervalMinutes: number | null
}

/** 사냥 타이머 상시 알림 ([[ADR-005]]). */
export interface HuntingTimerPort {
  start(options: { soundIntervalMinutes: number }): Promise<void>
  stop(): Promise<void>
  getState(): Promise<HuntingTimerState>
}

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown'

export interface LiveUpdateHttpRequest {
  url: string
  params?: Record<string, string>
  headers?: Record<string, string>
}

export interface LiveUpdateHttpResponse {
  status: number
  /** 파싱 전 원문. CDN이 octet-stream으로 내려주면 문자열이 온다([[ADR-026]]). */
  data: unknown
}

export interface LiveUpdateDownloadParams {
  url: string
  version: string
  checksum: string
}

/**
 * Live Update (OTA) ([[ADR-022]]·[[ADR-024]]·[[ADR-026]]·[[ADR-027]]·[[ADR-117]]).
 *
 * **매니페스트 형식·버전 비교·적용 순서는 이 포트 밖(`native/live-update.ts`)에 있다** — 프로토콜
 * 재설계(@capgo → expo-updates)는 별도 결정이고([[ADR-127]] 결정 7), 그때 갈아끼우는 것은 이 인터페이스
 * 구현이지 그 정책이 아니다.
 */
export interface LiveUpdatePort {
  /**
   * 이 실행 환경에 라이브 업데이트 런타임이 있는가(개발 서버에는 없다).
   *
   * 동기인 것이 중요하다 — 매니페스트를 받기 **전에** 판정해야 지원하지 않는 환경에서 네트워크
   * 요청이 나가지 않는다.
   */
  isSupported(): boolean
  notifyAppReady(): Promise<void>
  /** 지금 도는 번들과 설치된 네이티브 셸의 버전. */
  getCurrent(): Promise<{ bundleVersion: string; nativeVersion: string }>
  /** 매니페스트 조회. 캐시 우회 파라미터·헤더는 호출부가 정한다([[ADR-026]]). */
  httpGet(request: LiveUpdateHttpRequest): Promise<LiveUpdateHttpResponse>
  download(
    params: LiveUpdateDownloadParams,
    onProgress: (percent: number) => void,
  ): Promise<{ id: string }>
  /** 내려받아 둔 번들로 갈아끼우고 리로드한다. 이후 코드는 실행되지 않는다. */
  applyBundle(id: string): Promise<void>
  getNetworkType(): Promise<NetworkType>
  /** 스토어 업데이트가 필요할 때 스토어를 연다([[ADR-027]] 결정 7). */
  openStore(): void
}

/**
 * 포트 하나의 보관함. `storage/ports.ts` 와 같은 계약이다 — 주입 전 접근은 던지고, 테스트는
 * 되돌릴 수 있다. 포트가 아홉이라 그 계약을 손으로 아홉 번 베끼는 대신 한 곳에 두었다.
 */
function createPortSlot<T>(name: string): {
  set: (port: T) => void
  get: () => T
  clear: () => void
} {
  let port: T | null = null
  return {
    set: (next: T) => {
      port = next
    },
    get: () => {
      if (port === null) {
        throw new Error(
          `${name}가 주입되지 않았습니다 — 네이티브 API를 쓰기 전에 set${name}()를 부르세요.`,
        )
      }
      return port
    },
    clear: () => {
      port = null
    },
  }
}

const adsSlot = createPortSlot<AdsPort>('AdsPort')
const splashScreenSlot = createPortSlot<SplashScreenPort>('SplashScreenPort')
const statusBarSlot = createPortSlot<StatusBarPort>('StatusBarPort')
const systemBarsSlot = createPortSlot<SystemBarsPort>('SystemBarsPort')
const keyboardSlot = createPortSlot<KeyboardPort>('KeyboardPort')
const notificationsSlot = createPortSlot<NotificationsPort>('NotificationsPort')
const backGestureSlot = createPortSlot<BackGesturePort>('BackGesturePort')
const huntingTimerSlot = createPortSlot<HuntingTimerPort>('HuntingTimerPort')
const liveUpdateSlot = createPortSlot<LiveUpdatePort>('LiveUpdatePort')

export const setAdsPort = adsSlot.set
export const getAdsPort = adsSlot.get

export const setSplashScreenPort = splashScreenSlot.set
export const getSplashScreenPort = splashScreenSlot.get

export const setStatusBarPort = statusBarSlot.set
export const getStatusBarPort = statusBarSlot.get

export const setSystemBarsPort = systemBarsSlot.set
export const getSystemBarsPort = systemBarsSlot.get

export const setKeyboardPort = keyboardSlot.set
export const getKeyboardPort = keyboardSlot.get

export const setNotificationsPort = notificationsSlot.set
export const getNotificationsPort = notificationsSlot.get

export const setBackGesturePort = backGestureSlot.set
export const getBackGesturePort = backGestureSlot.get

export const setHuntingTimerPort = huntingTimerSlot.set
export const getHuntingTimerPort = huntingTimerSlot.get

export const setLiveUpdatePort = liveUpdateSlot.set
export const getLiveUpdatePort = liveUpdateSlot.get

/** 테스트 전용 — 주입된 포트를 전부 비운다(`storage/ports.ts` 의 `__resetStoragePortsForTest` 관례). */
export function __resetNativePortsForTest(): void {
  for (const slot of [
    adsSlot,
    splashScreenSlot,
    statusBarSlot,
    systemBarsSlot,
    keyboardSlot,
    notificationsSlot,
    backGestureSlot,
    huntingTimerSlot,
    liveUpdateSlot,
  ]) {
    slot.clear()
  }
}
