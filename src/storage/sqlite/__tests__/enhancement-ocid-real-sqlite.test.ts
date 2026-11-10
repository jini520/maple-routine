/// <reference types="node" />
/**
 * 강화 합계 줄에 ocid 를 붙이고 판정 열쇠를 ocid 로 바꾸는 버전 18 을 진짜 SQLite 로 태운다.
 *
 * 새 DB 를 연 뒤 합계 표와 조회 기록을 버전 17 모양으로 다시 세워 옛 기기를 만든다. 다시 열어 붙인 줄 · 지운 줄 · 다시 받을 날을 본다.
 */
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

const VERSION_17_TOTALS = `CREATE TABLE enhancement_totals (
    id TEXT NOT NULL PRIMARY KEY,
    nexon_account_id TEXT NOT NULL,
    history_date TEXT NOT NULL,
    character_name TEXT NOT NULL,
    enhancement_type TEXT NOT NULL,
    enhancement_category TEXT NOT NULL,
    item_group TEXT NOT NULL,
    item_key TEXT,
    item_name TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    attempt_cost_meso INTEGER NOT NULL,
    destroy_defence_cost_meso INTEGER NOT NULL,
    from_star INTEGER,
    to_star INTEGER,
    event_world INTEGER,
    updated_at TEXT NOT NULL,
    UNIQUE (nexon_account_id, history_date, character_name, enhancement_category, item_group)
  )`

const VERSION_17_CHECKS = `CREATE TABLE enhancement_history_checks (
    id TEXT NOT NULL PRIMARY KEY,
    nexon_account_id TEXT,
    enhancement_type TEXT NOT NULL,
    history_date TEXT NOT NULL,
    next_cursor TEXT,
    settled INTEGER NOT NULL DEFAULT 0,
    checked_at TEXT NOT NULL,
    UNIQUE (nexon_account_id, enhancement_type, history_date)
  )`

function 합계(id: string, nexonAccountId: string, date: string, name: string, attempts: number, updatedAt: string): string {
  return `INSERT INTO enhancement_totals VALUES ('${id}', '${nexonAccountId}', '${date}', '${name}', 'cube', 'cube_reset',
    'key:arcane', 'arcane', '아케인셰이드', ${attempts}, ${attempts * 100}, 0, NULL, NULL, 0, '${updatedAt}')`
}

function 조회(id: string, nexonAccountId: string | null, date: string, checkedAt: string): string {
  const account = nexonAccountId === null ? 'NULL' : `'${nexonAccountId}'`
  return `INSERT INTO enhancement_history_checks VALUES ('${id}', ${account}, 'cube', '${date}', NULL, 1, '${checkedAt}')`
}

async function seedVersion17(): Promise<void> {
  await getBossProfitDb()
  await closeBossProfitDb()
  real.inspect((db) => {
    db.exec('DROP TABLE enhancement_totals')
    db.exec('DROP TABLE enhancement_history_checks')
    db.exec(VERSION_17_TOTALS)
    db.exec(VERSION_17_CHECKS)
    db.exec(`CREATE TABLE event_world_characters (id TEXT NOT NULL PRIMARY KEY, nexon_account_id TEXT NOT NULL,
      character_name TEXT NOT NULL, world_key TEXT NOT NULL, updated_at TEXT NOT NULL)`)
    db.exec(`INSERT INTO character_accounts (ocid, name, account_id, nexon_account_id, first_seen_date, last_seen_date)
      VALUES ('o-1', '살름', 'maple-1', 'account-new', '2026-09-01', '2026-09-30'),
             ('o-1', '낟낟', 'maple-1', 'account-new', '2026-10-01', '2026-10-31')`)
    db.exec(`INSERT INTO character_profiles (ocid, name, image_url, world, world_key, updated_at) VALUES ('o-1', '낟낟', 'https://img/1', '스카니아', 'scania', '2026-10-31T00:00:00.000Z')`)
    // 같은 캐릭터의 같은 날을 옛 계정 id 와 새 계정 id 로 두 번 받은 줄.
    db.exec(합계('t-old', 'account-old', '2026-09-10', '살름', 3, '2026-09-11T00:00:00.000Z'))
    db.exec(합계('t-new', 'account-new', '2026-09-10', '살름', 5, '2026-10-02T00:00:00.000Z'))
    db.exec(합계('t-rename', 'account-new', '2026-10-10', '낟낟', 2, '2026-10-11T00:00:00.000Z'))
    // 앱이 본 적 없는 이름. 어느 캐릭터의 줄인지 모른다.
    db.exec(합계('t-unknown', 'account-new', '2026-10-12', '지운캐릭', 4, '2026-10-13T00:00:00.000Z'))
    db.exec(조회('c-1', 'account-new', '2026-10-10', '2026-10-11T00:00:00.000Z'))
    db.exec(조회('c-2', 'account-new', '2026-10-12', '2026-10-13T00:00:00.000Z'))
    db.exec(조회('c-3', null, '2026-08-01', '2026-08-02T00:00:00.000Z'))
    db.exec('PRAGMA user_version = 17')
  })
}

