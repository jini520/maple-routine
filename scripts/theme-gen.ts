/**
 * 테마 토큰 생성 도구 ([[ADR-064]] 결정 9).
 *
 * 시드 3색 + mode 를 넣으면 34토큰과 대비 검증 리포트를 낸다. 파생 규칙 본체는
 * `src/lib/theme-derive.ts` 에 있고 이 파일은 CLI 껍데기다 — 대비 검증 테스트가 같은 함수를
 * 재사용하므로 도구와 테스트가 갈라지지 않는다.
 *
 * 값은 **사람이 확인한 뒤** `src/data/job-themes.json` 에 커밋한다([[ADR-006]]).
 *
 *   npm run theme:gen -- --primary '#F58B0F' --secondary '#F7D00D' --third '#CA763A' --mode light
 *   npm run theme:gen -- --existing 머쉬맘        # 기존 테마의 17값을 승계하고 신규 토큰만 채운다
 *   npm run theme:gen -- --existing-all           # 기존 4테마 일괄
 */

import jobThemes from '../src/data/job-themes.json' with { type: 'json' }
import {
  deriveMediaScope,
  deriveTheme,
  measureThemeContrast,
  type ContrastReport,
  type DerivedTheme,
  type ThemeMode,
  type ThemeSeed,
} from '../src/lib/theme-derive'
import type { ThemeCategory } from '../src/types/theme'

type ExistingThemeName = keyof typeof jobThemes

/**
 * 등록된 테마와 그 `mode` — **JSON 에서 읽는다**([[ADR-064]] 결정 8·10).
 * 한때 여기에 이름·mode 를 하드코딩했더니 신규 테마를 도구가 모르는 일이 있었다.
 */
const EXISTING_MODES = Object.fromEntries(
  Object.entries(jobThemes).map(([name, theme]) => [name, (theme as { mode: ThemeMode }).mode]),
) as Record<ExistingThemeName, ThemeMode>

/** 등록된 테마의 카테고리 — 같은 이유로 JSON 에서 읽는다([[ADR-104]] 결정 1). */
const EXISTING_CATEGORIES = Object.fromEntries(
  Object.entries(jobThemes).map(([name, theme]) => [
    name,
    (theme as { category: ThemeCategory }).category,
  ]),
) as Record<ExistingThemeName, ThemeCategory>

const CATEGORIES: readonly ThemeCategory[] = ['기본', '직업', '보스']

/** 기존 테마에서 그대로 승계하는 값 — 신규 17토큰만 생성한다(회귀 방지, [[ADR-064]] 결정 5). */
const INHERITED_KEYS = [
  'bg', 'surface', 'surface2', 'border', 'borderStrong',
  'primaryHover', 'error', 'infoTint',
  'text', 'textMuted', 'textDisabled',
] as const

const DIM = '\u001b[2m'
const YELLOW = '\u001b[33m'
const GREEN = '\u001b[32m'
const RESET = '\u001b[0m'

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args.set(key, 'true')
    } else {
      args.set(key, next)
      i += 1
    }
  }
  return args
}

/** 배경색 위에 색 견본을 찍어 터미널에서 눈으로도 확인할 수 있게 한다. */
function swatch(hex: string): string {
  const value = hex.slice(1, 7)
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `\u001b[48;2;${r};${g};${b}m   ${RESET}`
}

function printTokens(tokens: DerivedTheme): void {
  const groups: Array<[string, Array<keyof DerivedTheme>]> = [
    ['표면', ['bg', 'surface', 'surface2', 'track', 'border', 'borderStrong']],
    ['텍스트', ['text', 'textMuted', 'textDisabled']],
    ['primary', ['primary', 'primaryHover', 'onPrimary', 'primaryTint', 'primaryInk']],
    ['secondary', ['secondary', 'onSecondary', 'secondaryTint', 'secondaryInk']],
    ['third', ['third', 'onThird', 'thirdTint', 'thirdInk']],
    ['error', ['error', 'onError', 'errorTint', 'errorInk']],
    ['정보', ['infoTint', 'infoInk']],
    ['미디어', ['mediaSurface', 'mediaBorder', 'mediaInk', 'mediaInkMuted']],
    ['깊이', ['scrim', 'shadowColor']],
  ]

  for (const [label, keys] of groups) {
    console.log(`\n  ${DIM}${label}${RESET}`)
    for (const key of keys) {
      console.log(`    ${swatch(tokens[key])} ${String(key).padEnd(15)} ${tokens[key]}`)
    }
  }
}

