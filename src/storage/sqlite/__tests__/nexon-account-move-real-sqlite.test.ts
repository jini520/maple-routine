/// <reference types="node" />
/**
 * 로그인이 메이플 ID 가 같은 키의 계정 id 를 이어받을 때 기기 기록을 옮기는 일을 진짜 SQLite 로 태운다.
 *
 * 옛 id 에 줄이 남으면 강화 수집기가 새 id 로 같은 날을 다시 받고, 계정을 가리지 않고 더하는 강화 합계가 두 번 세어진다.
 */
import { moveNexonAccountRows } from '../../nexon-account-ids'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  await getBossProfitDb()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const 키 = 'account-key'
const 로그인 = 'account-login'
const 다른계정 = 'account-other'

function 조회(account: string, date: string, checkedAt: string): void {
  real.inspect((db) =>
    db
      .prepare(
        `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, next_cursor, settled, checked_at)
         VALUES (?, 'starforce', ?, NULL, 1, ?)`,
      )
      .run(account, date, checkedAt),
  )
}

function 합계(account: string, date: string, attempts: number, updatedAt: string): void {
  real.inspect((db) =>
    db
      .prepare(
        `INSERT INTO enhancement_totals (nexon_account_id, history_date, character_name, enhancement_type, enhancement_category,
           item_group, item_key, item_name, attempts, attempt_cost_meso, destroy_defence_cost_meso, event_world, updated_at)
         VALUES (?, ?, '낟낟', 'starforce', 'starforce', 'name:모자', NULL, '모자', ?, 1000, 0, 0, ?)`,
      )
      .run(account, date, attempts, updatedAt),
  )
}

function 줄(sql: string): Array<Record<string, unknown>> {
  return real.inspect((db) => db.prepare(sql).all() as Array<Record<string, unknown>>)
}

it('옛 id 의 줄을 이어받은 id 로 옮기고, 다른 계정의 줄은 그대로 둔다', async () => {
  조회(키, '2026-10-01', '2026-10-02T00:00:00.000Z')
  조회(다른계정, '2026-10-01', '2026-10-02T00:00:00.000Z')
  합계(키, '2026-10-01', 3, '2026-10-02T00:00:00.000Z')
  real.inspect((db) => {
    db.prepare(
      `INSERT INTO enhancement_recomputes (nexon_account_id, request_key, done_through_date, completed_at, updated_at)
       VALUES (?, 'r1', '2026-10-01', NULL, '2026-10-02T00:00:00.000Z')`,
    ).run(키)
    db.prepare(
      `INSERT INTO character_accounts (ocid, name, account_id, nexon_account_id, first_seen_date, last_seen_date)
       VALUES ('o1', '낟낟', 'maple-1', ?, '2026-10-01', '2026-10-01')`,
    ).run(키)
    for (const account of [키, 로그인]) {
      db.prepare(
        `INSERT INTO event_world_characters (nexon_account_id, character_name, world_key, updated_at)
         VALUES (?, '지운캐릭', 'special_2', '2026-10-02T00:00:00.000Z')`,
      ).run(account)
    }
  })

  await moveNexonAccountRows([키], 로그인)

  expect(줄('SELECT nexon_account_id AS a FROM enhancement_history_checks ORDER BY a')).toEqual([{ a: 로그인 }, { a: 다른계정 }])
  expect(줄('SELECT nexon_account_id AS a, attempts FROM enhancement_totals')).toEqual([{ a: 로그인, attempts: 3 }])
  expect(줄('SELECT nexon_account_id AS a FROM enhancement_recomputes')).toEqual([{ a: 로그인 }])
  expect(줄('SELECT nexon_account_id AS a FROM character_accounts')).toEqual([{ a: 로그인 }])
  expect(줄('SELECT nexon_account_id AS a, character_name AS n FROM event_world_characters')).toEqual([{ a: 로그인, n: '지운캐릭' }])
})

// 같은 넥슨 계정의 같은 날을 두 번 받은 것이다. 나중 줄이 그 날을 더 많이 담는다.
it('계정 칸이 UNIQUE 에 든 표에서 겹치면 나중에 적힌 줄이 남는다', async () => {
  조회(키, '2026-10-01', '2026-10-05T00:00:00.000Z')
  조회(로그인, '2026-10-01', '2026-10-03T00:00:00.000Z')
  조회(키, '2026-10-02', '2026-10-03T00:00:00.000Z')
  조회(로그인, '2026-10-02', '2026-10-05T00:00:00.000Z')
  합계(키, '2026-10-01', 7, '2026-10-05T00:00:00.000Z')
  합계(로그인, '2026-10-01', 5, '2026-10-03T00:00:00.000Z')
  합계(키, '2026-10-02', 5, '2026-10-03T00:00:00.000Z')
  합계(로그인, '2026-10-02', 7, '2026-10-05T00:00:00.000Z')

  await moveNexonAccountRows([키], 로그인)

  expect(줄('SELECT history_date AS d, checked_at AS at, nexon_account_id AS a FROM enhancement_history_checks ORDER BY d')).toEqual([
    { d: '2026-10-01', at: '2026-10-05T00:00:00.000Z', a: 로그인 },
    { d: '2026-10-02', at: '2026-10-05T00:00:00.000Z', a: 로그인 },
  ])
  expect(줄('SELECT history_date AS d, attempts, nexon_account_id AS a FROM enhancement_totals ORDER BY d')).toEqual([
    { d: '2026-10-01', attempts: 7, a: 로그인 },
    { d: '2026-10-02', attempts: 7, a: 로그인 },
  ])
})

it('옛 id 가 여럿이어도 모두 옮긴다', async () => {
  합계(키, '2026-10-01', 3, '2026-10-02T00:00:00.000Z')
  합계('account-key-2', '2026-10-02', 4, '2026-10-02T00:00:00.000Z')

  await moveNexonAccountRows([키, 'account-key-2'], 로그인)

  expect(줄('SELECT DISTINCT nexon_account_id AS a FROM enhancement_totals')).toEqual([{ a: 로그인 }])
})
