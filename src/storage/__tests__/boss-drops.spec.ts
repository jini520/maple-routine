/// <reference types="node" />
/**
 * 드롭 저장을 진짜 SQLite 로 태운다. 드롭은 수익 건(`boss_profit_entries`)을 가리키고 아이템을 줄 id 로 적으며, 상태는 서버와
 * 같은 `price_status` 다. 가격 · 받는 메소 · 분배 · 수수료는 값을 매긴 드롭만 갖는다.
 */
import {
  applyAutoDropFees,
  getAllBossDropRecords,
  getAutoFeeDropRecords,
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
import { dropItemNameOf } from '../../lib/drop/drop-items'
import { dropPayoutMeso } from '../../lib/drop/drop-price'
import { findWorld } from '../../lib/world/worlds'
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
const RED_BOX = 'red_boss_ring_box'
/** 루시드 하드가 주는 장비 둘. 드롭 표의 차례는 몽환의 벨트보다 황혼의 징표가 앞이다. */
const MARK = 'twilight_mark'
const BELT = 'dreamy_belt'
/** 루시드 드롭 표에 없는 아이템. 표에 없는 타일은 뒤로 간다. */
const ELSEWHERE = 'magic_eyepatch'

function drop(itemKey: string, over: Partial<RecordedDrop> = {}): RecordedDrop {
  return { dropRecordId: null, category: 'equipment', itemKey, itemName: '', quantity: 1, ...over }
}

/** 빨간 보스 반지 상자에서 나온 리스트레인트 링. */
function boxRing(ringLevel = 3): RecordedDrop {
  return drop('restraint_ring', { category: 'consumable', boxOriginKey: RED_BOX, boxOrigin: '상자', ringLevel })
}

const priced: Partial<RecordedDrop> = { priceState: 'entered', priceMeso: 1_000, priceSplitMode: 'even', pricePartySize: 2, priceShare: 3 }

async function save(drops: RecordedDrop[], at = AT, world: DropWorld = WORLD, periodKey = '2026-10-01'): Promise<string[]> {
  return replaceBossDropRecords('ocid-1', 'lucid', 'hard', periodKey, drops, at, world)
}

function stored(column: string): unknown[] {
  return real.inspect((db) => (db.prepare(`SELECT ${column} AS value FROM boss_drops ORDER BY created_at, rowid`).all() as { value: unknown }[]).map((row) => row.value))
}

function entryRows(): unknown[] {
  return real.inspect((db) => db.prepare('SELECT clear_recorded_by, split_type, world_id FROM boss_profit_entries').all())
}

describe('replaceBossDropRecords', () => {
  // 차례를 저장하지 않는다. 드롭 표의 차례로 늘어놓아 기기와 서버가 같은 차례로 보인다.
  it('수익 건 안에서는 드롭 표의 차례로 늘어놓고, 식별자는 넘긴 차례로 돌려준다', async () => {
    const ids = await save([drop(ELSEWHERE), boxRing(), drop(BELT), drop(MARK)])

    const rows = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(rows.map((row) => [row.itemKey, row.dropIndex])).toEqual([
      [MARK, 0], [BELT, 1], ['restraint_ring', 2], [ELSEWHERE, 3],
    ])
    expect(rows.map((row) => row.dropRecordId)).toEqual([ids[3], ids[2], ids[1], ids[0]])
  })

  // 한 수익 건에 같은 아이템 줄은 하나라 아이템 줄이 신분이다. 반지는 레벨마다 줄이 다르다.
  it('다시 저장해도 같은 아이템 줄은 식별자를 이어 받는다. 레벨이 다른 반지는 다른 줄이다', async () => {
    await save([drop(MARK), boxRing(3)])
    const before = Object.fromEntries((await getBossDropRecords(['ocid-1'], ['2026-10-01'])).map((row) => [`${row.itemKey}${row.ringLevel ?? ''}`, row.dropRecordId]))

    await save([boxRing(3), drop(MARK), boxRing(4)])

    const after = Object.fromEntries((await getBossDropRecords(['ocid-1'], ['2026-10-01'])).map((row) => [`${row.itemKey}${row.ringLevel ?? ''}`, row.dropRecordId]))
    expect(after[MARK]).toBe(before[MARK])
    expect(after.restraint_ring3).toBe(before.restraint_ring3)
    expect(Object.values(before)).not.toContain(after.restraint_ring4)
  })

  it('비우면 드롭을 지우고, 분배 값도 처치도 없는 수익 건까지 지운다', async () => {
    await save([drop(MARK)])
    expect(await save([])).toEqual([])

    expect(await getBossDropRecords(['ocid-1'], ['2026-10-01'])).toEqual([])
    expect(entryRows()).toEqual([])
  })

  it('그 기간 값이 있는 수익 건은 드롭을 비워도 남긴다', async () => {
    await setBossPartyPeriodOverride({
      ocid: 'ocid-1', bossKey: 'lucid', difficulty: 'hard', periodKey: '2026-10-01',
      partySize: 3, crystalMyShare: null, crystalSharesTotal: null, splitFeePercent: null, updatedAt: AT,
    })
    await save([drop(MARK)])
    await save([])

    expect(entryRows()).toEqual([{ clear_recorded_by: null, split_type: 'even', world_id: findWorld('elysium')!.id }])
  })

  it('월드는 수익 건에 한 번 적고, 월드를 모르는 저장이 지우지 않는다', async () => {
    await save([drop(MARK)])
    await save([drop(MARK, priced)], LATER, NO_WORLD)

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ worldKey: 'elysium', world: '엘리시움' })
  })

  it('게임 데이터에 없는 아이템은 적지 않고 던진다', async () => {
    await expect(save([drop('other_ring')])).rejects.toThrow('게임 데이터에 없는 드롭 아이템')
  })
})

