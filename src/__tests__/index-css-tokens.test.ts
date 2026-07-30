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
    const expected = deriveMediaScope(getThemeDefinition(DEFAULT_THEME))
    for (const [token, value] of Object.entries(expected)) {
      expect(SCOPE_BLOCK, token).toContain(`--color-${toCustomPropertyName(token)}: ${value.toLowerCase()};`)
    }
  })

  it('표면 기준이 바뀌므로 accent 틴트·잉크를 다시 선언한다', () => {
    for (const accent of ['primary', 'secondary', 'third', 'error']) {
      expect(SCOPE_BLOCK, accent).toContain(`--color-${accent}-tint:`)
      expect(SCOPE_BLOCK, accent).toContain(`--color-${accent}-ink:`)
    }
  })
})
