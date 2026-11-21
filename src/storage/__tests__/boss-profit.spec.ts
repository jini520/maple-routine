/// <reference types="node" />
/**
 * 처치 기록 저장을 진짜 SQLite 로 태운다. 처치 기록은 `boss_profit_entries` 의 처치한 줄이고, 같은 표에
 * 그 기간 값과 드롭만 있는 처치 전 줄이 함께 있다. 읽기가 처치 전 줄을 처치로 세지 않는지가 요점이다.
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
  getCrystalLimitRecords,
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
  setOverCrystalLimit,
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
    periodKey: '2026-10-01',
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

const key = { ocid: 'ocid-1', bossKey: 'black_mage', difficulty: 'extreme', periodKey: '2026-10-01' }

/** 같은 표의 'open' 행 둘. 처치가 아니므로 처치 읽기에 안 나와야 한다. */
async function seedOpenRows(): Promise<void> {
  await setBossPartyPeriodOverride({
    ocid: 'ocid-1', bossKey: 'guardian_kalos', difficulty: 'normal', periodKey: '2026-10-08',
    partySize: 3, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, splitFeeAuto: true, updatedAt: AT,
  })
  await replaceBossDropRecords('ocid-2', 'chosen_seren', 'hard', '2026-09-24', [
    { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
  ], AT, NO_WORLD)
}

describe('upsertBossProfitRecord', () => {
  it('같은 키로 다시 쓰면 값을 덮고, 월드를 모르는 쓰기는 적힌 월드를 지우지 않는다', async () => {
    await upsertBossProfitRecord(record())
    await upsertBossProfitRecord(record({ partySize: 3, payoutMeso: 333_333, world: null, worldKey: null }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ partySize: 3, payoutMeso: 333_333, worldKey: 'elysium', world: '엘리시움', source: 'auto' })
  })

  it('이름은 저장하지 않고 key 로 찾아 채운다', async () => {
    await upsertBossProfitRecord(record({ boss: '아무 이름' }))

    const rows = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(rows.map((row) => [row.bossKey, row.boss, row.world])).toEqual([['black_mage', '검은 마법사', '엘리시움']])
  })

  // 표는 보스 난이도를 게임 데이터의 줄 id 로 적는다. 서버도 그 줄이 없는 기록은 받지 않는다.
  it('게임 데이터에 없는 보스는 적지 않고 던진다', async () => {
    await expect(upsertBossProfitRecord(record({ bossKey: 'unknown_boss' }))).rejects.toThrow('게임 데이터에 없는 보스 난이도')
  })

  // 내 몫은 % 에 1000 을 곱한 정수 한 칸이다. 비율 합 칸을 두지 않아 읽으면 합이 100000 이다.
  it('결정석 비율을 % 의 1000 배로 적고, 처치를 계산한 요율은 등급을 따라도 남긴다', async () => {
    await upsertBossProfitRecord(record({ crystalMyShare: 2, crystalSharesTotal: 5, splitFeePercent: 5, splitFeeAuto: true }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ crystalMyShare: 40_000, crystalSharesTotal: 100_000, splitFeePercent: 5, splitFeeAuto: true })
  })

  it('그 기간만 고친 값이 있던 기간을 처치하면 처치 값으로 덮인다', async () => {
    await setBossPartyPeriodOverride({ ...key, partySize: 4, crystalMyShare: 1, crystalSharesTotal: 4, splitFeePercent: null, updatedAt: AT })
    await upsertBossProfitRecord(record({ partySize: 2 }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ partySize: 2, crystalMyShare: null, crystalSharesTotal: null })
  })

  it('처치 날짜는 안 건드린다. 동기화가 다시 돌아도 캐 놓은 날짜가 남는다', async () => {
    await upsertBossProfitRecord(record())
    await setBossProfitDefeatedOn(key, '2026-10-04')
    await upsertBossProfitRecord(record({ payoutMeso: 1 }))

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(read.defeatedOn).toBe('2026-10-04')
  })
})

describe('처치 읽기는 처치 전 줄을 세지 않는다', () => {
  beforeEach(async () => {
    await seedOpenRows()
    await upsertBossProfitRecord(record())
    await upsertBossProfitRecord(
      record({ bossKey: 'lotus', difficulty: 'hard', cycle: 'monthly', periodKey: '2026-09', crystalMyShare: 1, crystalSharesTotal: 2, splitFeePercent: 3, splitFeeAuto: true }),
    )
  })

  it('getBossProfitRecords · getAllBossProfitRecordKeys', async () => {
    expect(await getBossProfitRecords(['ocid-1', 'ocid-2'], ['2026-10-01', '2026-10-08', '2026-09-24'])).toHaveLength(1)
    expect(await getAllBossProfitRecordKeys(['ocid-1', 'ocid-2'])).toEqual(
      expect.arrayContaining([key, { ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-09' }]),
    )
    expect(await getAllBossProfitRecordKeys(['ocid-1', 'ocid-2'])).toHaveLength(2)
  })

  it('getWeeklyPeriodKeysWithRecords · findAdjacentPeriodKeyWithRecords', async () => {
    expect(await getWeeklyPeriodKeysWithRecords(['ocid-1', 'ocid-2'], '2026-10')).toEqual(['2026-10-01'])
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1', 'ocid-2'], 'weekly', '2026-10-30', 'prev')).toBe('2026-10-01')
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1', 'ocid-2'], 'weekly', '2026-09-01', 'next')).toBe('2026-10-01')
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1', 'ocid-2'], 'monthly', '2026-11', 'prev')).toBe('2026-10')
    expect(await findAdjacentPeriodKeyWithRecords(['ocid-1'], 'weekly', '2026-10-01', 'next')).toBeNull()
  })

  it('getUndatedBossProfitRecords · getEarliestBossProfitPeriodKeys · getAutoFeeProfitRecords', async () => {
    expect((await getUndatedBossProfitRecords(['ocid-1', 'ocid-2'], ['2026-10-01', '2026-10-08', '2026-09-24'])).map((row) => row.bossKey))
      .toEqual(['black_mage'])
    expect(await getEarliestBossProfitPeriodKeys('ocid-2')).toEqual({})
    expect(await getEarliestBossProfitPeriodKeys('ocid-1')).toEqual({ weekly: '2026-10-01', monthly: '2026-09' })
    // 그 기간 값도 분배 수수료 자동 칸을 갖지만, 처치가 아니라 다시 셀 대상이 아니다. 균등 처치는 요율을 쓰지 않아 대상이 아니다.
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
      { ocid: 'ocid-1', bossKey: 'black_mage', boss: '검은 마법사', difficulty: 'extreme', periodKey: '2026-10-01', payoutMeso: 500_000, defeatedOn: '2026-10-04', crystalExcluded: false, overCrystalLimit: false },
    ])
    expect(await getUndatedBossProfitRecords(['ocid-1'], ['2026-10-01'])).toEqual([
      { ocid: 'ocid-1', bossKey: 'lotus', boss: '스우', difficulty: 'hard', cycle: 'weekly', periodKey: '2026-10-01' },
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
    expect(await getBossProfitRecords([], ['2026-10-01'])).toEqual([])
  })
})

describe('deleteBossProfitRecord', () => {
  it('드롭이 없으면 수익 건을 지운다', async () => {
    await upsertBossProfitRecord(record())
    await deleteBossProfitRecord(key)

    expect(await getBossProfitRecords(['ocid-1'], ['2026-10-01'])).toEqual([])
    expect(real.inspect((db) => db.prepare('SELECT count(*) AS n FROM boss_profit_entries').get())).toEqual({ n: 0 })
  })

  it('드롭이 남아 있으면 처치만 걷고 그 기간은 보스 관리 설정을 따른다', async () => {
    await upsertBossProfitRecord(record())
    await replaceBossDropRecords('ocid-1', 'black_mage', 'extreme', '2026-10-01', [
      { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)

    await deleteBossProfitRecord(key)

    expect(await getBossProfitRecords(['ocid-1'], ['2026-10-01'])).toEqual([])
    expect(await getBossDropRecords(['ocid-1'], ['2026-10-01'])).toHaveLength(1)
    expect(real.inspect((db) => db.prepare('SELECT clear_recorded_by, split_type, crystal_price_meso FROM boss_profit_entries').get()))
      .toEqual({ clear_recorded_by: null, split_type: null, crystal_price_meso: null })
  })
})

describe('기록 한 행을 고치는 쓰기', () => {
  it('markBossProfitRecordAuto 는 직접 적은 완료만 auto 로 내린다', async () => {
    await upsertBossProfitRecord(record({ source: 'manual' }))
    expect(await getManualBossProfitRecordKeys(['ocid-1'], ['2026-10-01'])).toEqual([key])

    await markBossProfitRecordAuto(key)

    expect(await getManualBossProfitRecordKeys(['ocid-1'], ['2026-10-01'])).toEqual([])
  })

  it('updateProfitSplitFees 는 요율과 받은 몫을 함께 고친다', async () => {
    await upsertBossProfitRecord(record({ splitFeeAuto: true }))
    await updateProfitSplitFees([{ ...key, splitFeePercent: 5, payoutMeso: 480_000 }])

    const [read] = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ splitFeePercent: 5, payoutMeso: 480_000 })
  })

  it('fillMissingRecordWorlds 는 월드가 빈 처치만 채운다', async () => {
    await upsertBossProfitRecord(record({ world: null, worldKey: null }))
    await upsertBossProfitRecord(record({ bossKey: 'lotus', difficulty: 'hard', world: '스카니아', worldKey: 'scania' }))

    await fillMissingRecordWorlds(new Map([['ocid-1', { world: '엘리시움', worldKey: 'elysium' }]]))

    const rows = await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
    expect(Object.fromEntries(rows.map((row) => [row.bossKey, row.worldKey]))).toEqual({ black_mage: 'elysium', lotus: 'scania' })
  })

  it('hasBossProfitRecordInPeriod 는 난이도를 안 가린다', async () => {
    await upsertBossProfitRecord(record())
    expect(await hasBossProfitRecordInPeriod('ocid-1', 'black_mage', '2026-10-01')).toBe(true)
    expect(await hasBossProfitRecordInPeriod('ocid-1', 'black_mage', '2026-10-08')).toBe(false)
  })
})

describe('개정 수', () => {
  it('쓰기마다 오르고 구독자를 부른다. 읽기로는 안 오른다', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeBossProfitRecordsRevision(listener)

    await upsertBossProfitRecord(record())
    await getBossProfitRecords(['ocid-1'], ['2026-10-01'])
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

describe('분배 방식 `제외`', () => {
  it('`제외` 기록을 쓰면 다시 읽을 때 `제외` 로 읽는다', async () => {
    await upsertBossProfitRecord(record({ payoutMeso: 0, crystalExcluded: true }))

    expect((await getBossProfitRecords(['ocid-1'], ['2026-10-01']))[0]).toMatchObject({ payoutMeso: 0, crystalExcluded: true })
  })

  it('처치를 걷어 드롭만 남은 수익 건은 `제외` 와 한도 초과 표시도 비운다', async () => {
    await upsertBossProfitRecord(record({ payoutMeso: 0, crystalExcluded: true }))
    await replaceBossDropRecords('ocid-1', 'black_mage', 'extreme', '2026-10-01', [
      { dropRecordId: null, category: 'fixed', itemKey: 'black_boss_ring_box', itemName: '', quantity: 1 },
    ], AT, NO_WORLD)
    const [limited] = await getCrystalLimitRecords('all')
    await setOverCrystalLimit([{ id: limited.id, over: true }])

    await deleteBossProfitRecord(key)

    expect(real.inspect((db) => db.prepare('SELECT split_type, over_crystal_sale_limit FROM boss_profit_entries').get()))
      .toEqual({ split_type: null, over_crystal_sale_limit: null })
  })
})

describe('주간 결정석 판매 한도를 넘긴 처치', () => {
  it('한도 초과로 적은 기록은 두 읽기 함수가 0 메소로 읽고, 판정용 읽기는 원래 내 몫을 준다', async () => {
    await upsertBossProfitRecord(record())
    await setBossProfitDefeatedOn(key, '2026-10-04')
    const [limited] = await getCrystalLimitRecords('all')

    await setOverCrystalLimit([{ id: limited.id, over: true }])

    expect((await getBossProfitRecords(['ocid-1'], ['2026-10-01']))[0]).toMatchObject({ payoutMeso: 0, overCrystalLimit: true })
    expect((await getDatedBossProfitRecords(['ocid-1'], '2026-10-01', '2026-10-31'))[0]).toMatchObject({ payoutMeso: 0, overCrystalLimit: true })
    expect((await getCrystalLimitRecords('all'))[0]).toMatchObject({ payoutMeso: 500_000, overCrystalLimit: true })
  })

  it('판정용 읽기는 고른 주의 주간 처치만 준다', async () => {
    await upsertBossProfitRecord(record())
    await upsertBossProfitRecord(record({ bossKey: 'lotus', difficulty: 'hard', periodKey: '2026-10-08' }))
    await upsertBossProfitRecord(record({ cycle: 'monthly', periodKey: '2026-10' }))

    expect((await getCrystalLimitRecords(['2026-10-01'])).map((row) => [row.bossKey, row.periodKey, row.cycle, row.worldKey])).toEqual([
      ['black_mage', '2026-10-01', 'weekly', 'elysium'],
    ])
    expect(await getCrystalLimitRecords([])).toEqual([])
    expect(await getCrystalLimitRecords('all')).toHaveLength(2)
  })

  it('바뀐 것이 없으면 판을 올리지 않는다', async () => {
    await upsertBossProfitRecord(record())
    const [limited] = await getCrystalLimitRecords('all')
    const before = getBossProfitRecordsRevision()

    await setOverCrystalLimit([])
    expect(getBossProfitRecordsRevision()).toBe(before)

    await setOverCrystalLimit([{ id: limited.id, over: true }])
    expect(getBossProfitRecordsRevision()).toBe(before + 1)
  })

  it('한도 안으로 돌아오면 원래 내 몫을 다시 읽는다', async () => {
    await upsertBossProfitRecord(record())
    const [limited] = await getCrystalLimitRecords('all')
    await setOverCrystalLimit([{ id: limited.id, over: true }])

    await setOverCrystalLimit([{ id: limited.id, over: false }])

    expect((await getBossProfitRecords(['ocid-1'], ['2026-10-01']))[0]).toMatchObject({ payoutMeso: 500_000, overCrystalLimit: false })
  })
})
