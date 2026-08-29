/**
 * 바 위 슬롯 — 화면이 소유한 오버레이를 **하단바보다 위에** 그린다([[ADR-180]]).
 *
 * ## 왜 슬롯이 필요한가 — `zIndex` 로는 못 올린다
 *
 * RN 에는 문서도 전역 z-index 도 없고, `zIndex` 는 **같은 부모 안에서만** 겨룬다. 층은 곧 형제
 * 순서다(`AppShell` 의 벽지 주석이 같은 말을 한다). 그런데 하단바는 `Main` 의 `layout` 이 **화면들
 * 뒤에** 그리므로, 화면 **안**에서 그린 오버레이는 무슨 값을 줘도 바 아래다 — 펼침판을 펴도
 * 백드롭이 바를 못 덮었다. 화면 컨테이너를 통째로 올리면 화면이 불투명이라 바가 흐려지는 대신
 * **사라진다**.
 *
 * 그래서 그림을 화면 밖으로 내보낸다. 기구는 새로 만들지 않는다 — **시트가 이미 쓰는 포털**이다
 * (`@gorhom/portal`). 시트가 바를 덮는 것도 같은 이유다: `PortalProvider` 가 `{children}` 을 그린
 * **뒤에** 루트 호스트를 붙여서, 시트가 앱 트리 전체의 다음 형제가 된다.
 *
 * ## 호스트는 **바 바로 뒤**에 선다
 *
 * `Main` 의 `layout` 안, `ConnectedBottomBar` 다음이다. 앱 셸(토스트가 있는 자리)에 두면 하위
 * 페이지가 `Main` 을 밀어낼 때 바는 함께 나가는데 이 그림만 남는다([[ADR-120]] 결정 4).
 * 바와 같은 상자에 있어야 «바가 나가면 함께 나간다» 가 구조로 성립한다.
 *
 * ## 슬롯이 **초점을 판정한다**
 *
 * 포털로 나간 그림은 **화면이 숨어도 안 숨는다.** 층 안의 화면들은 탭이라 서로 언마운트되지 않고
 * ([[ADR-167]] 결정 3) 네이티브가 화면 뷰를 숨길 뿐인데, 이 그림은 그 뷰 **밖**에 있다 — 가만 두면
 * 가계부의 ＋ 가 보스·오늘 화면 위에까지 떠 있게 된다. 그 판정은 여기 오는 **모든 그림의 전제**라
 * 쓰는 쪽이 아니라 슬롯이 든다.
 */
import { useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react'
import { Portal, PortalHost } from '@gorhom/portal'
import { NavigationContext } from '@react-navigation/native'

/** 호스트 이름 — 시트의 루트 호스트와 **다른 이름**이라 둘이 섞이지 않는다. */
export const ABOVE_BAR_HOST = 'above-bar'

/**
 * 「내 화면이 지금 보이나」.
 *
 * **`useIsFocused` 를 그대로 못 쓴다** — 그 훅은 내비게이터 밖에서 **던지는데**, 이 저장소의
 * 컴포넌트 테스트는 내비게이터 없이 렌더한다(`components/__tests__/render-atom.tsx`). 컨텍스트를
 * 옵션으로 읽어 **없으면 «보인다»** 로 둔다. 있으면 보는 값은 그 훅과 같다 — `isFocused()` 와
 * `focus`/`blur` 이고, 그 이벤트는 **부모 스택이 밀어낸 경우까지** 함께 온다.
 *
 * 값을 상태에 베끼지 않고 `useSyncExternalStore` 로 **바깥에서 그때그때 읽는다**(테마가 같은
 * 모양이다 — `ThemeProvider`). 상태로 베끼면 구독이 붙기 전(첫 커밋 이전)의 변화를 놓치고, 그것을
 * 메우려 효과 안에서 `setState` 하면 렌더가 한 번 더 돈다.
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

/** 슬롯의 호스트 — `Main` 의 `layout` 이 **바 뒤에** 하나만 그린다. */
export function AboveBarHost(): React.JSX.Element {
  return <PortalHost name={ABOVE_BAR_HOST} />
}

/**
 * 감싼 그림을 바 위 슬롯에 그린다. 선 자리에는 아무것도 안 남는다(포털은 `null` 을 낸다).
 *
 * 자리 계산은 넘기는 쪽의 몫이고 **창 기준 절대 배치를 전제**한다 — 부모가 바뀌어도 같은 자리에
 * 서야 하기 때문이다(`SpeedDial` 의 `dialBottomPx` 가 그렇게 서 있다).
 */
export function AboveBar(props: { children: ReactNode }): React.JSX.Element | null {
  const focused = useScreenFocused()

  if (!focused) return null

  return <Portal hostName={ABOVE_BAR_HOST}>{props.children}</Portal>
}
