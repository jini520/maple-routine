// 도넛 조각 색 단계를 등록된 테마 전부에 대고 본다. 라이트는 primary 에서 바탕 쪽으로 옅어지고, 다크는 셋째가 primary 다.
// 테마를 더하면 그 테마도 여기서 걸린다. 연한 primary 를 가진 테마는 작은 조각이 바탕에 묻힐 수 있다.
import jobThemes from '../../../../data/job-themes.json'
import { contrastHex, hexToOklch } from '../../../../lib/color'
import type { ThemeDefinition } from '../../../../types/theme'
import { donutStepColors } from '../donut-steps'

const THEMES = Object.entries(jobThemes) as ReadonlyArray<[string, ThemeDefinition]>
const LIGHT = THEMES.filter(([, theme]) => theme.mode === 'light')
const DARK = THEMES.filter(([, theme]) => theme.mode === 'dark')

const lightnessOf = (hex: string): number => hexToOklch(hex).l

/** 두 색상(도)의 차이. 0 ~ 180 */
function hueGap(a: string, b: string): number {
  return Math.abs(((hexToOklch(a).h - hexToOklch(b).h + 540) % 360) - 180)
}

describe('donutStepColors', () => {
  it('라이트 · 다크 테마가 모두 있다. 아래 검사가 공회전하지 않는다', () => {
    expect(LIGHT.length).toBeGreaterThan(0)
    expect(DARK.length).toBeGreaterThan(0)
  })

  it.each(LIGHT)('%s: 첫째가 primary 이고, 뒤로 갈수록 명도가 카드 바탕 쪽으로 다가간다', (_name, theme) => {
    const steps = donutStepColors(theme.primary, theme.surface, theme.mode)
    const surface = lightnessOf(theme.surface)
    const distances = steps.map((step) => Math.abs(surface - lightnessOf(step)))

    expect(steps).toHaveLength(5)
    expect(steps[0]).toBe(theme.primary)
    for (let index = 1; index < steps.length; index += 1) {
      expect(distances[index]!).toBeLessThan(distances[index - 1]! - 0.03)
    }
  })

  it.each(DARK)('%s: 셋째가 primary 이고, 앞은 더 밝고 뒤는 더 어둡다', (_name, theme) => {
    const steps = donutStepColors(theme.primary, theme.surface, theme.mode)
    const lightness = steps.map(lightnessOf)

    expect(steps).toHaveLength(5)
    expect(steps[2]).toBe(theme.primary)
    for (let index = 1; index < steps.length; index += 1) {
      expect(lightness[index]!).toBeLessThan(lightness[index - 1]! - 0.03)
    }
  })

  // 명도를 옮기다 sRGB 밖으로 나가면 채도만 줄인다. 채널을 자르면 색상이 틀어져 다른 색처럼 보인다.
  it.each(THEMES)('%s: 다섯 단계가 모두 primary 의 색상을 지킨다', (_name, theme) => {
    for (const step of donutStepColors(theme.primary, theme.surface, theme.mode)) {
      expect(hueGap(step, theme.primary)).toBeLessThan(2)
    }
  })

  // 가장 옅은 조각도 카드 바탕에서 보여야 한다. 범례 이름이 있어 글자만큼의 대비는 요구하지 않는다.
  it.each(THEMES)('%s: 모든 단계가 카드 바탕과 구분된다', (_name, theme) => {
    for (const step of donutStepColors(theme.primary, theme.surface, theme.mode)) {
      expect(contrastHex(step, theme.surface)).toBeGreaterThanOrEqual(1.3)
    }
  })
})
