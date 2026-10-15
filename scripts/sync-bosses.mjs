#!/usr/bin/env node
/**
 * 보스 표 동기화. `npm run sync:bosses`
 *
 * 서버 `GET /v1/bosses` 를 받아 `src/data/bosses.json` 을 다시 쓴다. 서버가 보스 표의 기준이고 번들은
 * 그 사본이라, 빌드 전에 이것을 돌려 사본을 최신으로 맞춘다. `updatedAt` 도 응답 그대로 쓴다. 앱이
 * 켤 때 이 값과 서버 값이 같으면 사본을 그대로 쓰기 때문이다.
 *
 * 서버가 아직 비었으면(`updatedAt: null`) 파일을 건드리지 않고 멈춘다.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const BOSSES_URL = 'https://mapleroutine.store/v1/bosses'

/**
 * 응답을 파일 본문으로 바꾼다. 모양이 어긋나면 던진다.
 *
 * 검사는 파일을 쓰기 전에 걸리는 것만 본다. 값 하나하나의 계약은 앱의 `parseBossCatalog` 가 보고,
 * 그 검사가 실패하면 `src/lib/__tests__/catalog.spec.ts` 의 번들 사본 검사가 빨개진다.
 *
 * @param body 서버 응답
 */
export function renderBossesFile(body) {
  if (typeof body !== 'object' || body === null) throw new Error('응답이 객체가 아닙니다')
  if (typeof body.updatedAt !== 'string' || body.updatedAt === '') {
    throw new Error('서버에 아직 보스 표가 없습니다(updatedAt 이 비었습니다). 관리 화면에서 먼저 넣으세요')
  }
  if (typeof body.rules !== 'object' || body.rules === null) throw new Error('응답에 rules 가 없습니다')
  if (!Array.isArray(body.bosses) || body.bosses.length === 0) throw new Error('응답의 bosses 가 비었습니다')

  const file = { updatedAt: body.updatedAt, rules: body.rules, bosses: body.bosses }
  return `${JSON.stringify(file, null, 2)}\n`
}

async function main() {
  const response = await fetch(BOSSES_URL)
  if (response.status !== 200) throw new Error(`${BOSSES_URL} → ${response.status}`)

  const text = renderBossesFile(await response.json())
  writeFileSync(fileURLToPath(new URL('../src/data/bosses.json', import.meta.url)), text)
  const { updatedAt, bosses } = JSON.parse(text)
  console.log(`src/data/bosses.json ← 보스 ${bosses.length} · updatedAt ${updatedAt}`)
}

// jest 는 `import.meta.url` 을 못 채운다(`null`). 그때는 진입점이 아니다.
if (typeof import.meta.url === 'string' && process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
