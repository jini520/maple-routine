import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

// 네이티브 스플래시는 실행 시점부터 계속 떠 있고(capacitor.config.ts launchAutoHide:false,
// iOS는 플러그인 / Android는 MainActivity가 유지), 앱 콘텐츠가 준비되면 이 함수로 내린다.
export async function hideSplashScreen(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return
  await SplashScreen.hide()
}
