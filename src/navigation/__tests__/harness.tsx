import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'
import { PortalProvider } from '@gorhom/portal'
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context'

import { ThemeProvider } from '../../theme/ThemeProvider'
import { RootNavigator } from '../RootNavigator'
import type { RootStackParamList } from '../routes'

/**
 * 내비게이션 테스트용 껍데기.
 *
 * `SafeAreaProvider` 에 **인셋을 명시로 넣는다** — jest 에서는 네이티브 측정이 오지 않아 값이 늦게
 * 채워지고, 그러면 탭바가 첫 프레임에 다른 높이로 그려져 스냅샷이 실행마다 흔들린다.
 * 0 이 아니라 실제 기기에 가까운 값을 쓰는 이유는 가 다루는 자리(하단 인셋)를
 * 0 으로 두면 그 구간의 회귀를 스냅샷이 영원히 못 보기 때문이다.
 *
 * **`ThemeProvider` 는 step 2 가 더했다** — 자리표시자만 있을 때는 없어도 됐지만, 진짜 화면은 테마를
 * 읽는다(온보딩은 스크롤 인디케이터 색 —). 컨텍스트가 없으면 조용히 기본 테마로
 * 폴백하지 않고 **던지므로**(`theme/context.ts` 의 판단) 여기서 감싼다. 실제 트리와도 같은 순서다
 * (`App.tsx`: `SafeAreaProvider` → `ThemeProvider` → … → `AppNavigation`).
 *
 * **`PortalProvider` 도 같은 이유로 있다**. 실제 트리에서는 `BottomSheetModalProvider`
 * 가 그것을 세우는데, 그 프로바이더를 통째로 들이면 시트 호스팅 컨테이너(빈 View 하나)가 딸려 와
 * 이 스위트의 스냅샷이 흔들린다 — 포털만 세우면 뷰가 하나도 안 늘고, 바 위 슬롯(`BottomBarOverlayHost`,
 * `Main` 의 `layout`)이 실제와 같은 자리에서 돈다. 없으면 그 슬롯을 쓰는 화면이 렌더 중에
 * **던진다**(PortalProvider 를 루트에 두라).
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
      <ThemeProvider>
        <PortalProvider shouldAddRootHost={false}>
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
          </NavigationContainer>
        </PortalProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
