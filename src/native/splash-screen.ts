import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'

// 브랜드 주황 — capacitor.config.ts backgroundColor·스플래시 이미지 배경과 동일한 값(ADR-025/027).
const BRAND_SPLASH_COLOR = '#FB8101'

// 네이티브 스플래시는 실행 시점부터 계속 떠 있고(capacitor.config.ts launchAutoHide:false,
// iOS는 플러그인 / Android는 MainActivity가 유지), 앱 콘텐츠가 준비되면 이 함수로 내린다.
export async function hideSplashScreen(): Promise<void> {
  // index.html의 정적 부팅 커버(#boot-cover — 리로드/콜드 스타트의 첫 페인트부터 여기까지 화면
  // 전체를 브랜드색으로 덮는다, ADR-027 정정)를 앱이 준비된 시점에 걷는다. 캔버스 배경만으론
  // 테마(비동기 복원) 적용 전 라이트 기본값 첫 렌더가 노출되므로 렌더된 콘텐츠까지 덮는 div를 쓴다.
  // 웹(개발 서버)에서도 걷어야 하므로 플랫폼 가드보다 먼저 수행한다.
  document.getElementById('boot-cover')?.remove()
  if (Capacitor.getPlatform() === 'web') return
  await SplashScreen.hide()
}

// 웹뷰를 JS에서 다시 로드하기 직전에 호출한다 — 리로드 동안 새 문서가 페인트되기 전까지 웹뷰의
// 네이티브 배경색(capacitor.config.ts backgroundColor, 브랜드 주황)이 그대로 드러나는 것을 스플래시로
// 덮는다. autoHide:false로 유지하고, 리로드된 앱의 부팅 흐름(App.tsx → hideSplashScreen)이 내린다.
export async function showSplashScreen(): Promise<void> {
  if (Capacitor.getPlatform() === 'web') return
  // 플러그인 스플래시 창은 하단 내비게이션 바 인셋만큼 잘려 그 띠에 직전 화면이 비친다(ADR-027 정정).
  // 리로드로 문서가 파괴되기 전까지 그 자리를 브랜드색 전체 화면 오버레이로 덮는다 — 문서와 함께
  // 사라지므로 별도 정리가 필요 없다.
  const cover = document.createElement('div')
  cover.setAttribute('data-splash-cover', '')
  cover.style.cssText = `position:fixed;inset:0;z-index:2147483647;background-color:${BRAND_SPLASH_COLOR}`
  document.body.appendChild(cover)
  await SplashScreen.show({ autoHide: false })
}
