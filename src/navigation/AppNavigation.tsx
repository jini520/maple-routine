import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'

import { useLiveUpdateStore } from '../features/live-update/store'

import { UpdatePromptModal } from '../app/UpdatePromptModal'
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
 *
 * ## `UpdatePromptModal` 이 여기 있는 이유 ([[ADR-137]])
 *
 * 어느 화면에 있든 떠야 하므로 **화면 안**은 안 된다. 그렇다고 `AppShell` 에 두면 「자세히 보기」가
 * 갈 곳(`SettingsReleaseNotes`, [[ADR-126]] 결정 1)을 부를 방법이 없다 — 그 자리는 컨테이너 밖이라
 * 내비게이션을 못 잡는다. **컨테이너 안 · 내비게이터 밖**이 그 둘을 동시에 만족하는 유일한 자리이고,
 * 마침 여기가 ref 를 이미 들고 있다.
 *
 * `ApiKeyNoticeModal` 보다 아래로 그려진다(그쪽은 `AppShell` 의 더 뒤 형제다). 순서가 그래야 하는
 * 이유가 있다 — 키가 무효화된 상태에서는 업데이트를 받아도 앱을 쓸 수 없으므로 그쪽이 먼저다.
 */
export function AppNavigation(): React.JSX.Element {
  const navigationRef = useNavigationContainerRef<RootStackParamList>()
  const theme = useNavigationTheme()

  useRootBackToBackground(navigationRef)

  return (
    <NavigationContainer ref={navigationRef} theme={theme}>
      <RootNavigator />
      <ConnectedUpdatePrompt onOpenReleaseNotes={() => navigationRef.navigate('SettingsReleaseNotes')} />
    </NavigationContainer>
  )
}

/**
 * 스토어를 모달에 잇는 한 줄 — `migration/README.md` 가 *"OTA 가 붙는 날 배선은
 * `state={useLiveUpdateStore()}` 한 줄이다"* 라고 적어 둔 그 자리다([[ADR-137]]).
 *
 * 별도 컴포넌트인 이유는 **구독 범위** 다. `AppNavigation` 이 스토어를 직접 구독하면 진행률이
 * 1% 오를 때마다 `NavigationContainer` 까지 다시 렌더된다.
 */
function ConnectedUpdatePrompt({
  onOpenReleaseNotes,
}: {
  onOpenReleaseNotes: () => void
}): React.JSX.Element | null {
  const state = useLiveUpdateStore()
  return <UpdatePromptModal state={state} actions={state} onOpenReleaseNotes={onOpenReleaseNotes} />
}
