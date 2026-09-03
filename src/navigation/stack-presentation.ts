/**
 * 스택 한 단이 어떻게 열리는가. 두 스택의 공유물.
 *
 * 두 스택이 각자 값을 적으면 다른 하위 페이지처럼 열린다 가 두 곳이 같은 값을 갖고 있다는
 * 우연이 되고, 한쪽만 고치면 조용히 갈린다. 한 상수를 함께 쓰면 그것이 구조가 된다.
 *
 * 쓰는 곳 둘. `RootNavigator`(하위 페이지 열하나) · `Main`(그룹 행 ↔ 하위 행의 층).
 */

import type { NativeStackNavigationOptions } from '@react-navigation/native-stack'

export const PUSH_SCREEN_OPTIONS: NativeStackNavigationOptions = {
  // 페이지 헤더는 앱이 직접 그린다(`PageHeader`, templates). 라이브러리 헤더를 켜면 두 겹이 된다.
  headerShown: false,

  // iOS 에서는 `default`(UIKit push)로 해석된다. 안드로이드에서는 이 값이 플랫폼 기본 대신
  // iOS 식 슬라이드를 그린다. 두 플랫폼에 같은 전환을 그려야 하므로 기본값을 택하지 않는다.
  //
  // 340ms·0.12·-30% 같은 개별 수치는 OS 와 `react-native-screens` 가 갖고 있어 못 돌린다.
  animation: 'ios_from_right',

  // iOS 가장자리 스와이프 백. `gestureResponseDistance` 는 주지 않는다. 기본값이 UIKit 의 화면
  // 가장자리 인식기이고 28px·35%·0.4px/ms 는 그것을 손으로 흉내 낸 값이었다. 숫자를 다시
  // 얹으면 흉내가 원본을 덮는다. `fullScreenGestureEnabled` 도 켜지 않는다. 화면 전체 드래그는
  // 가장자리 28px 규정과 다르다.
  gestureEnabled: true,
}
