/// <reference types="node" />
/**
 * 보스 기록 테이블 넷을 새 테이블 셋(`boss_parties` · `boss_party_periods` · `boss_drops`)으로 옮기는
 * 버전 14 를 진짜 SQLite 로 태우는 자리.
 *
 * 옛 행을 심고 버전 13 으로 되돌린 뒤 다시 열어, 새 테이블에서 옛 테이블 모양을 되짚어 원본과 견준다.
 * 지우기로 한 칸(이름 · `quantity` · `slot`)은 견주지 않는다.
 */
import type { DatabaseSync } from 'node:sqlite'

import { closeBossProfitDb, getBossProfitDb } from '../db'
import { DB_VERSION } from '../migrations'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
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

/** 버전 13 기기를 만든다. 옛 테이블에 행을 넣고 버전을 되돌린다. */
async function seedVersion13(seed: (db: DatabaseSync) => void): Promise<void> {
  await getBossProfitDb()
  await closeBossProfitDb()
  real.inspect((db) => {
    // 새 테이블은 지금 코드가 이미 만들었다. 이관 전 기기처럼 비운다.
    db.exec('DELETE FROM boss_drops; DELETE FROM boss_party_periods; DELETE FROM boss_parties;')
    seed(db)
    db.exec('PRAGMA user_version = 13')
  })
}

const PROFIT_COLUMNS =
  'ocid, boss_key, boss, difficulty, cycle, period_key, party_size, price_meso, payout_meso, crystal_my_share, crystal_shares_total, split_fee_percent, split_fee_auto, recorded_at, world, world_key, defeated_on, source'
const DROP_COLUMNS =
  'drop_record_id, ocid, boss_key, boss, difficulty, period_key, drop_index, category, item_key, item_name, box_origin_key, box_origin, ring_level, quantity, recorded_at, world, world_key, price_state, price_meso, price_split_mode, price_party_size, price_share, price_my_share, sale_fee_percent, split_fee_percent, sale_fee_auto, split_fee_auto'

