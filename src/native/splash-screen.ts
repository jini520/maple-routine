import { getSplashScreenPort } from './ports'

// 네이티브 스플래시는 실행 시점부터 계속 떠 있고, 앱 콘텐츠가 준비되면 이 함수로 내린다.
export async function hideSplashScreen(): Promise<void> {
  await getSplashScreenPort().hide()
}

// 화면을 다시 로드하기 직전에 호출한다. 리로드 동안 네이티브 배경색(브랜드 주황)이 그대로
// 드러나는 것을 덮는다. 내리는 것은 리로드된 앱의 부팅 흐름이 맡는다.
export async function showSplashScreen(): Promise<void> {
  await getSplashScreenPort().show()
}
