import { getSystemBarsPort } from './ports'

// 하단 시스템 내비게이션 바(제스처 핸들·3버튼)의 글리프 명암을 앱 표면 밝기에 맞춘다. 배경색은
// 앱이 edge-to-edge 로 직접 그리므로 여기서 다루지 않는다.
export async function setNavigationBarStyle(isDarkTheme: boolean): Promise<void> {
  await getSystemBarsPort().setNavigationBarStyle(isDarkTheme)
}

// 안전영역 인셋(--safe-area-inset-*)을 네이티브에서 다시 주입받는다. 최초 인셋 적용이 DOM 준비보다
// 먼저 일어나면 주입이 유실되므로 앱이 마운트된 뒤 한 번 호출한다. 이후 회전·폴더블 접힘·키보드
// 변화는 네이티브 리스너가 자동으로 갱신한다.
export async function refreshSafeAreaInsets(): Promise<void> {
  await getSystemBarsPort().refreshSafeAreaInsets()
}

/** 아래에 3버튼 내비게이션 바가 있는가. 그 바는 버튼 줄 전체가 인셋이라 하단바를 더 띄워야 한다 */
export function isButtonNavigation(): boolean {
  return getSystemBarsPort().isButtonNavigation()
}

/** 내비게이션 방식이 바뀌면 부를 함수를 건다. 돌려준 함수로 뗀다 */
export function addButtonNavigationListener(listener: () => void): () => void {
  return getSystemBarsPort().addButtonNavigationListener(listener)
}
