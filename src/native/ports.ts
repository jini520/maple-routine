/**
 * 네이티브 포트. `native/*` 가 플랫폼 플러그인 대신 이 인터페이스에만 의존한다.
 *
 *  가 그은 경계는 "`features/*` 가 네이티브 API를 직접 만지지 않는다"였고 그
 * 규칙은 지켜져 왔다. 다만 어댑터 자신이 Capacitor 플러그인을 직접 import 하고 있어서 **어댑터를
 * 프레임워크 없는 패키지로 옮길 수 없었다**. 여기서 뒤집는 것이 그 방향 하나뿐이다. 밖으로 나가는
 * `native/*` 함수 시그니처는 한 글자도 안 바뀐다.
 *
 * **포트는 플랫폼을 모른다.** 지금 어댑터들이 `Capacitor.getPlatform()` 으로 웹이면 no-op 하는 그
 * 분기는 전부 구현(`native/adapters/*`) 안에 남는다. 이 인터페이스를 부르는 쪽이 아는 것은 "부르면
 * 알아서 된다"뿐이고, 그래서 `isSupported()`·`prepareInterstitial(): boolean` 처럼 **결과로 능력을
 * 말하는** 자리는 있어도 "지금 어느 플랫폼인가"를 묻는 자리는 없다.
 *
 * 포트 구현은 앱이 부팅 시 주입한다(`src/main.tsx`). 주입 전에 네이티브를 건드리면 **조용히 넘어가지
 * 않고 던진다**. no-op 으로 두면 "이 플랫폼엔 그 기능이 없다"와 "포트가 없다"가 구분되지 않아,
 * 스플래시가 안 걷히거나 광고가 안 뜨는 것이 정상 동작처럼 보인다(`storage/ports.ts` 와 같은 판단).
 */

import type { ThemeDefinition, ThemeName } from '../types/theme'

/**
 * OS 라이트/다크 설정 (2026-07-14).
 *
 * 저장된 테마가 없을 때의 **1회성 판정**에만 쓴다. 실행 중 OS 설정 변경을 실시간으로 따라가지
 * 않는다(범위 밖). 그래서 구독 API를 두지 않았다: 부를 곳이 없는 인터페이스는 구현마다 죽은
 * 코드가 된다. 필요해지는 날 추가하면 된다.
 */
export interface ColorSchemePort {
  get(): 'light' | 'dark'
}

/**
 * 고른 테마를 플랫폼 표면에 반영한다.
 *
 * 웹뷰에서는 34토큰을 `<style>` 하나로 주입하고 `data-theme`/`data-mode` · `color-scheme` ·
 * `scrollbar-color` 를 문서에 건다. 전부 DOM 이라 구현이 갖는다. 상태바·내비바 명암은 이 포트가
 * 아니라 호출부(`features/theme/store.ts`)가 계속 맡는다: 그건 이미 자기 포트가 있다.
 *
 * 타입 두 개를 import 하는 자리가 여기뿐이다(둘 다 `import type` 이라 런타임 의존은 여전히 0).
 */
export interface ThemeAppearancePort {
  apply(theme: ThemeName, definition: ThemeDefinition): void
}

/**
 * 전면광고.
 *
 * 광고 단위 ID·테스트 광고 판정은 `native/ads.ts` 의 순수 함수가 갖고 있고 어댑터가 그것을 쓴다.
 * 이 프로젝트에서 가장 비싼 실수(실 ID로 자기 광고 클릭)를 막는 것이 그 게이트뿐이라 플랫폼
 * 구현마다 다시 쓰이면 안 된다.
 */
export interface AdsPort {
  /** SDK 초기화. 광고를 쓸 수 없는 환경이면 아무것도 하지 않는다. */
  initialize(): Promise<void>
  /**
   * 다음 전면광고를 미리 받아둔다. **준비됐으면 `true`**. 광고를 쓸 수 없는 환경이면 던지지 않고
   * `false` 다. 플러그인이 "로드됐는지" 묻는 API를 주지 않아 그 상태는 호출부가 들고 있는다.
   */
  prepareInterstitial(): Promise<boolean>
  /** 준비된 광고를 표시한다. **실제로 떴으면 `true`**(안 떴는데 기록하면 30분간 광고가 죽는다). */
  showInterstitial(): Promise<boolean>
}

