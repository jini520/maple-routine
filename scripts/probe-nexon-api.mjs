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
 *   NEXON_KEY=<서비스 키> node scripts/probe-nexon-api.mjs eligibility [캐릭터명]
 *
 *   dates    — 오늘~오늘−16일 전수 스윕. 조회 가능 구간과 에러 코드를 확인한다.
 *              **미계측 항목**: 오늘−1일의 OPENAPI00009("아직 집계 전")가 하루 중 몇 시에 풀리는지.
 *              오전/오후에 두 번 돌리면 그 경계를 잡을 수 있다([[ADR-067]] 트레이드오프).
 *   accounts — 키가 반환하는 전 계정·전 캐릭터의 character/basic 상태. 조회 불가 ocid(OPENAPI00003)를 찾는다.
 *   shape    — 당일 vs 과거 응답의 섹션 항목 수 비교(미접속 캐릭터의 축약 정도).
 *   eligibility — [[ADR-086]] 결정 3의 후보 자격 판정을 **그대로 재현하고 무엇이 자격을 켰는지 찍는다**.
 *              "왜 이 캐릭터가 목록에 있는가"에 추론이 아니라 관측으로 답하기 위한 모드다.
 *              캐릭터명을 주면 그 캐릭터만 14일 전부를 훑어 날짜별 트리거를 나열한다(중간에 멈추지 않는다).
 *   items    — 일간/주간 항목 전체 이름 + `scheduler-content-catalog.json` 의 현재 분류(공유/캐릭터).
 *              공유 목록이 실제 API 이름과 어긋나면 여기서 드러난다(2026-08-03 실측: 카탈로그의
 *              `몬스터파크` 가 API 의 `[몬스터파크] 익스트림 몬스터파커에 도전해보겠나?` 를 못 잡는다).
 *              분류 자체는 게임 지식이라 사용자 확인이 필요하다([[ADR-006]]).
 */

import fs from 'node:fs'

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

// ── eligibility: ADR-086 결정 3 판정 재현 ────────────────────────────────────
// 앱의 lib/scheduler-activity.ts와 **같은 규칙**을 wire 위에서 다시 구현한다. 앱 코드를 import하지
// 않는 이유는 이 스크립트가 빌드 없이 도는 독립 도구이기 때문이고, 그래서 규칙이 갈라지면 여기가
// 먼저 틀린다 — 규칙을 고칠 때 두 곳을 같이 본다.
const catalog = JSON.parse(
  fs.readFileSync(new URL('../src/data/scheduler-content-catalog.json', import.meta.url), 'utf8'),
)
const stripSpaces = (value) => value.replace(/\s+/g, '')
const SHARED_NAMES = new Set(
  [...catalog.worldShared, ...catalog.accountShared].map((entry) => stripSpaces(entry.name)),
)
const shareScope = (name) => (SHARED_NAMES.has(stripSpaces(name)) ? 'shared' : 'character')
// ADR-086 정정 2: 리셋 없이 누적되는 개인 점수는 자격 판정에서 뺀다.
const CUMULATIVE_NAMES = new Set((catalog.cumulativeScores ?? []).map(stripSpaces))
const isCumulative = (name) => CUMULATIVE_NAMES.has(stripSpaces(name))

// 앱: nowCount > 0 || questState === 2 (누적 점수 항목 제외)
function contentTriggers(wire, section) {
  return (wire ?? [])
    .filter((item) => shareScope(item.content_name) === 'character')
    .filter((item) => !isCumulative(item.content_name))
    .filter((item) => item.now_count > 0 || Number(item.quest_state) === 2)
    .map(
      (item) =>
        `${section.padEnd(6)} ${item.content_name}  now=${item.now_count}/${item.max_count} quest=${item.quest_state} reg=${item.registration_flag}`,
    )
}

// 앱: bossContents.some(ownComplete) — bossDaily는 정규화 단계에서 제외된다(ADR-007)
function bossTriggers(wire) {
  return (wire ?? [])
    .filter((boss) => boss.cycle !== 'bossDaily' && boss.complete_flag === 'true')
    .map(
      (boss) =>
        `boss   ${boss.content_name}(${boss.difficulty}) ${boss.cycle}  reg=${boss.registration_flag} comp=${boss.complete_flag}`,
    )
}

async function dayTriggers(ocid, date) {
  const query = date === null ? '' : `&date=${date}`
  const result = await call(`/maplestory/v1/scheduler/character-state?ocid=${ocid}${query}`)
  if (result.status !== 200) {
    return { error: errorCode(result) ?? String(result.status), triggers: [], counts: null }
  }
  const json = result.json
  return {
    error: null,
    counts: `${json.daily_contents?.length ?? 0}/${json.weekly_contents?.length ?? 0}/${json.boss_contents?.length ?? 0}`,
    triggers: [
      ...contentTriggers(json.daily_contents, 'daily'),
      ...contentTriggers(json.weekly_contents, 'weekly'),
      ...bossTriggers(json.boss_contents),
    ],
  }
}

