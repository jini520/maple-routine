/**
 * 웹 `index.css` 의 **`.valuable-drop-row`** 가 내려온 값들.
 *
 * ## 왜 컴포넌트 파일이 아닌가
 *
 * 원래 `keyframes-parity.test.ts` 가 웹 `index.css` 를 **실제로 읽어** 이 값들과 대조했다. **그 테스트는
 * 없다**(웹 소스와 함께 지워졌다). 값이 컴포넌트가 아니라 여기 사는 이유는
 * 남은 하나다: 컴포넌트 파일에서 내보내면 fast refresh 가 깨진다(`valuable-card-glow.ts`·
 * `Button/variants.ts`·`row-class.ts` 와 같은 판단).
 *
 * ## step 6 이 `BossProfitBossRow` 안에 두었던 것이 여기로 왔다
 *
 * 그때는 호출부가 보스 행 하나뿐이었다. step 8 의 **가격 기록 화면 행**(`DropPriceScreen` 의
 * `EntryRow`. 웹도 같은 `valuable-drop-row` 클래스를 쓴다)이 두 번째가 되어 의
 * "호출부 2곳 이상"을 넘겼다. 옮기지 않고 `BossProfitBossRow` 에서 가져오면 가격 화면이 드롭 시트·
 * 팝오버·보스 초상까지 딸린 모듈에 매달린다.
 *
 * **드롭 히스토리에는 쓰지 않는다**. 이 명시적으로 뺐다(줄간격을 좁히면 배경
 * 블록끼리 붙어 서로를 잡아먹는다). 그 화면의 고가 표시는 pill 과 본문색만 담당한다.
 */

/** `.valuable-drop-row` 의 정적 폴백 틴트 — 모션을 끈 사용자가 보는 색이기도 하다. */
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
