import jobThemes from '../../data/job-themes.json'
import { contrastHex, hexToOklch } from '../color'
import {
  DEFAULT_THEME,
  THEME_CATEGORIES,
  THEME_NAMES,
  getThemeDefinition,
  groupThemesByCategory,
  isThemeName,
} from '../theme/theme-registry'
import { deriveMediaScope } from '../theme/theme-derive'
import type { ThemeName } from '../../types/theme'

const NAMES = Object.keys(jobThemes) as ThemeName[]

describe('THEME_NAMES / isThemeName: JSON 키가 단일 진실 공급원', () => {
  it('등록된 테마를 하나도 빠뜨리거나 더하지 않는다', () => {
    expect([...THEME_NAMES].sort()).toEqual([...NAMES].sort())
  })

  it('기본 테마가 맨 앞이다', () => {
    expect(THEME_NAMES[0]).toBe(DEFAULT_THEME)
  })

  /**
   * 표시 순서 규약은 카테고리가 먼저다. JSON 이 우연히 카테고리 순으로 적혀 있어 결과가 같아도
   * 규약은 그쪽이다. 그래서 나열 비교 대신 카테고리 인덱스가 뒤로 갈수록 줄지 않는다 를 본다.
   * 새 테마를 JSON 아무 데나 끼워 넣어도 이 성질이 깨지면 실패한다.
   */
  it('카테고리 순서대로 늘어서고, 같은 카테고리 안에서는 JSON 키 순서다', () => {
    const indexOf = (name: ThemeName): number =>
      THEME_CATEGORIES.indexOf(getThemeDefinition(name).category)

    const categoryIndexes = THEME_NAMES.map(indexOf)
    expect([...categoryIndexes]).toEqual([...categoryIndexes].sort((a, b) => a - b))

    for (const category of THEME_CATEGORIES) {
      const inRegistry = THEME_NAMES.filter((name) => getThemeDefinition(name).category === category)
      const inJson = NAMES.filter((name) => getThemeDefinition(name).category === category)
      expect(inRegistry).toEqual(inJson)
    }
  })
})

describe('groupThemesByCategory: 선택 목록의 섹션', () => {
  it('카테고리 순서대로 그룹을 낸다', () => {
    const groups = groupThemesByCategory(THEME_NAMES)

    expect(groups.map((group) => group.category)).toEqual(
      THEME_CATEGORIES.filter((category) =>
        THEME_NAMES.some((name) => getThemeDefinition(name).category === category),
      ),
    )
  })

  it('모든 테마가 자기 카테고리 그룹에 정확히 한 번 들어간다', () => {
    const grouped = groupThemesByCategory(THEME_NAMES).flatMap((group) => group.themes)

    expect([...grouped].sort()).toEqual([...THEME_NAMES].sort())
    for (const group of groupThemesByCategory(THEME_NAMES)) {
      for (const name of group.themes) {
        expect(getThemeDefinition(name).category).toBe(group.category)
      }
    }
  })

  // 필터가 걸러낸 뒤 빈 카테고리가 헤더만 남는 것을 막는다. 감추는 책임은 이 함수에 있다.
  it('항목이 없는 카테고리는 그룹째 나오지 않는다', () => {
    const darkOnly = THEME_NAMES.filter((name) => getThemeDefinition(name).mode === 'dark')
    const groups = groupThemesByCategory(darkOnly)

    expect(groups.every((group) => group.themes.length > 0)).toBe(true)
    expect(groups.flatMap((group) => group.themes)).toEqual(darkOnly)
  })

  it.each(NAMES)('%s 는 테마 이름이다', (name) => {
    expect(isThemeName(name)).toBe(true)
  })

  it('등록되지 않은 값은 걸러낸다', () => {
    expect(isThemeName('없는테마')).toBe(false)
    expect(isThemeName('')).toBe(false)
  })
})

// 일러스트 카드 안은 기준 표면이 media-surface 로 바뀐다. 등록된 테마 전부에서 본다.
describe('미디어 스코프', () => {
  // 카드 안 표면이 페이지 표면으로 새면 어두운 카드 위에 밝은 pill 이 얹힌다.
  it.each([...THEME_NAMES])('%s: 카드 안 표면이 카드와 같은 밝기 대역에 있다', (name) => {
    const theme = getThemeDefinition(name)
    const scope = deriveMediaScope(theme, theme.mode)
    const cardLightness = hexToOklch(theme.mediaSurface).l

    for (const token of ['surface2', 'track'] as const) {
      expect(hexToOklch(scope[token]).l, `${token} 가 카드보다 너무 밝다`).toBeLessThan(cardLightness + 0.2)
    }
  })

  it.each([...THEME_NAMES])('%s: 완료 배지가 카드 안 "시작 안함" 배지와 구분된다', (name) => {
    const theme = getThemeDefinition(name)
    const scope = deriveMediaScope(theme, theme.mode)

    // 알파는 떼고 바탕색만 견준다. 카드 위에 얹히므로 실제 인상은 이보다 카드 쪽에 가깝다.
    expect(contrastHex(scope.secondaryTint.slice(0, 7), scope.surface2.slice(0, 7))).toBeGreaterThan(1.5)
  })
})
