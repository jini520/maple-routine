/// <reference types="node" />
/**
 * 처치 기록 저장을 진짜 SQLite 로 태운다. 처치 기록은 `boss_party_periods` 의 'cleared' 행이고, 같은 표에
 * 그 기간 값과 드롭만 있는 'open' 행이 함께 있다. 읽기가 'open' 행을 처치로 세지 않는지가 요점이다.
 */
import {
  type BossProfitRecord,
  deleteBossProfitRecord,
  fillMissingRecordWorlds,
  findAdjacentPeriodKeyWithRecords,
  getAllBossProfitRecordKeys,
  getAutoFeeProfitRecords,
  getBossProfitRecords,
  getBossProfitRecordsRevision,
  getDatedBossProfitRecords,
  getEarliestBossProfitPeriodKeys,
  getManualBossProfitRecordKeys,
  getMonthlyDefeatDates,
  getRecordedCharacterOcids,
  getUndatedBossProfitRecords,
  getWeeklyPeriodKeysWithRecords,
  hasBossProfitRecordInPeriod,
  markBossProfitRecordAuto,
  resetBossProfitRecordsRevisionForTests,
  setBossProfitDefeatedOn,
  subscribeBossProfitRecordsRevision,
  updateProfitSplitFees,
  upsertBossProfitRecord,
} from '../boss-profit'
import { NO_WORLD, getBossDropRecords, replaceBossDropRecords } from '../boss-drops'
import { setBossPartyPeriodOverride } from '../boss-party-period-overrides'
import { setBossPartySetting } from '../boss-party-settings'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  resetBossProfitRecordsRevisionForTests()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const AT = '2026-10-03T00:00:00.000Z'

function record(over: Partial<BossProfitRecord> = {}): BossProfitRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'black_mage',
    boss: '검은 마법사',
    difficulty: 'extreme',
    cycle: 'weekly',
    periodKey: '2026-10-02',
    partySize: 2,
    priceMeso: 1_000_000,
    payoutMeso: 500_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    recordedAt: AT,
    world: '엘리시움',
    worldKey: 'elysium',
    ...over,
  }
}

const key = { ocid: 'ocid-1', bossKey: 'black_mage', difficulty: 'extreme', periodKey: '2026-10-02' }

