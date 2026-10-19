// 난이도 확정 이관이 옮긴 드롭의 가격을 서버에 다시 보내는지. 안 보내면 서버 줄이 옛 난이도를 가리킨 채 남는다.
import type { BossDropRecord } from '../../../storage/boss-drops'

jest.mock('../../../storage/boss-drops', () => ({
  NO_WORLD: { name: null, key: null },
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
}))
jest.mock('../../../storage/record-revision-batch', () => ({
  batchRecordWrites: async (write: () => Promise<unknown>) => write(),
}))
jest.mock('../../server-sync/drop-price-sync', () => ({ reportDropPrice: jest.fn(), reportDropRemoved: jest.fn() }))

const { replaceBossDropRecords: replaceMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>
const { reportDropPrice: reportMock, reportDropRemoved: removedMock } = jest.requireMock('../../server-sync/drop-price-sync') as Record<string, jest.Mock>

import { migrateDropsToConfirmedDifficulty } from '../drops-loader'

const PERIOD = '2026-10-15'
const NOW = new Date('2026-10-16T00:00:00.000Z')
const row = { ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard' as const, periodKey: PERIOD }

function record(over: Partial<BossDropRecord>): BossDropRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: PERIOD,
    dropIndex: 0,
    dropRecordId: 'drop-x',
    world: null,
    worldKey: null,
    category: 'equipment',
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-10-15T00:00:00.000Z',
    priceState: 'entered',
    priceMeso: 15_000_000_000,
    priceSplitMode: 'even',
    pricePartySize: null,
    priceShare: 3,
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: false,
    splitFeeAuto: false,
    ...over,
  }
}

beforeEach(() => {
  replaceMock.mockReset().mockResolvedValue(undefined)
  reportMock.mockReset().mockResolvedValue(undefined)
  removedMock.mockReset().mockResolvedValue(undefined)
})

// 스우 하드가 주는 것은 루즈 컨트롤 머신 마크와 홍옥 반지 상자 둘이다. 그 둘을 익스트림 키에서 옮긴다.
it('옛 난이도에서 옮겨 온 드롭은 다시 보낸다. 기록 안함도 보낸다(서버 줄이 skipped 가 된다)', async () => {
  await migrateDropsToConfirmedDifficulty(row, [
    record({ difficulty: 'extreme', dropRecordId: 'moved-entered', dropIndex: 0 }),
    record({
      difficulty: 'extreme',
      dropRecordId: 'moved-excluded',
      dropIndex: 1,
      category: 'consumable',
      itemKey: 'red_boss_ring_box',
      itemName: '홍옥의 보스 반지 상자',
      priceState: 'excluded',
      priceMeso: null,
    }),
  ], NOW)

  expect(replaceMock).toHaveBeenCalled()
  expect(reportMock.mock.calls.map((c) => c[0]).sort()).toEqual(['moved-entered', 'moved-excluded'])
  expect(reportMock).toHaveBeenCalledWith('moved-entered', NOW)
})

// 미입력도 서버 줄(pending)이 있다. 안 보내면 그 줄이 옛 난이도를 가리킨 채 남는다.
it('가격 상태가 없는 드롭도 옮기면 보낸다', async () => {
  await migrateDropsToConfirmedDifficulty(row, [
    record({ difficulty: 'extreme', dropRecordId: 'moved-none', priceState: null, priceMeso: null }),
  ], NOW)

  expect(replaceMock).toHaveBeenCalled()
  expect(reportMock).toHaveBeenCalledWith('moved-none', NOW)
  expect(removedMock).not.toHaveBeenCalled()
})

it('확정 난이도에 이미 있던 드롭은 다시 안 보낸다', async () => {
  await migrateDropsToConfirmedDifficulty(row, [
    record({ difficulty: 'hard', dropRecordId: 'already-there', dropIndex: 0 }),
    record({
      difficulty: 'extreme',
      dropRecordId: 'moved',
      dropIndex: 0,
      category: 'consumable',
      itemKey: 'red_boss_ring_box',
      itemName: '홍옥의 보스 반지 상자',
    }),
  ], NOW)

  expect(reportMock.mock.calls.map((c) => c[0])).toEqual(['moved'])
})

// 확정 난이도에서 못 얻는 드롭은 기기에서 걷힌다. 기록이 사라졌으니 서버의 그 줄은 deleted 가 되어야 한다.
it('확정 난이도에서 못 얻어 걷힌 드롭은 지우기를 보낸다', async () => {
  await migrateDropsToConfirmedDifficulty(row, [
    record({
      difficulty: 'extreme',
      dropRecordId: 'pruned',
      category: 'consumable',
      itemKey: 'white_boss_ring_box',
      itemName: '백옥의 보스 반지 상자',
    }),
  ], NOW)

  expect(reportMock).not.toHaveBeenCalled()
  expect(removedMock).toHaveBeenCalledWith('pruned', PERIOD, NOW)
})

it('옮길 것이 없으면 아무것도 안 보낸다', async () => {
  await migrateDropsToConfirmedDifficulty(row, [record({ difficulty: 'hard' })], NOW)

  expect(replaceMock).not.toHaveBeenCalled()
  expect(reportMock).not.toHaveBeenCalled()
})