function seedEdgeCases(db: DatabaseSync): void {
  // A: 설정 비율 2:5, 같은 기간 처치(비율), 드롭 셋(미입력 · 비율로 매김 · 옛 값 skipped)
  db.exec(`INSERT INTO boss_party_settings (ocid, boss_key, boss, difficulty, party_size, crystal_my_share, crystal_shares_total, split_fee_percent, split_fee_auto, updated_at)
    VALUES ('A', 'lotus', '스우', 'hard', 3, 2, 5, 5, NULL, '2026-10-01T00:00:00Z')`)
  db.exec(`INSERT INTO boss_profit_records (${PROFIT_COLUMNS}) VALUES
    ('A', 'lotus', '스우', 'hard', 'weekly', '2026-10-02', 3, 100, 40, 2, 5, 5, NULL, '2026-10-03T00:00:00Z', '엘리시움', 'elysium', '2026-10-03', 'manual')`)
  db.exec(`INSERT INTO boss_drop_records (${DROP_COLUMNS}) VALUES
    ('d1', 'A', 'lotus', '스우', 'hard', '2026-10-02', 0, 'equipment', 'item_a', 'A', NULL, NULL, NULL, 1, '2026-10-03T00:00:00Z', NULL, NULL, NULL, NULL, 'even', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('d2', 'A', 'lotus', '스우', 'hard', '2026-10-02', 1, 'equipment', 'item_b', 'B', 'box_x', '상자', 3, 1, '2026-10-03T00:00:00Z', NULL, NULL, 'entered', 5000, 'ratio', 3, 5, 2, 5, 3, 1, NULL),
    ('d3', 'A', 'lotus', '스우', 'hard', '2026-10-02', 2, 'consumable', 'item_c', 'C', NULL, NULL, NULL, 1, '2026-10-03T00:00:00Z', NULL, NULL, 'skipped', NULL, 'even', NULL, NULL, NULL, NULL, NULL, NULL, NULL)`)
  // B: 설정도 처치도 없이 드롭만(결정석 가격을 모르는 보스), 월드 모름
  db.exec(`INSERT INTO boss_drop_records (${DROP_COLUMNS}) VALUES
    ('d4', 'B', 'seren', '세렌', 'hard', '2026-10-09', 0, 'fixed', 'item_d', 'D', NULL, NULL, NULL, 1, '2026-10-10T00:00:00Z', NULL, NULL, 'entered', 700, 'even', 2, 2, NULL, NULL, NULL, NULL, NULL)`)
  // C: 그 기간 값만(미완료 행에서 고친 값), 설정 있음
  db.exec(`INSERT INTO boss_party_settings (ocid, boss_key, boss, difficulty, party_size, updated_at)
    VALUES ('C', 'kalos', '칼로스', 'normal', 2, '2026-10-01T00:00:00Z')`)
  db.exec(`INSERT INTO boss_party_period_overrides (ocid, boss_key, difficulty, period_key, party_size, crystal_my_share, crystal_shares_total, split_fee_percent, split_fee_auto, updated_at)
    VALUES ('C', 'kalos', 'normal', '2026-10-16', 4, NULL, NULL, NULL, NULL, '2026-10-17T00:00:00Z')`)
  // D: 월간 처치, key 없는 옛 드롭, 0메소로 매긴 드롭
  db.exec(`INSERT INTO boss_profit_records (${PROFIT_COLUMNS}) VALUES
    ('D', 'black_mage', '검은 마법사', 'extreme', 'monthly', '2026-10', 1, 9, 9, NULL, NULL, NULL, NULL, '2026-10-05T00:00:00Z', '스카니아', 'scania', NULL, NULL)`)
  db.exec(`INSERT INTO boss_drop_records (${DROP_COLUMNS}) VALUES
    ('d5', 'D', 'black_mage', '검은 마법사', 'extreme', '2026-10', 0, 'equipment', NULL, '옛 아이템', NULL, NULL, NULL, 1, '2026-10-05T00:00:00Z', '스카니아', 'scania', 'entered', 100, 'even', 1, 1, NULL, NULL, NULL, NULL, NULL),
    ('d6', 'D', 'black_mage', '검은 마법사', 'extreme', '2026-10', 1, 'equipment', 'item_e', 'E', NULL, NULL, NULL, 1, '2026-10-05T00:00:00Z', '스카니아', 'scania', 'entered', 0, 'even', 1, 1, NULL, NULL, NULL, NULL, NULL)`)
  // E: 그 기간 값과 처치가 같은 기간에 둘 다 있다
  db.exec(`INSERT INTO boss_party_period_overrides (ocid, boss_key, difficulty, period_key, party_size, crystal_my_share, crystal_shares_total, split_fee_percent, split_fee_auto, updated_at)
    VALUES ('E', 'kalos', 'normal', '2026-09-24', 2, 2, 3, 3, 1, '2026-09-25T00:00:00Z')`)
  db.exec(`INSERT INTO boss_profit_records (${PROFIT_COLUMNS}) VALUES
    ('E', 'kalos', '칼로스', 'normal', 'weekly', '2026-09-24', 2, 50, 30, 2, 3, 3, 1, '2026-09-26T00:00:00Z', '엘리시움', 'elysium', NULL, 'auto')`)
}

/** 새 테이블에서 되짚은 옛 처치 기록. 이름 칸은 뺀다. */
const LEGACY_PROFIT = `
  SELECT pa.ocid, pa.boss_key, pa.difficulty, pe.cycle, pe.period_key, pe.party_size, pe.price_meso, pe.payout_meso,
         pe.my_share AS crystal_my_share, pe.shares_total AS crystal_shares_total, pe.split_fee_percent, pe.split_fee_auto,
         pe.created_at AS recorded_at, pe.world_key, pe.defeated_date AS defeated_on, pe.source
    FROM boss_party_periods pe JOIN boss_parties pa ON pa.id = pe.party_id
   WHERE pe.clear_status = 'cleared' ORDER BY pa.ocid`

