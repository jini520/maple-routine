/**
 * 바와 그 미리보기가 같이 쓰는 그림자. 치수는 `lib/bottom-bar-metrics.ts` 에 있다.
 *
 * 컴포넌트 파일이 아닌 것은 값을 내보내면 fast refresh 가 깨지기 때문이다.
 */
import type { ShadowLayer } from '../../../lib/shadow'

/** 바 자신의 그림자. 페이지와 바를 가르는 유일한 장치라 선을 걷은 만큼 조금 진하다. 층은 알약 쪽에서 만든다. */
export const BAR_SHADOW: ShadowLayer = { opacity: 0.3, radius: 16, y: 6 }

/**
 * 유리가 없는 곳(iOS 26 미만 · 안드로이드)에서 쉬는 알약의 판 그림자. 설정의 미리보기도 같은 값이다.
 *
 * 값이 큰 것은 과해서가 아니라 두 번 깎이기 때문이다. 테마의 `shadowColor` 알파(0.35)와
 * 곱해져 실효 0.23 이다. 0.26(실효 0.09)이면 라이트에서 층이 아예 안 보인다.
 */
export const PLATE_SHADOW: ShadowLayer = { opacity: 0.65, radius: 10, y: 3 }
