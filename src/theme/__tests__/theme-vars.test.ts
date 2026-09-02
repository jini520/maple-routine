// 테마 값이 **이름과 값 그대로** 변수 맵에 실리는지 지킨다([[ADR-128]] 3단계).
//
// 값을 손으로 적지 않는다 — 색은 [[ADR-006]] 대상이라 사람이 확인해 `job-themes.json` 에 커밋한
// 것이고, 테스트가 그 값을 베끼면 두 벌이 되어 어느 쪽이 진실인지 알 수 없게 된다. 그래서 기대값은
// **데이터에서 읽거나 core 의 출력과 대조**한다. 예외는 딱 하나, [[ADR-122]] 가 실기기에서 확정해
// ADR 본문 표에 적어 둔 세 값이다(그건 데이터가 아니라 **결정**이라 다시 계산해선 안 된다).
//
// 이 파일이 지키는 고리 넷:
//   ① 변수 **이름**이 core 의 `buildThemeCss` 와 같은가 — 다르면 색이 조용히 사라진다
//   ② 변수 **값**이 `job-themes.json` 의 값 그대로인가
//   ③ `.media-scope` 재선언이 빠짐없이 실리는가([[ADR-064]] 결정 5)
//   ④ `tailwind.config.js` 가 만든 유틸리티 이름과 변수 이름이 맞물리는가

import { buildThemeCss, THEME_NAMES, getThemeDefinition } from '../../lib/theme/theme-registry'
import { THEME_TOKEN_KEYS } from '../../lib/theme/theme-derive'
import { hexToOklch } from '../../lib/color'
import type { ThemeName } from '../../types/theme'

import {
  PANEL_BORDER_TOKEN,
  SHEET_LIFT,
  buildMediaScopeVariables,
  buildSheetScopeVariables,
  buildThemeVariables,
  resolvePanelBorder,
  toColorVariableName,
} from '../theme-vars'

/** `buildThemeCss` 결과에서 한 블록의 `--이름: 값;` 선언을 뽑는다. */
function declarationsIn(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(
    [...body.matchAll(/(?<name>--[a-z0-9-]+):\s*(?<value>[^;]+);/g)].map((match) => [
      match.groups!.name,
      match.groups!.value.trim(),
    ]),
  )
}

/** 파생 토큰은 core 의 CSS 에 없다 — RN 이 선택자 대신 값으로 푸는 자리다([[ADR-122]]). */
const PANEL_BORDER_VARIABLE = toColorVariableName(PANEL_BORDER_TOKEN)

/**
 * `--color-*` 만 남긴다 — `:root` 블록에는 배경 이미지(`--theme-bg-*`)도 섞여 있다.
 *
 * [[ADR-129]] 전에는 RN 에서 배경 슬러그가 **아무것도 해석되지 않아** 그 줄이 애초에 안 나왔고,
 * 그래서 두 맵을 통째로 비교해도 맞았다. 지금은 에셋이 있어 `buildThemeCss` 가 그 줄을 낸다 —
 * 그런데 RN 은 벽지를 CSS 배경이 아니라 `<Image>` 로 그리므로 **값의 형태가 다르고**
 * (`theme-vars.ts` 파일 머리) 변수로 내지 않는 것이 여전히 맞다. 그 «내지 않는다»는 아래에서
 * 따로 단언하고, 여기서는 색만 견준다.
 */
function colorDeclarationsIn(css: string, selector: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(declarationsIn(css, selector)).filter(([name]) => name.startsWith('--color-')),
  )
}

