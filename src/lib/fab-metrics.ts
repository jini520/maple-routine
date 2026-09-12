/**
 * 떠 있는 원의 치수와 자리. 화면이 콘텐츠 끝에 갚아야 할 높이를 함께 내는 값.
 *
 * FAB 는 화면 위에 떠 있어 콘텐츠를 밀어내지 않는다. 그래서 스크롤을 끝까지 내리면 마지막
 * 줄이 버튼 뒤로 들어간다.
 *
 * 값이 파일로 나와 있는 것은 여러 곳이 나눠 쓰기 때문이다. 버튼이 자기 높이를 정하고 화면이
 * 그만큼을 콘텐츠 끝에 갚는다. 한쪽에 손으로 옮겨 적으면 갈리고, 갈려도 화면에서는 조금
 * 가린다로만 보인다.
 *
 * 하단바의 몫은 여기 없다. `ScreenScroll` 이 이미 콘텐츠 끝에 준다.
 */
import { useWindowDimensions } from 'react-native'

import { resolveBottomBarMetrics } from './bottom-bar-metrics'
import { useBottomSafeAreaPx } from './safe-area'
import type { ShadowLayer } from './shadow'

/** FAB 의 지름. 버튼의 `h-14 w-14` 와 같아야 하고, 그 약속은 테스트가 잰다. */
export const FAB_DIAMETER_PX = 56

/** FAB 가 하단바 위로 뜨는 높이. */
export const FAB_LIFT_PX = 12

/**
 * 마지막 줄과 FAB 사이의 숨돌림.
 *
 * 0 이면 안 가린다 는 만족하지만 마지막 줄이 버튼에 딱 붙는다. 화면의 리듬과 같은 16 을 쓴다.
 * 이 값이 화면의 `pb-4` 를 대신하므로 넣지 않으면 바닥 여백이 도리어 사라진다.
 */
export const FAB_CONTENT_GAP_PX = 16

/**
 * FAB 가 하단바 위로 더 먹는 세로 몫. 스크롤 콘텐츠가 끝에 남겨야 하는 값이다.
 *
 * 화면의 `pb-4` 를 대신한다(더하지 않는다). 둘을 더하면 바닥 여백이 두 번 붙는다.
 */
export const FAB_SPACE_PX = FAB_LIFT_PX + FAB_DIAMETER_PX + FAB_CONTENT_GAP_PX

/**
 * 원이 드는 그림자 한 겹. 원 둘이 같은 것을 쓴다.
 *
 * 같은 층에 떠 있는 물건이라 같은 높이로 보여야 한다. 값을 각자 적어 두면 한쪽만 손볼 때 갈리고,
 * 갈려도 화면에서는 한쪽이 조금 진하다로만 보인다.
 *
 * 불투명도 0.65 는 테마 `shadowColor` 의 알파(0.35)와 곱해져 실효 0.23 이다. 하단바의 알약이
 * 같은 실효값을 쓰고(반경 10 · y 3) 그 값은 실기기에서 고른 것이다. 반경과 민 거리만 한 걸음 큰
 * 것은 원이 알약보다 한 겹 위에 떠 있어서다(`FAB_LIFT_PX`).
 */
export const FAB_SHADOW: ShadowLayer = { opacity: 0.65, radius: 12, y: 4 }

/**
 * 다크에서 원의 경계를 내는 헤어라인.
 *
 * 어두운 바탕에서는 그림자가 거의 안 보인다. 하단바가 라이트 그림자 · 다크 테두리로 가른 것과
 * 같은 자리다.
 *
 * 흰색인 것은 원이 색을 진 판이기 때문이다. 바의 폴백 테두리는 무채색 판의 가장자리를 세우는
 * 값인데, 닫혀 있으면 `bg-primary` 인 이 원에 어두운 중립선을 두르면 파낸 구멍처럼 읽힌다.
 */
export const FAB_DARK_EDGE = 'rgba(255,255,255,0.22)'

/**
 * 떠 있는 하단바 위에 앉는 `bottom` 값.
 *
 * 바는 화면 상자 밖이 아니라 그 위에 떠 있어서 화면 기준 `bottom: 0` 은 바 뒤다. 그렇게
 * 두면 FAB 가 캡슐에 반쯤 가려 안 보인다.
 *
 * `ScreenScroll` 이 콘텐츠 끝에 남기는 몫과 같은 함수에서 나온다. 손으로 옮겨 적으면
 * 기기마다 갈린다. **바 높이가 창 폭의 함수이기 때문이다.**
 *
 * 부르는 쪽은 탭 화면에 선다고 전제한다. 바가 없는 하위 페이지에 놓을 일이 생기면 그때 가른다.
 */
export function useFabBottomPx(): number {
  const bottomSafeAreaPx = useBottomSafeAreaPx()
  const { width: windowWidthPx } = useWindowDimensions()

  return bottomSafeAreaPx + resolveBottomBarMetrics(windowWidthPx).spacePx + FAB_LIFT_PX
}