/** 같은 표의 'open' 행 둘. 처치가 아니므로 처치 읽기에 안 나와야 한다. */
async function seedOpenRows(): Promise<void> {
  await setBossPartyPeriodOverride({
    ocid: 'ocid-1', bossKey: 'kalos', difficulty: 'normal', periodKey: '2026-10-09',
    partySize: 3, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, splitFeeAuto: true, updatedAt: AT,
  })
  await replaceBossDropRecords('ocid-2', 'seren', 'hard', '2026-09-25', [
    { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
  ], AT, NO_WORLD)
}

describe('upsertBossProfitRecord', () => {
  it('같은 키로 다시 쓰면 값을 덮고, 월드를 모르는 쓰기는 적힌 월드를 지우지 않는다', async () => {
    await upsertBossProfitRecord(record())
    await upsertBossProfitRecord(record({ partySize: 3, payoutMeso: 333_333, world: null, worldKey: null }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ partySize: 3, payoutMeso: 333_333, worldKey: 'elysium', world: '엘리시움', source: 'auto' })
  })

  it('이름은 저장하지 않고 key 로 찾아 채운다. 모르는 key 면 key 를 쓴다', async () => {
    await upsertBossProfitRecord(record({ boss: '아무 이름' }))
    await upsertBossProfitRecord(record({ bossKey: 'unknown_boss', boss: '아무 이름', world: null, worldKey: null }))

    const rows = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(rows.map((row) => [row.bossKey, row.boss, row.world])).toEqual(
      expect.arrayContaining([['black_mage', '검은 마법사', '엘리시움'], ['unknown_boss', 'unknown_boss', null]]),
    )
  })

  it('결정석 비율을 적고 그대로 읽는다', async () => {
    await upsertBossProfitRecord(record({ crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 5, splitFeeAuto: true }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 5, splitFeeAuto: true })
  })

  it('그 기간만 고친 값이 있던 기간을 처치하면 처치 값으로 덮인다', async () => {
    await setBossPartyPeriodOverride({ ...key, partySize: 4, crystalMyShare: 1, crystalSharesTotal: 4, splitFeePercent: null, updatedAt: AT })
    await upsertBossProfitRecord(record({ partySize: 2 }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ partySize: 2, crystalMyShare: null, crystalSharesTotal: null })
  })

  it('처치 날짜는 안 건드린다. 동기화가 다시 돌아도 캐 놓은 날짜가 남는다', async () => {
    await upsertBossProfitRecord(record())
    await setBossProfitDefeatedOn(key, '2026-10-04')
    await upsertBossProfitRecord(record({ payoutMeso: 1 }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(read.defeatedOn).toBe('2026-10-04')
  })
})

describe('처치 읽기는 open 행을 세지 않는다', () => {
  beforeEach(async () => {
    await seedOpenRows()
    await upsertBossProfitRecord(record())
    await upsertBossProfitRecord(record({ bossKey: 'lotus', difficulty: 'hard', cycle: 'monthly', periodKey: '2026-09', splitFeeAuto: true }))
  })

  it('getBossProfitRecords · getAllBossProfitRecordKeys', async () => {
    expect(await getBossProfitRecords(['ocid-1', 'ocid-2'], ['2026-10-02', '2026-10-09', '2026-09-25'])).toHaveLength(1)
    expect(await getAllBossProfitRecordKeys(['ocid-1', 'ocid-2'])).toEqual(
      expect.arrayContaining([key, { ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-09' }]),
    )
    expect(await getAllBossProfitRecordKeys(['ocid-1', 'ocid-2'])).toHaveLength(2)
  })

  it('getWeeklyPeriodKeysWithRecords · findAdjacentPeriodKeyWithRecords', async () => {
    expect(await getWeeklyPeriodKeysWithRecords(['ocid-1', 'ocid-2'], '2026-10')).toEqual(['2026-10-02'])
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1', 'ocid-2'], 'weekly', '2026-10-30', 'prev')).toBe('2026-10-02')
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1', 'ocid-2'], 'weekly', '2026-09-01', 'next')).toBe('2026-10-02')
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1', 'ocid-2'], 'monthly', '2026-11', 'prev')).toBe('2026-10')
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1'], 'weekly', '2026-10-02', 'next')).toBeNull()
  })

  it('getUndatedBossProfitRecords · getEarliestBossProfitPeriodKeys · getAutoFeeProfitRecords', async () => {
    expect((await getUndatedBossProfitRecords(['ocid-1', 'ocid-2'], ['2026-10-02', '2026-10-09', '2026-09-25'])).map((row) => row.bossKey))
      .toEqual(['black_mage'])
    expect(await getEarliestBossProfitPeriodKeys('ocid-2')).toEqual({})
    expect(await getEarliestBossProfitPeriodKeys('ocid-1')).toEqual({ weekly: '2026-10-02', monthly: '2026-09' })
    // 그 기간 값도 분배 수수료 자동 칸을 갖지만, 처치가 아니라 다시 셀 대상이 아니다.
    expect((await getAutoFeeProfitRecords()).map((row) => row.bossKey)).toEqual(['lotus'])
  })

  it('getRecordedCharacterOcids 는 처치나 드롭이 있는 캐릭터만 준다', async () => {
    await setBossPartySetting({ ocid: 'ocid-3', bossKey: 'lucid', difficulty: 'hard', partySize: 2, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: AT })

    expect((await getRecordedCharacterOcids()).sort()).toEqual(['ocid-1', 'ocid-2'])
  })
})

describe('처치 날짜', () => {
  it('날짜 범위로 자르고 모르는 날짜는 뺀다', async () => {
    await upsertBossProfitRecord(record())
    await upsertBossProfitRecord(record({ bossKey: 'lotus', difficulty: 'hard' }))
    await setBossProfitDefeatedOn(key, '2026-10-04')

    expect(await getDatedBossProfitRecords(['ocid-1'], '2026-10-01', '2026-10-31')).toEqual([
      { ocid: 'ocid-1', bossKey: 'black_mage', boss: '검은 마법사', difficulty: 'extreme', periodKey: '2026-10-02', payoutMeso: 500_000, defeatedOn: '2026-10-04' },
    ])
    expect(await getUndatedBossProfitRecords(['ocid-1'], ['2026-10-02'])).toEqual([
      { ocid: 'ocid-1', bossKey: 'lotus', boss: '스우', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-02' },
    ])
  })

  it('getMonthlyDefeatDates 는 월간 처치의 날짜만 중복 없이 준다', async () => {
    const monthly = { ...key, periodKey: '2026-10' }
    await upsertBossProfitRecord(record({ cycle: 'monthly', periodKey: '2026-10' }))
    await setBossProfitDefeatedOn(monthly, '2026-10-05')
    await upsertBossProfitRecord(record())
    await setBossProfitDefeatedOn(key, '2026-10-04')

    expect(await getMonthlyDefeatDates(['ocid-1'])).toEqual(['2026-10-05'])
  })

  it('빈 목록이면 조회하지 않는다', async () => {
    expect(await getDatedBossProfitRecords([], '2026-10-01', '2026-10-31')).toEqual([])
    expect(await getUndatedBossProfitRecords(['ocid-1'], [])).toEqual([])
    expect(await getBossProfitRecords([], ['2026-10-02'])).toEqual([])
  })
})

describe('deleteBossProfitRecord', () => {
  it('드롭이 없으면 기간 행을 지운다', async () => {
    await upsertBossProfitRecord(record())
    await deleteBossProfitRecord(key)

    expect(await getBossProfitRecords(['ocid-1'], ['2026-10-02'])).toEqual([])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_party_periods').get())).toEqual({ n: 0 })
  })

  it('드롭이 남아 있으면 처치만 걷고 그 기간은 보스 관리 설정을 따른다', async () => {
    await upsertBossProfitRecord(record())
    await replaceBossDropRecords('ocid-1', 'black_mage', 'extreme', '2026-10-02', [
      { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)

    await deleteBossProfitRecord(key)

    expect(await getBossProfitRecords(['ocid-1'], ['2026-10-02'])).toEqual([])
    expect(await getBossDropRecords(['ocid-1'], ['2026-10-02'])).toHaveLength(1)
    expect(real.inspect((db) => db.prepare('SELECT status, split_mode, price_meso, source FROM boss_party_periods').get()))
      .toEqual({ status: 'open', split_mode: null, price_meso: null, source: null })
  })
})

describe('기록 한 행을 고치는 쓰기', () => {
  it('markBossProfitRecordAuto 는 직접 적은 완료만 auto 로 내린다', async () => {
    await upsertBossProfitRecord(record({ source: 'manual' }))
    expect(await getManualBossProfitRecordKeys(['ocid-1'], ['2026-10-02'])).toEqual([key])

    await markBossProfitRecordAuto(key)

    expect(await getManualBossProfitRecordKeys(['ocid-1'], ['2026-10-02'])).toEqual([])
  })

  it('updateProfitSplitFees 는 요율과 받은 몫을 함께 고친다', async () => {
    await upsertBossProfitRecord(record({ splitFeeAuto: true }))
    await updateProfitSplitFees([{ ...key, splitFeePercent: 5, payoutMeso: 480_000 }])

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ splitFeePercent: 5, payoutMeso: 480_000 })
  })

  it('fillMissingRecordWorlds 는 월드가 빈 처치만 채운다', async () => {
    await upsertBossProfitRecord(record({ world: null, worldKey: null }))
    await upsertBossProfitRecord(record({ bossKey: 'lotus', difficulty: 'hard', world: '스카니아', worldKey: 'scania' }))

    await fillMissingRecordWorlds(new Map([['ocid-1', { world: '엘리시움', worldKey: 'elysium' }]]))

    const rows = await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    expect(Object.fromEntries(rows.map((row) => [row.bossKey, row.worldKey]))).toEqual({ black_mage: 'elysium', lotus: 'scania' })
  })

  it('hasBossProfitRecordInPeriod 는 난이도를 안 가린다', async () => {
    await upsertBossProfitRecord(record())
    expect(await hasBossProfitRecordInPeriod('ocid-1', 'black_mage', '2026-10-02')).toBe(true)
    expect(await hasBossProfitRecordInPeriod('ocid-1', 'black_mage', '2026-10-09')).toBe(false)
  })
})

describe('개정 수', () => {
  it('쓰기마다 오르고 구독자를 부른다. 읽기로는 안 오른다', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeBossProfitRecordsRevision(listener)

    await upsertBossProfitRecord(record())
    await getBossProfitRecords(['ocid-1'], ['2026-10-02'])
    await deleteBossProfitRecord(key)
    unsubscribe()
    await upsertBossProfitRecord(record())

    expect(getBossProfitRecordsRevision()).toBe(3)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('쓰기가 던지면 안 오른다', async () => {
    await expect(upsertBossProfitRecord(record({ priceMeso: null as unknown as number }))).rejects.toThrow()
    expect(getBossProfitRecordsRevision()).toBe(0)
  })
})
