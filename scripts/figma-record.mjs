// Figma 를 어느 소스에 맞췄는지 적는 기록(`scripts/figma-record.json`)을 다룬다. 부품 폴더와 토큰 파일의 해시를 계산하고,
// 정책 테스트(`scripts/__tests__/figma-record.test.mjs`)가 같은 함수로 지금 소스와 기록을 견준다.
//
// 저장소 루트에서 돌린다. 쓰는 법은 `docs/foundation/design-system/figma.md` 의 `코드와 맞추기` 에 있다.
//   node scripts/figma-record.mjs record atoms/Button 123:45
//   node scripts/figma-record.mjs remove molecules/OldPart
//   node scripts/figma-record.mjs status
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'

import ts from 'typescript'

/** 토큰 세 파일을 묶은 항목의 이름 */
export const FOUNDATIONS = 'Foundations'

/** 부품 계층. `components/` 바로 아래의 디렉터리 */
export const LAYERS = ['atoms', 'molecules', 'organisms', 'templates']

const FOUNDATION_FILES = ['src/data/job-themes.json', 'typography.cjs', 'tailwind-v4-axes.cjs']

const RECORD_PATH = join('scripts', 'figma-record.json')

const NODE_ID = /^\d+:\d+$/

/** 계층/이름 꼴의 부품 폴더 목록 */
export function listComponentKeys(root) {
  const keys = []
  for (const layer of LAYERS) {
    const dir = join(root, 'src', 'components', layer)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir).sort()) {
      if (name === '__tests__' || !statSync(join(dir, name)).isDirectory()) continue
      keys.push(`${layer}/${name}`)
    }
  }
  return keys
}

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== '__tests__') out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

/** JSX 글자가 화면에 그리는 값. React 처럼 줄바꿈이 낀 앞뒤 공백을 걷고 줄을 공백 하나로 잇는다 */
function jsxText(text) {
  const lines = text.split(/\r?\n/)
  return lines
    .map((line, i) => {
      let out = line
      if (i > 0) out = out.replace(/^\s+/, '')
      if (i < lines.length - 1) out = out.replace(/\s+$/, '')
      return out
    })
    .filter((line) => line.length > 0)
    .join(' ')
}

/** 주석과 공백을 걷은 토큰. 글자 안의 공백은 화면에 보이는 값이라 남긴다 */
function codeTokens(text, fileName) {
  const kind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : fileName.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, kind)
  const out = []
  const visit = (node) => {
    // `getChildren` 은 JSDoc 주석도 자식으로 낸다
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return
    // 비어 있는 `{/* … */}` 는 JSX 주석이다
    if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) return
    if (node.kind === ts.SyntaxKind.JsxText) {
      const value = jsxText(node.getText(file))
      if (value) out.push(value)
      return
    }
    const children = node.getChildren(file)
    if (children.length > 0) {
      children.forEach(visit)
    } else if (node.kind !== ts.SyntaxKind.EndOfFileToken) {
      out.push(node.getText(file))
    }
  }
  visit(file)
  return out.join('\u0001')
}

function digest(parts) {
  const hash = createHash('sha256')
  for (const [name, body] of parts) hash.update(`${name}\u0000${body}\u0000`)
  return hash.digest('hex').slice(0, 16)
}

/** 항목(부품 폴더나 Foundations)의 지금 소스 해시 */
export function hashComponent(root, key) {
  if (key === FOUNDATIONS) {
    return digest(
      FOUNDATION_FILES.map((file) => {
        const text = readFileSync(join(root, file), 'utf8')
        return [file, file.endsWith('.json') ? JSON.stringify(JSON.parse(text)) : codeTokens(text, file)]
      }),
    )
  }
  const dir = join(root, 'src', 'components', key)
  const files = sourceFiles(dir)
    .map((path) => relative(dir, path).split('\\').join('/'))
    .sort()
  return digest(files.map((file) => [file, codeTokens(readFileSync(join(dir, file), 'utf8'), file)]))
}

/**
 * 기록과 지금 소스의 차이
 * @returns `missing` 기록에 없는 항목 · `extra` 폴더가 없는 항목 · `pending` Figma 에 아직 안 옮긴 항목 · `stale` 맞춘 뒤 소스가 바뀐 항목 ·
 *   `invalid` 노드 id 가 Figma 형식이 아닌 항목
 */
export function checkRecord(root, record) {
  const expected = [FOUNDATIONS, ...listComponentKeys(root)]
  const recorded = Object.keys(record.entries)
  const result = { missing: [], extra: [], pending: [], stale: [], invalid: [] }
  result.missing = expected.filter((key) => !recorded.includes(key))
  result.extra = recorded.filter((key) => !expected.includes(key))
  for (const key of recorded) {
    const entry = record.entries[key]
    if (!expected.includes(key)) continue
    if (entry === 'pending') {
      result.pending.push(key)
      continue
    }
    if (entry.hash !== hashComponent(root, key)) result.stale.push(key)
    if (!NODE_ID.test(entry.node ?? '')) result.invalid.push(key)
  }
  return result
}

function sortedEntries(entries) {
  const keys = Object.keys(entries).sort((a, b) => (a === FOUNDATIONS ? -1 : b === FOUNDATIONS ? 1 : a.localeCompare(b)))
  return Object.fromEntries(keys.map((key) => [key, entries[key]]))
}

function main() {
  const root = process.cwd()
  const path = join(root, RECORD_PATH)
  const record = JSON.parse(readFileSync(path, 'utf8'))
  const [command, key, node] = process.argv.slice(2)
  const known = [FOUNDATIONS, ...listComponentKeys(root)]
  const save = () => writeFileSync(path, `${JSON.stringify({ ...record, entries: sortedEntries(record.entries) }, null, 2)}\n`)
  const fail = (message) => {
    console.error(message)
    process.exit(1)
  }

  if (command === 'record') {
    if (!known.includes(key)) fail(`부품 폴더나 ${FOUNDATIONS} 가 아니다: ${key}`)
    if (!NODE_ID.test(node ?? '')) fail(`Figma 노드 id 는 123:45 꼴이다: ${node}`)
    record.entries[key] = { node, hash: hashComponent(root, key) }
    save()
    console.log(`${key} → ${node} ${record.entries[key].hash}`)
  } else if (command === 'remove') {
    if (!(key in record.entries)) fail(`기록에 없다: ${key}`)
    if (known.includes(key)) fail(`폴더가 아직 있다: ${key}`)
    delete record.entries[key]
    save()
    console.log(`${key} 를 뺐다`)
  } else if (command === 'status') {
    const result = checkRecord(root, record)
    console.log(`항목 ${Object.keys(record.entries).length}`)
    for (const [name, keys] of Object.entries(result)) if (keys.length > 0) console.log(`${name}: ${keys.join(', ')}`)
  } else {
    fail('쓰는 법: node scripts/figma-record.mjs record <항목> <노드 id> | remove <항목> | status')
  }
}

if (basename(process.argv[1] ?? '') === 'figma-record.mjs') main()
