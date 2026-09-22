/// <reference types="node" />
/**
 * 수수료가 자동인 기록을 읽고 고쳐 쓰는 저장 연산을 진짜 SQLite 로 태우는 자리.
 */
import { closeBossProfitDb } from '../db'
import { __resetStoragePortsForTest, setSqlitePort } from '../../ports'
import { type IncomeRecord, getAutoFeeIncomeRecords, getIncomeRecordsBetween, insertIncomeRecord, updateIncomeSaleFee } from '../../income'
import { getAutoFeeDropRecords, getBossDropRecords, replaceBossDropRecords, updateDropFees } from '../../boss-drops'
import {
  type BossProfitRecord,
  getAutoFeeProfitRecords,
  getBossProfitRecords,
  updateProfitSplitFees,
  upsertBossProfitRecord,
} from '../../boss-profit'
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

const sale: IncomeRecord = {
  id: 'sale-auto',
  ocid: 'ocid-1',
  earnedOn: '2026-08-23',
  category: 'item_sale',
  item: '앱솔랩스 케이프',
  itemKey: null,
  mesoAmount: 1_140_000_000,
  saleFeePercent: 5,
  saleFeeMeso: 60_000_000,
  saleFeeAuto: true,
  pointAmount: null,
  pointPer100mMeso: null,
  cashAmount: null,
  quantity: null,
  hunt: null,
  memo: null,
  recordedAt: '2026-08-23T05:00:00.000Z',
}

describe('수입의 자동 수수료', () => {
  it('자동인 기록만 읽고, 세 칸을 고쳐 쓴다', async () => {
    await insertIncomeRecord(sale)
    await insertIncomeRecord({ ...sale, id: 'sale-manual', saleFeeAuto: false })

    const auto = await getAutoFeeIncomeRecords()
    expect(auto.map((record) => record.id)).toEqual(['sale-auto'])

    await updateIncomeSaleFee('sale-auto', { mesoAmount: 1_164_000_000, saleFeePercent: 3, saleFeeMeso: 36_000_000 })
    const [updated] = (await getIncomeRecordsBetween('2026-08-23', '2026-08-23')).filter((record) => record.id === 'sale-auto')
    expect(updated).toMatchObject({ mesoAmount: 1_164_000_000, saleFeePercent: 3, saleFeeMeso: 36_000_000, saleFeeAuto: true })
  })
})

describe('드롭의 자동 수수료', () => {
  it('두 칸 중 하나라도 자동인 기록을 읽고, 두 요율을 고쳐 쓴다', async () => {
    const base = { category: 'equipment' as const, itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', quantity: 1 }
    await replaceBossDropRecords('ocid-1', 'lotus', 'hard', '2026-08-06', [
      { ...base, priceState: 'entered', priceMeso: 1_000_000_000, priceShare: 2, saleFeePercent: 5, splitFeePercent: 5, saleFeeAuto: true },
      { ...base, priceState: 'entered', priceMeso: 1_000_000_000, priceShare: 2, saleFeePercent: 3, splitFeePercent: 3 },
    ], '2026-08-10T00:00:00.000Z')

    const auto = await getAutoFeeDropRecords()
    expect(auto.map((record) => record.dropIndex)).toEqual([0])

    await updateDropFees([{ ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', dropIndex: 0, saleFeePercent: 3, splitFeePercent: 5 }])
    const [first] = await getBossDropRecords(['ocid-1'], ['2026-08-06'])
    expect(first).toMatchObject({ saleFeePercent: 3, splitFeePercent: 5, saleFeeAuto: true, splitFeeAuto: false })
  })
})

describe('결정석의 자동 송금 수수료', () => {
  const crystal: BossProfitRecord = {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: '2026-08-06',
    partySize: 2,
    priceMeso: 1_000_000,
    payoutMeso: 600_000,
    crystalMyShare: 2,
    crystalSharesTotal: 3,
    splitFeePercent: 5,
    splitFeeAuto: true,
    recordedAt: '2026-08-07T00:00:00.000Z',
    world: null,
    worldKey: null,
  }

  it('자동인 기록을 읽고 요율과 받은 몫을 고쳐 쓴다', async () => {
    await upsertBossProfitRecord(crystal)
    await upsertBossProfitRecord({ ...crystal, bossKey: 'demian', boss: '데미안', splitFeeAuto: false })

    const auto = await getAutoFeeProfitRecords()
    expect(auto.map((record) => record.bossKey)).toEqual(['lotus'])

    await updateProfitSplitFees([{ ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-08-06', splitFeePercent: 3, payoutMeso: 610_000 }])
    const records = await getBossProfitRecords(['ocid-1'], ['2026-08-06'])
    expect(records.find((record) => record.bossKey === 'lotus')).toMatchObject({ splitFeePercent: 3, payoutMeso: 610_000, splitFeeAuto: true })
  })
})
