#!/usr/bin/env node
/**
 * 게임 데이터 번들 동기화. `node scripts/sync-game-data.mjs`
 *
 * 서버 `GET /v1/game-data` 를 받아 칸마다 `src/data/<표>.json` 을 다시 쓴다. 서버가 표의 기준이고
 * 번들은 그 사본이라, 빌드 전에 이것을 돌려 사본을 최신으로 맞춘다. `updatedAt` 도 응답 그대로 쓴다.
 * 앱이 켤 때 이 값과 서버 값이 같으면 사본을 그대로 쓰기 때문이다.
 *
 * 서버가 아직 안 넣은 표(`updatedAt: null`)는 파일을 건드리지 않고 이름만 알린다.
 * `package.json` 의 `scripts` 에는 넣지 않는다. 그 칸이 OTA 지문 재료라서다.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const GAME_DATA_URL = 'https://mapleroutine.store/v1/game-data'

/**
 * 보스 칸을 파일 본문으로 바꾼다. 모양이 어긋나면 던진다.
 *
 * 검사는 파일을 쓰기 전에 걸리는 것만 본다. 값 하나하나의 계약은 앱의 `parseBossCatalog` 가 보고,
 * 그 검사가 실패하면 `src/lib/__tests__/catalog.spec.ts` 의 번들 사본 검사가 빨개진다.
 *
 * @param body 응답의 `bosses` 칸
 */
export function renderBossesFile(body) {
  if (typeof body !== 'object' || body === null) throw new Error('bosses 칸이 객체가 아닙니다')
  if (typeof body.updatedAt !== 'string' || body.updatedAt === '') {
    throw new Error('서버에 아직 보스 표가 없습니다(updatedAt 이 비었습니다). 관리 화면에서 먼저 넣으세요')
  }
  if (typeof body.rules !== 'object' || body.rules === null) throw new Error('bosses 칸에 rules 가 없습니다')
  if (!Array.isArray(body.bosses) || body.bosses.length === 0) throw new Error('bosses 칸의 bosses 가 비었습니다')

  const file = { updatedAt: body.updatedAt, rules: body.rules, bosses: body.bosses }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** 칸 이름 · 번들 파일 · 본문을 만드는 함수. 표가 옮겨 올 때마다 줄이 는다. */
const SECTIONS = [{ key: 'bosses', path: 'src/data/bosses.json', render: renderBossesFile }]

/**
 * 응답을 번들 파일 목록으로 바꾼다. 칸이 없거나 `updatedAt` 이 `null` 이면 그 파일은 건너뛰고 `skipped` 에 적는다.
 *
 * @param body 서버 응답
 * @returns `files` 는 쓸 파일(저장소 루트 기준 경로와 본문), `skipped` 는 건너뛴 칸 이름
 */
export function renderGameDataFiles(body) {
  if (typeof body !== 'object' || body === null) throw new Error('응답이 객체가 아닙니다')

  const files = []
  const skipped = []
  for (const section of SECTIONS) {
    const value = body[section.key]
    if (typeof value !== 'object' || value === null || value.updatedAt == null) {
      skipped.push(section.key)
      continue
    }
    files.push({ path: section.path, text: section.render(value) })
  }
  return { files, skipped }
}

async function main() {
  const response = await fetch(GAME_DATA_URL)
  if (response.status !== 200) throw new Error(`${GAME_DATA_URL} → ${response.status}`)

  const { files, skipped } = renderGameDataFiles(await response.json())
  for (const file of files) {
    writeFileSync(fileURLToPath(new URL(`../${file.path}`, import.meta.url)), file.text)
    console.log(`${file.path} ← updatedAt ${JSON.parse(file.text).updatedAt}`)
  }
  for (const key of skipped) console.log(`${key}: 서버에 아직 표가 없어 건너뛰었습니다`)
}

// jest 는 `import.meta.url` 을 못 채운다(`null`). 그때는 진입점이 아니다.
if (typeof import.meta.url === 'string' && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
