import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context'

import { RootNavigator } from '../RootNavigator'
import type { RootStackParamList } from '../routes'

/**
 * 내비게이션 테스트용 껍데기.
 *
 * `SafeAreaProvider` 에 **인셋을 명시로 넣는다** — jest 에서는 네이티브 측정이 오지 않아 값이 늦게
 * 채워지고, 그러면 탭바가 첫 프레임에 다른 높이로 그려져 스냅샷이 실행마다 흔들린다.
 * 0 이 아니라 실제 기기에 가까운 값을 쓰는 이유는 [[ADR-120]] 결정 16·19 가 다루는 자리(하단 인셋)를
 * 0 으로 두면 그 구간의 회귀를 스냅샷이 영원히 못 보기 때문이다.
 */
const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
}

export function NavigationHarness({
  navigationRef,
}: {
  navigationRef?: ReturnType<typeof useNavigationContainerRef<RootStackParamList>>
}): React.JSX.Element {
  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
