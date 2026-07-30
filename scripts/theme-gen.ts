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
  checkThemeContrast,
  deriveMediaScope,
  deriveTheme,
  type ContrastReport,
  type DerivedTheme,
  type ThemeMode,
  type ThemeSeed,
} from '../src/lib/theme-derive'

type ExistingThemeName = keyof typeof jobThemes

const EXISTING_MODES: Record<ExistingThemeName, ThemeMode> = {
  레테: 'dark',
  렌: 'light',
  머쉬맘: 'light',
  혼테일: 'dark',
}

/** 기존 테마에서 그대로 승계하는 값 — 신규 17토큰만 생성한다(회귀 방지, [[ADR-064]] 결정 5). */
const INHERITED_KEYS = [
  'bg', 'surface', 'surface2', 'border', 'borderStrong',
  'primaryHover', 'error', 'infoTint',
  'text', 'textMuted', 'textDisabled',
] as const

/**
 * 테마별 추가 override 와 대비 면제 — 사용자가 눈으로 확인하고 내린 결정만 들어간다.
 *
 * 머쉬맘: 파생된 어두운 트랙(`#585545`)보다 **기존 크림 트랙이 낫다**는 판단(2026-07-30).
 * 진행률 채움/트랙 대비가 1.86:1로 남지만, 주황과 크림은 색상 차가 커서 실제로는 구분된다.
 * 규칙 자체를 완화하지 않고 이 테마 하나만 면제해, 뒤에 올 파스텔 primary 테마는 계속 걸리게 둔다.
 */
const THEME_EXCEPTIONS: Partial<
  Record<ExistingThemeName, { overrides?: Partial<DerivedTheme>; waivers?: string[] }>
> = {
  머쉬맘: {
    overrides: { track: '#E4E1CE' },
    waivers: ['track/primary', 'onPrimary/primary'],
  },
}

const DIM = '\u001b[2m'
const RED = '\u001b[31m'
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
      console.log(`    ${swatch(tokens[key])} ${key.padEnd(15)} ${tokens[key]}`)
    }
  }
}

function printReport(report: ContrastReport): void {
  console.log(`\n  ${DIM}대비 검증${RESET}`)
  for (const check of report.checks) {
    const ratio = `${check.ratio.toFixed(2)}:1`.padStart(8)
    const label = `${check.token} / ${check.against}`.padEnd(34)
    const waived = report.waived.includes(check)
    if (check.pass) {
      console.log(`    ${GREEN}✓${RESET} ${label}${ratio} ${DIM}(≥${check.required})${RESET}`)
    } else if (waived) {
      console.log(`    ${DIM}—${RESET} ${label}${ratio} ${DIM}(면제 · 원래 ≥${check.required})${RESET}`)
    } else if (check.severity === 'advisory') {
      console.log(`    ${YELLOW}!${RESET} ${label}${ratio} ${YELLOW}(권고 ≥${check.required})${RESET}`)
    } else {
      console.log(`    ${RED}✗${RESET} ${label}${ratio} ${RED}(필수 ≥${check.required})${RESET}`)
    }
  }

  const tail = [
    report.waived.length > 0 ? `${DIM}면제 ${report.waived.length}건${RESET}` : '',
    report.warnings.length > 0 ? `${YELLOW}권고 ${report.warnings.length}건 미달${RESET}` : '',
  ].filter(Boolean)

  if (report.pass) {
    console.log(`\n  ${GREEN}필수 항목 전부 통과${RESET}${tail.length > 0 ? ` (${tail.join(', ')})` : ''}`)
  } else {
    console.log(`\n  ${RED}필수 ${report.failures.length}건 미달 — 시드를 조정하거나 해당 토큰을 override 하세요${RESET}`)
  }
}

function run(label: string, seed: ThemeSeed, waivers: string[] = []): boolean {
  const tokens = deriveTheme(seed)
  const report = checkThemeContrast(tokens, waivers)

  console.log(`\n${'─'.repeat(60)}\n  ${label}  ${DIM}(${seed.mode})${RESET}`)
  printTokens(tokens)
  printReport(report)

  console.log(`\n  ${DIM}job-themes.json 에 붙여넣을 블록${RESET}`)
  console.log(JSON.stringify({ [label]: { mode: seed.mode, ...tokens } }, null, 2))

  console.log(`\n  ${DIM}미디어 스코프(.media-scope) 파생값${RESET}`)
  console.log(JSON.stringify(deriveMediaScope(tokens), null, 2))

  return report.pass
}

function seedFromExisting(name: ExistingThemeName): { seed: ThemeSeed; waivers: string[] } {
  const existing = jobThemes[name] as Record<string, string>
  const exception = THEME_EXCEPTIONS[name]

  const overrides: Partial<DerivedTheme> = {}
  for (const key of INHERITED_KEYS) {
    overrides[key] = existing[key]
  }
  Object.assign(overrides, exception?.overrides ?? {})

  return {
    seed: {
      primary: existing.primary,
      secondary: existing.secondary,
      third: existing.third,
      mode: EXISTING_MODES[name],
      overrides,
    },
    waivers: exception?.waivers ?? [],
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  let allPassed = true

  if (args.has('existing-all')) {
    for (const name of Object.keys(EXISTING_MODES) as ExistingThemeName[]) {
      const { seed, waivers } = seedFromExisting(name)
      allPassed = run(name, seed, waivers) && allPassed
    }
  } else if (args.has('existing')) {
    const name = args.get('existing') as ExistingThemeName
    if (!(name in EXISTING_MODES)) {
      console.error(`알 수 없는 테마: ${name} (가능: ${Object.keys(EXISTING_MODES).join(', ')})`)
      process.exit(1)
    }
    const { seed, waivers } = seedFromExisting(name)
    allPassed = run(name, seed, waivers)
  } else {
    const primary = args.get('primary')
    const secondary = args.get('secondary')
    const third = args.get('third')
    const mode = args.get('mode')

    if (primary === undefined || secondary === undefined || third === undefined) {
      console.error(
        '사용법:\n' +
          "  npm run theme:gen -- --primary '#F58B0F' --secondary '#F7D00D' --third '#CA763A' --mode light\n" +
          '  npm run theme:gen -- --existing 머쉬맘\n' +
          '  npm run theme:gen -- --existing-all',
      )
      process.exit(1)
    }
    if (mode !== 'light' && mode !== 'dark') {
      console.error("--mode 는 'light' 또는 'dark' 여야 합니다")
      process.exit(1)
    }

    allPassed = run(args.get('name') ?? '새 테마', { primary, secondary, third, mode })
  }

  if (!allPassed) process.exit(1)
}

main()
