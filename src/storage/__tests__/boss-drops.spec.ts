/// <reference types="node" />
/**
 * 드롭 저장을 진짜 SQLite 로 태운다. 드롭은 기간 행(`boss_party_periods`)을 가리키고, 상태는 서버와 같은
 * `record_status` 다. 가격 · 분배 · 수수료는 값을 매긴 드롭만 갖는다.
 */
import {
  applyAutoDropFees,
  getAllBossDropRecords,
  getAutoFeeDropRecords,
  getBossDropRecordById,
  getBossDropRecords,
  getBossDropRecordsRevision,
  getBulkFeeDropRecords,
  type DropWorld,
  NO_WORLD,
  replaceBossDropRecords,
  resetBossDropRecordsRevisionForTests,
  subscribeBossDropRecordsRevision,
  updateDropFees,
} from '../boss-drops'
import { setBossPartyPeriodOverride } from '../boss-party-period-overrides'
import { __resetStoragePortsForTest, setSqlitePort } from '../ports'
import { closeBossProfitDb } from '../sqlite/db'
import { createRealSqlite, type RealSqlite } from '../sqlite/__tests__/node-sqlite-port'
import type { RecordedDrop } from '../../types/drops'

let real: RealSqlite

beforeEach(() => {
  real = createRealSqlite()
  setSqlitePort(real.port)
  resetBossDropRecordsRevisionForTests()
})

afterEach(async () => {
  await closeBossProfitDb()
  __resetStoragePortsForTest()
  real.dispose()
})

const AT = '2026-10-03T00:00:00.000Z'
const LATER = '2026-10-05T00:00:00.000Z'
const WORLD = { name: '엘리시움', key: 'elysium' }
const RING = 'black_boss_ring_box'

function drop(itemKey: string, over: Partial<RecordedDrop> = {}): RecordedDrop {
  return { dropRecordId: null, category: 'equipment', itemKey, itemName: '', quantity: 1, ...over }
}

const priced: Partial<RecordedDrop> = { priceState: 'entered', priceMeso: 1_000, priceSplitMode: 'even', pricePartySize: 2, priceShare: 3 }

async function save(drops: RecordedDrop[], at = AT, world: DropWorld = WORLD, periodKey = '2026-10-02'): Promise<string[]> {
  return replaceBossDropRecords('ocid-1', 'lucid', 'hard', periodKey, drops, at, world)
}

function storedStatus(): string[] {
  return real.inspect((db) => (db.prepare('SELECT record_status FROM boss_drops ORDER BY drop_index').all() as { record_status: string }[]).map((row) => row.record_status))
}

function pricedAt(): string | null {
  return real.inspect((db) => (db.prepare('SELECT priced_at FROM boss_drops').get() as { priced_at: string | null }).priced_at)
}

function periodRows(): unknown[] {
  return real.inspect((db) => db.prepare('SELECT status, split_mode, world_key FROM boss_party_periods').all())
}

describe('replaceBossDropRecords', () => {
  it('넘긴 차례대로 drop_index 를 매기고, 식별자를 그 차례로 돌려준다', async () => {
    const ids = await save([drop('a'), drop('b'), drop('c')])

    const rows = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(rows.map((row) => [row.itemKey, row.dropIndex, row.dropRecordId])).toEqual([
      ['a', 0, ids[0]], ['b', 1, ids[1]], ['c', 2, ids[2]],
    ])
  })

  it('다시 저장해도 같은 아이템은 식별자를 이어 받는다. 상자와 반지 레벨까지 같아야 같은 아이템이다', async () => {
    await save([drop('a'), drop('a', { boxOriginKey: 'box', ringLevel: 3 })])
    const before = await getBossDropRecords(['ocid-1'], ['2026-10-02'])

    await save([drop('a', { boxOriginKey: 'box', ringLevel: 3 }), drop('a'), drop('b')])

    const after = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(after[0].dropRecordId).toBe(before[1].dropRecordId)
    expect(after[1].dropRecordId).toBe(before[0].dropRecordId)
    expect([before[0].dropRecordId, before[1].dropRecordId]).not.toContain(after[2].dropRecordId)
  })

  it('비우면 드롭을 지우고, 분배 값도 처치도 없는 기간 행까지 지운다', async () => {
    await save([drop('a')])
    expect(await save([])).toEqual([])

    expect(await getBossDropRecords(['ocid-1'], ['2026-10-02'])).toEqual([])
    expect(periodRows()).toEqual([])
  })

  it('그 기간 값이 있는 기간은 드롭을 비워도 남긴다', async () => {
    await setBossPartyPeriodOverride({
      ocid: 'ocid-1', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-02',
      partySize: 3, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: AT,
    })
    await save([drop('a')])
    await save([])

    expect(periodRows()).toEqual([{ status: 'open', split_mode: 'even', world_key: 'elysium' }])
  })

  it('월드는 기간 행에 한 번 적고, 월드를 모르는 저장이 지우지 않는다', async () => {
    await save([drop('a')])
    await save([drop('a', priced)], LATER, NO_WORLD)

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ worldKey: 'elysium', world: '엘리시움' })
  })
})

