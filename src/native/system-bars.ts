import { Capacitor, registerPlugin } from '@capacitor/core'

interface AppSystemBarsPlugin {
  // dark: 어두운 표면(다크 테마)이면 true → 하단 내비 글리프를 밝게 그린다.
  setStyle(options: { dark: boolean }): Promise<void>
  refreshInsets(): Promise<void>
}

const AppSystemBars = registerPlugin<AppSystemBarsPlugin>('AppSystemBars')

// 하단 시스템 내비게이션 바(제스처 핸들/3버튼)의 글리프 명암을 앱 표면 밝기에 맞춘다. 배경색은
// 앱이 edge-to-edge로 직접 그리므로 여기서 다루지 않는다(SystemBarsPlugin.java 주석 참고).
// iOS엔 이런 시스템 내비 바가 없어 건너뛴다.
export async function setNavigationBarStyle(isDarkTheme: boolean): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  await AppSystemBars.setStyle({ dark: isDarkTheme })
}

// 안전영역 인셋(--safe-area-inset-*)을 네이티브에서 다시 주입받는다. 최초 인셋 적용이 DOM 준비보다
// 먼저 일어나면 주입이 유실되므로 앱이 마운트된 뒤 한 번 호출한다. 이후 회전·폴더블 접힘·키보드
// 변화는 네이티브 리스너가 자동으로 갱신한다. iOS는 env()가 정상 동작하므로 불필요하다.
export async function refreshSafeAreaInsets(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  await AppSystemBars.refreshInsets()
}
