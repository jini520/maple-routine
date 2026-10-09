/// <reference types="node" />
/**
 * **SQLite 가 만드는 uuid 를 진짜 엔진으로 재는 자리.**
 *
 * 기록의 식별자를 JS 가 아니라 SQLite 가 만든다. `crypto` 가 전역에 없고(`react-native` 0.86 Core 도
 * `expo` winter 런타임도 안 심는다) `Math.random` 은 씨앗 품질을 모르며, 새 네이티브 모듈을 들이면
 * 스토어 빌드를 탄다. SQLite 는 이미 번들에 있어 OTA 로 간다.
 *
 * 여기서 보는 것 셋이다.
 *
 * - **식이 v4 모양을 내는가.** 버전 니블과 변종 비트를 손으로 박으므로 틀리면 uuid 가 아니다.
 * - **겹치지 않는가.** 서버가 `UNIQUE` 로 받고, 겹치면 그 쓰기가 조용히 무시된다.
 * - **프로세스를 새로 띄워도 수열이 반복되지 않는가.** 이것이 제일 무섭다. 반복되면 설치마다 같은
 *   식별자가 생겨 서버에서 서로를 덮는다. `node:sqlite` 와 op-sqlite 가 같은 SQLite 이고 씨앗을
 *   unix VFS 에서 받는 것도 같아서, 이 측정이 기기 동작을 대신 말해 준다.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { NEW_UUID_SQL } from '../uuid'

/** 한 줄로 uuid 를 뽑는다. */
function uuidOnce(db: DatabaseSync): string {
  return (db.prepare(`SELECT ${NEW_UUID_SQL} AS u`).get() as { u: string }).u
}

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('SQLite 가 만드는 uuid', () => {
  it('v4 모양이다', () => {
    const db = new DatabaseSync(':memory:')
    try {
      expect(uuidOnce(db)).toMatch(V4)
    } finally {
      db.close()
    }
  })

  it('만 개를 뽑아도 겹치지 않고 전부 v4 다', () => {
    const db = new DatabaseSync(':memory:')
    try {
      const seen = new Set<string>()
      for (let i = 0; i < 10_000; i += 1) seen.add(uuidOnce(db))

      expect(seen.size).toBe(10_000)
      expect([...seen].every((one) => V4.test(one))).toBe(true)
    } finally {
      db.close()
    }
  })

  it('프로세스를 새로 띄워도 수열이 반복되지 않는다', () => {
    // 앱을 완전히 종료하고 다시 켠 것과 같은 조건이다. 같은 DB 파일을 쓰는 것까지 같게 한다.
    const dir = mkdtempSync(join(tmpdir(), 'uuid-seed-'))
    try {
      const script = join(dir, 'tick.cjs')
      // 식 안에 홑따옴표가 있어 그대로 끼우면 생성한 스크립트의 문자열이 그 자리에서 닫힌다.
      const sql = JSON.stringify(`SELECT ${NEW_UUID_SQL} AS u`)
      writeFileSync(
        script,
        `const { DatabaseSync } = require('node:sqlite')
         const db = new DatabaseSync(process.argv[2])
         const out = []
         for (let i = 0; i < 3; i += 1) out.push(db.prepare(${sql}).get().u)
         console.log(out.join(' '))`,
      )

      const file = join(dir, 'seed.db')
      const seen = new Set<string>()
      for (let run = 0; run < 5; run += 1) {
        const line = execFileSync(process.execPath, ['--no-warnings', script, file], {
          encoding: 'utf8',
        })
        for (const one of line.trim().split(' ')) seen.add(one)
      }

      // 다섯 프로세스 × 세 개. 씨앗이 겹치면 이 수가 3 이나 6 으로 떨어진다.
      expect(seen.size).toBe(15)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
