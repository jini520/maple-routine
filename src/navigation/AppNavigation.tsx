import { useEffect, useRef, useState } from 'react'
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native'

import { useNoticeDelivery } from '../features/notice/use-notice-delivery'

import { useLiveUpdateStore } from '../features/live-update/store'

import { useRootBackToBackground } from '../hooks/useRootBackToBackground'
import { UpdatePromptModal } from '../app/UpdatePromptModal'
import { RootNavigator } from './RootNavigator'
import { useNavigationTheme } from './navigation-theme'
import type { RootStackParamList } from './routes'

/** 알림 탭의 목적지. 문자열을 두 번 적으면 한쪽 오타가 조용히 안 미는 상태를 만든다. */
const NOTICE_DETAIL = 'SettingsNoticeDetail'

/**
 * 내비게이션 루트. 컨테이너 + 루트 스택 + 시스템 뒤로가기의 마지막 자리.
 *
 * `<ThemeProvider>` 안에 있어야 한다. `useNavigationTheme` 이 테마 컨텍스트를 읽고, 컨텍스트가
 * 없으면 기본 테마로 폴백하지 않고 던진다.
 *
 * 컨테이너 ref 를 여기서 만드는 것은 `useRootBackToBackground` 가 컨테이너 밖에서 상태를 물어야
 * 하기 때문이다. `useNavigation` 은 화면 안에서만 쓸 수 있고 이 판정은 앱 전체의 것이다.
 *
 * `UpdatePromptModal` 이 여기 있는 것도 자리 때문이다. 어느 화면에 있든 떠야 하니 화면 안은
 * 안 되고, `AppShell` 에 두면 자세히 보기가 갈 곳(`SettingsReleaseNotes`)을 부를 방법이 없다
 * (컨테이너 밖이라 내비게이션을 못 잡는다). 둘을 동시에 만족하는 자리가 컨테이너 안 ·
 * 내비게이터 밖뿐이다.
 *
 * `ApiKeyNoticeModal` 보다 아래로 그려진다. 키가 무효화된 상태에서는 업데이트를 받아도 앱을
 * 쓸 수 없으므로 그쪽이 먼저다.
 */
export function AppNavigation(): React.JSX.Element {
  const navigationRef = useNavigationContainerRef<RootStackParamList>()
  const theme = useNavigationTheme()

  /**
   * 지금 루트 스택에 **등록돼 있는 화면 이름들**.
   *
   * 진입 단계에 따라 목록이 통째로 갈린다(`RootNavigator`). 여기서 그 조건을 다시 적지 않고
   * 결과만 읽는 이유가 그것이다. 조건을 베끼면 게이트가 바뀌는 날 두 곳이 갈린다.
   */
  const [routeNames, setRouteNames] = useState<readonly string[]>([])

  /** 알림을 탭했는데 아직 못 민 공지. */
  const [pendingNoticeId, setPendingNoticeId] = useState<string | null>(null)

  /**
   * 이미 민 공지. **상태가 아니라 ref 인 것이 요건이다.**
   *
   * 민 뒤에 `pendingNoticeId` 를 비우려면 이펙트 안에서 setState 를 해야 하는데 그것이 곧 연쇄
   * 렌더다. 여기 적어 두면 화면을 다시 그리지 않고 같은 일을 한다. 안 적으면 나중에 화면 목록이
   * 다시 바뀔 때(로그아웃했다 다시 열기) 그 상세가 또 튀어나온다.
   */
  const openedNoticeIdRef = useRef<string | null>(null)

  useRootBackToBackground(navigationRef)
  // 알림 탭이 상세를 민다. 이 자리인 이유는 `UpdatePromptModal` 과 같다 - 어느 화면에 있든
  // 열려야 하니 화면 안은 안 되고, 컨테이너 밖이면 내비게이션을 못 잡는다.
  //
  // **곧장 밀지 않고 붙든다.** 죽어 있던 앱을 알림으로 열면 `getInitialNotification` 이 진입 단계
  // 판정보다 먼저 답할 수 있는데, 그때 스택에는 로그인 화면 하나뿐이라 상세가 아직 없다. 그
  // 상태로 이동을 걸면 내비게이터가 안 받고 콘솔 에러만 남는다(실기기 관측, iOS).
  useNoticeDelivery(setPendingNoticeId)

  useEffect(() => {
    if (pendingNoticeId === null || openedNoticeIdRef.current === pendingNoticeId) return
    if (!routeNames.includes(NOTICE_DETAIL)) return

    openedNoticeIdRef.current = pendingNoticeId
    navigationRef.navigate(NOTICE_DETAIL, { noticeId: pendingNoticeId })
  }, [pendingNoticeId, routeNames, navigationRef])

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={theme}
      // 화면 목록이 갈리는 것은 상태 변화로 온다. 첫 값은 `onReady` 가 준다(그때는 아직
      // `onStateChange` 가 한 번도 안 불렸다).
      onReady={() => setRouteNames(navigationRef.getRootState().routeNames)}
      onStateChange={(state) => setRouteNames(state?.routeNames ?? [])}
    >
      <RootNavigator />
      <ConnectedUpdatePrompt onOpenReleaseNotes={() => navigationRef.navigate('SettingsReleaseNotes')} />
    </NavigationContainer>
  )
}

/**
 * 스토어를 모달에 잇는 한 줄.
 *
 * 별도 컴포넌트인 이유는 구독 범위다. `AppNavigation` 이 스토어를 직접 구독하면 진행률이 1%
 * 오를 때마다 `NavigationContainer` 까지 다시 렌더된다.
 */
function ConnectedUpdatePrompt({
  onOpenReleaseNotes,
}: {
  onOpenReleaseNotes: () => void
}): React.JSX.Element | null {
  const state = useLiveUpdateStore()
  return <UpdatePromptModal state={state} actions={state} onOpenReleaseNotes={onOpenReleaseNotes} />
}
