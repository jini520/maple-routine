import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { THEME_TOKEN_KEYS, deriveMediaScope } from '../lib/theme-derive'
import { DEFAULT_THEME, getThemeDefinition } from '../lib/theme-registry'

/**
 * `index.css` 의 `@theme` 블록은 **유일하게 남은 수동 동기화 지점**이다([[ADR-064]] 결정 10).
 *
 * Tailwind v4 는 빌드 시점에 이 블록을 읽어 유틸리티(`bg-primary`·`text-text-muted` 등)를 만들기
 * 때문에 토큰 이름이 여기 있어야 하고, 값은 부팅 첫 페인트용 기본값 역할을 한다. 선택 테마는
 * 런타임에 `<style id="theme-vars">` 로 덮이므로 이 값이 어긋나도 앱은 대체로 멀쩡해 보이는데,
 * 그래서 더 조용히 틀어진다 — 기본 테마 사용자가 부팅 순간 잘못된 색을 잠깐 보게 된다.
 * 그 드리프트를 여기서 잡는다.
 */
const CSS = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8')
const THEME_BLOCK = /@theme \{(?<body>[\s\S]*?)\n\}/.exec(CSS)?.groups?.body ?? ''

const DECLARED = new Map(
  [...THEME_BLOCK.matchAll(/--color-(?<name>[a-z0-9-]+):\s*(?<value>#[0-9a-fA-F]+);/g)].map(
    (match) => [match.groups!.name, match.groups!.value.toLowerCase()],
  ),
)

function toCustomPropertyName(token: string): string {
  return token.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()
}

describe('index.css @theme 블록', () => {
  it('블록을 찾을 수 있다', () => {
    expect(THEME_BLOCK).not.toBe('')
  })

  it('34개 토큰을 정확히 선언한다 — 빠뜨리면 Tailwind 유틸이 안 만들어진다', () => {
    expect([...DECLARED.keys()].sort()).toEqual(THEME_TOKEN_KEYS.map(toCustomPropertyName).sort())
  })

  it.each([...THEME_TOKEN_KEYS])('%s 값이 기본 테마와 일치한다', (token) => {
    const base = getThemeDefinition(DEFAULT_THEME)
    expect(DECLARED.get(toCustomPropertyName(token))).toBe(base[token].toLowerCase())
  })

  it('테마별 :root[data-theme] 블록을 두지 않는다 — 런타임 주입이 대신한다', () => {
    expect(CSS).not.toMatch(/:root\[data-theme=/)
  })
})

/**
 * `.media-scope` 기본값도 첫 페인트용으로 정적으로 둔다([[ADR-064]] 결정 5).
 * 없으면 일러스트 카드가 부팅 순간 페이지 표면색(라이트 테마면 크림색)으로 잠깐 보였다가
 * 어두워진다 — 하드코딩하던 시절엔 없던 깜빡임이다.
 */
describe('index.css .media-scope 블록', () => {
  const SCOPE_BLOCK = /\.media-scope \{(?<body>[\s\S]*?)\n\}/.exec(CSS)?.groups?.body ?? ''

  it('블록을 찾을 수 있다', () => {
    expect(SCOPE_BLOCK).not.toBe('')
  })

  it('기본 테마의 미디어 스코프 파생값과 일치한다', () => {
    const base = getThemeDefinition(DEFAULT_THEME)
    const expected = deriveMediaScope(base, base.mode)
    for (const [token, value] of Object.entries(expected)) {
      expect(SCOPE_BLOCK, token).toContain(`--color-${toCustomPropertyName(token)}: ${value.toLowerCase()};`)
    }
  })

  // 카드 위에 직접 놓이는 것만 다시 묶는다. accent 틴트 칩은 자기 배경을 갖고 있어서
  // 뒤의 카드 색과 무관하다 — 다시 계산하면 옅은 칩이 카드에 묻힌다([[ADR-064]] 결정 5 정정).
  it('카드 위에 직접 놓이는 토큰만 다시 선언한다', () => {
    for (const token of ['surface', 'surface-2', 'track', 'border', 'text', 'text-muted']) {
      expect(SCOPE_BLOCK, token).toContain(`--color-${token}:`)
    }
    // secondary 만 예외 — 완료 배지가 카드 안에서만 쓰이므로 모드별 값을 준다.
    for (const accent of ['primary', 'third', 'error']) {
      expect(SCOPE_BLOCK, accent).not.toContain(`--color-${accent}-tint:`)
      expect(SCOPE_BLOCK, accent).not.toContain(`--color-${accent}-ink:`)
    }
    expect(SCOPE_BLOCK).toContain('--color-secondary-tint:')
  })
})

/**
 * 테마 배경 이미지([[ADR-088]] 결정 4·5-1)는 **JS 가 값을 내고 CSS 가 읽는** 구조라 이름이
 * 어긋나면 조용히 배경만 사라진다. 그리고 배경은 두 자리에 그려진다 — 페이지 전체를 덮는
 * 백드롭과, sticky 헤더가 덮는 자리의 조각. 둘이 **같은 선언을 공유**하지 않으면 이어붙인
 * 자리에서 어긋난다.
 */
describe('테마 배경 CSS', () => {
  /**
   * 선택자가 **정확히** 일치하는 규칙의 본문을 꺼낸다. 부분 일치로 찾으면
   * `.theme-header-backdrop::before` 가 공유 규칙(`.theme-backdrop,\n.theme-header-backdrop::before`)
   * 에도 걸려 개별 규칙과 뒤섞인다.
   */
  function ruleBody(selector: string): string {
    // 주석을 먼저 걷는다 — 안 걷으면 규칙 앞 주석이 선택자 자리에 딸려 들어와 비교가 어긋난다.
    const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    for (const match of stripped.matchAll(/(?<selector>[^{}]+)\{(?<body>[^{}]*)\}/g)) {
      if (match.groups!.selector.trim() === selector) return match.groups!.body
    }
    return ''
  }

  const SHARED = ruleBody('.theme-backdrop,\n.theme-header-backdrop::before')
  const BACKDROP = ruleBody('.theme-backdrop')
  const HEADER_WRAP = ruleBody('.theme-header-backdrop')
  const HEADER_LAYER = ruleBody('.theme-header-backdrop::before')

  it('백드롭과 헤더 조각이 배경 선언을 공유한다', () => {
    expect(SHARED).not.toBe('')
  })

  it.each(['image', 'size', 'position', 'dim', 'fade-top'])(
    '--theme-bg-%s 를 읽는다 — buildThemeCss 가 내는 값과 짝이다',
    (name) => {
      expect(SHARED).toContain(`var(--theme-bg-${name}`)
    },
  )

  it('배경이 없는 테마를 위해 폴백을 둔다 — 값이 없으면 아무것도 안 그린다', () => {
    expect(SHARED).toContain('var(--theme-bg-image, none)')
  })

  // 헤더 조각은 스크롤된 카드를 가려야 하므로 바탕색이 있어야 한다(결정 5-1).
  it('바탕색이 테마 배경색이다', () => {
    expect(SHARED).toContain('background-color: var(--color-bg)')
  })

  // 벽지 고정은 position: fixed 한 장으로 한다 — background-attachment: fixed 는 iOS
  // WKWebView 에서 불안정하고, 이 앱은 같은 계열 결함을 [[ADR-077]]·[[ADR-085]] 에서 겪었다.
  it('백드롭은 position: fixed 이고 background-attachment 를 쓰지 않는다', () => {
    expect(BACKDROP).toContain('position: fixed')
    // 선언으로 쓰지 않는다는 뜻 — 왜 안 쓰는지 적은 주석은 파일에 남아 있다.
    expect(SHARED).not.toContain('background-attachment:')
    expect(BACKDROP).not.toContain('background-attachment:')
  })

  it('헤더 조각 래퍼가 헤더 상자를 채우고 넘치는 부분을 잘라낸다', () => {
    expect(HEADER_WRAP).toContain('position: absolute')
    expect(HEADER_WRAP).toContain('inset: 0')
    expect(HEADER_WRAP).toContain('overflow: hidden')
  })

  // 조각을 헤더 상자 기준으로 그리면 cover 배율이 달라져 백드롭과 어긋난다.
  it('헤더 조각은 뷰포트 크기로 그린다', () => {
    expect(HEADER_LAYER).toContain('width: 100vw')
    expect(HEADER_LAYER).toContain('height: 100dvh')
    expect(HEADER_LAYER).toContain('top: 0')
    expect(HEADER_LAYER).toContain('left: 0')
  })
})
