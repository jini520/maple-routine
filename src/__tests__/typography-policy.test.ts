// 글자 계단은 `typography.cjs` 한 표가 쥔다.
//
// Tailwind 기본 계단을 **교체**했기 때문에, 표에 없는 이름을 쓰면 그 클래스가 **조용히 사라진다**
// (NativeWind 는 못 만든 유틸리티를 그냥 안 낸다. 에러가 아니다). 화면에서만 드러나는 종류의
// 실패라 여기서 막는다.
//
// 임의값(`text-[10px]`)도 막는다. 크기는 만들어지지만 **줄 높이가 안 붙어** 플랫폼마다 줄 상자가
// 갈린다(실측. 10px 글자가 iOS 12.0· 안드로이드 15.2).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fontSize, fontWeight } = require('../../typography.cjs') as {
  fontSize: Record<string, unknown>
  fontWeight: Record<string, unknown>
}

const SRC = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__tests__' ? [] : sourceFiles(path)
    return /\.tsx?$/.test(entry) ? [path] : []
  })
}

const FILES = sourceFiles(SRC)
const where = (path: string): string => path.slice(SRC.length + 1)

describe('글자 계단은 표 안에서만 고른다', () => {
  it('훑을 파일이 있다. 스캐너가 빈손이면 아래 단언이 무의미하다', () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  it('`text-<이름>` 은 전부 표에 있다', () => {
    const known = new Set(Object.keys(fontSize))
    const 밖 = FILES.flatMap((file) => {
      const body = readFileSync(file, 'utf8')
      return [...body.matchAll(/\btext-([a-z0-9]+(?:-[a-z]+)?)\b/g)]
        .map((m) => m[1])
        // 색 유틸리티(`text-text-muted`)와 정렬(`text-center`)은 크기가 아니다.
        .filter((name) => /^(\d+|xs|sm|base|lg|xl|\dxl|chip(-\w+)?)$/.test(name))
        .filter((name) => !known.has(name))
        .map((name) => `${where(file)} → text-${name}`)
    })

    expect([...new Set(밖)]).toEqual([])
  })

  it('임의 크기(`text-[Npx]`)를 쓰지 않는다. 줄 높이가 안 붙는다', () => {
    const 임의 = FILES.filter((file) => /text-\[\d+px\]/.test(readFileSync(file, 'utf8'))).map(where)

    expect(임의).toEqual([])
  })

  it('`font-<굵기>` 도 전부 표에 있다', () => {
    const known = new Set(Object.keys(fontWeight))
    const 밖 = FILES.flatMap((file) => {
      const body = readFileSync(file, 'utf8')
      return [...body.matchAll(/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g)]
        .map((m) => m[1])
        .filter((name) => !known.has(name))
        .map((name) => `${where(file)} → font-${name}`)
    })

    expect([...new Set(밖)]).toEqual([])
  })

  it('표의 모든 크기가 줄 높이를 갖는다', () => {
    const 빠짐 = Object.entries(fontSize)
      .filter(([, value]) => {
        const pair = value as [string, { lineHeight?: string }]
        return !Array.isArray(pair) || typeof pair[1]?.lineHeight !== 'string'
      })
      .map(([name]) => name)

    expect(빠짐).toEqual([])
  })
})
