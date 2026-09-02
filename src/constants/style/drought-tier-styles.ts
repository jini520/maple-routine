/**
 * 아이템 드롭 미획득 단계의 **시각 표현**([[ADR-071]] 결정 9, 사용자 확정 2026-08-01 — 시안 W4).
 *
 * 단풍잎이 색을 잃고 기울다 떨어지는 것으로 가뭄을 말한다. 은유를 새로 만들지 않고 **브랜드 마크를
 * 그대로 쓴 이유**가 이것이다 — 단풍잎은 원래 그렇게 늙으므로 억지 장식이 아니고, 새 에셋도 없다.
 *
 * ## 왜 화면이 아니라 `lib/` 에 있는가
 *
 * 읽는 곳이 둘이다 — 드롭 히스토리 화면(`/profit/drops`)과 today 의 아이템 드롭 가뭄 위젯. 5행짜리
 * 값 표를 양쪽이 각자 들면 한쪽만 고쳐지고, 그러면 같은 단계가 두 화면에서 다른 색으로 늙는다
 * ([[ADR-094]] 결정 1의 «호출부 2곳» 조건). 여기 있는 것은 값뿐이고 그림(SVG 크기·testID·접근성
 * 이름)은 각 화면이 자기 사정대로 그린다.
 *
 * 색이 테마 토큰이 아니라 고정 hex 인 것은 고가 골드와 같은 사정이다([[ADR-045]]) — 이 램프는 "골드에서
 * 무채색을 거쳐 차가운 회청색으로" 가는 한 줄기라 테마마다 다른 색으로 갈리면 의미를 잃는다. 잎은
 * 아이콘(면적 채색)이라 본문 텍스트급 대비가 필요 없고, 글자색은 테마 토큰을 쓴다.
 *
 * 단계 경계·문구는 `src/lib/drop/drop-history` 의 `VALUABLE_DROUGHT_TIERS` 가 정한다 — 이 배열은 그
 * 인덱스에 1:1로 대응하므로 길이가 어긋나면 안 된다(`getValuableDroughtTier` 가 주는 값이 곧 첨자다).
 */

export const DROUGHT_TIER_STYLES = [
  { leaf: '#f7d00d', ink: 'text-text', rotate: 0, opacity: 1, glow: true },
  { leaf: '#e0b400', ink: 'text-text', rotate: 6, opacity: 0.95, glow: false },
  { leaf: '#b99a5c', ink: 'text-text-muted', rotate: 14, opacity: 0.8, glow: false },
  { leaf: '#9a9a93', ink: 'text-text-muted', rotate: 26, opacity: 0.6, glow: false },
  { leaf: '#8f98a1', ink: 'text-text-disabled', rotate: 42, opacity: 0.45, glow: false },
] as const

/**
 * 0단계 잎의 글로우 — 웹 `drop-shadow(0 0 5px rgba(247,208,13,.75))`.
 *
 * **문자열로 넘긴다**: RN 의 `dropShadow` 필터는 CSS 값 문법을 그대로 받으므로 blur 반지름 ↔ 표준
 * 편차 환산을 우리가 하지 않아도 된다(객체 형태로 적으면 그 환산이 새 오차원이 된다).
 */
export const DROUGHT_GLOW_FILTER = [{ dropShadow: '0 0 5px rgba(247,208,13,0.75)' }]
