/** 통계 도넛과 today 이번 주 수익 도넛이 함께 쓰는 조각 단계. 한쪽만 바꾸면 같은 갈래가 두 화면에서 다른 색이 된다 */
import { hexToOklch, oklchToHex } from '../color'

/** 조각이 되는 갈래 수. 넘으면 앞 넷과 `그 외 n` 으로 묶는다. 하나만 넘으면 묶지 않는다 */
export const SLICE_LIMIT = 4

/**
 * 조각의 OKLCH 명도. 큰 조각이 가장 밝다.
 * 0.56 보다 밝으면 흰 글자가 대비 4.5 를 못 지키고, 0.38 보다 어두우면 다크 테마의 카드 바탕에 묻힌다.
 */
export const SLICE_LIGHTNESS = [0.56, 0.515, 0.47, 0.425, 0.38] as const

/** 조각 안 글자색. 조각이 모두 어두워 테마와 상관없이 흰색이다 */
export const SLICE_LABEL_INK = '#FFFFFF'

/** `index` 번째 조각 색. `ink` 의 색상과 채도는 그대로 두고 명도만 바꾼다 */
export function sliceColor(ink: string, index: number): string {
  const { c, h } = hexToOklch(ink)
  return oklchToHex({ l: SLICE_LIGHTNESS[Math.min(index, SLICE_LIGHTNESS.length - 1)], c, h })
}

/** `그 외` 조각 색. 갈래 색과 섞이지 않게 거의 회색이다 */
export function restSliceColor(ink: string): string {
  return oklchToHex({ l: 0.42, c: 0.015, h: hexToOklch(ink).h })
}
