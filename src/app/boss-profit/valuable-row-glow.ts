/**
 * 고가 드롭 행의 글로우 값 표. 보스 행과 가격 기록 행이 함께 쓴다.
 *
 * 컴포넌트 파일이 아닌 것은 거기서 내보내면 fast refresh 가 깨지기 때문이다. 호출부가 둘이라
 * 한쪽에서 가져오면 가격 화면이 드롭 시트·팝오버·보스 초상까지 딸린 모듈에 매달린다.
 */

/** `.valuable-drop-row` 의 정적 폴백 틴트. 모션을 끈 사용자가 보는 색이기도 하다. */
export const VALUABLE_ROW_TINT = 'rgba(247, 208, 13, 0.05)'

/**
 * `@keyframes valuable-drop-row-pulse` + `animation: … 2.6s ease-in-out infinite`.
 *
 * 웹은 `0%,100%` 를 한 블록으로 묶어 두 값만 적는다(0.03 → 0.1). RN 은 `from`·`50%`·`to` 세 마디라
 * 첫 값이 두 번 나온다. `FLOAT_ANIMATION` 과 같은 형태다. 웹 `index.css` 와 대조하던 테스트는
 * 없다(파일 머리).
 */
export const VALUABLE_ROW_PULSE = {
  animationName: {
    from: { backgroundColor: 'rgba(247, 208, 13, 0.03)' },
    '50%': { backgroundColor: 'rgba(247, 208, 13, 0.1)' },
    to: { backgroundColor: 'rgba(247, 208, 13, 0.03)' },
  },
  animationDuration: '2600ms',
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite',
} as const

/** `radial-gradient(70% 160% at 82% 50%, …)` 의 세 정지점. 색은 전 테마 공통 골드(`#F7D00D`). */
export const VALUABLE_ROW_GLOW_COLOR = '#F7D00D'
export const VALUABLE_ROW_GLOW_STOPS = [
  { offset: '0', opacity: 0.22 },
  { offset: '0.58', opacity: 0.06 },
  { offset: '0.78', opacity: 0 },
] as const
