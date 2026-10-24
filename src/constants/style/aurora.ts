/**
 * 고가 드롭의 오로라 색. 빛기둥 연출 프레임(`assets/drop-effect/`)에서 뽑은 값이라, 먹은 순간 본 빛과 목록에 남는 표시가 같은 색이 된다.
 *
 * 테마와 관계없는 고정색이다. 고가라는 뜻이 테마마다 다른 색이 되면 안 된다.
 */
export const AURORA = {
  mint: '#8CECE7',
  cyan: '#6CCDED',
  sky: '#5CA1DD',
  cobalt: '#6E89CD',
  lilac: '#A79FE1',
  violet: '#C991D5',
  pink: '#E5A3E0',
} as const

/**
 * 오로라 글자의 그라디언트. 라이트는 같은 색상의 짙은 값이다.
 *
 * 파스텔을 밝은 카드 위에 그대로 쓰면 4.5:1 대비가 나오지 않는다.
 */
export const AURORA_TEXT = {
  light: ['#17799A', '#4552B8', '#8E3F99'],
  dark: [AURORA.mint, AURORA.lilac, AURORA.pink],
} as const