describe('가격 상태', () => {
  it('매긴 드롭은 entered 이고, 비율은 % 의 1000 배로 적으며 분배와 수수료를 함께 적는다', async () => {
    await save([drop(MARK, { ...priced, priceSplitMode: 'ratio', pricePartySize: 3, priceShare: 5, priceMyShare: 2, saleFeePercent: 5, splitFeePercent: 3, saleFeeAuto: true })])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(stored('price_status')).toEqual(['entered'])
    expect(read).toMatchObject({
      priceState: 'entered', priceMeso: 1_000,
      priceSplitMode: 'ratio', pricePartySize: 3, priceShare: 100_000, priceMyShare: 40_000,
      saleFeePercent: 5, splitFeePercent: 3, saleFeeAuto: true, splitFeeAuto: false,
    })
  })

  it('균등은 인원만 남긴다', async () => {
    await save([drop(MARK, priced)])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ priceSplitMode: 'even', pricePartySize: 2, priceShare: null, priceMyShare: null })
  })

  // 받는 메소를 저장해 지난 금액을 지킨다. 다시 세면 셈법이 바뀐 옛 기록(변환 전 내 비율 칸이 찬 균등)의 금액이 움직인다.
  it('받는 메소를 적고, 가격 · 분배 · 수수료가 그대로면 다시 저장해도 이어 받는다', async () => {
    await save([drop(MARK, { ...priced, saleFeePercent: 5 })])
    real.inspect((db) => db.exec('UPDATE boss_drops SET sale_received_meso = 123'))

    await save([drop(MARK, { ...priced, saleFeePercent: 5 }), drop(BELT)], LATER)
    expect(stored('sale_received_meso')).toEqual([123, null])

    await save([drop(MARK, { ...priced, saleFeePercent: 3 })], LATER)
    expect(stored('sale_received_meso')).toEqual([dropPayoutMeso({ ...priced, saleFeePercent: 3 })])
  })

  it('저장된 받는 메소를 읽고, 금액 계산은 그 값을 쓴다', async () => {
    await save([drop(MARK, priced)])
    real.inspect((db) => db.exec('UPDATE boss_drops SET sale_received_meso = 777'))

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(read.saleReceivedMeso).toBe(777)
    expect(dropPayoutMeso(read)).toBe(777)
  })

  it('미입력은 pending, 기록 안 함은 skipped 이고 분배 칸을 버린다', async () => {
    await save([drop(MARK, { priceSplitMode: 'even', pricePartySize: 2 }), drop(BELT, { priceState: 'excluded', priceSplitMode: 'even', pricePartySize: 2 })])

    const rows = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(stored('price_status')).toEqual(['pending', 'skipped'])
    expect(rows.map((row) => [row.priceState, row.priceMeso, row.priceSplitMode, row.pricePartySize])).toEqual([
      [null, null, null, null],
      ['excluded', null, null, null],
    ])
  })

  it('0메소는 저장하지 않고 미입력으로 둔다', async () => {
    await save([drop(MARK, { ...priced, priceMeso: 0 })])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(stored('price_status')).toEqual(['pending'])
    expect(read.priceState).toBeNull()
  })

  it('가격을 매긴 시각은 가격이 바뀔 때만 움직인다', async () => {
    await save([drop(MARK, priced)])
    await save([drop(MARK, priced)], LATER)
    expect(stored('priced_at')).toEqual([AT])

    await save([drop(MARK, { ...priced, priceMeso: 2_000 })], LATER)
    expect(stored('priced_at')).toEqual([LATER])
  })

  // 나온 상자는 적지 않고 그 난이도가 주는 상자에서 찾는다.
  it('이름은 저장하지 않고 key 로 찾아 채우고, 나온 상자는 드롭 표에서 되짚는다. 수량은 늘 1 이다', async () => {
    await save([{ ...boxRing(4), itemName: '아무 이름' }])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ boss: '루시드', itemKey: 'restraint_ring', ringLevel: 4, boxOriginKey: RED_BOX, quantity: 1 })
    expect(read.boxOrigin).toBe(dropItemNameOf(RED_BOX, RED_BOX))
  })
})

