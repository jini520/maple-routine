import { Capacitor } from '@capacitor/core'
import { SplashScreen } from '@capacitor/splash-screen'
import type { SplashScreenPort } from '../ports'

/**
 * `SplashScreenPort` 의 Capacitor 구현([[ADR-127]], [[ADR-025]]·[[ADR-027]]·[[ADR-117]]).
 *
 * 웹뷰에서 "화면을 덮는다"는 일은 **네이티브 스플래시 + DOM 커버 두 장**이 함께 한다. 그 두 장은
 * 정의상 웹뷰 구현이므로(다른 프레임워크에는 `#boot-cover` 라는 것이 없다) 포트가 아니라 여기 있다.
 */

// 브랜드 주황 — capacitor.config.ts backgroundColor·스플래시 이미지 배경과 동일한 값(ADR-025/027).
const BRAND_SPLASH_COLOR = '#F58B0F'

export const capacitorSplashScreenPort: SplashScreenPort = {
  // 네이티브 스플래시는 실행 시점부터 계속 떠 있고(capacitor.config.ts launchAutoHide:false,
  // iOS는 플러그인 / Android는 MainActivity가 유지), 앱 콘텐츠가 준비되면 여기서 내린다.
  async hide() {
    // index.html의 정적 부팅 커버(#boot-cover — 리로드/콜드 스타트의 첫 페인트부터 여기까지 화면
    // 전체를 브랜드색으로 덮는다, ADR-027 정정)를 앱이 준비된 시점에 걷는다. 캔버스 배경만으론
    // 테마(비동기 복원) 적용 전 라이트 기본값 첫 렌더가 노출되므로 렌더된 콘텐츠까지 덮는 div를 쓴다.
    // 웹(개발 서버)에서도 걷어야 하므로 플랫폼 가드보다 먼저 수행한다.
    document.getElementById('boot-cover')?.remove()
    // show()가 깐 리로드 커버도 함께 걷는다(ADR-117 결정 4). 이것을 걷는 코드가 저장소에
    // 아예 없었다 — "문서와 함께 사라진다"가 리로드 성공을 전제한 탓이다. 리로드가 실패해 문서가
    // 살아남으면 영구히 남아 앱이 브랜드 주황에 갇힌다(이슈 #175). querySelectorAll로 "전부" 지운다:
    // 중복 호출로 여러 장 쌓였을 수 있고, 걷는 쪽이 한 장만 아는 것은 그 자체로 약한 계약이다.
    // 두 커버 모두 플랫폼 가드보다 먼저, 그리고 어떤 await보다 먼저다 — 네이티브 hide()가 매달려도
    // DOM 커버만큼은 이미 사라진 뒤여야 화면이 돌아온다.
    document.querySelectorAll('[data-splash-cover]').forEach((cover) => {
      cover.remove()
    })
    if (Capacitor.getPlatform() === 'web') return
    await SplashScreen.hide()
  },

  // 웹뷰를 JS에서 다시 로드하기 직전에 호출한다 — 리로드 동안 새 문서가 페인트되기 전까지 웹뷰의
  // 네이티브 배경색(capacitor.config.ts backgroundColor, 브랜드 주황)이 그대로 드러나는 것을 스플래시로
  // 덮는다. autoHide:false로 유지하고, 리로드된 앱의 부팅 흐름(App.tsx → hideSplashScreen)이 내린다.
  async show() {
    if (Capacitor.getPlatform() === 'web') return
    // 플러그인 스플래시 창은 하단 내비게이션 바 인셋만큼 잘려 그 띠에 직전 화면이 비친다(ADR-027 정정).
    // 리로드로 문서가 파괴되기 전까지 그 자리를 브랜드색 전체 화면 오버레이로 덮는다 — 리로드가
    // 성공하면 문서와 함께 사라지지만, **실패하면 남는다**. 그래서 걷는 것은 hide()가
    // 맡는다(ADR-117 결정 4 — "별도 정리가 필요 없다"는 옛 전제가 틀렸다).
    // 커버는 await보다 먼저 붙인다 — 클릭과 같은 틱에 올라가야 리로드 직전 깜빡임을 막는다(ADR-027 정정).
    const cover = document.createElement('div')
    cover.setAttribute('data-splash-cover', '')
    cover.style.cssText = `position:fixed;inset:0;z-index:2147483647;background-color:${BRAND_SPLASH_COLOR}`
    document.body.appendChild(cover)
    await SplashScreen.show({ autoHide: false })
  },
}