describe('가격 상태', () => {
  it('매긴 드롭은 completed 이고 분배와 수수료를 함께 적는다', async () => {
    await save([drop('a', { ...priced, priceSplitMode: 'ratio', pricePartySize: 3, priceShare: 5, priceMyShare: 2, saleFeePercent: 5, splitFeePercent: 3, saleFeeAuto: true })])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(storedStatus()).toEqual(['completed'])
    expect(read).toMatchObject({
      priceState: 'entered', priceMeso: 1_000,
      priceSplitMode: 'ratio', pricePartySize: 3, priceShare: 5, priceMyShare: 2,
      saleFeePercent: 5, splitFeePercent: 3, saleFeeAuto: true, splitFeeAuto: false,
    })
  })

  it('균등은 인원만 남긴다', async () => {
    await save([drop('a', priced)])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ priceSplitMode: 'even', pricePartySize: 2, priceShare: null, priceMyShare: null })
  })

  // 2026-10-19 전의 균등 기록은 내 비율 칸이 차 있고 그 칸으로 금액을 센다. 그룹을 다시 저장해도 지난 금액이 안 바뀌어야 한다.
  it('균등인데 내 비율 칸이 찬 드롭은 다시 저장해도 그 칸을 지킨다', async () => {
    const legacy = drop('a', { ...priced, priceMyShare: 2, saleFeePercent: 5 })
    await save([legacy])
    await save([legacy, drop('b')], LATER)

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ priceSplitMode: 'even', pricePartySize: 2, priceMyShare: 2 })
  })

  it('미입력은 pending, 기록 안 함은 skipped 이고 분배 칸을 버린다', async () => {
    await save([drop('a', { priceSplitMode: 'even', pricePartySize: 2 }), drop('b', { priceState: 'excluded', priceSplitMode: 'even', pricePartySize: 2 })])

    const rows = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(storedStatus()).toEqual(['pending', 'skipped'])
    expect(rows.map((row) => [row.priceState, row.priceMeso, row.priceSplitMode, row.pricePartySize])).toEqual([
      [null, null, null, null],
      ['excluded', null, null, null],
    ])
  })

  it('0메소는 저장하지 않고 미입력으로 둔다', async () => {
    await save([drop('a', { ...priced, priceMeso: 0 })])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(storedStatus()).toEqual(['pending'])
    expect(read.priceState).toBeNull()
  })

  it('가격을 매긴 시각은 가격이 바뀔 때만 움직인다', async () => {
    await save([drop('a', priced)])
    await save([drop('a', priced)], LATER)
    expect(pricedAt()).toBe(AT)

    await save([drop('a', { ...priced, priceMeso: 2_000 })], LATER)
    expect(pricedAt()).toBe(LATER)
  })

  it('이름은 저장하지 않고 key 로 찾아 채운다. 수량은 늘 1 이다', async () => {
    await save([drop(RING, { itemName: '아무 이름', boxOriginKey: RING })])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ boss: '루시드', itemName: '흑옥의 보스 반지 상자', boxOrigin: '흑옥의 보스 반지 상자', quantity: 1 })
  })
})

describe('읽기', () => {
  it('getAllBossDropRecords 는 기간 내림차순 · drop_index 순이다', async () => {
    await save([drop('a'), drop('b')], AT, WORLD, '2026-09-25')
    await save([drop('c')], AT, WORLD, '2026-10-02')

    expect((await getAllBossDropRecords(['ocid-1'])).map((row) => row.itemKey)).toEqual(['c', 'a', 'b'])
    expect(await getAllBossDropRecords([])).toEqual([])
  })

  it('getBossDropRecordById 는 없으면 null 이다', async () => {
    const [id] = await save([drop('a')])

    expect((await getBossDropRecordById(id))?.itemKey).toBe('a')
    expect(await getBossDropRecordById('nope')).toBeNull()
  })

  it('빈 목록이면 조회하지 않는다', async () => {
    expect(await getBossDropRecords([], ['2026-10-02'])).toEqual([])
    expect(await getBossDropRecords(['ocid-1'], [])).toEqual([])
  })
})

describe('수수료', () => {
  const where = { ocid: 'ocid-1', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-02' }

  it('updateDropFees 는 요율만 고친다', async () => {
    await save([drop('a', { ...priced, saleFeePercent: 3, splitFeePercent: 3, saleFeeAuto: true })])
    expect((await getAutoFeeDropRecords()).map((row) => row.itemKey)).toEqual(['a'])

    await updateDropFees([{ ...where, dropIndex: 0, saleFeePercent: 5, splitFeePercent: 5 }])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ saleFeePercent: 5, splitFeePercent: 5, saleFeeAuto: true })
  })

  it('일괄 대상은 값을 매겼고 두 수수료가 다 빈 드롭이고, 적용하면 두 칸이 자동이 된다', async () => {
    await save([drop('a', priced), drop('b'), drop('c', { ...priced, saleFeePercent: 3 })])
    expect((await getBulkFeeDropRecords()).map((row) => row.itemKey)).toEqual(['a'])

    await applyAutoDropFees([{ ...where, dropIndex: 0, saleFeePercent: 5, splitFeePercent: 3 }])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-02'])
    expect(read).toMatchObject({ saleFeePercent: 5, splitFeePercent: 3, saleFeeAuto: true, splitFeeAuto: true })
  })
})

describe('개정 수', () => {
  it('쓰기가 끝나면 구독자를 부르고, 던지면 안 부른다', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeBossDropRecordsRevision(listener)

    await save([drop('a')])
    await expect(save([drop(null as unknown as string)])).rejects.toThrow()
    unsubscribe()

    expect(getBossDropRecordsRevision()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
