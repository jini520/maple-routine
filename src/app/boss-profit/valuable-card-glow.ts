/**
 * 고가 드롭 카드의 **글로우 값**. 웹 `index.css` 의 `.valuable-drop-card`
 * `box-shadow` 와 `@keyframes valuable-drop-glow` 가 여기로 내려왔다.
 *
 * **왜 컴포넌트 파일이 아니라 여기인가**. `CharacterAccordion.tsx` 가 이 값들을 export 하면 fast
 * refresh 가 깨진다(`Button/variants.ts`·`row-class.ts`·`Toast/timer-animation.ts` 와 같은 판단).
 * 값을 밖으로 내보낸 이유는 원래 `keyframes-parity.test.ts` 가 **웹 CSS 를 실제로 읽어** 이 값들과
 * 대조했기 때문이다. **그 테스트는 없다**. 웹 소스가 사라지며 함께 지워졌다.
 * 지금 이 값들을 지키는 것은 대조가 아니라 이 주석과 아래 출처 표기뿐이다.
 *
 * ══ RN 에서 갈린 것. 맥동을 **파라미터로 못 굴린다** ═══════════════════════════════
 *
 * 웹은 `box-shadow` 자체를 키프레임으로 보간해 블러·확산·알파가 함께 움직였다. RN 은 그 속성을
 * 보간하지 않으므로 두 끝점을 각각 가진 겹을 **반대 방향 `opacity` 로 교차**시킨다.
 * 끝점 둘(`0%,100%` 와 `50%`)은 웹과 정확히 같고, 중간만 파라미터 보간이 아니라 알파 교차다.
 */

/**
 * `.valuable-drop-card` 의 **정적** `box-shadow`.
 *
 * 웹에서 이 값이 그대로 보이는 자리가 셋이다. `@property` 미지원 WebView · `prefers-reduced-motion`
 * **펼침 상태**(`.valuable-drop-card--expanded { animation: none }`).
 */
export const VALUABLE_CARD_GLOW_STATIC = [
  { offsetX: 0, offsetY: 0, blurRadius: 8, spreadDistance: 0, color: 'rgba(247, 208, 13, 0.45)' },
  { offsetX: 0, offsetY: 0, blurRadius: 15, spreadDistance: 2, color: 'rgba(247, 208, 13, 0.25)' },
] as const

/** `@keyframes valuable-drop-glow` 의 `0%,100%` 마디. */
export const VALUABLE_CARD_GLOW_LOW = [
  { offsetX: 0, offsetY: 0, blurRadius: 6, spreadDistance: 0, color: 'rgba(247, 208, 13, 0.4)' },
  { offsetX: 0, offsetY: 0, blurRadius: 12, spreadDistance: 2, color: 'rgba(247, 208, 13, 0.2)' },
] as const

/** `@keyframes valuable-drop-glow` 의 `50%` 마디. */
export const VALUABLE_CARD_GLOW_HIGH = [
  { offsetX: 0, offsetY: 0, blurRadius: 10, spreadDistance: 1, color: 'rgba(247, 208, 13, 0.6)' },
  { offsetX: 0, offsetY: 0, blurRadius: 18, spreadDistance: 4, color: 'rgba(247, 208, 13, 0.32)' },
] as const

/** `animation: valuable-drop-glow 2s ease-in-out infinite`. */
export const VALUABLE_CARD_GLOW_DURATION_MS = 2000
export const VALUABLE_CARD_GLOW_TIMING = 'ease-in-out'

/**
 * `.valuable-drop-card::before` 가 **degrade 했을 때** 그리는 그림(`@property`
 * 미지원 WebView 를 위해 그 결정이 이미 설계해 둔 폴백이다).
 *
 * conic-gradient 의 `from var(--vd-angle)` 은 `initial-value: 0deg` 이고 그 각도에서 링의 대부분이
 * 베이스 골드(`#f7d00d`)라, 회전을 못 하는 환경이 보는 것은 **골드 2px 테두리**다. RN 에 conic
 * gradient 가 없으므로 그 폴백이 그대로 우리 그림이 된다.
 */
export const VALUABLE_CARD_RING_COLOR = '#f7d00d'
export const VALUABLE_CARD_RING_WIDTH = 2

/**
 * 링 반경.
 *
 * 펼침 셸은 자식을 **패딩 박스**(반경 13 = 14 − 테두리 1)에서 잘라내므로 링도 13 이어야 모서리
 * 바깥이 안 깎인다. 접힘 셸은 그 자리에 테두리가 없어(패딩 박스 = 테두리 박스) 14 그대로다.
 */
export const VALUABLE_CARD_RING_RADIUS = { collapsed: 14, expanded: 13 } as const

const GLOW_FADE_BASE = {
  animationDuration: `${VALUABLE_CARD_GLOW_DURATION_MS}ms`,
  animationTimingFunction: VALUABLE_CARD_GLOW_TIMING,
  animationIterationCount: 'infinite',
} as const

/** 낮은 겹: 1 → 0 → 1. */
export const VALUABLE_CARD_GLOW_LOW_FADE = {
  animationName: { from: { opacity: 1 }, '50%': { opacity: 0 }, to: { opacity: 1 } },
  ...GLOW_FADE_BASE,
} as const

/** 높은 겹: 0 → 1 → 0. */
export const VALUABLE_CARD_GLOW_HIGH_FADE = {
  animationName: { from: { opacity: 0 }, '50%': { opacity: 1 }, to: { opacity: 0 } },
  ...GLOW_FADE_BASE,
} as const
