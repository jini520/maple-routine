/// <reference types="node" />
/**
 * 서버로 보낼 기록을 기기 표에서 읽는 자리를 진짜 SQLite 로 태운다. 과거 올리기가 id 차례를 지키지 않으면 어디까지 보냈는지
 * 하나로 들 수 없다.
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import { getDropPeriodId, listRecordIdsAfter } from '../../server-sync-sources'
import { createRealSqlite, type RealSqlite } from './node-sqlite-port'

let real: RealSqlite

beforeEach(async () => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  await getBossProfitDb()
  real.inspect((db) => {
    db.exec(`INSERT INTO boss_parties (id, ocid, boss_key, difficulty, created_at, updated_at) VALUES ('p', 'ocid-1', 'lucid', 'hard', 't', 't')`)
    db.exec(`INSERT INTO boss_party_periods
      (id, party_id, period_key, cycle, clear_status, price_meso, payout_meso, defeated_date, source, split_mode, party_size, my_share, shares_total, split_fee_percent, world_key, created_at, updated_at)
      VALUES
      ('pe-a', 'p', '2026-10-15', 'weekly', 'cleared', 300, 150, NULL, 'auto', 'even', 2, NULL, NULL, NULL, NULL, 't', 't'),
      ('pe-c', 'p', '2026-10-08', 'weekly', 'open', NULL, NULL, NULL, NULL, 'even', 2, NULL, NULL, NULL, NULL, 't', 't')`)
    db.exec(`INSERT INTO boss_drops (id, period_id, sort_order, category, item_key, record_status, created_at, updated_at)
      VALUES ('d-2', 'pe-a', 0, 'equipment', 'dreamy_belt', 'pending', 't', 't'),
             ('d-1', 'pe-c', 0, 'equipment', 'dreamy_belt', 'pending', 't', 't')`)
  })
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('과거 올리기는 드롭을 id 차례로 나눠 읽는다', async () => {
  await expect(listRecordIdsAfter('dropPrice', '', 1)).resolves.toEqual(['d-1'])
  await expect(listRecordIdsAfter('dropPrice', 'd-1', 10)).resolves.toEqual(['d-2'])
})

it('드롭이 붙은 기간 행 id 를 읽고, 없는 드롭은 null 이다', async () => {
  await expect(getDropPeriodId('d-1')).resolves.toBe('pe-c')
  await expect(getDropPeriodId('없음')).resolves.toBeNull()
})
