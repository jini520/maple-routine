/// <reference types="node" />
// 주간 결정석 판매 한도를 넘긴 처치를 판정해 기간 행에 적는 흐름. 진짜 SQLite 로 태운다.
//
// 한도는 2 로 줄여 둔다. 90 건을 쌓지 않아도 같은 규칙이 돈다.

import {
  getBossProfitRecords,
  upsertBossProfitRecord,
  type BossProfitRecord,
} from '../../../storage/boss-profit'
import { __resetStoragePortsForTest, setSqlitePort } from '../../../storage/ports'
import { closeBossProfitDb } from '../../../storage/sqlite/db'
import { createRealSqlite, type RealSqlite } from '../../../storage/sqlite/__tests__/node-sqlite-port'

jest.mock('../../../lib/boss/bosses', () => ({
  ...jest.requireActual('../../../lib/boss/bosses'),
  WEEKLY_CRYSTAL_SALE_LIMIT: 2,
}))

jest.mock('../../maple-id/owners', () => ({ loadMapleIdOwners: jest.fn() }))
jest.mock('../../../storage/character-selection', () => ({ getTrackedCharacterOcids: jest.fn() }))
const { loadMapleIdOwners } = jest.requireMock('../../maple-id/owners') as { loadMapleIdOwners: jest.Mock }
const { getTrackedCharacterOcids } = jest.requireMock('../../../storage/character-selection') as {
  getTrackedCharacterOcids: jest.Mock
}

const { judgeCrystalLimit, resetCrystalLimitJudgeForTests } =
  require('../crystal-limit-judge') as typeof import('../crystal-limit-judge')

const WEEK_A = '2026-11-19'
const WEEK_B = '2026-11-26'
const AT = '2026-11-20T00:00:00.000Z'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  resetCrystalLimitJudgeForTests()
  loadMapleIdOwners.mockResolvedValue({ ofOcid: { 'ocid-1': 'maple-1' }, order: ['maple-1'] })
  getTrackedCharacterOcids.mockResolvedValue(['ocid-1'])
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

async function clear(bossKey: string, periodKey: string, payoutMeso: number, over: Partial<BossProfitRecord> = {}): Promise<void> {
  await upsertBossProfitRecord({
    ocid: 'ocid-1',
    bossKey,
    boss: bossKey,
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey,
    partySize: 1,
    priceMeso: payoutMeso,
    payoutMeso,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: AT,
    world: '스카니아',
    worldKey: 'scania',
    ...over,
  })
}

/** 그 주의 보스 key → 읽히는 받은 몫. */
async function payouts(periodKey: string): Promise<Record<string, number>> {
  const records = await getBossProfitRecords(['ocid-1'], [periodKey])
  return Object.fromEntries(records.map((record) => [record.bossKey, record.payoutMeso]))
}

describe('judgeCrystalLimit', () => {
  it('앱을 켠 뒤 처음 판정은 모든 주를 보고, 그 뒤는 받은 주만 본다', async () => {
    for (const week of [WEEK_A, WEEK_B]) {
      await clear('lucid', week, 100)
      await clear('will', week, 200)
      await clear('gloom', week, 300)
    }

    await judgeCrystalLimit([WEEK_B])
    expect(await payouts(WEEK_A)).toEqual({ lucid: 0, will: 200, gloom: 300 })
    expect(await payouts(WEEK_B)).toEqual({ lucid: 0, will: 200, gloom: 300 })

    await clear('darknell', WEEK_A, 400)
    await judgeCrystalLimit([WEEK_B])
    expect(await payouts(WEEK_A)).toMatchObject({ will: 200 })

    await judgeCrystalLimit([WEEK_A])
    expect(await payouts(WEEK_A)).toEqual({ lucid: 0, will: 0, gloom: 300, darknell: 400 })
  })

  // 주를 통째로 다시 보므로 `제외` 를 고르면 한도 안으로 들어온다.
  it('한도 안으로 들어오면 0 이던 처치가 금액을 되찾는다', async () => {
    await clear('lucid', WEEK_A, 100)
    await clear('will', WEEK_A, 200)
    await clear('gloom', WEEK_A, 300)
    await judgeCrystalLimit([WEEK_A])

    await clear('gloom', WEEK_A, 0, { crystalExcluded: true })
    await judgeCrystalLimit([WEEK_A])

    expect(await payouts(WEEK_A)).toEqual({ lucid: 100, will: 200, gloom: 0 })
  })

  // 소속 없이 한 묶음으로 세면 다른 메이플 ID 의 처치까지 합쳐 팔 수 있던 결정석을 0 으로 만든다.
  it('메이플 ID 소속을 못 읽으면 지난 판정을 그대로 두고 던지지 않는다', async () => {
    await clear('lucid', WEEK_A, 100)
    await clear('will', WEEK_A, 200)
    await clear('gloom', WEEK_A, 300)
    await judgeCrystalLimit([WEEK_A])

    loadMapleIdOwners.mockRejectedValue(new Error('읽기 실패'))
    await clear('darknell', WEEK_A, 400)
    await expect(judgeCrystalLimit([WEEK_A])).resolves.toBeUndefined()

    expect(await payouts(WEEK_A)).toEqual({ lucid: 0, will: 200, gloom: 300, darknell: 400 })
  })
})
