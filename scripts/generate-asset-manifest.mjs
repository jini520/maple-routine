// 에셋 목록 생성기 ([[ADR-129]]). `npm run assets:gen`
//
// `core/assets/` 아래 그림 파일을 훑어 **슬러그 → 에셋** 목록을
// `core/assets/generated/*.ts` 로 낸다. 옛 `import.meta.glob` 이 하던 일과 같지만
// **빌드 타임이 아니라 커밋 타임**에 한다 — 그래야 Vite 없이도(= Metro 로도) 같은 목록이 선다.
//
// 생성물은 웹·RN 이 **한 벌을 함께 쓴다.** 파일 안에는 평범한 ESM 에셋 import 만 있고, 그 값이
// 무엇이 되는지는 번들러가 정한다(Vite → URL 문자열 · Metro → 에셋 id). 그래서 플랫폼별 생성물이
// 필요 없고, 갈리는 것은 값의 **타입 한 줄**뿐이다(`src/types/image-asset.ts` ↔ `.native.ts`).
//
// 무엇을 훑을지는 이 파일이 아니라 `core/assets/asset-groups.ts` 가 정한다 —
// 같은 표를 생성물 검사 테스트도 읽는다(표가 두 벌이면 검사가 통과하는데 목록이 틀릴 수 있다).
// `.ts` 를 그대로 import 하는 것은 Node 내장 타입 스트리핑이고, `publish-live-update.mjs` 가
// `data/release-notes.ts` 를 읽는 방식과 같다([[ADR-119]] 결정 1).

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ASSET_GROUPS } from '../core/assets/asset-groups.ts'

const ASSETS_DIR = fileURLToPath(new URL('../core/assets/', import.meta.url))
const OUT_DIR = path.join(ASSETS_DIR, 'generated')

/**
 * 한 디렉터리에서 대상 파일을 찾는다(하위 디렉터리는 안 본다 — `asset-groups.ts` 파일 머리).
 * 결과는 파일 이름 오름차순이라 **매번 같은 파일이 나온다**(생성물이 흔들리면 diff 가 거짓말을 한다).
 */
