// 끌기 중 **자동 스크롤이 만질 스크롤 뷰**. 화면의 `ScreenScroll` 이다.
//
// ── 왜 화면까지 올라가는가 ──────────────────────────────────────────────────────────
//
//  이 고정 영역을 없앤 뒤로 이 화면에는 자기 스크롤을 가진 조각이 없다. 두 층도 CTA 도
// 페이지와 함께 굴러가므로, 목록이 화면보다 길 때 끝으로 옮기려면 **페이지를 굴려야 한다.** 그
// 스크롤 뷰는 화면이 소유하고(`ScreenScroll`) 끌기는 목록 안에서 일어나니, 그 사이를 잇는 배선이
// 필요하다. 이 훅이 그 배선을 한 벌로 갖는다.
//
// 자리를 컨트롤러(`useCharacterManage`)에 두는 이유는 과 같다: 설정 하위 페이지와
// 온보딩 단계가 **같은 본문**을 쓰고 갈리는 것은 머리와 CTA 뿐이라, 두 화면이 각자 배선하면 그
// **같은 본문** 이 반쪽만 같아진다.
//
// ── 오프셋을 낙관적으로 앞당기지 않는다 ─────────────────────────────────────────────
//
// `scrollToPx` 뒤에 우리가 먼저 오프셋을 적어 두면(낙관적 갱신) 목록 끝에서 **매 프레임 어긋난다**.
// 네이티브가 최대치로 자르는데 우리 장부만 계속 늘어나고, 그 차이가 그대로 끌리는 행의 보정값이
// 되어 손가락 밑에서 떨린다. 그래서 진실은 `onScroll` 하나뿐이다. 대가는 한 프레임 늦은 값으로
// 다음 목표를 잡는 것뿐이고(그 프레임의 이동량이 조금 줄 뿐 멈추지는 않는다), 목록 끝에서는
// 오프셋이 안 변해 보정도 자연히 멈춘다.
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
