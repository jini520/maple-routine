/// <reference types="node" />
/**
 * 남은 다섯 표의 기본키를 uuid 로 옮기고 칸 이름을 서버 규칙에 맞추는 버전 16 을 진짜 SQLite 로 태운다.
 *
 * 새 DB 를 연 뒤 다섯 표를 옛 모양으로 다시 세우고 바뀐 칸 이름을 되돌려 버전 15 기기를 만든다. 다시 열어 옛 행이
 * 하나도 빠지지 않았는지, 새 이름과 `UNIQUE` 가 섰는지 본다.
 */
import type { DatabaseSync } from 'node:sqlite'

import { findNexonAccountIdOfMapleIds, recordCharacterAccounts } from '../../character-accounts'
import { fillLegacyNexonAccountIds } from '../../nexon-account-ids'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { DB_VERSION } from '../migrations'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

function columnsOf(table: string): string[] {
  return all(`PRAGMA table_info(${table})`).map((row) => String(row.name))
}

function primaryKeyOf(table: string): string[] {
  return all(`PRAGMA table_info(${table})`)
    .filter((row) => Number(row.pk) > 0)
    .map((row) => String(row.name))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** 버전 15 의 다섯 표. 기본키가 값의 조합이고 칸 이름이 옛 이름이다. */
const VERSION_15_TABLES = [
  `CREATE TABLE character_profiles (
    ocid TEXT NOT NULL, name TEXT NOT NULL, image_url TEXT NOT NULL, world TEXT, world_key TEXT, level INTEGER,
    job_class TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (ocid))`,
  `CREATE TABLE character_world_leaps (
    from_ocid TEXT NOT NULL, to_ocid TEXT NOT NULL, linked_at TEXT NOT NULL, PRIMARY KEY (from_ocid))`,
  `CREATE TABLE enhancement_history_checks (
    kind TEXT NOT NULL, date_key TEXT NOT NULL, next_cursor TEXT, settled INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL, PRIMARY KEY (kind, date_key))`,
  `CREATE TABLE mvp_grade_history (
    account_id TEXT NOT NULL, start_date TEXT NOT NULL, grade TEXT, updated_at TEXT NOT NULL,
    PRIMARY KEY (account_id, start_date))`,
  `CREATE TABLE character_accounts (
    ocid TEXT NOT NULL, name TEXT NOT NULL, account_id TEXT NOT NULL, first_seen_on TEXT NOT NULL,
    last_seen_on TEXT NOT NULL, PRIMARY KEY (ocid, name, account_id))`,
]

/** 버전 16 이 이름을 바꾸는 나머지 표의 칸. `[표, 새 이름, 옛 이름]` */
const RENAMED_COLUMNS: ReadonlyArray<readonly [string, string, string]> = [
  ['boss_party_periods', 'clear_status', 'status'],
  ['boss_party_periods', 'defeated_date', 'defeated_on'],
  ['boss_drops', 'sort_order', 'drop_index'],
  ['cashbook_entry_hunt_inputs', 'fragment_price_meso', 'fragment_price'],
  ['server_sync_queue', 'record_type', 'kind'],
]

function seedDevice(db: DatabaseSync): void {
  db.exec(`INSERT INTO character_profiles VALUES
    ('ocid-1', '지내우시', 'https://img/1', '스카니아', 'scania', 285, '나이트로드', '2026-10-20T00:00:00.000Z'),
    ('ocid-2', '부캐', 'https://img/2', NULL, NULL, NULL, NULL, '2026-10-21T00:00:00.000Z')`)
  db.exec(`INSERT INTO character_world_leaps VALUES ('ocid-old', 'ocid-1', '2026-09-12T00:00:00.000Z')`)
  db.exec(`INSERT INTO enhancement_history_checks VALUES
    ('starforce', '2026-10-01', 'cursor-a', 1, '2026-10-02T00:00:00.000Z'),
    ('cube', '2026-10-01', NULL, 1, '2026-10-02T00:00:00.000Z'),
    ('starforce', '2026-10-26', NULL, 0, '2026-10-26T01:00:00.000Z')`)
  db.exec(`INSERT INTO mvp_grade_history VALUES
    ('acc-1', '2026-09-03', 'gold', '2026-09-03T00:00:00.000Z'),
    ('acc-1', '2026-10-01', 'diamond', '2026-10-01T00:00:00.000Z'),
    ('acc-2', '2026-08-06', NULL, '2026-08-06T00:00:00.000Z')`)
  db.exec(`INSERT INTO character_accounts VALUES
    ('ocid-1', '지내우시', 'acc-1', '2026-09-01', '2026-10-26'),
    ('ocid-1', '옛이름', 'acc-1', '2026-07-01', '2026-08-31')`)
  db.exec(`INSERT INTO cashbook_entries (id, ocid, entry_type, category_key, entry_date, memo, created_at, updated_at) VALUES
    ('e-account', NULL, 'spend', 'buff', '2026-10-01', NULL, '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
    ('e-character', 'ocid-1', 'income', 'hunting', '2026-10-01', NULL, '2026-10-01T01:00:00.000Z', '2026-10-01T01:00:00.000Z')`)
  db.exec(`INSERT INTO cashbook_entry_hunt_inputs (id, entry_id, fragments, fragment_price) VALUES ('h-1', 'e-character', 30, 4000000)`)
  db.exec(`INSERT INTO boss_parties (id, ocid, boss_key, difficulty, created_at, updated_at) VALUES
    ('p-1', 'ocid-1', 'lucid', 'hard', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`)
  db.exec(`INSERT INTO boss_party_periods
    (id, party_id, period_key, cycle, status, price_meso, payout_meso, defeated_on, source, split_mode, party_size, created_at, updated_at)
    VALUES ('pe-1', 'p-1', '2026-10-01', 'weekly', 'cleared', 300000000, 300000000, '2026-10-02', 'auto', 'even', 1,
      '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`)
  db.exec(`INSERT INTO boss_drops (id, period_id, drop_index, category, item_key, record_status, created_at, updated_at)
    VALUES ('d-1', 'pe-1', 0, 'equipment', 'dreamy_belt', 'pending', '2026-10-02T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`)
  db.exec(`INSERT INTO server_sync_queue (id, kind, record_id, created_at) VALUES ('q-1', 'drop-price', 'd-1', '2026-10-02T00:00:00.000Z')`)
}

/** 버전 15 기기를 만든다. 다섯 표를 옛 모양으로 다시 세우고 바뀐 칸을 옛 이름으로 되돌린다. */
async function seedVersion15(): Promise<void> {
  await getBossProfitDb()
  await closeBossProfitDb()
  real.inspect((db) => {
    for (const table of ['character_profiles', 'character_world_leaps', 'enhancement_history_checks', 'mvp_grade_history', 'character_accounts']) {
      db.exec(`DROP TABLE ${table}`)
    }
    for (const sql of VERSION_15_TABLES) db.exec(sql)
    for (const [table, next, previous] of RENAMED_COLUMNS) {
      db.exec(`ALTER TABLE ${table} RENAME COLUMN ${next} TO ${previous}`)
    }
    db.exec('ALTER TABLE cashbook_entries DROP COLUMN nexon_account_id')
    db.exec('ALTER TABLE cashbook_entries ADD COLUMN memo TEXT')
    seedDevice(db)
    db.exec("UPDATE cashbook_entries SET memo = NULL")
    db.exec('PRAGMA user_version = 15')
  })
}

const FIVE_TABLES = ['character_profiles', 'character_world_leaps', 'enhancement_history_checks', 'mvp_grade_history', 'character_accounts']

describe('버전 16: 남은 다섯 표의 기본키를 uuid 로 옮기고 칸 이름을 서버 규칙에 맞춘다', () => {
  it('새 DB 는 다섯 표가 처음부터 uuid 기본키이고 칸이 새 이름이다', async () => {
    await getBossProfitDb()

    expect(real.inspect((db) => (db.prepare('PRAGMA user_version').get() as Row).user_version)).toBe(DB_VERSION)
    for (const table of FIVE_TABLES) expect(primaryKeyOf(table)).toEqual(['id'])
    expect(columnsOf('enhancement_history_checks')).toEqual(
      expect.arrayContaining(['nexon_account_id', 'enhancement_type', 'history_date']),
    )
    expect(columnsOf('character_accounts')).toEqual(
      expect.arrayContaining(['nexon_account_id', 'first_seen_date', 'last_seen_date']),
    )
    expect(columnsOf('mvp_grade_history')).toContain('from_date')
    expect(columnsOf('cashbook_entries')).toContain('nexon_account_id')
    expect(columnsOf('cashbook_entries')).not.toContain('memo')
    for (const [table, next] of RENAMED_COLUMNS) expect(columnsOf(table)).toContain(next)
  })

  it('버전 15 기기의 행을 하나도 잃지 않고 값 그대로 옮기며, 행마다 서로 다른 uuid 를 붙인다', async () => {
    await seedVersion15()
    await getBossProfitDb()

    expect(all('SELECT ocid, name, image_url, world, world_key, level, job_class, updated_at FROM character_profiles ORDER BY ocid')).toEqual([
      { ocid: 'ocid-1', name: '지내우시', image_url: 'https://img/1', world: '스카니아', world_key: 'scania', level: 285, job_class: '나이트로드', updated_at: '2026-10-20T00:00:00.000Z' },
      { ocid: 'ocid-2', name: '부캐', image_url: 'https://img/2', world: null, world_key: null, level: null, job_class: null, updated_at: '2026-10-21T00:00:00.000Z' },
    ])
    expect(all('SELECT from_ocid, to_ocid, linked_at FROM character_world_leaps')).toEqual([
      { from_ocid: 'ocid-old', to_ocid: 'ocid-1', linked_at: '2026-09-12T00:00:00.000Z' },
    ])
    expect(all('SELECT enhancement_type, history_date, next_cursor, settled, checked_at FROM enhancement_history_checks ORDER BY history_date, enhancement_type')).toEqual([
      { enhancement_type: 'cube', history_date: '2026-10-01', next_cursor: null, settled: 1, checked_at: '2026-10-02T00:00:00.000Z' },
      { enhancement_type: 'starforce', history_date: '2026-10-01', next_cursor: 'cursor-a', settled: 1, checked_at: '2026-10-02T00:00:00.000Z' },
      { enhancement_type: 'starforce', history_date: '2026-10-26', next_cursor: null, settled: 0, checked_at: '2026-10-26T01:00:00.000Z' },
    ])
    expect(all('SELECT account_id, from_date, grade FROM mvp_grade_history ORDER BY account_id, from_date')).toEqual([
      { account_id: 'acc-1', from_date: '2026-09-03', grade: 'gold' },
      { account_id: 'acc-1', from_date: '2026-10-01', grade: 'diamond' },
      { account_id: 'acc-2', from_date: '2026-08-06', grade: null },
    ])
    expect(all('SELECT ocid, name, account_id, first_seen_date, last_seen_date FROM character_accounts ORDER BY first_seen_date')).toEqual([
      { ocid: 'ocid-1', name: '옛이름', account_id: 'acc-1', first_seen_date: '2026-07-01', last_seen_date: '2026-08-31' },
      { ocid: 'ocid-1', name: '지내우시', account_id: 'acc-1', first_seen_date: '2026-09-01', last_seen_date: '2026-10-26' },
    ])

    const ids = FIVE_TABLES.flatMap((table) => all(`SELECT id FROM ${table}`).map((row) => String(row.id)))
    expect(ids).toHaveLength(11)
    for (const id of ids) expect(id).toMatch(UUID)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('나머지 표의 칸은 이름만 바뀌고 값이 그대로다', async () => {
    await seedVersion15()
    await getBossProfitDb()

    expect(all('SELECT clear_status, defeated_date FROM boss_party_periods')).toEqual([
      { clear_status: 'cleared', defeated_date: '2026-10-02' },
    ])
    expect(all('SELECT sort_order FROM boss_drops')).toEqual([{ sort_order: 0 }])
    expect(all('SELECT fragment_price_meso FROM cashbook_entry_hunt_inputs')).toEqual([{ fragment_price_meso: 4000000 }])
    expect(all('SELECT record_type, record_id FROM server_sync_queue')).toEqual([{ record_type: 'drop-price', record_id: 'd-1' }])
    for (const [table, , previous] of RENAMED_COLUMNS) expect(columnsOf(table)).not.toContain(previous)
  })

  it('계정 칸은 옛 행에 빈 글자를 적어 메인 계정으로 채울 행을 표시하고, 캐릭터가 있는 가계부 기록은 비워 둔다', async () => {
    await seedVersion15()
    await getBossProfitDb()

    expect(all("SELECT count(*) AS n FROM enhancement_history_checks WHERE nexon_account_id = ''")).toEqual([{ n: 3 }])
    expect(all("SELECT count(*) AS n FROM character_accounts WHERE nexon_account_id = ''")).toEqual([{ n: 2 }])
    expect(all('SELECT id, nexon_account_id FROM cashbook_entries ORDER BY id')).toEqual([
      { id: 'e-account', nexon_account_id: '' },
      { id: 'e-character', nexon_account_id: null },
    ])
  })

  it('옛 조합으로 같은 행을 또 넣으면 UNIQUE 가 막고, id 없이 쓰는 upsert 는 그대로 돈다', async () => {
    await seedVersion15()
    const db = await getBossProfitDb()

    await expect(
      db.run(`INSERT INTO mvp_grade_history (account_id, from_date, grade, updated_at) VALUES ('acc-1', '2026-09-03', 'gold', 'x')`),
    ).rejects.toThrow(/UNIQUE/)
    await db.run(
      `INSERT INTO character_profiles (ocid, name, image_url, updated_at) VALUES ('ocid-1', '새이름', 'https://img/1', 'y')
       ON CONFLICT(ocid) DO UPDATE SET name = excluded.name`,
    )
    expect(all("SELECT name FROM character_profiles WHERE ocid = 'ocid-1'")).toEqual([{ name: '새이름' }])
    expect(all('SELECT count(*) AS n FROM character_profiles')).toEqual([{ n: 2 }])
  })

  it('같은 날짜 · 같은 종류라도 계정이 다르면 조회 기록이 둘 선다', async () => {
    const db = await getBossProfitDb()
    const insert = `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, settled, checked_at)
      VALUES (?, 'starforce', '2026-10-01', 1, 'z')`

    await db.run(insert, ['account-a'])
    await db.run(insert, ['account-b'])

    expect(all('SELECT count(*) AS n FROM enhancement_history_checks')).toEqual([{ n: 2 }])
    await expect(db.run(insert, ['account-a'])).rejects.toThrow(/UNIQUE/)
  })

  // 입력 시트가 모두 null 로 적던 칸이다. 서버로도 보내지 않아 칸째 지운다.
  it('버전 17 이 쓰지 않던 가계부 메모 칸을 지운다', async () => {
    await seedVersion15()
    await getBossProfitDb()

    expect(columnsOf('cashbook_entries')).not.toContain('memo')
    expect(all('SELECT count(*) AS n FROM cashbook_entries')).toEqual([{ n: 2 }])
  })

  it('한 번 돈 버전 16 은 다시 열어도 다시 돌지 않는다', async () => {
    await seedVersion15()
    await getBossProfitDb()
    const before = all('SELECT id FROM character_profiles ORDER BY ocid')
    await closeBossProfitDb()

    await getBossProfitDb()

    expect(all('SELECT id FROM character_profiles ORDER BY ocid')).toEqual(before)
  })

  it('부팅 단계가 빈 글자 계정 칸을 메인 계정 id 로 채우고, 이미 다시 조회한 날짜는 새 줄을 남긴다', async () => {
    await seedVersion15()
    const db = await getBossProfitDb()
    await db.run(
      `INSERT INTO enhancement_history_checks (nexon_account_id, enhancement_type, history_date, next_cursor, settled, checked_at)
       VALUES ('main', 'starforce', '2026-10-26', 'cursor-new', 0, '2026-10-26T09:00:00.000Z')`,
    )

    await fillLegacyNexonAccountIds('main')
    await fillLegacyNexonAccountIds('main')

    expect(all('SELECT nexon_account_id, enhancement_type, history_date, next_cursor FROM enhancement_history_checks ORDER BY history_date, enhancement_type')).toEqual([
      { nexon_account_id: 'main', enhancement_type: 'cube', history_date: '2026-10-01', next_cursor: null },
      { nexon_account_id: 'main', enhancement_type: 'starforce', history_date: '2026-10-01', next_cursor: 'cursor-a' },
      { nexon_account_id: 'main', enhancement_type: 'starforce', history_date: '2026-10-26', next_cursor: 'cursor-new' },
    ])
    expect(all('SELECT DISTINCT nexon_account_id FROM character_accounts')).toEqual([{ nexon_account_id: 'main' }])
    expect(all('SELECT id, nexon_account_id FROM cashbook_entries ORDER BY id')).toEqual([
      { id: 'e-account', nexon_account_id: 'main' },
      { id: 'e-character', nexon_account_id: null },
    ])
  })

  it('소속을 계정 없는 자격으로 다시 봐도 아는 계정을 지우지 않는다', async () => {
    await getBossProfitDb()
    const accounts = [{ accountId: 'acc-1', characters: [{ ocid: 'o', name: '루디', world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] }]

    await recordCharacterAccounts(accounts, '2026-10-01', 'account-a')
    await recordCharacterAccounts(accounts, '2026-10-02', null)

    expect(all('SELECT nexon_account_id, first_seen_date, last_seen_date FROM character_accounts')).toEqual([
      { nexon_account_id: 'account-a', first_seen_date: '2026-10-01', last_seen_date: '2026-10-02' },
    ])
  })

  it('메이플 ID 가 속했던 넥슨 계정을 찾는다. 계정을 모르는 소속은 건너뛴다', async () => {
    await getBossProfitDb()
    const 목록 = (accountId: string) => [{ accountId, characters: [{ ocid: `o-${accountId}`, name: accountId, world: '스카니아', worldKey: 'scania', jobClass: '비숍', level: 280 }] }]
    await recordCharacterAccounts(목록('maple-1'), '2026-10-01', 'account-a')
    await recordCharacterAccounts(목록('maple-2'), '2026-10-02', null)

    await expect(findNexonAccountIdOfMapleIds(['maple-2', 'maple-1'])).resolves.toBe('account-a')
    await expect(findNexonAccountIdOfMapleIds(['maple-2'])).resolves.toBeNull()
    await expect(findNexonAccountIdOfMapleIds([])).resolves.toBeNull()
  })
})
