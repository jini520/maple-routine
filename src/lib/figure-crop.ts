/**
 * 전신 크롭. `character/basic` 이 주는 300×300 전신 룩에서 캐릭터가 서는 칸만 자른다.
 *
 * 통계 단상과 today 대표 캐릭터가 함께 쓴다. 같은 캐릭터를 두 화면이 다르게 자르면 다른 그림으로 보인다.
 */

/** 넥슨 그림(300×300)에서 캐릭터가 서는 칸. 발끝이 y≈201 이라 그 아래 3px 까지 자른다 */
export const FIGURE_SOURCE_SIZE = 300
export const FIGURE_BOX = { left: 92, top: 104, width: 116, height: 100 } as const
/** 흰 실루엣(180×180)에서 같은 크기로 서는 칸. 발끝이 y≈144 라 넥슨 그림과 같은 줄에 발이 닿는다 */
export const UNKNOWN_FIGURE_SIZE = 180
export const UNKNOWN_FIGURE_BOX = { left: 28.5, top: 47 } as const

/**
 * 칸을 `scale` 배로 줄여 세울 때 `overflow: hidden` 상자 안에 절대 배치할 `<Image>` 의 크기 · 오프셋.
 * @param scale 칸 폭 대비 화면 폭의 배수
 * @param known 넥슨 그림이면 참, 흰 실루엣이면 거짓
 */
export function figureCropStyle(
  scale: number,
  known: boolean,
): { width: number; height: number; left: number; top: number } {
  const size = known ? FIGURE_SOURCE_SIZE : UNKNOWN_FIGURE_SIZE
  const box = known ? FIGURE_BOX : UNKNOWN_FIGURE_BOX
  return { width: size * scale, height: size * scale, left: -box.left * scale, top: -box.top * scale }
}
