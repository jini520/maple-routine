/**
 * 아이템 드롭 미획득 단계의 시각 표현 표. 단풍잎이 색을 잃고 기울다 떨어지는 5단계.
 *
 * 읽는 곳이 둘이다(드롭 히스토리 화면 · today 의 가뭄 위젯). 양쪽이 각자 들면 한쪽만 고쳐지고
 * 같은 단계가 두 화면에서 다른 색으로 늙는다. 여기 있는 것은 값뿐이고 그림은 각 화면이 그린다.
 *
 * 색이 테마 토큰이 아니라 **고정 hex** 인 것은 이 램프가 골드에서 무채색을 거쳐 차가운 회청색으로
 * 가는 한 줄기라서다. 테마마다 다른 색으로 갈리면 의미를 잃는다. 잎은 면적 채색이라 본문 텍스트급
 * 대비가 필요 없고, 글자색은 테마 토큰을 쓴다.
 */

export const DROUGHT_TIER_STYLES = [
  { leaf: '#f7d00d', ink: 'text-text', rotate: 0, opacity: 1, glow: true },
  { leaf: '#e0b400', ink: 'text-text', rotate: 6, opacity: 0.95, glow: false },
  { leaf: '#b99a5c', ink: 'text-text-muted', rotate: 14, opacity: 0.8, glow: false },
  { leaf: '#9a9a93', ink: 'text-text-muted', rotate: 26, opacity: 0.6, glow: false },
  { leaf: '#8f98a1', ink: 'text-text-disabled', rotate: 42, opacity: 0.45, glow: false },
] as const

/**
 * 0단계 잎의 글로우. 웹 `drop-shadow(0 0 5px rgba(247,208,13,.75))`.
 *
 * **문자열로 넘긴다**: RN 의 `dropShadow` 필터는 CSS 값 문법을 그대로 받으므로 blur 반지름 ↔ 표준
 * 편차 환산을 우리가 하지 않아도 된다(객체 형태로 적으면 그 환산이 새 오차원이 된다).
 */
export const DROUGHT_GLOW_FILTER = [{ dropShadow: '0 0 5px rgba(247,208,13,0.75)' }]
