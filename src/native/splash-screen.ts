import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

// 네이티브 스플래시는 실행 시점부터 계속 떠 있고(capacitor.config.ts launchAutoHide:false,
// iOS는 플러그인 / Android는 MainActivity가 유지), 앱 콘텐츠가 준비되면 이 함수로 내린다.
export async function hideSplashScreen(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return
  await SplashScreen.hide()
}

// 웹뷰를 JS에서 다시 로드하기 직전에 호출한다 — 리로드 동안 새 문서가 페인트되기 전까지 웹뷰의
// 네이티브 배경색(capacitor.config.ts backgroundColor, 브랜드 주황)이 그대로 드러나는 것을 스플래시로
// 덮는다. autoHide:false로 유지하고, 리로드된 앱의 부팅 흐름(App.tsx → hideSplashScreen)이 내린다.
export async function showSplashScreen(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return
  await SplashScreen.show({ autoHide: false })
}
