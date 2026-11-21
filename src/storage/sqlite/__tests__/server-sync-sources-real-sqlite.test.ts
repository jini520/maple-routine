/// <reference types="node" />
/**
 * 서버로 보낼 기록을 기기 표에서 읽는 자리를 진짜 SQLite 로 태운다. 과거 올리기가 id 차례를 지키지 않으면 어디까지 보냈는지
 * 하나로 들 수 없다.
 */
import { bossDifficultyIdOf } from '../../../lib/boss/bosses'
import { findItem } from '../../../lib/item-catalog'
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
    db.exec(`INSERT INTO boss_profit_entries
      (id, ocid, boss_difficulty_id, period_code, clear_recorded_by, crystal_price_meso, crystal_received_meso, split_type, party_size,
       split_fee_follows_mvp_grade, created_at, updated_at)
      VALUES
      ('pe-a', 'ocid-1', '${bossDifficultyIdOf('lucid', 'hard')}', 'W202642', 'auto', 300, 150, 'even', 2, 1, 't', 't'),
      ('pe-c', 'ocid-1', '${bossDifficultyIdOf('lucid', 'hard')}', 'W202641', NULL, NULL, NULL, 'even', 2, 1, 't', 't')`)
    db.exec(`INSERT INTO boss_drops (id, profit_entry_id, item_id, category, price_status, sale_fee_follows_mvp_grade, split_fee_follows_mvp_grade, created_at, updated_at)
      VALUES ('d-2', 'pe-a', '${findItem('dreamy_belt')!.id}', 'equipment', 'pending', 0, 0, 't', 't'),
             ('d-1', 'pe-c', '${findItem('dreamy_belt')!.id}', 'equipment', 'pending', 0, 0, 't', 't')`)
  })
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('과거 올리기는 드롭을 id 차례로 나눠 읽는다', async () => {
  await expect(listRecordIdsAfter('dropPriceOwner', '', 1)).resolves.toEqual(['d-1'])
  await expect(listRecordIdsAfter('dropPriceOwner', 'd-1', 10)).resolves.toEqual(['d-2'])
})

it('드롭이 붙은 수익 건 id 를 읽고, 없는 드롭은 null 이다', async () => {
  await expect(getDropPeriodId('d-1')).resolves.toBe('pe-c')
  await expect(getDropPeriodId('없음')).resolves.toBeNull()
})
