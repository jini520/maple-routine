import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { StatusBarPort } from '../ports'

/** `StatusBarPort` 의 Capacitor 구현([[ADR-127]]). 웹에는 상태바가 없어 no-op 이다. */
export const capacitorStatusBarPort: StatusBarPort = {
  async setStyle(isDarkTheme) {
    if (Capacitor.getPlatform() === 'web') return
    await StatusBar.setStyle({ style: isDarkTheme ? Style.Dark : Style.Light })
  },
}
