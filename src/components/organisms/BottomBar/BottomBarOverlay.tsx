/**
 * 화면이 소유한 오버레이를 하단바 위에 그리는 포털 슬롯. 지금 쓰는 곳은 `SpeedDial`(가계부 ＋) 하나.
 *
 * `zIndex` 는 같은 부모 안에서만 겨루는데 하단바는 `LayerStack` 의 `layout` 이 화면들 뒤에 그린다. 그래서
 * 화면 안에서 그린 오버레이는 어떤 값을 줘도 바 아래다. 그림을 포털로 화면 밖에 내보내 푼다.
 *
 * @see src/navigation/LayerStack.tsx 호스트를 바 뒤에 꽂는 자리
 */
import { useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { Portal, PortalHost } from '@gorhom/portal'
import { NavigationContext } from '@react-navigation/native'

/** 포털 호스트 이름. 시트의 루트 호스트와 달라야 둘이 안 섞인다. */
const BOTTOM_BAR_OVERLAY_HOST = 'bottom-bar-overlay'

/**
 * 이 컴포넌트가 선 화면이 지금 보이는지 내는 훅.
 *
 * `useIsFocused` 를 못 쓴다. 그 훅은 내비게이터 밖에서 던지는데 이 저장소의 컴포넌트 테스트는
 * 내비게이터 없이 렌더한다. 컨텍스트를 옵션으로 읽고 없으면 보이는 것으로 둔다.
 *
 * @returns 초점 여부. 내비게이터가 없으면 항상 `true`
 */
function useScreenFocused(): boolean {
  const navigation = useContext(NavigationContext)

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (navigation === undefined) return () => {}

      const unsubscribeFocus = navigation.addListener('focus', onChange)
      const unsubscribeBlur = navigation.addListener('blur', onChange)

      return () => {
        unsubscribeFocus()
        unsubscribeBlur()
      }
    },
    [navigation],
  )

  return useSyncExternalStore(subscribe, () => navigation?.isFocused() ?? true)
}

/**
 * 슬롯이 그려질 자리를 여는 호스트.
 *
 * `LayerStack` 의 `layout` 안, 하단바 **바로 뒤**에 하나만 둘 것. 앱 셸에 두면 하위 페이지가 `LayerStack` 을
 * 밀어낼 때 바만 나가고 이 그림이 남는다.
 *
 * @example
 * <ConnectedBottomBar state={state} navigation={navigation} />
 * <BottomBarOverlayHost />
 */
export function BottomBarOverlayHost(): React.JSX.Element {
  return <PortalHost name={BOTTOM_BAR_OVERLAY_HOST} />
}

/**
 * 감싼 그림을 바 위 슬롯으로 내보내는 래퍼. 선 자리에는 아무것도 안 남는다.
 *
 * 자리 계산은 넘기는 쪽 몫이고 창 기준 절대 배치를 전제한다. 화면이 초점을 잃으면 스스로 접는다.
 * 포털로 나간 그림은 화면이 숨어도 안 숨어서, 안 접으면 가계부의 ＋ 가 보스·오늘 화면 위에 떠 있다.
 *
 * @example
 * <BottomBarOverlay>
 *   <SpeedDialScrim />
 *   <SpeedDialFab />
 * </BottomBarOverlay>
 */
export function BottomBarOverlay(props: { children: ReactNode }): React.JSX.Element | null {
  const focused = useScreenFocused()

  if (!focused) return null

  return <Portal hostName={BOTTOM_BAR_OVERLAY_HOST}>{props.children}</Portal>
}
