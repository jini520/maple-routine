// 코드가 원본이고 Figma 는 사본이다. 부품이나 토큰의 소스를 고치고 Figma 를 맞추지 않으면 사본이 낡는데, 문장으로만 둔 규칙은
// 지켜지지 않았다. 그래서 Figma 를 맞춘 때의 소스 해시를 기록해 두고, 지금 소스와 다르면 여기서 실패한다.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { FOUNDATIONS, checkRecord, hashComponent, listComponentKeys } from '../figma-record.mjs'

const ROOT = process.cwd()

describe('Figma 기록 정책', () => {
  const record = JSON.parse(readFileSync(join(ROOT, 'scripts', 'figma-record.json'), 'utf8'))
  const result = checkRecord(ROOT, record)

  it('부품 폴더마다 기록 항목이 있다. 새 부품은 Figma 에도 그리고 기록에 더한다', () => {
    expect(result.missing).toEqual([])
  })

  it('기록에만 있고 폴더가 없는 항목이 없다. 지운 부품은 Figma 에서도 지우고 기록에서 뺀다', () => {
    expect(result.extra).toEqual([])
  })

  it('맞춘 항목의 소스가 그 뒤로 바뀌지 않았다. 바뀌었으면 Figma 의 그 부품을 맞추고 스크립트로 다시 기록한다', () => {
    expect(result.stale).toEqual([])
  })

  it('맞춘 항목은 Figma 노드 id 를 갖는다', () => {
    expect(result.invalid).toEqual([])
  })

  it('부품 폴더를 실제로 읽는다', () => {
    expect(listComponentKeys(ROOT).length).toBeGreaterThan(60)
    expect(Object.keys(record.entries)).toContain(FOUNDATIONS)
  })
})

describe('부품 해시', () => {
  let root

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'figma-record-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const write = (relative, text) => {
    const path = join(root, 'src', 'components', relative)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text)
  }
  const hash = () => hashComponent(root, 'atoms/Chip')

  const BASE = [
    "import { Text } from 'react-native'",
    '',
    '/** 칩 */',
    'export function Chip({ label }: { label: string }) {',
    '  // 라벨만 그린다',
    '  return (',
    '    <Text className="text-xs font-bold">',
    '      {/* 라벨 */}',
    '      {label} 개',
    '    </Text>',
    '  )',
    '}',
    '',
  ].join('\n')

  it('주석만 바꾸면 그대로다', () => {
    write('atoms/Chip/Chip.tsx', BASE)
    const before = hash()
    write(
      'atoms/Chip/Chip.tsx',
      BASE.replace('/** 칩 */', '/**\n * 작은 칩\n * @example <Chip />\n */').replace('// 라벨만 그린다', '// 바꾼 설명').replace('{/* 라벨 */}', '{/* 바꾼 JSX 주석 */}'),
    )
    expect(hash()).toBe(before)
  })

  it('주석을 지우거나 더해도, 줄바꿈과 들여쓰기만 바꿔도 그대로다', () => {
    write('atoms/Chip/Chip.tsx', BASE)
    const before = hash()
    write(
      'atoms/Chip/Chip.tsx',
      BASE.replace('/** 칩 */\n', '').replace('      {/* 라벨 */}\n', '').replace('  return (', '\n\n    return (  // 새 주석'),
    )
    expect(hash()).toBe(before)
  })

  it('코드가 바뀌면 달라진다', () => {
    write('atoms/Chip/Chip.tsx', BASE)
    const before = hash()
    write('atoms/Chip/Chip.tsx', BASE.replace('font-bold', 'font-semibold'))
    expect(hash()).not.toBe(before)
  })

  it('글자 안의 공백이 바뀌면 달라진다', () => {
    write('atoms/Chip/Chip.tsx', BASE.replace('"text-xs font-bold"', "{`text-xs ${'x'}`}"))
    const before = hash()
    write('atoms/Chip/Chip.tsx', BASE.replace('"text-xs font-bold"', "{`text-xs  ${'x'}`}"))
    expect(hash()).not.toBe(before)
  })

  it('JSX 안의 글자가 바뀌면 달라진다', () => {
    write('atoms/Chip/Chip.tsx', BASE)
    const before = hash()
    write('atoms/Chip/Chip.tsx', BASE.replace('{label} 개', '{label} 장'))
    expect(hash()).not.toBe(before)
  })

  it('같은 폴더의 다른 소스 파일도 본다', () => {
    write('atoms/Chip/Chip.tsx', BASE)
    const before = hash()
    write('atoms/Chip/variants.ts', "export const SIZES = ['sm'] as const\n")
    expect(hash()).not.toBe(before)
  })

  it('테스트는 보지 않는다', () => {
    write('atoms/Chip/Chip.tsx', BASE)
    const before = hash()
    write('atoms/Chip/__tests__/Chip.test.tsx', "it('그린다', () => {})\n")
    write('atoms/Chip/Chip.spec.ts', "it('그린다', () => {})\n")
    expect(hash()).toBe(before)
  })
})

