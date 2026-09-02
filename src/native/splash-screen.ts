import { getSplashScreenPort } from './ports'

// 네이티브 스플래시는 실행 시점부터 계속 떠 있고, 앱 콘텐츠가 준비되면 이 함수로 내린다.
// 웹뷰에서는 그 위에 DOM 커버 두 장(#boot-cover · [data-splash-cover])이 함께 화면을 덮는데, 그
// 두 장은 정의상 웹뷰 구현이라 어댑터가 걷는다("전부" 걷는 것이 계약이다).
export async function hideSplashScreen(): Promise<void> {
  await getSplashScreenPort().hide()
}

// 웹뷰를 JS에서 다시 로드하기 직전에 호출한다. 리로드 동안 새 문서가 페인트되기 전까지 웹뷰의
// 네이티브 배경색(브랜드 주황)이 그대로 드러나는 것을 덮는다. 내리는 것은 리로드된 앱의 부팅
// 흐름(App.tsx → hideSplashScreen)이 맡는다.
export async function showSplashScreen(): Promise<void> {
  await getSplashScreenPort().show()
}
