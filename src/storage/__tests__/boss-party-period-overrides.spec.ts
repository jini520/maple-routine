/// <reference types="node" />
/**
 * 그 기간만 고친 값을 진짜 SQLite 로 태운다. 이 값은 `boss_party_periods` 의 'open' 행 분배 칸이다. 처치한
 * 기간('cleared')과 드롭만 있는 기간(분배 칸이 빔)은 그 기간 값으로 읽히면 안 된다.
 */
import {
  type BossPartyPeriodOverride,
  getBossPartyPeriodOverride,
  getBossPartyPeriodOverrides,
  setBossPartyPeriodOverride,
} from '../boss-party-period-overrides'
import { NO_WORLD, replaceBossDropRecords } from '../boss-drops'
import { getBossProfitRecords, upsertBossProfitRecord } from '../boss-profit'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

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

const AT = '2026-10-03T00:00:00.000Z'

function override(over: Partial<BossPartyPeriodOverride> = {}): BossPartyPeriodOverride {
  return {
    ocid: 'ocid-1',
    bossKey: 'lucid',
    difficulty: 'hard',
    periodKey: '2026-10-02',
    partySize: 3,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    updatedAt: AT,
    ...over,
  }
}

describe('setBossPartyPeriodOverride', () => {
  it('같은 기간을 다시 고치면 덮고, 비율과 자동 수수료를 함께 적는다', async () => {
    await setBossPartyPeriodOverride(override())
    await setBossPartyPeriodOverride(override({ partySize: 4, crystalMyShare: 1, crystalSharesTotal: 4, splitFeePercent: 5, splitFeeAuto: true }))

    expect(await getBossPartyPeriodOverride('ocid-1', 'lucid', 'hard', '2026-10-02')).toEqual(
      override({ partySize: 4, crystalMyShare: 1, crystalSharesTotal: 4, splitFeePercent: 5, splitFeeAuto: true }),
    )
  })

  it('처치한 기간은 건드리지 않는다', async () => {
    await upsertBossProfitRecord({
      ocid: 'ocid-1', bossKey: 'lucid', boss: '', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-02',
      partySize: 2, priceMeso: 10, payoutMeso: 5, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null,
      recordedAt: AT, world: null, worldKey: null,
    })

    await setBossPartyPeriodOverride(override({ partySize: 6 }))

    expect((await getBossProfitRecords(['ocid-1'], ['2026-10-02']))[0].partySize).toBe(2)
    expect(await getBossPartyPeriodOverride('ocid-1', 'lucid', 'hard', '2026-10-02')).toBeNull()
  })
})

describe('getBossPartyPeriodOverrides', () => {
  it('그 기간 값만 준다. 처치한 기간과 드롭만 있는 기간은 안 준다', async () => {
    await setBossPartyPeriodOverride(override())
    await setBossPartyPeriodOverride(override({ ocid: 'ocid-2', periodKey: '2026-10' }))
    await replaceBossDropRecords('ocid-1', 'will', 'hard', '2026-10-02', [
      { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)

    const read = await getBossPartyPeriodOverrides(['ocid-1', 'ocid-2'], ['2026-10-02', '2026-10'])
    expect(read.map((row) => [row.ocid, row.bossKey, row.periodKey])).toEqual(
      expect.arrayContaining([['ocid-1', 'lucid', '2026-10-02'], ['ocid-2', 'lucid', '2026-10']]),
    )
    expect(read).toHaveLength(2)
  })

  it('캐릭터나 기간이 비면 조회하지 않는다', async () => {
    expect(await getBossPartyPeriodOverrides([], ['2026-10-02'])).toEqual([])
    expect(await getBossPartyPeriodOverrides(['ocid-1'], [])).toEqual([])
  })
})
