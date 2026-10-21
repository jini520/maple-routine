/// <reference types="node" />
/**
 * 캐시 데이터 삭제가 보스 기록 새 표 셋을 행 단위로 지우는지 진짜 SQLite 로 본다.
 *
 * 한 표 안에 두 그룹이 섞여 있다. 보스 관리 설정과 그 기간 값은 `일반`, 처치와 드롭은 `기록` 이다. 표를 통째로
 * 지우면 외래키를 따라 다른 그룹의 행까지 사라진다.
 */
import { installFakePreferences } from './fake-preferences'
import { clearCacheData, getCacheDataSizes } from '../cache-data'
import { NO_WORLD, getBossDropRecords, replaceBossDropRecords } from '../boss-drops'
import { getBossPartyPeriodOverrides, setBossPartyPeriodOverride } from '../boss-party-period-overrides'
import { getBossPartySettings, setBossPartySetting } from '../boss-party-settings'
import { getBossProfitRecords, upsertBossProfitRecord } from '../boss-profit'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  installFakePreferences()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const AT = '2026-10-03T00:00:00.000Z'
const PERIODS = ['2026-10-02', '2026-10-09']

async function seed(): Promise<void> {
  await setBossPartySetting({ ocid: 'o', bossKey: 'lucid', difficulty: 'hard', partySize: 2, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: AT })
  await upsertBossProfitRecord({
    ocid: 'o', bossKey: 'lucid', boss: '', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-02',
    partySize: 2, priceMeso: 10, payoutMeso: 5, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null,
    recordedAt: AT, world: null, worldKey: null,
  })
  await replaceBossDropRecords('o', 'lucid', 'hard', '2026-10-02', [
    { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
  ], AT, NO_WORLD)
  await setBossPartyPeriodOverride({ ocid: 'o', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-09', partySize: 4, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: AT })
  // 드롭만 있는 기간에 그 기간 값도 있다.
  await setBossPartyPeriodOverride({ ocid: 'o', bossKey: 'will', difficulty: 'hard', periodKey: '2026-10-09', partySize: 3, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: AT })
  await replaceBossDropRecords('o', 'will', 'hard', '2026-10-09', [
    { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
  ], AT, NO_WORLD)
}

function count(table: string): number {
  return real.inspect((db) => (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n)
}

describe('보스 기록 새 표 셋의 캐시 삭제', () => {
  it('일반만 지우면 보스 관리 설정과 그 기간 값만 사라지고 처치와 드롭은 남는다', async () => {
    await seed()

    await clearCacheData({ general: true, records: false })

    expect(await getBossPartySettings(['o'])).toEqual([])
    expect(await getBossPartyPeriodOverrides(['o'], PERIODS)).toEqual([])
    expect(await getBossProfitRecords(['o'], PERIODS)).toHaveLength(1)
    expect(await getBossDropRecords(['o'], PERIODS)).toHaveLength(2)
  })

  it('기록만 지우면 처치와 드롭만 사라지고 보스 관리 설정과 그 기간 값은 남는다', async () => {
    await seed()

    await clearCacheData({ general: false, records: true })

    expect(await getBossProfitRecords(['o'], PERIODS)).toEqual([])
    expect(await getBossDropRecords(['o'], PERIODS)).toEqual([])
    expect((await getBossPartySettings(['o'])).map((row) => row.partySize)).toEqual([2])
    expect((await getBossPartyPeriodOverrides(['o'], PERIODS)).map((row) => [row.bossKey, row.partySize]).sort()).toEqual([
      ['lucid', 4],
      ['will', 3],
    ])
  })

  it('둘 다 지우면 세 표가 빈다', async () => {
    await seed()

    await clearCacheData({ general: true, records: true })

    expect([count('boss_parties'), count('boss_party_periods'), count('boss_drops')]).toEqual([0, 0, 0])
  })

  it('크기는 행이 속한 그룹에 센다', async () => {
    const before = await getCacheDataSizes()
    await seed()
    const after = await getCacheDataSizes()

    expect(after.general).toBeGreaterThan(before.general)
    expect(after.records).toBeGreaterThan(before.records)

    await clearCacheData({ general: false, records: true })
    expect((await getCacheDataSizes()).records).toBe(before.records)
  })
})
