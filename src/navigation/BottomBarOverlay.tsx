/**
 * 화면이 소유한 오버레이를 **하단바 위에** 그리는 포털 슬롯([[ADR-180]]). 지금 쓰는 곳은
 * `SpeedDial`(가계부 ＋) 하나다.
 *
 * `zIndex` 는 같은 부모 안에서만 겨루는데 하단바는 `Main` 의 `layout` 이 화면들 뒤에 그린다. 그래서
 * 화면 안에서 그린 오버레이는 어떤 값을 줘도 바 아래다. 그림을 포털로 화면 밖에 내보내 해결한다.
 *
 * 두 가지가 계약이다.
 *
 * ① **호스트는 `Main` 의 `layout` 안, 바 바로 뒤에 선다.** 그래야 하위 페이지가 `Main` 을 밀어낼
 *    때 바와 함께 나간다. 앱 셸에 두면 바만 나가고 이 그림이 남는다.
 * ② **슬롯이 초점을 판정한다.** 포털로 나간 그림은 화면이 숨어도 안 숨는다(탭 화면은 서로
 *    언마운트되지 않고 네이티브가 뷰만 숨기는데, 이 그림은 그 뷰 밖이다). 안 접으면 가계부의 ＋ 가
 *    보스·오늘 화면 위에까지 떠 있다.
 */
import { useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { Portal, PortalHost } from '@gorhom/portal'
import { NavigationContext } from '@react-navigation/native'

/** 시트의 루트 호스트와 다른 이름이라 둘이 안 섞인다. */
const BOTTOM_BAR_OVERLAY_HOST = 'bottom-bar-overlay'

function useScreenFocused(): boolean {
  // `useIsFocused` 를 못 쓴다 — 내비게이터 밖에서 **던지는데** 컴포넌트 테스트는 내비게이터 없이
  // 렌더한다(`components/__tests__/render-atom.tsx`). 컨텍스트를 옵션으로 읽고 없으면 「보인다」다.
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

/** 호스트 — `Main` 의 `layout` 이 바 뒤에 하나만 그린다(계약 ①). */
export function BottomBarOverlayHost(): React.JSX.Element {
  return <PortalHost name={BOTTOM_BAR_OVERLAY_HOST} />
}

/**
 * 감싼 그림을 바 위 슬롯에 그린다. 선 자리에는 아무것도 안 남는다.
 *
 * 자리 계산은 넘기는 쪽 몫이고 **창 기준 절대 배치를 전제한다** — 부모가 바뀌어도 같은 자리에
 * 서야 하기 때문이다.
 */
export function BottomBarOverlay(props: { children: ReactNode }): React.JSX.Element | null {
  const focused = useScreenFocused()

  if (!focused) return null

  return <Portal hostName={BOTTOM_BAR_OVERLAY_HOST}>{props.children}</Portal>
}