describe('버전 14: 보스 기록 테이블 넷을 셋으로 옮긴다', () => {
  it('처치 기록은 값 그대로 cleared 기간 행이 되고, source 가 비었으면 auto 다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()

    expect(all(LEGACY_PROFIT)).toEqual([
      { ocid: 'A', boss_key: 'lotus', difficulty: 'hard', cycle: 'weekly', period_key: '2026-10-02', party_size: 3, price_meso: 100, payout_meso: 40, crystal_my_share: 2, crystal_shares_total: 5, split_fee_percent: 5, split_fee_auto: null, recorded_at: '2026-10-03T00:00:00Z', world_key: 'elysium', defeated_on: '2026-10-03', source: 'manual' },
      { ocid: 'D', boss_key: 'black_mage', difficulty: 'extreme', cycle: 'monthly', period_key: '2026-10', party_size: 1, price_meso: 9, payout_meso: 9, crystal_my_share: null, crystal_shares_total: null, split_fee_percent: null, split_fee_auto: null, recorded_at: '2026-10-05T00:00:00Z', world_key: 'scania', defeated_on: null, source: 'auto' },
      // 같은 기간의 그 기간 값은 처치 기록에 합쳐진다. 처치 기록의 값이 이긴다.
      { ocid: 'E', boss_key: 'kalos', difficulty: 'normal', cycle: 'weekly', period_key: '2026-09-24', party_size: 2, price_meso: 50, payout_meso: 30, crystal_my_share: 2, crystal_shares_total: 3, split_fee_percent: 3, split_fee_auto: 1, recorded_at: '2026-09-26T00:00:00Z', world_key: 'elysium', defeated_on: null, source: 'auto' },
    ])
    expect(all(`SELECT split_mode FROM boss_party_periods WHERE clear_status = 'cleared' ORDER BY created_at`).map((row) => row.split_mode))
      .toEqual(['ratio', 'ratio', 'even'])
  })

  it('보스 관리 설정은 조합 행이 되고, 설정 없이 기록만 있는 조합은 분배 칸이 빈 조합 행이 된다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()

    expect(all(`SELECT ocid, boss_key, difficulty, split_mode, party_size, my_share, shares_total, split_fee_percent FROM boss_parties ORDER BY ocid`)).toEqual([
      { ocid: 'A', boss_key: 'lotus', difficulty: 'hard', split_mode: 'ratio', party_size: 3, my_share: 2, shares_total: 5, split_fee_percent: 5 },
      { ocid: 'B', boss_key: 'seren', difficulty: 'hard', split_mode: null, party_size: null, my_share: null, shares_total: null, split_fee_percent: null },
      { ocid: 'C', boss_key: 'kalos', difficulty: 'normal', split_mode: 'even', party_size: 2, my_share: null, shares_total: null, split_fee_percent: null },
      { ocid: 'D', boss_key: 'black_mage', difficulty: 'extreme', split_mode: null, party_size: null, my_share: null, shares_total: null, split_fee_percent: null },
      { ocid: 'E', boss_key: 'kalos', difficulty: 'normal', split_mode: null, party_size: null, my_share: null, shares_total: null, split_fee_percent: null },
    ])
  })

  it('그 기간 값은 분배 칸이 찬 open 행이 되고, 드롭만 있는 기간은 분배 칸이 빈 open 행이 된다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()

    expect(all(`SELECT pa.ocid, pe.period_key, pe.cycle, pe.world_key, pe.split_mode, pe.party_size, pe.price_meso, pe.source
                  FROM boss_party_periods pe JOIN boss_parties pa ON pa.id = pe.party_id
                 WHERE pe.clear_status = 'open' ORDER BY pa.ocid`)).toEqual([
      { ocid: 'B', period_key: '2026-10-09', cycle: 'weekly', world_key: null, split_mode: null, party_size: null, price_meso: null, source: null },
      { ocid: 'C', period_key: '2026-10-16', cycle: 'weekly', world_key: null, split_mode: 'even', party_size: 4, price_meso: null, source: null },
    ])
  })

  it('드롭은 상태를 서버 값으로 옮기고, 매기지 않은 드롭의 분배 칸은 버린다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()

    expect(all(`SELECT d.id, pa.ocid, pe.period_key, d.sort_order, d.item_key, d.box_origin_key, d.ring_level, d.record_status, d.price_meso, d.priced_at,
                       d.split_mode, d.party_size, d.my_share, d.shares_total, d.sale_fee_percent, d.split_fee_percent, d.sale_fee_auto, d.created_at
                  FROM boss_drops d JOIN boss_party_periods pe ON pe.id = d.period_id JOIN boss_parties pa ON pa.id = pe.party_id
                 ORDER BY d.id`)).toEqual([
      { id: 'd1', ocid: 'A', period_key: '2026-10-02', sort_order: 0, item_key: 'item_a', box_origin_key: null, ring_level: null, record_status: 'pending', price_meso: null, priced_at: null, split_mode: null, party_size: null, my_share: null, shares_total: null, sale_fee_percent: null, split_fee_percent: null, sale_fee_auto: null, created_at: '2026-10-03T00:00:00Z' },
      { id: 'd2', ocid: 'A', period_key: '2026-10-02', sort_order: 1, item_key: 'item_b', box_origin_key: 'box_x', ring_level: 3, record_status: 'completed', price_meso: 5000, priced_at: '2026-10-03T00:00:00Z', split_mode: 'ratio', party_size: 3, my_share: 2, shares_total: 5, sale_fee_percent: 5, split_fee_percent: 3, sale_fee_auto: 1, created_at: '2026-10-03T00:00:00Z' },
      { id: 'd3', ocid: 'A', period_key: '2026-10-02', sort_order: 2, item_key: 'item_c', box_origin_key: null, ring_level: null, record_status: 'skipped', price_meso: null, priced_at: null, split_mode: null, party_size: null, my_share: null, shares_total: null, sale_fee_percent: null, split_fee_percent: null, sale_fee_auto: null, created_at: '2026-10-03T00:00:00Z' },
      { id: 'd4', ocid: 'B', period_key: '2026-10-09', sort_order: 0, item_key: 'item_d', box_origin_key: null, ring_level: null, record_status: 'completed', price_meso: 700, priced_at: '2026-10-10T00:00:00Z', split_mode: 'even', party_size: 2, my_share: null, shares_total: null, sale_fee_percent: null, split_fee_percent: null, sale_fee_auto: null, created_at: '2026-10-10T00:00:00Z' },
      // 0메소로 매긴 드롭은 미입력이다. 서버도 그렇게 받았다.
      { id: 'd6', ocid: 'D', period_key: '2026-10', sort_order: 1, item_key: 'item_e', box_origin_key: null, ring_level: null, record_status: 'pending', price_meso: null, priced_at: null, split_mode: null, party_size: null, my_share: null, shares_total: null, sale_fee_percent: null, split_fee_percent: null, sale_fee_auto: null, created_at: '2026-10-05T00:00:00Z' },
    ])
  })

  // 2026-10-19 전의 균등 기록은 내 비율 칸이 차 있고, 수수료가 있으면 그 칸으로 금액을 센다(사용자 결정). 비우면 지난 금액이 바뀐다.
  it('균등인데 내 비율 칸이 찬 옛 드롭은 그 칸을 지킨다', async () => {
    await seedVersion13((db) => {
      db.exec(`INSERT INTO boss_drop_records (${DROP_COLUMNS}) VALUES
        ('old', 'F', 'lucid', '루시드', 'hard', '2026-09-24', 0, 'equipment', 'item_f', 'F', NULL, NULL, NULL, 1, '2026-09-25T00:00:00Z', NULL, NULL, 'entered', 1000, 'even', 3, 3, 2, 5, 3, 1, 1)`)
    })
    await getBossProfitDb()

    expect(all(`SELECT split_mode, party_size, my_share, shares_total FROM boss_drops WHERE id = 'old'`))
      .toEqual([{ split_mode: 'even', party_size: 3, my_share: 2, shares_total: null }])
  })

  it('월드가 없는 드롭은 같은 기간 처치 기록의 월드를 물려받는다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()

    expect(all(`SELECT pe.world_key FROM boss_drops d JOIN boss_party_periods pe ON pe.id = d.period_id WHERE d.id = 'd1'`))
      .toEqual([{ world_key: 'elysium' }])
  })

  it('옛 테이블은 지우지 않는다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()

    expect(all(`SELECT count(*) AS n FROM boss_drop_records`)).toEqual([{ n: 6 }])
    expect(all(`SELECT count(*) AS n FROM boss_profit_records`)).toEqual([{ n: 3 }])
  })

  it('한 번 돈 이관은 다시 안 돈다', async () => {
    await seedVersion13(seedEdgeCases)
    await getBossProfitDb()
    await closeBossProfitDb()
    await getBossProfitDb()

    expect(all(`SELECT count(*) AS n FROM boss_party_periods`)).toEqual([{ n: 5 }])
    expect(all('PRAGMA user_version')).toEqual([{ user_version: DB_VERSION }])
  })
})

