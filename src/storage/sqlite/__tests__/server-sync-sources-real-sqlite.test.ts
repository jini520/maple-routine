/// <reference types="node" />
/**
 * 서버로 보낼 기록을 기기 표에서 읽는 자리를 진짜 SQLite 로 태운다. 처치가 아닌 기간을 처치로 읽으면 서버에 거짓 처치가 남고,
 * 과거 올리기가 id 차례를 지키지 않으면 어디까지 보냈는지 하나로 들 수 없다.
 */
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb, getBossProfitDb } from '../db'
import {
  findBossPeriodIds,
  getBossClearSource,
  getCashbookEntrySource,
  getDropPeriodId,
  listRecordIdsAfter,
} from '../../server-sync-sources'
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
      ('pe-b', 'p', '2026-10-22', 'weekly', 'cleared', 300, 100, '2026-10-23', 'manual', 'ratio', 3, 1, 3, 3, 'scania', 't', 't'),
      ('pe-a', 'p', '2026-10-15', 'weekly', 'cleared', 300, 150, NULL, 'auto', 'even', 2, NULL, NULL, NULL, NULL, 't', 't'),
      ('pe-c', 'p', '2026-10-08', 'weekly', 'open', NULL, NULL, NULL, NULL, 'even', 2, NULL, NULL, NULL, NULL, 't', 't')`)
    db.exec(`INSERT INTO boss_drops (id, period_id, sort_order, category, item_key, record_status, created_at, updated_at)
      VALUES ('d-1', 'pe-c', 0, 'equipment', 'dreamy_belt', 'pending', 't', 't')`)
    db.exec(`INSERT INTO cashbook_entries (id, ocid, nexon_account_id, entry_type, category_key, entry_date, created_at, updated_at)
      VALUES ('e-1', NULL, 'account-a', 'spend', 'buff', '2026-10-26', 't', 't')`)
    db.exec(`INSERT INTO cashbook_entry_items (id, entry_id, sort_order, item_key, quantity, amount_meso)
      VALUES ('i-1', 'e-1', 0, 'seiram_elixir', 2, 4000000)`)
  })
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

it('처치한 기간만 서버 칸으로 읽고, 처치가 아니거나 없는 기간은 null 이다', async () => {
  await expect(getBossClearSource('pe-b')).resolves.toEqual({
    periodId: 'pe-b',
    ocid: 'ocid-1',
    bossKey: 'lucid',
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: '2026-10-22',
    worldKey: 'scania',
    priceMeso: 300,
    payoutMeso: 100,
    splitMode: 'ratio',
    partySize: 3,
    myShare: 1,
    sharesTotal: 3,
    splitFeePercent: 3,
    defeatedDate: '2026-10-23',
    source: 'manual',
  })
  await expect(getBossClearSource('pe-c')).resolves.toBeNull()
  await expect(getBossClearSource('없음')).resolves.toBeNull()
})

it('키로 기간 행 id 를 찾고, 처치를 취소해 open 인 기간도 돌려준다', async () => {
  await expect(
    findBossPeriodIds([
      { ocid: 'ocid-1', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-08' },
      { ocid: 'ocid-1', bossKey: 'lucid', difficulty: 'hard', periodKey: '1999-01-01' },
    ]),
  ).resolves.toEqual(['pe-c'])
})

it('과거 올리기는 처치한 기간만 id 차례로 나눠 읽는다', async () => {
  await expect(listRecordIdsAfter('bossClear', '', 1)).resolves.toEqual(['pe-a'])
  await expect(listRecordIdsAfter('bossClear', 'pe-a', 10)).resolves.toEqual(['pe-b'])
  await expect(listRecordIdsAfter('dropPrice', '', 10)).resolves.toEqual(['d-1'])
  await expect(listRecordIdsAfter('cashbookEntry', '', 10)).resolves.toEqual(['e-1'])
})

it('드롭의 기간 행과 가계부 기록의 계정을 읽는다', async () => {
  await expect(getDropPeriodId('d-1')).resolves.toBe('pe-c')
  const source = await getCashbookEntrySource('e-1')
  expect(source?.nexonAccountId).toBe('account-a')
  expect(source?.entry.items.map((item) => [item.itemKey, item.amountMeso])).toEqual([['seiram_elixir', 4000000]])
  await expect(getCashbookEntrySource('없음')).resolves.toBeNull()
})
