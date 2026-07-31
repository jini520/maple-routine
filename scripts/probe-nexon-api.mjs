#!/usr/bin/env node
/**
 * Nexon Open API 계측 도구 — [[ADR-067]]의 실측 근거를 다시 확인할 때 쓴다.
 *
 * docs/foundation/nexon-api.md의 "date 조회 가능 구간"·"에러 코드"·"미접속 캐릭터의 응답 축약"이
 * 이 스크립트의 출력에서 나왔다(최초 계측 2026-07-31). 넥슨이 동작을 바꾸면 여기서 먼저 드러난다.
 *
 * 사용법 (키는 인자로 넘기지 말 것 — 셸 히스토리에 남는다):
 *   NEXON_KEY=<서비스 키> node scripts/probe-nexon-api.mjs dates <캐릭터명>
 *   NEXON_KEY=<서비스 키> node scripts/probe-nexon-api.mjs accounts
 *   NEXON_KEY=<서비스 키> node scripts/probe-nexon-api.mjs shape <캐릭터명>
 *
 *   dates    — 오늘~오늘−16일 전수 스윕. 조회 가능 구간과 에러 코드를 확인한다.
 *              **미계측 항목**: 오늘−1일의 OPENAPI00009("아직 집계 전")가 하루 중 몇 시에 풀리는지.
 *              오전/오후에 두 번 돌리면 그 경계를 잡을 수 있다([[ADR-067]] 트레이드오프).
 *   accounts — 키가 반환하는 전 계정·전 캐릭터의 character/basic 상태. 조회 불가 ocid(OPENAPI00003)를 찾는다.
 *   shape    — 당일 vs 과거 응답의 섹션 항목 수 비교(미접속 캐릭터의 축약 정도).
 */

const KEY = process.env.NEXON_KEY
if (KEY === undefined || KEY === '') {
  console.error('NEXON_KEY 환경변수가 필요합니다.')
  process.exit(1)
}

const BASE = 'https://open.api.nexon.com'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function call(path) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, { headers: { 'x-nxopen-api-key': KEY } })
  } catch (error) {
    return { status: 'FETCH_FAIL', json: null, error: String(error) }
  }
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-json */
  }
  return { status: response.status, json, raw: json === null ? text.slice(0, 200) : null }
}

function errorCode(result) {
  const error = result.json?.error
  return error == null ? null : `${error.name ?? '?'} / ${error.message ?? '?'}`
}

function kstDateKey(offsetDays) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

async function listCharacters() {
  const result = await call('/maplestory/v1/character/list')
  if (result.status !== 200) {
    throw new Error(`character/list 실패: ${result.status} ${errorCode(result) ?? ''}`)
  }
  return result.json.account_list.flatMap((account) =>
    account.character_list.map((character) => ({ ...character, account: account.account_id })),
  )
}

async function findOcid(name) {
  const characters = await listCharacters()
  const found = characters.find((character) => character.character_name === name)
  if (found === undefined) {
    throw new Error(`계정에 없는 캐릭터: ${name} (있는 캐릭터: ${characters.length}명)`)
  }
  return found
}

async function probeDates(name) {
  const character = await findOcid(name)
  console.log(`${character.character_name} (${character.world_name} Lv.${character.character_level})`)
  console.log(`KST 지금: ${new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)}\n`)
  console.log('date         오프셋      status  코드')

  const noDate = await call(`/maplestory/v1/scheduler/character-state?ocid=${character.ocid}`)
  console.log(`(없음)       당일        ${String(noDate.status).padEnd(6)}  ${errorCode(noDate) ?? 'OK'}`)

  for (let offset = 0; offset >= -16; offset -= 1) {
    const date = kstDateKey(offset)
    const result = await call(`/maplestory/v1/scheduler/character-state?ocid=${character.ocid}&date=${date}`)
    console.log(
      `${date}   오늘${offset === 0 ? '  ' : offset}${offset === 0 ? '   ' : '일 '}   ${String(result.status).padEnd(6)}  ${errorCode(result) ?? 'OK'}`,
    )
    await sleep(50)
  }
}

async function probeAccounts() {
  const characters = await listCharacters()
  const byAccount = new Map()
  for (const character of characters) {
    if (!byAccount.has(character.account)) byAccount.set(character.account, [])
    byAccount.get(character.account).push(character)
  }

  for (const [accountId, list] of byAccount) {
    console.log(`\n=== account ${accountId} (${list.length}명) ===`)
    let ok = 0
    const failures = []
    const inactive = []
    for (const character of list) {
      const result = await call(`/maplestory/v1/character/basic?ocid=${character.ocid}`)
      if (result.status === 200) {
        ok += 1
        // access_flag는 boolean이 아니라 문자열이다(nexon-api.md "확인 완료된 사실")
        if (result.json.access_flag === 'false') {
          inactive.push(`${character.character_name}(${character.world_name} Lv.${character.character_level})`)
        }
      } else {
        failures.push(
          `${character.character_name}(${character.world_name} Lv.${character.character_level}) → ${result.status} ${errorCode(result)}`,
        )
      }
      await sleep(40)
    }
    console.log(`  200: ${ok}명 / 실패: ${failures.length}명`)
    if (inactive.length > 0) console.log(`  access_flag=false: ${inactive.join(', ')}`)
    failures.forEach((line) => console.log(`  실패 → ${line}`))
  }
}

async function probeShape(name) {
  const character = await findOcid(name)
  console.log(`${character.character_name} — 섹션 항목 수 (daily / weekly / boss)\n`)
  for (const date of [null, kstDateKey(-2), kstDateKey(-8)]) {
    const query = date === null ? '' : `&date=${date}`
    const result = await call(`/maplestory/v1/scheduler/character-state?ocid=${character.ocid}${query}`)
    if (result.status !== 200) {
      console.log(`  ${date ?? '당일'}: ${result.status} ${errorCode(result)}`)
      continue
    }
    const bosses = result.json.boss_contents ?? []
    const byCycle = {}
    for (const boss of bosses) byCycle[boss.cycle] = (byCycle[boss.cycle] ?? 0) + 1
    console.log(
      `  ${String(date ?? '당일').padEnd(12)} ${String(result.json.daily_contents?.length ?? '-').padEnd(4)} ${String(result.json.weekly_contents?.length ?? '-').padEnd(4)} ${bosses.length} (${Object.entries(byCycle).map(([k, v]) => `${k}:${v}`).join(' ')})`,
    )
    await sleep(50)
  }
}

const [mode, name] = process.argv.slice(2)

if (mode === 'dates' && name !== undefined) {
  await probeDates(name)
} else if (mode === 'accounts') {
  await probeAccounts()
} else if (mode === 'shape' && name !== undefined) {
  await probeShape(name)
} else {
  console.error('사용법: NEXON_KEY=<키> node scripts/probe-nexon-api.mjs <dates|accounts|shape> [캐릭터명]')
  process.exit(1)
}