// 일간/주간 항목 전체 이름과 **현재 카탈로그가 어떻게 분류하는지**를 나란히 찍는다.
// 카탈로그는 게임 레퍼런스 데이터라 AI가 임의로 채울 수 없다([[ADR-006]]) — 이 출력이
// 사용자(도메인 전문가)가 "이건 월드/계정 공유다"를 확인해 주기 위한 입력이다.
async function probeItems(name) {
  const character = await findOcid(name)
  console.log(`${character.character_name}(${character.world_name} Lv.${character.character_level})`)
  console.log(`카탈로그 공유 항목: ${[...SHARED_NAMES].join(' · ')}`)
  console.log(`카탈로그 누적 점수: ${[...CUMULATIVE_NAMES].join(' · ') || '(없음)'}\n`)

  const seen = new Map()
  for (const date of [null, kstDateKey(-2), kstDateKey(-8)]) {
    const query = date === null ? '' : `&date=${date}`
    const result = await call(`/maplestory/v1/scheduler/character-state?ocid=${character.ocid}${query}`)
    if (result.status !== 200) continue
    for (const [section, wire] of [
      ['daily', result.json.daily_contents],
      ['weekly', result.json.weekly_contents],
    ]) {
      for (const item of wire ?? []) {
        const key = `${section} ${item.content_name}`
        if (!seen.has(key)) seen.set(key, { section, name: item.content_name, dates: [] })
        seen.get(key).dates.push(
          `${date ?? '당일'}:now=${item.now_count}/${item.max_count},quest=${item.quest_state}`,
        )
      }
    }
    await sleep(50)
  }

  console.log('구분     현재분류    항목명')
  for (const entry of [...seen.values()].sort((a, b) => a.section.localeCompare(b.section))) {
    const label = isCumulative(entry.name)
      ? '누적'
      : shareScope(entry.name) === 'shared'
        ? '공유'
        : '캐릭터'
    console.log(`${entry.section.padEnd(8)} ${label.padEnd(10)} ${entry.name}`)
    console.log(`                     ${entry.dates.join('  ')}`)
  }
}

async function probeEligibility(name) {
  const characters = await listCharacters()
  const targets = name === undefined ? characters : [await findOcid(name)]
  const dates = Array.from({ length: 13 }, (_, index) => kstDateKey(-(index + 1)))

  console.log(`판정 규칙: access_flag: true  OR  최근 14일 캐릭터 범위 항목 완료 기록 (ADR-086 결정 3)`)
  console.log(`대상 ${targets.length}명 · 과거 날짜 ${dates[0]} ~ ${dates.at(-1)}\n`)

  const verdicts = { accessFlag: [], swept: [], ineligible: [], failed: [] }

  for (const character of targets) {
    const label = `${character.character_name}(${character.world_name} Lv.${character.character_level})`
    const basic = await call(`/maplestory/v1/character/basic?ocid=${character.ocid}`)
    if (basic.status !== 200) {
      console.log(`${label}  → 조회 실패 ${errorCode(basic)}`)
      verdicts.failed.push(label)
      continue
    }
    // access_flag는 문자열이다(nexon-api.md "확인 완료된 사실")
    if (basic.json.access_flag === 'true') {
      console.log(`${label}  access=true   → 자격 O (access_flag 충분조건, 스윕 안 함)`)
      verdicts.accessFlag.push(label)
      continue
    }

    // 단일 캐릭터 모드에서는 중간에 멈추지 않고 14일 전부를 찍는다 — 어느 날짜의 무엇이
    // 자격을 켰는지 한 번에 보기 위해서다. 전체 모드는 앱과 같이 첫 발견에서 멈춘다.
    const verbose = name !== undefined
    console.log(`${label}  access=false`)

    const today = await dayTriggers(character.ocid, null)
    if (verbose || today.triggers.length > 0) {
      console.log(`    당일        ${today.error ?? today.counts}  트리거 ${today.triggers.length}건`)
      today.triggers.forEach((line) => console.log(`        ${line}`))
    }

    let firstHit = today.triggers.length > 0 ? '당일' : null
    for (const date of dates) {
      if (firstHit !== null && !verbose) break
      const day = await dayTriggers(character.ocid, date)
      if (verbose || day.triggers.length > 0) {
        console.log(`    ${date}  ${day.error ?? day.counts}  트리거 ${day.triggers.length}건`)
        day.triggers.forEach((line) => console.log(`        ${line}`))
      }
      if (day.triggers.length > 0 && firstHit === null) firstHit = date
      await sleep(40)
    }

    if (firstHit === null) {
      console.log(`    → 자격 X (14일 전부 0건)`)
      verdicts.ineligible.push(label)
    } else {
      console.log(`    → 자격 O (${firstHit})`)
      verdicts.swept.push(label)
    }
  }

  console.log(`\n=== 요약 ===`)
  console.log(`자격 O — access_flag: ${verdicts.accessFlag.length}명`)
  console.log(`자격 O — 활동 관측:  ${verdicts.swept.length}명`)
  console.log(`자격 X:              ${verdicts.ineligible.length}명`)
  console.log(`조회 실패:           ${verdicts.failed.length}명`)
  if (verdicts.swept.length > 0) console.log(`\n활동 관측으로 통과: ${verdicts.swept.join(', ')}`)
}

const [mode, name] = process.argv.slice(2)

if (mode === 'dates' && name !== undefined) {
  await probeDates(name)
} else if (mode === 'accounts') {
  await probeAccounts()
} else if (mode === 'shape' && name !== undefined) {
  await probeShape(name)
} else if (mode === 'eligibility') {
  await probeEligibility(name)
} else if (mode === 'items' && name !== undefined) {
  await probeItems(name)
} else {
  console.error(
    '사용법: NEXON_KEY=<키> node scripts/probe-nexon-api.mjs <dates|accounts|shape|eligibility|items> [캐릭터명]',
  )
  process.exit(1)
}
