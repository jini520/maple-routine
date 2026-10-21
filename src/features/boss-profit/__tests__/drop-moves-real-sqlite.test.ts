/// <reference types="node" />
/**
 * 드롭을 다른 기간 행으로 옮기는 흐름을 진짜 SQLite 로 태운다. 처치 난이도가 확정되거나 직접 완료의 난이도를
 * 고치면, 드롭이 자기 식별자를 들고 새 난이도의 기간 행으로 옮겨 가고 옛 기간 행은 지워져야 한다.
 */
import { migrateDropsToConfirmedDifficulty } from '../drops-loader'
import { cancelManualCompletion, saveManualCompletion, type ManualCompletionInput } from '../../manual-completion/record'
import { getBossProfitRecords } from '../../../storage/boss-profit'
import { NO_WORLD, getAllBossDropRecords, replaceBossDropRecords } from '../../../storage/boss-drops'
import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { closeBossProfitDb } from '../../../storage/sqlite/db'
import { createRealSqlite, type RealSqlite } from '../../../storage/sqlite/__tests__/node-sqlite-port'

jest.mock('../../server-sync/drop-price-sync', () => ({
  reportDropPrice: jest.fn(),
  reportDropRemoved: jest.fn(),
}))

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
const NOW = new Date('2026-10-05T00:00:00.000Z')

describe('난이도 확정 이관', () => {
  it('드롭이 식별자와 가격을 들고 확정 난이도로 옮겨 가고, 옛 기간 행은 지워진다', async () => {
    await replaceBossDropRecords('o', 'lucid', 'hard', '2026-10-02', [
      {
        dropRecordId: null, category: 'equipment', itemKey: 'twilight_mark', itemName: '', quantity: 1,
        priceState: 'entered', priceMeso: 5_000, priceSplitMode: 'even', pricePartySize: 2,
      },
    ], AT, { name: '엘리시움', key: 'elysium' })
    const before = await getAllBossDropRecords(['o'])

    await migrateDropsToConfirmedDifficulty({ ocid: 'o', bossKey: 'lucid', difficulty: 'normal', periodKey: '2026-10-02' }, before, NOW)

    const after = await getAllBossDropRecords(['o'])
    expect(after.map((row) => [row.difficulty, row.dropRecordId, row.priceMeso])).toEqual([
      ['normal', before[0].dropRecordId, 5_000],
    ])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_party_periods').get())).toEqual({ n: 1 })
  })

  it('확정 난이도에서 못 얻는 드롭은 옮기지 않고 지운다', async () => {
    await replaceBossDropRecords('o', 'lucid', 'hard', '2026-10-02', [
      { dropRecordId: null, category: 'equipment', itemKey: 'dreamy_belt', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)
    const before = await getAllBossDropRecords(['o'])

    await migrateDropsToConfirmedDifficulty({ ocid: 'o', bossKey: 'lucid', difficulty: 'normal', periodKey: '2026-10-02' }, before, NOW)

    expect(await getAllBossDropRecords(['o'])).toEqual([])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_party_periods').get())).toEqual({ n: 0 })
  })
})

describe('직접 완료', () => {
  const input: ManualCompletionInput = {
    ocid: 'o',
    bossKey: 'lucid',
    bossName: '루시드',
    cycle: 'weekly',
    periodKey: '2026-10-02',
    difficulty: 'hard',
    partySize: 1,
    shares: { myShare: null, sharesTotal: null, splitFeePercent: null },
    defeatedOn: '2026-10-03',
    world: null,
    worldKey: null,
  }

  async function seedDrop(difficulty: string): Promise<string> {
    const [id] = await replaceBossDropRecords('o', 'lucid', difficulty, '2026-10-02', [
      { dropRecordId: null, category: 'equipment', itemKey: 'twilight_mark', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)
    return id
  }

  it('난이도를 고치면 처치와 드롭이 새 난이도로 옮겨 가고 옛 기간 행은 남지 않는다', async () => {
    await saveManualCompletion(input, NOW)
    const id = await seedDrop('hard')

    await saveManualCompletion({ ...input, difficulty: 'normal', previousDifficulty: 'hard' }, NOW)

    expect((await getBossProfitRecords(['o'], ['2026-10-02'])).map((row) => [row.difficulty, row.defeatedOn])).toEqual([
      ['normal', '2026-10-03'],
    ])
    expect((await getAllBossDropRecords(['o'])).map((row) => [row.difficulty, row.dropRecordId])).toEqual([['normal', id]])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_party_periods').get())).toEqual({ n: 1 })
  })

  it('취소하면 처치와 드롭이 사라지고 기간 행도 남지 않는다', async () => {
    await saveManualCompletion(input, NOW)
    await seedDrop('hard')

    await cancelManualCompletion({ ocid: 'o', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-02' }, NOW)

    expect(await getBossProfitRecords(['o'], ['2026-10-02'])).toEqual([])
    expect(await getAllBossDropRecords(['o'])).toEqual([])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_party_periods').get())).toEqual({ n: 0 })
  })
})