describe('기록 대조', () => {
  let root

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'figma-record-'))
    const component = join(root, 'src', 'components', 'atoms', 'Chip')
    mkdirSync(join(component, '__tests__'), { recursive: true })
    writeFileSync(join(component, 'Chip.tsx'), 'export const Chip = 1\n')
    mkdirSync(join(root, 'src', 'components', 'molecules', 'Row'), { recursive: true })
    writeFileSync(join(root, 'src', 'components', 'molecules', 'Row', 'Row.tsx'), 'export const Row = 1\n')
    mkdirSync(join(root, 'src', 'components', '__tests__'), { recursive: true })
    mkdirSync(join(root, 'src', 'data'), { recursive: true })
    writeFileSync(join(root, 'src', 'data', 'job-themes.json'), '{"a":1}')
    writeFileSync(join(root, 'typography.cjs'), 'module.exports = {}\n')
    writeFileSync(join(root, 'tailwind-v4-axes.cjs'), 'module.exports = {}\n')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('계층 폴더 아래의 부품 폴더를 계층/이름 으로 센다', () => {
    expect(listComponentKeys(root)).toEqual(['atoms/Chip', 'molecules/Row'])
  })

  it('빠진 항목 · 남은 항목 · 낡은 해시 · 잘못된 노드 id 를 가른다', () => {
    const fresh = hashComponent(root, 'atoms/Chip')
    const result = checkRecord(root, {
      entries: {
        [FOUNDATIONS]: 'pending',
        'atoms/Chip': { node: '12:3', hash: fresh },
        'organisms/Gone': 'pending',
      },
    })
    expect(result).toEqual({ missing: ['molecules/Row'], extra: ['organisms/Gone'], stale: [], invalid: [] })

    writeFileSync(join(root, 'src', 'components', 'atoms', 'Chip', 'Chip.tsx'), 'export const Chip = 2\n')
    const changed = checkRecord(root, {
      entries: { [FOUNDATIONS]: 'pending', 'atoms/Chip': { node: '12:3', hash: fresh }, 'molecules/Row': { node: 'Row', hash: 'x' } },
    })
    expect(changed.stale).toEqual(['atoms/Chip', 'molecules/Row'])
    expect(changed.invalid).toEqual(['molecules/Row'])
  })

  it('Foundations 는 토큰 세 파일을 본다. json 은 값만 본다', () => {
    const at = (text) => {
      writeFileSync(join(root, 'src', 'data', 'job-themes.json'), text)
      return hashComponent(root, FOUNDATIONS)
    }
    const before = at('{"a":1}')
    expect(at('{\n  "a": 1\n}\n')).toBe(before)
    expect(at('{"a":2}')).not.toBe(before)

    writeFileSync(join(root, 'src', 'data', 'job-themes.json'), '{"a":1}')
    writeFileSync(join(root, 'typography.cjs'), 'module.exports = { a: 1 }\n')
    expect(hashComponent(root, FOUNDATIONS)).not.toBe(before)
  })
})
