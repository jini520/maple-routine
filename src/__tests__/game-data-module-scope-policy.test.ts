// 게임 데이터 표를 모듈 최상위에서 읽지 않는다.
//
// ## 왜 테스트가 필요한가
//
// 앱은 게임 데이터 표를 빈 값으로 켜고, 기기 사본이나 서버 응답이 나중에 채운다. 모듈 최상위의 `const X = 조회()` 는
// 모듈을 불러오는 순간 한 번 돌아 빈 표의 값으로 굳는다. 그래서 그림이 영영 빠지거나 이름이 빈 글자로 남는다. 번들에 표가
// 들어 있던 때는 불러오는 순간에도 표가 차 있어 드러나지 않았다.
//
// jest 는 fixture 로 표를 처음부터 채우므로 기능 테스트로는 이 결함을 못 본다. 그래서 구문 트리로 찾는다.
//
// ## 무엇을 세나
//
// `gameTable(` 로 표를 세우는 파일과, 그 파일을 바로 가져오는 `lib/` 의 조회 모듈을 "표를 읽는 모듈" 로 본다. 그 모듈에서 가져온 함수를
// 다른 파일이 함수 밖(모듈 최상위)에서 부르면 실패다. 표를 읽는 모듈 자신의 최상위는 세지 않는다. `derive` 와
// 구독(`subscribeBossCatalog`)으로 표가 바뀐 뒤 다시 만드는 장치가 그 자리에 있다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import ts from 'typescript'

const SRC = join(__dirname, '..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (!entry.startsWith('__')) out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry) && !/\.(test|spec|d)\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(from), spec)
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {
      // 다음 후보
    }
  }
  return null
}

const files = sourceFiles(SRC)
const parsed = new Map(
  files.map((file) => [file, ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)]),
)

function runtimeImports(source: ts.SourceFile): { name: string; target: string }[] {
  const out: { name: string; target: string }[] = []
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue
    const target = resolveImport(source.fileName, (statement.moduleSpecifier as ts.StringLiteral).text)
    const bindings = statement.importClause?.namedBindings
    if (target === null || bindings === undefined || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) if (!element.isTypeOnly) out.push({ name: element.name.text, target })
  }
  return out
}

const tableFiles = new Set(files.filter((file) => parsed.get(file)!.text.includes('gameTable(')))
const LIB = join(SRC, 'lib')
const readerFiles = new Set(tableFiles)
for (const file of files)
  if (file.startsWith(LIB) && runtimeImports(parsed.get(file)!).some((entry) => tableFiles.has(entry.target)))
    readerFiles.add(file)

/** 표를 세우고 다시 만드는 장치. 최상위에서 불러도 표가 바뀌면 따라간다. */
const ALLOWED = new Set(['gameTable', 'derive', 'createTable'])

function moduleScopeReads(source: ts.SourceFile): string[] {
  const readers = new Map(
    runtimeImports(source)
      .filter((entry) => readerFiles.has(entry.target) && !ALLOWED.has(entry.name))
      .map((entry) => [entry.name, entry.target]),
  )
  if (readers.size === 0) return []
  const hits: string[] = []
  const visit = (node: ts.Node): void => {
    // 함수 · 클래스 안은 부를 때 돈다.
    if (ts.isFunctionLike(node) || ts.isClassLike(node)) return
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && readers.has(node.expression.text)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      hits.push(`${relative(SRC, source.fileName)}:${line + 1} ${node.expression.text}()`)
    }
    ts.forEachChild(node, visit)
  }
  for (const statement of source.statements) if (!ts.isImportDeclaration(statement)) visit(statement)
  return hits
}

describe('게임 데이터 표를 모듈 최상위에서 읽지 않는다', () => {
  it('표를 읽는 모듈을 실제로 찾았다', () => {
    expect([...readerFiles].map((file) => relative(SRC, file))).toEqual(
      expect.arrayContaining(['lib/assets/asset-lookup.ts', 'lib/cashbook/categories.ts']),
    )
  })

  it('표를 읽는 모듈 밖에서 그 함수를 함수 밖에서 부르지 않는다', () => {
    const hits = files.filter((file) => !readerFiles.has(file)).flatMap((file) => moduleScopeReads(parsed.get(file)!))
    expect(hits).toEqual([])
  })
})
