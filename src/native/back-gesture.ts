import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

// 안드로이드 시스템 뒤로가기(제스처 내비 스와이프 / 3버튼 Back)를 앱 안의 화면 스택에 잇는 어댑터
// ([[ADR-120]] 결정 17). 네이티브 접근은 이 레이어에서만 한다([[ADR-003]]).
//
// **왜 `@capacitor/app` 이 아닌가** — 그 플러그인은 뒤로가기를 무조건 가로채므로 탭 최상위에서도
// 우리가 종료/최소화를 직접 불러야 하고, 그러면 시스템이 홈으로 돌아가며 그리는 predictive back
// 애니메이션이 사라진다. 여기서는 **스택이 열려 있는 동안에만** 가로챈다(`setBackGestureEnabled`).
//
// **진행률은 시스템이 준다**(API 34+). 제스처 사용자의 손가락 위치를 우리가 재지 않으므로 가장자리
// 띠를 두고 시스템과 다툴 일이 없다. 3버튼 사용자는 진행률 없이 `invoked` 만 온다 — 두 입력이 같은
// 결과로 수렴하는 것이 목표다.

export interface BackProgressEvent {
  /** 0~1. 시스템이 계산한 제스처 진행률. */
  progress: number
  /** 제스처가 시작된 가장자리. */
  edge: 'left' | 'right'
}

interface AppBackGesturePlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>
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

/** 스택이 열려 있는 동안에만 시스템 뒤로가기를 가로챈다. */
export async function setBackGestureEnabled(enabled: boolean): Promise<void> {
  if (!isAndroid()) return
  await AppBackGesture.setEnabled({ enabled })
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

/** 리스너를 붙이고, 해제 함수를 돌려준다. 안드로이드가 아니면 아무것도 하지 않는다. */
export async function addBackGestureListeners(
  handlers: BackGestureHandlers,
): Promise<() => void> {
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
}