describe('변수 이름 규칙', () => {
  it.each([
    ['bg', '--color-bg'],
    ['surface2', '--color-surface-2'],
    ['borderStrong', '--color-border-strong'],
    ['onPrimary', '--color-on-primary'],
    ['mediaInkMuted', '--color-media-ink-muted'],
  ])('%s → %s', (token, expected) => {
    expect(toColorVariableName(token)).toBe(expected)
  })

  // 이름 규칙이 core 에 한 벌, 여기 한 벌 있다(core 쪽은 export 되지 않는다). 규칙이 갈라지면
  // 유틸리티가 참조하는 변수와 우리가 내는 변수가 어긋나 색이 **조용히 사라지므로**, 토큰 이름
  // 전부를 core 의 실제 출력과 대조한다.
  it('38토큰 전부가 core 의 `buildThemeCss` 와 같은 이름으로 나온다', () => {
    const fromCore = Object.keys(
      colorDeclarationsIn(buildThemeCss(getThemeDefinition('머쉬맘')), ':root'),
    )

    expect(fromCore).toHaveLength(THEME_TOKEN_KEYS.length)
    expect(THEME_TOKEN_KEYS.map(toColorVariableName).sort()).toEqual([...fromCore].sort())
  })
})

describe.each(THEME_NAMES as readonly ThemeName[])('%s', (name) => {
  const definition = getThemeDefinition(name)
  const css = buildThemeCss(definition)

  it('`:root` 변수가 core 의 출력과 이름·값 모두 같다(파생 토큰 하나만 더 낸다)', () => {
    const variables = buildThemeVariables(definition)
    const { [PANEL_BORDER_VARIABLE]: panelBorder, ...tokens } = variables

    expect(panelBorder).toBe(resolvePanelBorder(definition))
    expect(tokens).toEqual(colorDeclarationsIn(css, ':root'))
  })

  // **배경 이미지는 변수로 내지 않는다**(`theme-vars.ts` 파일 머리). [[ADR-129]] 이후 core 는 그 줄을
  // 내고 에셋도 실재하지만, RN 에서 그 값은 URL 문자열이 아니라 에셋 id 라 `url("…")` 이 뜻을 잃는다 —
  // 벽지를 `<Image>` 로 그리는 것은 뷰 레이어 몫으로 남아 있다. 여기서 새어 나가면 조용히 죽는
  // 스타일이 하나 생기므로 계약으로 막는다.
  it('배경 이미지는 변수 맵에 새어 나오지 않는다', () => {
    const names = Object.keys(buildThemeVariables(definition))

    expect(names.some((name) => name.startsWith('--theme-bg'))).toBe(false)
    expect(names.every((name) => name.startsWith('--color-'))).toBe(true)
  })

  it('값이 `job-themes.json` 그대로다(변환·보정이 없다)', () => {
    const variables = buildThemeVariables(definition)

    for (const token of THEME_TOKEN_KEYS) {
      expect(variables[toColorVariableName(token)]).toBe(definition[token])
    }
  })

  it('`.media-scope` 재선언이 core 의 출력과 같다', () => {
    expect(buildMediaScopeVariables(definition)).toEqual(declarationsIn(css, '.media-scope'))
  })

  // 카드 안에서 쓰는 토큰을 하나라도 빠뜨리면 페이지 값이 그대로 내려온다(어두운 카드 위에 페이지의
  // 밝은 크림색 pill 이 얹혔던 실패, 2026-07-30). 무엇이 재선언돼야 하는지는 core 가 알고 있으므로
  // 개수를 여기 박지 않고 그쪽 출력과 대조하되, **0개가 아님**은 따로 본다(둘 다 비면 위 단언이
  // 저절로 통과한다).
  it('`.media-scope` 재선언이 비어 있지 않다', () => {
    expect(Object.keys(buildMediaScopeVariables(definition)).length).toBeGreaterThan(0)
  })
})