/**
 * 대비는 **참고 수치**로만 낸다 — 통과/실패를 매기지 않는다(ADR-064 결정 11 재정정).
 * 판단의 최우선은 전체 색감과 캐릭터의 컬러 컨셉이고, 이 표는 그 판단에 곁들이는 눈금이다.
 */
function printReport(report: ContrastReport): void {
  console.log(`\n  ${DIM}대비 참고치 (AA 기준선과 견줌 · 통과/실패 아님)${RESET}`)
  for (const entry of report.measurements) {
    const ratio = `${entry.ratio.toFixed(2)}:1`.padStart(8)
    const label = `${entry.token} / ${entry.against}`.padEnd(34)
    const mark = entry.meets ? `${GREEN}·${RESET}` : `${YELLOW}▸${RESET}`
    const note = entry.meets ? '' : ` ${YELLOW}(기준선 ${entry.reference})${RESET}`
    console.log(`    ${mark} ${label}${ratio}${note}`)
  }

  if (report.below.length > 0) {
    console.log(`\n  ${YELLOW}▸ ${report.below.length}건이 기준선 아래다${RESET} ${DIM}— 그림을 보고 받아들일지 정할 것${RESET}`)
  }
}

function run(label: string, seed: ThemeSeed, category: ThemeCategory): void {
  const tokens = deriveTheme(seed)
  const report = measureThemeContrast(tokens)

  console.log(`\n${'─'.repeat(60)}\n  ${label}  ${DIM}(${seed.mode} · ${category})${RESET}`)
  printTokens(tokens)
  printReport(report)

  console.log(`\n  ${DIM}job-themes.json 에 붙여넣을 블록${RESET}`)
  console.log(JSON.stringify({ [label]: { mode: seed.mode, category, ...tokens } }, null, 2))

  console.log(`\n  ${DIM}미디어 스코프(.media-scope) 파생값${RESET}`)
  console.log(JSON.stringify(deriveMediaScope(tokens, seed.mode), null, 2))
}

function seedFromExisting(name: ExistingThemeName): ThemeSeed {
  const existing = jobThemes[name] as Record<string, string>

  const overrides: Partial<DerivedTheme> = {}
  for (const key of INHERITED_KEYS) {
    overrides[key] = existing[key]
  }

  return {
    primary: existing.primary,
    secondary: existing.secondary,
    third: existing.third,
    mode: EXISTING_MODES[name],
    overrides,
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))

  if (args.has('existing-all')) {
    for (const name of Object.keys(EXISTING_MODES) as ExistingThemeName[]) {
      run(name, seedFromExisting(name), EXISTING_CATEGORIES[name])
    }
  } else if (args.has('existing')) {
    const name = args.get('existing') as ExistingThemeName
    if (!(name in EXISTING_MODES)) {
      console.error(`알 수 없는 테마: ${name} (가능: ${Object.keys(EXISTING_MODES).join(', ')})`)
      process.exit(1)
    }
    run(name, seedFromExisting(name), EXISTING_CATEGORIES[name])
  } else {
    const primary = args.get('primary')
    const secondary = args.get('secondary')
    const third = args.get('third')
    const mode = args.get('mode')
    const category = args.get('category')

    if (primary === undefined || secondary === undefined || third === undefined) {
      console.error(
        '사용법:\n' +
          "  npm run theme:gen -- --primary '#F58B0F' --secondary '#F7D00D' --third '#CA763A' --mode light --category 직업\n" +
          '  npm run theme:gen -- --existing 머쉬맘\n' +
          '  npm run theme:gen -- --existing-all',
      )
      process.exit(1)
    }
    if (mode !== 'light' && mode !== 'dark') {
      console.error("--mode 는 'light' 또는 'dark' 여야 합니다")
      process.exit(1)
    }
    // mode 와 같은 성질의 값이라 같은 방식으로 받는다 — 색에서 유도할 수 없어 사람이 정한다.
    // 기본값을 두지 않는 것은 도구가 소속을 추정하지 않기 위해서다([[ADR-006]]).
    if (!CATEGORIES.includes(category as ThemeCategory)) {
      console.error(`--category 는 ${CATEGORIES.join(' / ')} 중 하나여야 합니다`)
      process.exit(1)
    }

    run(
      args.get('name') ?? '새 테마',
      { primary, secondary, third, mode },
      category as ThemeCategory,
    )
  }
}

main()
