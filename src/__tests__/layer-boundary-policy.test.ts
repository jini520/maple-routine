/**
 * 화면과 기능 코드의 import 경계를 지키는 검사.
 *
 * 화면(`app/`)은 저장소(`storage/`)의 값을 가져오지 않는다. 저장된 값을 읽고 쓰는 일은
 * `features/` 의 함수와 스토어가 맡는다. 화면이 저장소를 직접 부르면 같은 읽기가 화면마다 따로
 * 생기고, 캐시나 리비전 규칙을 바꿀 때 고칠 곳을 놓친다. 타입만 가져오는 `import type` 은
 * 런타임 의존이 없어 허용한다.
 *
 * 기능 코드(`features/`)는 네이티브 라이브러리를 직접 가져오지 않는다. 네이티브 호출은
 * `native/` 의 포트를 거친다. 그래야 테스트가 포트만 바꿔 끼워 기능을 돌릴 수 있다.
 * 여기서는 허용하는 패키지만 적는다. 새 패키지를 막는 쪽이 기본이어야 네이티브 라이브러리가
 * 모르는 사이에 들어오지 않는다.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '..')

/**
 * `features/` 가 가져와도 되는 바깥 패키지. 네이티브 코드가 없는 JS 라이브러리만 둔다.
 *
 * `react-native` 는 `Platform` 같은 범용 API 때문에 남겨 둔다.
 */
const FEATURE_ALLOWED_PACKAGES = [
  'react',
  'react-native',
  'zustand',
  '@tanstack/react-query',
  '@tanstack/react-query-persist-client',
]

/** 디렉터리 아래 제품 소스(`.ts`·`.tsx`)의 절대 경로. 테스트 디렉터리는 뺀다. */
function productSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      return entry === '__tests__' || entry === '__mocks__' ? [] : productSourceFiles(full)
    }
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

interface ImportEntry {
  specifier: string
  typeOnly: boolean
}

/** 주석을 걷어 낸 소스. JSDoc 의 `@example` 에 적힌 import 를 잡지 않으려고 쓴다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** `{ type A, type B }` 처럼 이름이 전부 타입인 import 절인지. */
function isTypeOnlyClause(clause: string): boolean {
  const trimmed = clause.trim()
  if (trimmed.startsWith('type ')) return true
  const named = /^\{([\s\S]*)\}$/.exec(trimmed)
  if (named === null) return false
  const names = named[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  return names.length > 0 && names.every((name) => name.startsWith('type '))
}

/** 소스 하나의 정적 import·re-export·동적 import·require 목록. */
function importsOf(file: string): ImportEntry[] {
  const source = stripComments(readFileSync(file, 'utf8'))
  const entries: ImportEntry[] = []
  for (const [, clause, specifier] of source.matchAll(
    /(?:^|\n)\s*(?:import|export)\s+([^;'"]*?)\s+from\s+['"]([^'"]+)['"]/g,
  )) {
    entries.push({ specifier, typeOnly: isTypeOnlyClause(clause) })
  }
  for (const [, specifier] of source.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) {
    entries.push({ specifier, typeOnly: false })
  }
  for (const [, specifier] of source.matchAll(/\b(?:import|require)\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    entries.push({ specifier, typeOnly: false })
  }
  return entries
}

/** 바깥 패키지 지정자의 패키지 이름. `@scope/name/sub` 는 `@scope/name` 이다. */
function packageName(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

function relative(file: string): string {
  return path.relative(SRC, file)
}

describe('화면과 기능 코드의 import 경계', () => {
  it('검사할 파일이 실제로 있다', () => {
    // 경로가 틀려 0개를 훑고도 통과하는 일을 막는다.
    expect(productSourceFiles(path.join(SRC, 'app')).length).toBeGreaterThan(50)
    expect(productSourceFiles(path.join(SRC, 'features')).length).toBeGreaterThan(50)
  })

  it('import 절을 타입 전용과 값으로 가른다', () => {
    expect(isTypeOnlyClause('type { A }')).toBe(true)
    expect(isTypeOnlyClause('{ type A, type B }')).toBe(true)
    expect(isTypeOnlyClause('{ type A, b }')).toBe(false)
    expect(isTypeOnlyClause('{ a }')).toBe(false)
    expect(isTypeOnlyClause('* as all')).toBe(false)
  })

  it('app/ 은 storage/ 에서 값을 가져오지 않는다', () => {
    const storageDir = path.join(SRC, 'storage')
    const violations = productSourceFiles(path.join(SRC, 'app')).flatMap((file) =>
      importsOf(file)
        .filter(({ specifier, typeOnly }) => {
          if (typeOnly || !specifier.startsWith('.')) return false
          const target = path.resolve(path.dirname(file), specifier)
          return target === storageDir || target.startsWith(storageDir + path.sep)
        })
        .map(({ specifier }) => `${relative(file)}: ${specifier}`),
    )

    expect(violations).toEqual([])
  })

  it('features/ 는 허용 목록 밖의 패키지를 가져오지 않는다', () => {
    const violations = productSourceFiles(path.join(SRC, 'features')).flatMap((file) =>
      importsOf(file)
        .filter(({ specifier, typeOnly }) => {
          if (typeOnly || specifier.startsWith('.')) return false
          return !FEATURE_ALLOWED_PACKAGES.includes(packageName(specifier))
        })
        .map(({ specifier }) => `${relative(file)}: ${specifier}`),
    )

    expect(violations).toEqual([])
  })
})