describe('읽기', () => {
  it('getAllBossDropRecords 는 기간 내림차순이고 수익 건 안은 드롭 표의 차례다', async () => {
    await save([drop(BELT), drop(MARK)], AT, WORLD, '2026-09-24')
    await save([drop(ELSEWHERE)], AT, WORLD, '2026-10-01')

    expect((await getAllBossDropRecords(['ocid-1'])).map((row) => row.itemKey)).toEqual([ELSEWHERE, MARK, BELT])
    expect(await getAllBossDropRecords([])).toEqual([])
  })

  it('빈 목록이면 조회하지 않는다', async () => {
    expect(await getBossDropRecords([], ['2026-10-01'])).toEqual([])
    expect(await getBossDropRecords(['ocid-1'], [])).toEqual([])
  })
})

describe('수수료', () => {
  it('updateDropFees 는 드롭 id 로 요율을 고치고 받는 메소를 새 요율로 다시 센다', async () => {
    const [id] = await save([drop(MARK, { ...priced, saleFeePercent: 3, splitFeePercent: 3, saleFeeAuto: true })])
    expect((await getAutoFeeDropRecords()).map((row) => row.itemKey)).toEqual([MARK])

    await updateDropFees([{ dropRecordId: id!, saleFeePercent: 5, splitFeePercent: 5 }])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ saleFeePercent: 5, splitFeePercent: 5, saleFeeAuto: true })
    expect(read.saleReceivedMeso).toBe(dropPayoutMeso({ ...priced, saleFeePercent: 5, splitFeePercent: 5 }))
  })

  it('일괄 대상은 값을 매겼고 두 수수료가 다 빈 드롭이고, 적용하면 두 칸이 자동이 된다', async () => {
    await save([drop(MARK, priced), drop(BELT), drop(ELSEWHERE, { ...priced, saleFeePercent: 3 })])
    const [target] = await getBulkFeeDropRecords()
    expect(target?.itemKey).toBe(MARK)

    await applyAutoDropFees([{ dropRecordId: target!.dropRecordId, saleFeePercent: 5, splitFeePercent: 3 }])

    const [read] = await getBossDropRecords(['ocid-1'], ['2026-10-01'])
    expect(read).toMatchObject({ saleFeePercent: 5, splitFeePercent: 3, saleFeeAuto: true, splitFeeAuto: true })
  })
})

describe('개정 수', () => {
  it('쓰기가 끝나면 구독자를 부르고, 던지면 안 부른다', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeBossDropRecordsRevision(listener)

    await save([drop(MARK)])
    await expect(save([drop(null as unknown as string)])).rejects.toThrow()
    unsubscribe()

    expect(getBossDropRecordsRevision()).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
