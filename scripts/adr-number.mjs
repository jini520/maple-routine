// ADR 새 번호 받기. 한 브랜치만 보면 다른 브랜치 · 다른 세션이 쓴 번호가 보이지 않으므로 살아 있는 출처를 모두 본다.
//
//   node scripts/adr-number.mjs
//
// 종료 코드: 0 겹침 없음 · 1 서로 다른 파일이 같은 번호를 씀 · 2 출처를 다 읽지 못함(일부만 보고 고른 번호는 겹칠 수 있다)
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*'
const FILE_NAME = new RegExp(`^ADR-(\\d{3}(?:\\+\\d{3})*)_(${SLUG}_${SLUG})\\.md$`)

/** ADR 파일 이름의 번호 목록과 `카테고리_기능`. 규칙에 맞지 않는 이름은 `null` */
export function parseAdrFileName(name) {
  const m = FILE_NAME.exec(name)
  return m ? { numbers: m[1].split('+').map(Number), key: m[2] } : null
}

/**
 * 출처마다의 `docs/adr/` 파일 이름으로 고른 다음 번호와 충돌 목록
 * @param sources `{ name, files }` 목록. `name` 은 `origin/main` 같은 ref 나 워크트리 경로
 * @returns `next` 는 가장 큰 번호 + 1, `collisions` 는 `카테고리_기능` 이 다른 파일이 같은 번호를 쓰는 것
 */
export function planAdrNumber(sources) {
  const uses = new Map()
  let max = { number: 0, source: null }
  for (const { name, files } of sources) {
    for (const file of files) {
      const parsed = parseAdrFileName(file)
      if (!parsed) continue
      for (const number of parsed.numbers) {
        if (number > max.number) max = { number, source: name }
        const byKey = uses.get(number) ?? new Map()
        const where = byKey.get(parsed.key) ?? []
        if (!where.includes(name)) where.push(name)
        byKey.set(parsed.key, where)
        uses.set(number, byKey)
      }
    }
  }
  const collisions = [...uses]
    .filter(([, byKey]) => byKey.size > 1)
    .sort(([a], [b]) => a - b)
    .map(([number, byKey]) => ({ number, files: [...byKey].map(([key, where]) => ({ key, sources: where })) }))
  return { next: max.number + 1, max, collisions }
}

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const lines = (text) => text.split('\n').filter(Boolean)
const pad = (number) => String(number).padStart(3, '0')

/** main 에 이미 머지된 브랜치인지. 머지된 release · hotfix 는 main 이 이미 담고 있고, 옛 것은 재작성 전 번호를 쓴다 */
function mergedIntoMain(ref) {
  const { status } = spawnSync('git', ['merge-base', '--is-ancestor', ref, 'origin/main'])
  if (status === 0 || status === 1) return status === 0
  throw new Error(`git merge-base ${ref} 실패`)
}

function collectSources() {
  run('git', ['fetch', 'origin', '--prune', '--quiet'])
  const refs = ['origin/main', 'origin/develop']
  const shipping = lines(
    run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/release', 'refs/remotes/origin/hotfix']),
  )
  refs.push(...shipping.filter((ref) => !mergedIntoMain(ref)))
  const pulls = JSON.parse(run('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'headRefName']))
  refs.push(...pulls.map((p) => `origin/${p.headRefName}`))

  const sources = [...new Set(refs)].map((ref) => ({
    name: ref,
    files: lines(run('git', ['ls-tree', '--name-only', ref, 'docs/adr/'])).map((path) => basename(path)),
  }))
  const worktrees = lines(run('git', ['worktree', 'list', '--porcelain']))
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length))
  for (const path of worktrees) {
    const dir = join(path, 'docs', 'adr')
    if (existsSync(dir)) sources.push({ name: path, files: readdirSync(dir) })
  }
  return sources
}

function main() {
  let sources
  try {
    sources = collectSources()
  } catch (error) {
    console.error(`출처를 다 읽지 못해 번호를 고르지 않는다: ${error.message}`)
    process.exit(2)
  }
  const { next, max, collisions } = planAdrNumber(sources)
  console.log(`다음 번호: ADR-${pad(next)}`)
  console.log(`가장 큰 번호: ADR-${pad(max.number)} (${max.source})`)
  console.log(`본 출처: ${sources.map((s) => s.name).join(' · ')}`)
  if (collisions.length === 0) return
  for (const { number, files } of collisions) {
    console.error(`충돌: ADR-${pad(number)} 을 서로 다른 파일이 쓴다`)
    for (const { key, sources: where } of files) console.error(`  ${key}  ${where.join(' · ')}`)
  }
  process.exit(1)
}

// jest 가 판정 함수만 가져갈 때는 git 을 부르지 않는다
if (basename(process.argv[1] ?? '') === 'adr-number.mjs') main()
