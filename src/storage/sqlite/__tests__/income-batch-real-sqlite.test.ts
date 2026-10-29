/// <reference types="node" />
/**
 * 수입 기록 여러 건을 한 번에 넣는 저장을 진짜 SQLite 로 태운다. 사냥 전리품 판매가 아이템마다 한 줄씩 적는다.
 */
import { getIncomeRecordsBetween, insertIncomeRecords, type IncomeRecord } from '../../income'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { closeBossProfitDb } from '../db'
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

const 우유: IncomeRecord = {
  id: '2b7c3f0e-6d1a-4c8e-9a51-0f3e2d1c4b5a',
  ocid: 'ocid-1',
  earnedOn: '2026-10-29',
  category: 'hunt_loot_sale',
  item: null,
  itemKey: 'reindeer_milk',
  mesoAmount: 825_000,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  quantity: 300,
  itemKind: null,
  saleFeePercent: null,
  saleFeeMeso: null,
  saleFeeAuto: false,
  hunt: null,
  recordedAt: '2026-10-29T03:00:00.000Z',
}
const 이슬: IncomeRecord = {
  ...우유,
  id: '7e1d2c3b-4a5f-4e6d-8c7b-9a0f1e2d3c4b',
  itemKey: 'sunset_dew',
  mesoAmount: 612_000,
  quantity: 120,
}

describe('insertIncomeRecords', () => {
  it('한 번에 넣은 기록이 따로따로 읽힌다', async () => {
    await insertIncomeRecords([우유, 이슬], 'account-main')

    const rows = await getIncomeRecordsBetween('2026-10-29', '2026-10-29')
    expect(rows.map((row) => [row.itemKey, row.quantity, row.mesoAmount])).toEqual([
      ['reindeer_milk', 300, 825_000],
      ['sunset_dew', 120, 612_000],
    ])
  })

  /** 반만 적히면 한 번 판 것이 가계부에 반만 선다. 다시 적으면 앞의 반이 두 번 선다. */
  it('하나라도 못 넣으면 아무것도 안 남는다', async () => {
    await expect(insertIncomeRecords([우유, { ...이슬, id: 우유.id }], 'account-main')).rejects.toThrow()

    expect(await getIncomeRecordsBetween('2026-10-29', '2026-10-29')).toEqual([])
  })
})