describe('스크림 위 패널 테두리 — 모드가 역할을 가른다 ([[ADR-122]])', () => {
  // ADR-122 결정 2 의 표에 적힌 확정값. 계산해서 만들지 않는다 — 실기기에서 세 번 만에 잡은
  // **결정**이라 우리 구현이 그 값을 내는지가 검사 대상이다.
  it.each([
    ['머쉬맘', '#685B4A'],
    ['렌', '#656269'],
    ['엔젤릭버스터', '#6C5662'],
  ] as const)('라이트 %s 는 배경에 가라앉은 %s 가 된다', (name, expected) => {
    const definition = getThemeDefinition(name)

    expect(definition.mode).toBe('light')
    expect(resolvePanelBorder(definition)).toBe(expected)
  })

  // 다크는 패널과 배경 대비가 1.07~1.18 이라 **테두리가 유일한 경계**다 — 손대면 경계가 사라진다.
  it.each(['혼테일', '레테', '검은마법사'] as const)('다크 %s 는 `border` 를 그대로 쓴다', (name) => {
    const definition = getThemeDefinition(name)

    expect(definition.mode).toBe('dark')
    expect(resolvePanelBorder(definition)).toBe(definition.border)
  })

  // 분기가 **이름이 아니라 `mode`** 를 본다는 것을 이름은 그대로 두고 모드만 뒤집어 확인한다
  // ([[ADR-064]] 결정 8 — `DARK_THEMES` 수동 목록 폐기). 이름으로 갈랐다면 이 단언이 실패한다.
  it('분기 기준은 테마 이름이 아니라 `mode` 다', () => {
    const 머쉬맘 = getThemeDefinition('머쉬맘')

    expect(resolvePanelBorder({ ...머쉬맘, mode: 'dark' })).toBe(머쉬맘.border)
    expect(resolvePanelBorder({ ...머쉬맘, mode: 'light' })).not.toBe(머쉬맘.border)
  })
})

describe('`tailwind.config.js` 색 스케일', () => {
  const colors = (require('../../../tailwind.config.js') as { theme: { colors: Record<string, string> } })
    .theme.colors

  /** 테마를 안 따라가는 셋 — RN 색 리터럴이라 `var()` 를 거치지 않는다. */
  const LITERAL_COLORS = ['transparent', 'white', 'black']

  // 이름 규칙이 CJS(설정)와 TS(변수 생성)에 각각 있다 — CJS 가 TS 를 못 읽어서다. 한쪽만 바뀌면
  // 유틸리티는 있는데 변수는 없는(또는 반대) 상태가 되고, 그때 색은 **에러 없이 사라진다**.
  it('유틸리티 이름과 변수 이름이 정확히 맞물린다', () => {
    const fromConfig = Object.keys(colors).filter((name) => !LITERAL_COLORS.includes(name))
    const fromVariables = Object.keys(buildThemeVariables(getThemeDefinition('머쉬맘'))).map((name) =>
      name.replace('--color-', ''),
    )

    expect([...fromConfig].sort()).toEqual([...fromVariables].sort())
  })

  it('토큰 색은 값이 아니라 `var()` 를 가리킨다(런타임에 테마가 바뀐다)', () => {
    for (const name of Object.keys(colors)) {
      if (LITERAL_COLORS.includes(name)) continue
      expect(colors[name]).toBe(`var(--color-${name})`)
    }
  })

  // v3 기본 팔레트를 남겨 두면 테마를 안 따라가는 색(`bg-red-500`)을 쓰고도 빌드가 성공한다.
  it('v3 기본 팔레트는 남지 않는다', () => {
    expect(colors['red-500']).toBeUndefined()
    expect(colors.gray).toBeUndefined()
  })
})

/**
 * 시트 스코프 ([[ADR-179]]).
 *
 * 값을 손으로 적지 않는다 — 파일 머리의 규칙 그대로다. 여기서 지키는 것은 **규칙**이다:
 * 다크는 넷을 한 칸 올리고(그 «한 칸» 은 미디어 스코프가 쓰는 폭과 **같은 수**여야 한다),
 * 라이트는 아무것도 안 바꾼다.
 */