/**
 * 스플래시.
 *
 * 이 포트가 다루는 것은 "화면을 덮는다/되돌린다"이지 플러그인 호출이 아니다. 웹뷰에서는 네이티브
 * 스플래시 + DOM 커버 두 장이 함께 그 일을 하고(`#boot-cover` · `[data-splash-cover]`), 그 두 장은
 * 정의상 웹뷰 구현이라 어댑터가 갖는다.
 */
export interface SplashScreenPort {
  /** 덮개를 전부 걷는다. 리로드가 실패해 남은 커버까지 포함해서다. */
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

/** 시스템 뒤로가기. */
export interface BackGesturePort {
  setEnabled(enabled: boolean): Promise<void>
  moveToBackground(): Promise<void>
  /** 리스너를 붙이고 해제 함수를 돌려준다. 시스템 뒤로가기가 없는 환경이면 no-op 해제 함수. */
  addListeners(handlers: BackGestureHandlers): Promise<() => void>
}

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown'

/**
 * 확인 한 번의 결과. **프로토콜과 무관한 **앱이 무엇을 할 수 있나** 의 분류**다.
 *
 * @capgo 와 `expo-updates` 는 매니페스트 형식도 다운로드 단위도 다르지만 이 다섯 갈래는 같다.
 * 그래서 이 타입은 포트와 함께 남고, 두 어댑터가 각자의 프로토콜을 여기로 번역한다.
 */
export type LiveUpdateCheckResult =
  | { kind: 'unsupported' } // web·개발 서버 등 라이브 업데이트 런타임이 없는 환경
  | { kind: 'error' } // 매니페스트 조회·파싱 실패
  | { kind: 'up-to-date' } // 최신
  /**
   * 새 버전은 있는데 **라이브로 못 받는다**. 네이티브가 낮아 스토어를 거쳐야 한다.
   *
   * `expo-updates` 에서는 프로토콜이 이것을 **204(업데이트 없음)로 삼킨다.** 그래서 RN 어댑터는
   * 확인이 최신 으로 떨어졌을 때 한 번 더 물어 이 갈래를 되살린다.
   * 삼켜진 채로 두면 사용자에게 *"최신 버전입니다"* 라는 **거짓**이 보인다.
   */
  /**
   * `minNativeVersion` 은 **선택**이다. @capgo 는 우리가 손으로 적은 최소 네이티브 버전을 실어
   * 모달이 *"최소 앱 버전 1.0.7 이상 필요"* 라고 말할 수 있었지만, `expo-updates` 의
   * `runtimeVersion` 은 fingerprint 해시라 사용자에게 보여 줄 이름이 아니다.
   * 그래서 RN 은 이 값을 비우고, 모달은 그 줄을 **안 그린다**(원래부터 조건부였다). 없는 숫자를
   * 지어내지 않는다.
   */
  | { kind: 'store-required'; version: string; minNativeVersion?: string }
  /** 라이브로 받을 수 있다. `highlights` 는 받기 전 모달의 자세히 보기가 펼친다. */
  | { kind: 'update-available'; version: string; size: number; highlights?: string[] }

/**
 * Live Update (OTA).
 *
 * ## 경계는 프로토콜 이 아니라 ****행위**** 다
 *
 * 이 인터페이스는 한때 @capgo 의 모양을 그대로 드러냈다. `httpGet`(매니페스트를 **호출부가 직접
 * 판다**) · `download({url, checksum})` · `applyBundle(id)`. 셋 다 `expo-updates` 에 짝이 없다:
 * 주소·체크섬·번들 id 를 런타임이 자기 안에서 다루고 우리에게 안 보여준다.
 *
 * 그래서 포트가 말하는 것을 **무엇을 하는가**(확인·받기·적용)로 좁혔다. 갈리는 것은 그 아래다.
 *
 * | 여기 남는 것 | 어댑터로 간 것 |
 * |---|---|
 * | 상태 14개 · 셀룰러 확인 · 12초 타임아웃 · 완료 안내 판정 | 매니페스트 형식 · 버전 비교 · 채널 |
 *
 * 즉 이 정한 **UX 는 전부 스토어에
 * 남는다.** 프로토콜이 바뀌어도 사용자가 보는 것은 안 바뀐다는 것이 이 경계의 목적이다.
 */
export interface LiveUpdatePort {
  /**
   * 이 실행 환경에 라이브 업데이트 런타임이 있는가(개발 서버에는 없다).
   *
   * 동기인 것이 중요하다. 확인을 시작하기 **전에** 판정해야 지원하지 않는 환경에서 네트워크
   * 요청이 나가지 않는다.
   */
  isSupported(): boolean
  notifyAppReady(): Promise<void>
  /** 지금 도는 번들의 **사용자 표시 버전**(`1.0.6`). 런타임이 없으면 `null`. */
  getCurrentVersion(): Promise<string | null>
  /**
   * 빌드 시점에 고정된 채널 표시값(관찰용 UI).
   *
   * 어댑터가 갖는 이유는 그것이 **빌드 시점 값**이기 때문이다. core 가 `import.meta.env` 를
   * 읽던 자리가 여기였고, 그 한 줄이 RN 에서 모듈을 평가하는 순간 죽였다.
   */
  getChannel(): string
  /** 확인. 매니페스트 조회·파싱·버전 비교까지 **어댑터가** 끝낸다. */
  check(): Promise<LiveUpdateCheckResult>
  /** 사용자 동의 후 받는다. 진행률은 0~100 으로 흘린다. */
  download(onProgress: (percent: number) => void): Promise<void>
  /**
   * 받아둔 번들로 갈아끼우고 리로드한다. **이후 코드는 실행되지 않는다.**
   *
   * 앞뒤 순서(커넥션 닫기 → 커버 → 이 호출)는 여전히 `native/live-update.ts` 한 함수가 통째로
   * 소유한다. 그 순서가 곧 그 결정이라 두 곳으로 나누지 않는다.
   */
  apply(): Promise<void>
  getNetworkType(): Promise<NetworkType>
  /** 스토어 업데이트가 필요할 때 스토어를 연다. */
  openStore(): void
}

/**
 * 포트 하나의 보관함. `storage/ports.ts` 와 같은 계약이다. 주입 전 접근은 던지고, 테스트는
 * 되돌릴 수 있다. 포트가 여럿이라 그 계약을 포트마다 손으로 베끼는 대신 한 곳에 두었다.
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
          `${name}가 주입되지 않았습니다. 네이티브 API를 쓰기 전에 set${name}()를 부르세요.`,
        )
      }
      return port
    },
    clear: () => {
      port = null
    },
  }
}

const colorSchemeSlot = createPortSlot<ColorSchemePort>('ColorSchemePort')
const themeAppearanceSlot = createPortSlot<ThemeAppearancePort>('ThemeAppearancePort')
const adsSlot = createPortSlot<AdsPort>('AdsPort')
const splashScreenSlot = createPortSlot<SplashScreenPort>('SplashScreenPort')
const statusBarSlot = createPortSlot<StatusBarPort>('StatusBarPort')
const systemBarsSlot = createPortSlot<SystemBarsPort>('SystemBarsPort')
const keyboardSlot = createPortSlot<KeyboardPort>('KeyboardPort')
const notificationsSlot = createPortSlot<NotificationsPort>('NotificationsPort')
const backGestureSlot = createPortSlot<BackGesturePort>('BackGesturePort')
const liveUpdateSlot = createPortSlot<LiveUpdatePort>('LiveUpdatePort')

export const setColorSchemePort = colorSchemeSlot.set
export const getColorSchemePort = colorSchemeSlot.get

export const setThemeAppearancePort = themeAppearanceSlot.set
export const getThemeAppearancePort = themeAppearanceSlot.get

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

export const setLiveUpdatePort = liveUpdateSlot.set
export const getLiveUpdatePort = liveUpdateSlot.get

/** 테스트 전용. 주입된 포트를 전부 비운다(`storage/ports.ts` 의 `__resetStoragePortsForTest` 관례). */
export function __resetNativePortsForTest(): void {
  for (const slot of [
    colorSchemeSlot,
    themeAppearanceSlot,
    adsSlot,
    splashScreenSlot,
    statusBarSlot,
    systemBarsSlot,
    keyboardSlot,
    notificationsSlot,
    backGestureSlot,
    liveUpdateSlot,
  ]) {
    slot.clear()
  }
}
