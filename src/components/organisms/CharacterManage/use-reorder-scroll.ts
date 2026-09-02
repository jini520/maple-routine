/**
 * 끌기 중 자동 스크롤이 만질 스크롤 뷰를 잇는 훅. 대상은 화면의 `ScreenScroll` 이다.
 *
 * 이 화면에는 자기 스크롤을 가진 조각이 없어서, 목록이 화면보다 길 때 끝으로 옮기려면 페이지를
 * 굴려야 한다. 그 스크롤 뷰는 화면이 소유하고 끌기는 목록 안에서 일어나므로 사이를 잇는 배선이
 * 필요하다.
 *
 * 자리가 컨트롤러(`useCharacterManage`)인 것은 설정 하위 페이지와 온보딩 단계가 같은 본문을 쓰기
 * 때문이다. 두 화면이 각자 배선하면 그 같은 본문이 반쪽만 같아진다.
 *
 * ⚠️ **오프셋을 낙관적으로 앞당기지 말 것.** `scrollToPx` 뒤에 우리가 먼저 적어 두면 목록 끝에서
 * 매 프레임 어긋난다. 네이티브는 최대치로 자르는데 우리 장부만 계속 늘어난다.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native'

export interface ReorderScroll {
  /** 지금 스크롤 오프셋(px). 끌기 보정이 콘텐츠가 얼마나 흘렀나 를 이 값으로 잰다. */
  offsetPx: () => number
  /** 그 자리로 즉시 옮긴다. 애니메이션을 걸면 프레임마다 목표가 갈려 서로를 취소한다. */
  scrollToPx: (yPx: number) => void
}

interface ReorderScrollWiring {
  /** `ScreenScroll` 의 `ref` 로 넘긴다. */
  scrollRef: React.RefObject<ScrollView | null>
  /** `ScreenScroll` 의 `onScroll` 로 넘긴다. 오프셋은 여기서만 온다. */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  scroll: ReorderScroll
}

export function useReorderScroll(): ReorderScrollWiring {
  const scrollRef = useRef<ScrollView | null>(null)
  const offsetRef = useRef(0)

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    offsetRef.current = event.nativeEvent.contentOffset.y
  }, [])

  // 렌더마다 새 객체를 만들면 그것을 프롭으로 받는 목록이 매번 다시 그려진다(끌기 중에는 프레임
  // 마다다). 값은 전부 ref 뒤에 있으므로 객체 자체는 한 번 만들면 끝이다.
  const scroll = useMemo<ReorderScroll>(
    () => ({
      offsetPx: () => offsetRef.current,
      scrollToPx: (yPx: number) => {
        scrollRef.current?.scrollTo({ y: yPx, animated: false })
      },
    }),
    [],
  )

  return { scrollRef, onScroll, scroll }
}