describe('시트 스코프 — 다크에서만 표면 계열을 한 칸 올린다 ([[ADR-179]])', () => {
  const SCOPED = ['--color-bg', '--color-surface', '--color-surface-2', '--color-track'] as const

  it.each(THEME_NAMES as readonly ThemeName[])('%s 는 넷을 빠짐없이 다시 선언한다', (name) => {
    expect(Object.keys(buildSheetScopeVariables(getThemeDefinition(name))).sort()).toEqual(
      [...SCOPED].sort(),
    )
  })

  // 라이트는 대비가 4.18~4.29 로 멀쩡하고, 한 칸 더 올리면 `#FFFFFF` 에 부딪혀 눌린다.
  it.each(['머쉬맘', '렌', '엔젤릭버스터'] as const)('라이트 %s 는 값을 안 바꾼다', (name) => {
    const definition = getThemeDefinition(name)

    expect(definition.mode).toBe('light')
    expect(buildSheetScopeVariables(definition)).toEqual({
      '--color-bg': definition.bg,
      '--color-surface': definition.surface,
      '--color-surface-2': definition.surface2,
      '--color-track': definition.track,
    })
  })

  describe.each(['혼테일', '레테', '검은마법사'] as const)('다크 %s', (name) => {
    const definition = getThemeDefinition(name)
    const scope = buildSheetScopeVariables(definition)

    it.each([
      ['--color-bg', 'bg'],
      ['--color-surface', 'surface'],
      ['--color-surface-2', 'surface2'],
      ['--color-track', 'track'],
    ] as const)('%s 가 원래 값보다 한 칸 밝다', (variable, token) => {
      expect(scope[variable]).not.toBe(definition[token])
      // 자릿수 2 는 hex 양자화 몫이다 — 값이 8비트 채널로 굳었다가 다시 읽히므로 L 이 최대
      // 0.0014 흔들린다(실측). 재는 폭이 0.09 라 그 흔들림에 가려질 회귀는 없다.
      expect(hexToOklch(scope[variable]!).l).toBeCloseTo(
        hexToOklch(definition[token]).l + SHEET_LIFT,
        2,
      )
    })

    // 넷을 함께 올리는 이유가 이것이다 — 몸통만 올리면 안쪽 타일이 몸통과 같은 색이 되고,
    // 몸통을 더 올리면 타일이 몸통보다 어두워진다. 계열째 올려야 위계가 그대로다.
    it('올린 뒤에도 bg < surface < surface-2 순서가 그대로다', () => {
      const lightnessOf = (variable: (typeof SCOPED)[number]): number =>
        hexToOklch(scope[variable]!).l

      expect(lightnessOf('--color-bg')).toBeLessThan(lightnessOf('--color-surface'))
      expect(lightnessOf('--color-surface')).toBeLessThan(lightnessOf('--color-surface-2'))
    })

    // 시트가 «스크림 깔린 배경» 위로 떠오르는 것이 이 결정의 목적이다. 새까만 근처에서 WCAG 비는
    // 눌리므로([[ADR-179]] 결정 1) 눈에 가까운 OKLCH 명도차로 잰다. 0.10 은 실측 셋(0.133~0.139)
    // 아래이고 종전 값(0.043~0.050)보다는 확실히 위인 자리다.
    it('스크림 깔린 배경과 ΔL 0.10 이상 벌어진다', () => {
      const alpha = Number.parseInt(definition.scrim.slice(7, 9), 16) / 255
      const channel = (hex: string, at: number): number => Number.parseInt(hex.slice(at, at + 2), 16)
      const scrimmed = `#${[1, 3, 5]
        .map((at) =>
          Math.round(alpha * channel(definition.scrim, at) + (1 - alpha) * channel(definition.bg, at))
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')}`

      expect(hexToOklch(scope['--color-bg']!).l - hexToOklch(scrimmed).l).toBeGreaterThanOrEqual(0.1)
    })
  })

  // 「한 칸」이 두 벌이 되면 어느 쪽이 진짜인지 알 수 없게 된다 — 미디어 스코프가 카드 안
  // `surface → surface-2` 를 벌릴 때 쓰는 폭과 **같은 수**여야 한다.
  it('한 칸은 미디어 스코프가 쓰는 폭과 같은 수다', () => {
    const definition = getThemeDefinition('레테')
    const media = buildMediaScopeVariables(definition)

    expect(hexToOklch(media['--color-surface-2']!).l).toBeCloseTo(
      hexToOklch(media['--color-surface']!).l + SHEET_LIFT,
      2,
    )
  })
})