describe('버전 18: 강화 합계 줄에 ocid 를 붙인다', () => {
  it('새 DB 는 처음부터 ocid 판정 열쇠이고 이름 판정 표가 없다', async () => {
    await getBossProfitDb()

    expect(real.inspect((db) => (db.prepare('PRAGMA user_version').get() as Row).user_version)).toBe(DB_VERSION)
    expect(all("SELECT name FROM sqlite_master WHERE name = 'event_world_characters'")).toEqual([])
    expect(all('PRAGMA table_info(enhancement_totals)').map((row) => row.name)).toEqual(
      expect.arrayContaining(['ocid', 'account_id', 'world_key']),
    )
  })

  it('그 이름으로 본 기간의 줄에 ocid · 메이플 ID · 월드를 붙이고, 계정 id 둘로 겹친 줄은 늦게 적힌 줄을 남긴다', async () => {
    await seedVersion17()
    await getBossProfitDb()

    expect(all('SELECT history_date, character_name, ocid, account_id, world_key, attempts FROM enhancement_totals ORDER BY history_date')).toEqual([
      { history_date: '2026-09-10', character_name: '살름', ocid: 'o-1', account_id: 'maple-1', world_key: 'scania', attempts: 5 },
      { history_date: '2026-10-10', character_name: '낟낟', ocid: 'o-1', account_id: 'maple-1', world_key: 'scania', attempts: 2 },
    ])
  })

  // 다시 받아야 수집기가 넥슨에서 그날 이름을 찾는다. 조회 기록이 남으면 굳은 날이라 다시 받지 않는다.
  it('붙이지 못한 줄은 지우고, 그 날의 조회 기록을 지우고 다시 받을 날로 적는다', async () => {
    await seedVersion17()
    await getBossProfitDb()

    expect(all("SELECT * FROM enhancement_totals WHERE character_name = '지운캐릭'")).toEqual([])
    expect(all('SELECT nexon_account_id, enhancement_type, history_date FROM enhancement_refetches')).toEqual([
      { nexon_account_id: 'account-new', enhancement_type: 'cube', history_date: '2026-10-12' },
    ])
    expect(all('SELECT nexon_account_id, history_date FROM enhancement_history_checks ORDER BY history_date')).toEqual([
      { nexon_account_id: '', history_date: '2026-08-01' },
      { nexon_account_id: 'account-new', history_date: '2026-10-10' },
    ])
  })

  it('조회 기록의 계정 칸이 NOT NULL 이 되고, 이름 판정 표를 지운다', async () => {
    await seedVersion17()
    await getBossProfitDb()

    const column = all('PRAGMA table_info(enhancement_history_checks)').find((row) => row.name === 'nexon_account_id')
    expect(column?.notnull).toBe(1)
    expect(all("SELECT name FROM sqlite_master WHERE name = 'event_world_characters'")).toEqual([])
  })
})
