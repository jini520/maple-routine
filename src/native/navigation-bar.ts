import { Capacitor, registerPlugin } from '@capacitor/core'

interface NavigationBarPlugin {
  // dark: 어두운 표면(다크 테마)이면 true → 밝은 글리프. color: 앱 표면색(#rrggbb).
  setStyle(options: { dark: boolean; color: string }): Promise<void>
}

const NavigationBar = registerPlugin<NavigationBarPlugin>('NavigationBar')

// Android Color.parseColor는 #rrggbb/#aarrggbb만 받고 3자리 단축형(#fff)은 예외를 던진다.
// Vite CSS 미니파이어가 #ffffff(렌 테마 표면색)를 #fff로 줄이므로 6자리로 펴서 넘긴다.
function toAndroidHex(color: string): string {
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(color.trim())
  if (!short) return color.trim()
  const [, r, g, b] = short
  return `#${r}${r}${g}${g}${b}${b}`
}

// 하단 시스템 내비게이션 바(제스처 핸들/3버튼)를 앱 테마에 맞춘다. iOS는 이런 시스템 내비 바가
// 없어 건너뛴다. color는 현재 테마의 --color-surface(탭바 배경과 동일)를 넘기며, Android 14 이하는
// 이 색으로 nav 바를 칠하고 15+는 edge-to-edge로 WebView가 같은 색을 그린다(native 쪽 주석 참고).
export async function setNavigationBarStyle(isDarkTheme: boolean, color: string): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  await NavigationBar.setStyle({ dark: isDarkTheme, color: toAndroidHex(color) })
}
