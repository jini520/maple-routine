import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

export async function setStatusBarStyle(isDarkTheme: boolean): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return
  await StatusBar.setStyle({ style: isDarkTheme ? Style.Dark : Style.Light })
}
