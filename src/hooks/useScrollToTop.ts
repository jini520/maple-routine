/**
 * 최상단 이동을 화면에 잇는 훅 둘. 등록하는 쪽과 부르는 쪽이 **같은 라우트 이름**을 보므로,
 * 화면 안의 버튼과 하단바의 더블 터치가 한 과녁을 친다.
 *
 * 라우트를 `useRoute()` 로 안 읽는다. 그 훅은 내비게이터 밖에서 던지는데 이 저장소의 컴포넌트
 * 테스트는 내비게이터 없이 렌더한다(`BottomBarOverlay` 의 초점 판정이 컨텍스트를 직접 읽는
 * 것과 같은 이유).
 */
import { useCallback, useContext, useEffect, type RefObject } from 'react'

import { NavigationRouteContext } from '@react-navigation/native'

import { registerScrollToTop, scrollPageToTop } from '../navigation/scroll-to-top'

/** 최상단 이동이 쓰는 것은 이 메서드 하나다. `ScrollView`·`FlatList` 둘 다 갖는다. */
interface Scroller {
  scrollTo(options: { y: number; animated: boolean }): void
}

/** 이 컴포넌트가 선 화면의 라우트 이름. 내비게이터 밖이면 `undefined`. */
function useRouteName(): string | undefined {
  return useContext(NavigationRouteContext)?.name
}

/**
 * 이 화면의 스크롤 컨테이너를 최상단 이동의 과녁으로 등록한다. `ScreenScroll` 이 부른다.
 *
 * @param ref 스크롤 컨테이너의 ref
 */
export function useScrollToTopTarget(ref: RefObject<Scroller | null>): void {
  const page = useRouteName()

  useEffect(() => {
    if (page === undefined) return

    return registerScrollToTop(page, () => {
      ref.current?.scrollTo({ y: 0, animated: true })
    })
  }, [page, ref])
}

/**
 * 이 화면을 맨 위로 되돌리는 함수. 화면 안에 버튼으로 붙이는 자리가 쓴다.
 *
 * @example
 * const scrollToTop = useScrollToTop()
 * <IconButton onPress={scrollToTop} />
 */
export function useScrollToTop(): () => void {
  const page = useRouteName()

  return useCallback(() => {
    if (page !== undefined) scrollPageToTop(page)
  }, [page])
}