describe('새 테이블의 제약', () => {
  async function party(id: string, ocid = 'ocid-1'): Promise<void> {
    await getBossProfitDb()
    real.inspect((db) => db.exec(`INSERT INTO boss_parties (id, ocid, boss_key, difficulty, created_at, updated_at)
      VALUES ('${id}', '${ocid}', 'lucid', 'hard', 't', 't')`))
  }

  it('같은 조합의 조합 행은 둘 생기지 않는다', async () => {
    await party('p1')
    await expect(party('p2')).rejects.toThrow(/UNIQUE/)
  })

  it('기기에서도 외래키를 켜서, 조합 행을 지우면 기간 행과 드롭이 함께 지워진다', async () => {
    await party('p1')
    const db = await getBossProfitDb()
    await db.execute(`INSERT INTO boss_party_periods (id, party_id, period_key, cycle, clear_status, created_at, updated_at)
      VALUES ('pe1', 'p1', '2026-10-02', 'weekly', 'open', 't', 't')`)
    await db.execute(`INSERT INTO boss_drops (id, period_id, sort_order, category, item_key, record_status, created_at, updated_at)
      VALUES ('d1', 'pe1', 0, 'equipment', 'ring', 'pending', 't', 't')`)

    await db.execute(`DELETE FROM boss_parties WHERE id = 'p1'`)

    const { values } = await db.query('SELECT count(*) AS n FROM boss_drops')
    expect(values).toEqual([{ n: 0 }])
    // node:sqlite 는 기본이 켜져 있어 위만으로는 못 가른다. op-sqlite 는 기본이 꺼져 있다.
    expect(real.statements).toContain('PRAGMA foreign_keys = ON')
  })

  it('값을 매긴 드롭만 가격과 분배 칸을 가진다', async () => {
    await party('p1')
    const db = await getBossProfitDb()
    await db.execute(`INSERT INTO boss_party_periods (id, party_id, period_key, cycle, clear_status, created_at, updated_at)
      VALUES ('pe1', 'p1', '2026-10-02', 'weekly', 'open', 't', 't')`)

    await expect(db.execute(`INSERT INTO boss_drops (id, period_id, sort_order, category, item_key, record_status, split_mode, party_size, created_at, updated_at)
      VALUES ('d1', 'pe1', 0, 'equipment', 'ring', 'pending', 'even', 1, 't', 't')`)).rejects.toThrow(/CHECK/)
    await expect(db.execute(`INSERT INTO boss_drops (id, period_id, sort_order, category, item_key, record_status, price_meso, priced_at, created_at, updated_at)
      VALUES ('d2', 'pe1', 0, 'equipment', 'ring', 'completed', 0, 't', 't', 't')`)).rejects.toThrow(/CHECK/)
  })
})
