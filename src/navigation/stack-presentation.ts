/**
 * 스택 한 단이 **어떻게 열리는가** — [[ADR-120]] 결정 5·6 을 [[ADR-167]] 이 두 스택의 공유물로 만든 자리.
 *
 * ## 왜 상수 하나인가
 *
 * #240 의 요구는 *"하단바 하위 탭도 **다른 하위 페이지처럼** 열리게"* 였다. 두 스택이 각자 값을
 * 적으면 그 «처럼» 이 **두 곳이 같은 값을 갖고 있다는 우연**이 되고, 한쪽만 고치면 조용히 갈린다.
 * 한 상수를 함께 쓰면 그것이 우연이 아니라 **구조**가 된다.
 *
 * 쓰는 곳 둘: `RootNavigator`(하위 페이지 열하나) · `Main`(그룹 행 ↔ 하위 행의 층).
 */

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

export const PUSH_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  // 페이지 헤더는 앱이 직접 그린다(`PageHeader`, templates) — 라이브러리 헤더를 켜면 두 겹이 된다.
  headerShown: false,

  // [[ADR-120]] 결정 5. iOS 에서는 `default`(UIKit push)로 해석되는데, 그 결정의 값 네 줄
  // (`translateX(100% → 0)` · 아래 화면 `-30%` · 스크림 `0.12` · 왼쪽 그림자)이 애초에 그 전환을
  // 흉내 낸 것이라 원본으로 돌아가는 셈이다. 안드로이드에서는 이 값이 **플랫폼 기본 대신 iOS 식
  // 슬라이드**를 그린다 — 웹뷰 앱이 두 플랫폼에 같은 전환을 그렸으므로(`stack-transition.ts` 는
  // 플랫폼을 묻지 않는다) 여기서 기본값을 택하면 안드로이드 사용자에게 전환 후 앱이 **다르게 보인다**.
  //
  // 340ms·0.12·-30% 같은 개별 수치는 이제 OS/`react-native-screens` 가 갖고 있어 우리가 못 돌린다.
  animation: 'ios_from_right',

  // [[ADR-120]] 결정 6 — iOS 가장자리 스와이프 백. `gestureResponseDistance` 는 **주지 않는다**:
  // 기본값이 UIKit 의 화면 가장자리 인식기이고, 결정 6 의 28px·35%·0.4px/ms 가 바로 그것을 손으로
  // 흉내 낸 값이었다. 숫자를 다시 얹으면 흉내가 원본을 덮는다.
  // (`fullScreenGestureEnabled` 도 켜지 않는다 — 화면 전체 드래그는 "가장자리 28px" 규정과 다르다.)
  //
  // **이 한 줄이 #240 의 전부다.** 예전에는 층 이동이 형제 탭 전환이라 이 값이 걸릴 스택 자체가
  // 없었고, 그래서 안드로이드 백은 되는데 iOS 스와이프만 안 됐다.
  gestureEnabled: true,
}