export function listAssetFiles(assetsDir, dir, extensions) {
  const full = path.join(assetsDir, dir)
  return readdirSync(full)
    .filter((name) => {
      if (!statSync(path.join(full, name)).isFile()) return false
      const dot = name.lastIndexOf('.')
      return dot > 0 && extensions.includes(name.slice(dot + 1))
    })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * 파일 이름 → 키. macOS 는 한글 파일 이름을 NFD 로 저장하는데 소스의 문자열 리터럴은 보통 NFC 라
 * 육안으로 같아도 안 맞는다 — 옛 glob 모듈이 전부 하던 정규화를 **여기서 한 번** 한다
 * (조회 쪽 `normalize('NFC')` 는 그대로 남아 호출자가 준 문자열을 맞춰 준다).
 */
export function assetKey(fileName, rule) {
  const base = rule === 'fileName' ? fileName : fileName.slice(0, fileName.lastIndexOf('.'))
  return base.normalize('NFC')
}

/** `1.webp` → 1. 파일 이름 렉시코 정렬은 10 < 2 라 프레임 순서가 뒤집힌다([[ADR-038]]). */
function frameIndex(fileName) {
  return Number.parseInt(fileName, 10)
}

/** 생성물 안에서 쓸 import 식별자. 파일 이름은 `01-list.webp` 처럼 식별자가 못 되는 것이 섞여 있다. */
function importAlias(index) {
  return `a${index}`
}

function header(group) {
  return [
    '// ⚠️ 이 파일은 생성물이다 — **손으로 고치지 마라.** 고쳐도 다음 생성에서 사라진다.',
    '//',
    `// 만드는 법: \`npm run assets:gen\` (scripts/generate-asset-manifest.mjs · [[ADR-129]])`,
    `// 무엇: ${group.purpose}`,
    `// 원본: ${group.dirs.map((dir) => `src/assets/${dir}/*.{${group.extensions.join(',')}}`).join(' · ')}`,
    '//',
    '// 값의 타입은 번들러가 정한다 — 웹(Vite)은 URL 문자열, RN(Metro)은 에셋 id 다. 그 차이를',
    '// 한 줄로 적어 둔 것이 `ImageAssetRef` 이고, 이 파일은 웹·RN 이 **같은 것을 본다**.',
  ].join('\n')
}

function renderRecord(group, entries) {
  const imports = entries.map(({ alias, from }) => `import ${alias} from '${from}'`)
  const body = entries.map(({ key, alias }) => `  ${JSON.stringify(key)}: ${alias},`)

  return [
    header(group),
    '',
    "import type { ImageAssetRef } from '../../types/image-asset'",
    '',
    ...imports,
    '',
    `export const ${group.exportName}: Record<string, ImageAssetRef> = {`,
    ...body,
    '}',
    '',
  ].join('\n')
}

function renderFrames(group, framesByDir) {
  const imports = framesByDir.flatMap(({ entries }) =>
    entries.map(({ alias, from }) => `import ${alias} from '${from}'`),
  )
  const body = framesByDir.flatMap(({ key, entries }) => [
    `  ${JSON.stringify(key)}: [${entries.map(({ alias }) => alias).join(', ')}],`,
  ])

  return [
    header(group),
    '//',
    '// 순서가 곧 재생 순서다 — 파일 이름 앞의 숫자로 정렬해 둔다(렉시코 정렬은 10 < 2).',
    '',
    "import type { ImageAssetRef } from '../../types/image-asset'",
    '',
    ...imports,
    '',
    `export const ${group.exportName}: Record<string, ImageAssetRef[]> = {`,
    ...body,
    '}',
    '',
  ].join('\n')
}

/**
 * 한 그룹의 생성물 소스를 만든다. 파일을 쓰지 않으므로 테스트가 그대로 불러 대조할 수 있다.
 *
 * 별칭(`a0`, `a1` …)은 **정렬이 끝난 뒤에** 붙인다 — 훑은 순서로 붙이면 프레임 정렬 때문에
 * import 줄이 뒤죽박죽이 되어 생성물을 눈으로 읽을 수 없다.
 */
export function renderGroup(group, assetsDir = ASSETS_DIR) {
  const collect = (dir) =>
    listAssetFiles(assetsDir, dir, group.extensions).map((fileName) => ({
      fileName,
      key: assetKey(fileName, group.key),
      from: `../${dir}/${fileName}`,
    }))

  let counter = 0
  const withAliases = (entries) => entries.map((entry) => ({ ...entry, alias: importAlias(counter++) }))

  if (group.kind === 'frames') {
    return renderFrames(
      group,
      group.dirs.map((dir) => ({
        key: path.basename(dir),
        entries: withAliases(
          collect(dir).sort((a, b) => frameIndex(a.fileName) - frameIndex(b.fileName)),
        ),
      })),
    )
  }

  // 여러 디렉터리를 합칠 때 뒤가 이긴다 — 옛 `item-icons.ts` 가 items → rings 를 한 맵에 넣던 순서다.
  const byKey = new Map()
  for (const dir of group.dirs) {
    for (const entry of collect(dir)) byKey.set(entry.key, entry)
  }
  return renderRecord(
    group,
    withAliases([...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))),
  )
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  let changed = 0
  for (const group of ASSET_GROUPS) {
    const file = path.join(OUT_DIR, `${group.file}.ts`)
    const next = renderGroup(group)
    const current = (() => {
      try {
        return readFileSync(file, 'utf8')
      } catch {
        return null
      }
    })()

    if (current === next) {
      console.log(`  = ${group.file}.ts`)
      continue
    }
    writeFileSync(file, next)
    changed += 1
    console.log(`  ✎ ${group.file}.ts`)
  }

  console.log(changed === 0 ? '에셋 목록이 이미 최신이다.' : `${changed}개 파일을 다시 썼다.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
