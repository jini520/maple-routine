import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'

import { RootNavigator } from './RootNavigator'
import { useNavigationTheme } from './navigation-theme'
import { useRootBackToBackground } from './use-root-back'
import type { RootStackParamList } from './routes'

/**
 * 내비게이션 루트 — 컨테이너 + 루트 스택 + 시스템 뒤로가기의 마지막 자리.
 *
 * `<ThemeProvider>` **안**에 있어야 한다(`useNavigationTheme` 이 테마 컨텍스트를 읽는다). 컨텍스트가
 * 없으면 조용히 기본 테마로 폴백하지 않고 던진다 — `src/theme/context.ts` 의 판단이다.
 *
 * 컨테이너 ref 를 여기서 만드는 이유는 `useRootBackToBackground` 가 **컨테이너 밖**에서 상태를 물어야
 * 하기 때문이다(`useNavigation` 은 화면 안에서만 쓸 수 있고, 이 판정은 화면이 아니라 앱 전체의 것이다).
 */
export function AppNavigation(): React.JSX.Element {
  const navigationRef = useNavigationContainerRef<RootStackParamList>()
  const theme = useNavigationTheme()

  useRootBackToBackground(navigationRef)

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <RootNavigator />
    </NavigationContainer>
  )
}
