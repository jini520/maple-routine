/**
 * 비중 도넛의 조각 색 다섯 단계. 금액이 큰 조각부터 하나씩 쓰고, 범례 네모도 같은 색을 쓴다.
 *
 * `base` 의 OKLCH 색상 · 채도는 두고 명도만 옮긴다. 라이트는 첫째가 `base` 이고 바탕 쪽으로 옅어진다.
 * 다크는 셋째가 `base` 이고 앞이 밝고 뒤가 어둡다. 다크에서 바탕 쪽으로만 옮기면 작은 조각이 바탕에 묻힌다.
 */
import { hexToOklch, oklchToHex } from '../../../lib/color'
import type { ThemeMode } from '../../../types/theme'

/** 라이트: `base` 에서 바탕까지의 명도 거리 중 옮기는 몫 */
const LIGHT_SHARE_TOWARD_SURFACE = [0, 0.15, 0.3, 0.45, 0.6] as const

/** 다크: `base` 명도에 더하는 값 */
const DARK_LIGHTNESS_OFFSET = [0.14, 0.07, 0, -0.07, -0.14] as const

/**
 * @param base 단계의 바탕이 되는 색. 앱은 테마 `primary`
 * @param surface 도넛이 놓이는 면의 색
 * @param mode 테마의 라이트 · 다크
 * @returns 큰 조각부터 쓰는 다섯 색. `base` 와 같은 단계는 `base` 그대로
 */
export function donutStepColors(base: string, surface: string, mode: ThemeMode): readonly string[] {
  const { l, c, h } = hexToOklch(base)
  if (mode === 'light') {
    const target = hexToOklch(surface).l
    return LIGHT_SHARE_TOWARD_SURFACE.map((share) => (share === 0 ? base : oklchToHex({ l: l + (target - l) * share, c, h })))
  }
  return DARK_LIGHTNESS_OFFSET.map((offset) => (offset === 0 ? base : oklchToHex({ l: l + offset, c, h })))
}
