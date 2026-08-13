import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { BackGesturePort, BackProgressEvent } from '@core/native/ports'

/**
 * `BackGesturePort` 의 Capacitor 구현([[ADR-128]], [[ADR-120]] 결정 17·18).
 *
 * **왜 `@capacitor/app` 이 아닌가** — 그 플러그인은 뒤로가기를 무조건 가로채므로 탭 최상위에서도
 * 우리가 종료/최소화를 직접 불러야 하고, 그러면 시스템이 홈으로 돌아가며 그리는 predictive back
 * 애니메이션이 사라진다. 여기서는 **스택이 열려 있는 동안에만** 가로챈다(`setEnabled`).
 *
 * **진행률은 시스템이 준다**(API 34+). 제스처 사용자의 손가락 위치를 우리가 재지 않으므로 가장자리
 * 띠를 두고 시스템과 다툴 일이 없다. 3버튼 사용자는 진행률 없이 `invoked` 만 온다 — 두 입력이 같은
 * 결과로 수렴하는 것이 목표다.
 */
interface AppBackGesturePlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>
  moveToBackground(): Promise<void>
  addListener(
    event: 'backStarted' | 'backProgressed',
    handler: (data: BackProgressEvent) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    event: 'backInvoked' | 'backCancelled',
    handler: () => void,
  ): Promise<PluginListenerHandle>
}

const AppBackGesture = registerPlugin<AppBackGesturePlugin>('AppBackGesture')

const isAndroid = (): boolean => Capacitor.getPlatform() === 'android'

export const capacitorBackGesturePort: BackGesturePort = {
  /** 스택이 열려 있는 동안에만 시스템 뒤로가기를 가로챈다. */
  async setEnabled(enabled) {
    if (!isAndroid()) return
    await AppBackGesture.setEnabled({ enabled })
  },

  /**
   * 앱을 **종료하지 않고 백그라운드로** 보낸다([[ADR-120]] 결정 18) — 홈 버튼과 같다. 태스크가 살아
   * 있어 다시 열면 보던 화면 그대로다. 완전히 끝내면 다음 실행이 콜드 스타트라 스플래시부터 다시 본다.
   */
  async moveToBackground() {
    if (!isAndroid()) return
    await AppBackGesture.moveToBackground()
  },

  async addListeners(handlers) {
    if (!isAndroid()) return () => {}

    const subs = await Promise.all([
      AppBackGesture.addListener('backStarted', (event) => handlers.onStarted?.(event)),
      AppBackGesture.addListener('backProgressed', (event) => handlers.onProgress?.(event)),
      AppBackGesture.addListener('backInvoked', () => handlers.onInvoked()),
      AppBackGesture.addListener('backCancelled', () => handlers.onCancelled?.()),
    ])

    return () => {
      for (const sub of subs) void sub.remove()
    }
  },
}
