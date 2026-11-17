/// <reference types="node" />
/**
 * 버전 23 이 옛 보스 표 넷과 옛 가계부 표 둘을 지우는 것을 진짜 SQLite 로 태우는 자리.
 *
 * 옛 표는 이관 단계가 읽어야 해서 버전 23 전 DB 에서만 만든다. 지운 뒤에도 부팅마다 만들면 빈 표로 다시 생기므로, 다시 연
 * DB 에 옛 표가 없는지까지 본다.
 */
import type { DatabaseSync } from 'node:sqlite'

import { closeBossProfitDb, getBossProfitDb } from '../db'
import { __setMigrationCeilingForTest, DB_VERSION } from '../migrations'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

const LEGACY_TABLES = [
  'boss_profit_records',
  'boss_party_settings',
  'boss_party_period_overrides',
  'boss_drop_records',
  'income_records',
  'spend_records',
]

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
})

afterEach(async () => {
  __setMigrationCeilingForTest(null)
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

type Row = Record<string, unknown>

function all(sql: string): Row[] {
  return real.inspect((db) => db.prepare(sql).all() as Row[])
}

function legacyObjectsLeft(): string[] {
  return all(`SELECT name FROM sqlite_master WHERE name IN (${[...LEGACY_TABLES, 'boss_drop_records_group'].map((name) => `'${name}'`).join(', ')})`).map(
    (row) => String(row.name),
  )
}

/** 버전 13 기기를 만든다. 그 버전까지만 이관한 DB 의 옛 표에 행을 넣는다. */
async function seedVersion13(seed: (db: DatabaseSync) => void): Promise<void> {
  __setMigrationCeilingForTest(13)
  await getBossProfitDb()
  await closeBossProfitDb()
  real.inspect(seed)
  __setMigrationCeilingForTest(null)
}

function seedLegacyRecords(db: DatabaseSync): void {
  db.exec(`INSERT INTO boss_party_settings (ocid, boss_key, boss, difficulty, party_size, updated_at)
    VALUES ('ocid-1', 'lotus', '스우', 'hard', 2, '2026-10-01T00:00:00Z')`)
  db.exec(`INSERT INTO boss_profit_records (ocid, boss_key, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, recorded_at, world_key)
    VALUES ('ocid-1', 'lotus', '스우', 'hard', 'weekly', '2026-10-02', 2, 100, 50, '2026-10-03T00:00:00Z', 'elysium')`)
  db.exec(`INSERT INTO boss_drop_records (drop_record_id, ocid, boss_key, boss, difficulty, period_key, drop_index, category, item_key, item_name, quantity, recorded_at, price_state, price_meso, price_split_mode, price_party_size, price_share)
    VALUES ('d1', 'ocid-1', 'lotus', '스우', 'hard', '2026-10-02', 0, 'equipment', 'item_a', 'A', 1, '2026-10-03T00:00:00Z', 'entered', 5000, 'even', 2, 2)`)
  db.exec(`INSERT INTO spend_records (id, ocid, spent_on, category, category_key, item, item_key, quantity, meso_amount, recorded_at)
    VALUES ('s1', 'ocid-1', '2026-10-01', '버프', 'buff', '세이람의 영약', 'seiram_elixir', 1, 2000000, '2026-10-01T01:00:00.000Z')`)
  db.exec(`INSERT INTO income_records (id, ocid, earned_on, category, category_key, item, meso_amount, recorded_at)
    VALUES ('i1', NULL, '2026-10-02', '기타', 'etc', '옛 수입', 300, '2026-10-02T00:00:00.000Z')`)
}

describe('버전 23: 옛 보스 표 넷과 옛 가계부 표 둘을 지운다', () => {
  it('옛 기록을 심은 버전 13 기기가 끝까지 오르면 옛 표와 옛 인덱스가 없고, 기록은 새 표에 남는다', async () => {
    await seedVersion13(seedLegacyRecords)

    await getBossProfitDb()

    expect(legacyObjectsLeft()).toEqual([])
    expect(all(`SELECT clear_status, payout_meso FROM boss_party_periods`)).toEqual([{ clear_status: 'cleared', payout_meso: 50 }])
    expect(all(`SELECT id FROM boss_drops`)).toEqual([{ id: 'd1' }])
    expect(all(`SELECT entry_type FROM cashbook_entries ORDER BY entry_type`)).toEqual([
      { entry_type: 'income' },
      { entry_type: 'spend' },
    ])
    expect(all('PRAGMA user_version')).toEqual([{ user_version: DB_VERSION }])
  })

  it('다시 열어도 옛 표를 만들지 않고 칸도 더하지 않는다', async () => {
    await seedVersion13(seedLegacyRecords)
    await getBossProfitDb()
    await closeBossProfitDb()
    real.statements.length = 0

    await getBossProfitDb()

    expect(legacyObjectsLeft()).toEqual([])
    const touchingLegacy = real.statements.filter((statement) =>
      LEGACY_TABLES.some((table) => new RegExp(`\\b${table}\\b`).test(statement)),
    )
    expect(touchingLegacy).toEqual([])
  })

  it('새 기기도 옛 표 없이 마지막 버전이 된다', async () => {
    await getBossProfitDb()

    expect(legacyObjectsLeft()).toEqual([])
    expect(all('PRAGMA user_version')).toEqual([{ user_version: DB_VERSION }])
  })
})
