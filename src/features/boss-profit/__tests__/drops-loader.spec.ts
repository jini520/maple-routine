// ⚠️ 가격이 조용히 사라지는 자리 그 ③.
//
// 이 경로가 **가장 뜨겁다**. 기간을 로드할 때마다 돈다. 저장은 멀쩡한데 화면만 "미입력"으로
// 보이던 증상의 원인이었다.
// 시트에서 값을 넣은 직후에는 스토어가 들고 있는 값이라 보이고, 기간을 왕복하면 DB에서 다시
// 읽으면서 가격만 떨어져 나갔다.
import { findItem } from '../../../lib/item-catalog'
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { BossProfitRow } from '../rows'

jest.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: jest.fn(),
  settleClearedBossDrops: jest.fn(),
}))
const { getBossDropRecords: getBossDropRecordsMock, settleClearedBossDrops: settleMock } = jest.requireMock(
  '../../../storage/boss-drops',
) as Record<string, jest.Mock>
// 판 알림을 모으는 반복. 쓰기가 그 안에서 도는지 깊이로 본다.
jest.mock('../../../storage/record-revision-batch', () => ({
  batchRecordWrites: async (write: () => Promise<unknown>) => {
    mockBatchDepth += 1
    try {
      return await write()
    } finally {
      mockBatchDepth -= 1
    }
  },
}))
var mockBatchDepth = 0

const PERIOD = '2026-08-06'
const NOW = new Date('2026-08-10T00:00:00Z')

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    world: null,
    worldKey: null,
    bossKey: 'lotus',
    bossName: '스우',
    difficulty: 'hard',
    cycle: 'weekly',
    periodKey: PERIOD,
    periodLabel: '이번 주',
    priceMeso: 20_400_000_000,
    maxPartySize: 6,
    partySize: 3,
    payoutMeso: 6_800_000_000,
    crystalMyShare: null,
    crystalSharesTotal: null,
    splitFeePercent: null,
    isComplete: true,
    defeatedOn: null,
    source: 'auto',
    ...overrides,
  }
}

function record(overrides: Partial<BossDropRecord> = {}): BossDropRecord {
  const itemKey = overrides.itemKey ?? 'loose_control_machine_mark'
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: PERIOD,
    dropIndex: 0,
    itemId: findItem(itemKey)!.id,
    dropRecordId: `drop-${itemKey}`,
    world: null,
    worldKey: null,
    category: 'equipment',
    itemKey,
    itemName: '루즈 컨트롤 머신 마크',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-10T00:00:00.000Z',
    pricedAt: null,
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
    ...overrides,
  }
}

/** 컴플리트 언더컨트롤은 스우 익스트림 전용이다. 하드로 처치한 행에서는 지워진다. */
const extremeOnly = () => record({ itemKey: 'complete_under_control', itemName: '컴플리트 언더컨트롤', priceState: null, priceMeso: null })

beforeEach(() => {
  getBossDropRecordsMock.mockReset().mockResolvedValue([record()])
  settleMock.mockReset().mockResolvedValue(true)
})

const { loadDropsByRowKey, migrateDropsToConfirmedDifficulty } = require('../drops-loader') as typeof import('../drops-loader')

describe('loadDropsByRowKey: 가격 생존', () => {
  it('DB에서 읽은 가격을 화면 상태로 그대로 옮긴다', async () => {
    const map = await loadDropsByRowKey(['ocid-1'], [row()], NOW)

    expect(map[`ocid-1|lotus|hard|${PERIOD}`]).toEqual([
      expect.objectContaining({
        itemKey: 'loose_control_machine_mark',
        itemName: '루즈 컨트롤 머신 마크',
        priceState: 'entered',
        priceMeso: 15_000_000_000,
        priceShare: 3,
      }),
    ])
  })

  it('스킵 상태도 옮긴다. 미입력으로 되돌아가면 다시 묻게 된다', async () => {
    getBossDropRecordsMock.mockResolvedValue([record({ priceState: 'excluded', priceMeso: null, priceShare: null })])

    const map = await loadDropsByRowKey(['ocid-1'], [row()], NOW)

    expect(map[`ocid-1|lotus|hard|${PERIOD}`][0].priceState).toBe('excluded')
  })
})

describe('loadDropsByRowKey: 완료 행의 정리', () => {
  // 기간을 읽는 행은 낡은 캐시에서 나왔을 수 있다. 다른 난이도 수익 건의 드롭을 옮기는 일은 처치 기록을 적은 뒤의 이관이 한다.
  it('완료 행의 수익 건에 처치 난이도로 못 얻는 드롭이 있으면 그 수익 건만 모으고 다시 읽은 값을 돌려준다', async () => {
    getBossDropRecordsMock.mockResolvedValueOnce([record(), extremeOnly()]).mockResolvedValueOnce([record()])

    const map = await loadDropsByRowKey(['ocid-1'], [row()], NOW)

    expect(settleMock.mock.calls).toEqual([[row(), 'entry', NOW.toISOString()]])
    expect(map[`ocid-1|lotus|hard|${PERIOD}`].map((drop) => drop.itemKey)).toEqual(['loose_control_machine_mark'])
  })

  // 행마다 다시 쓸 수 있다. 쓰기마다 알리면 판을 구독하는 화면이 그만큼 다시 그려진다.
  it('정리해 다시 쓰는 반복은 판 알림을 모으는 반복 안에서 돈다', async () => {
    const depths: number[] = []
    settleMock.mockImplementation(async () => {
      depths.push(mockBatchDepth)
      return true
    })
    getBossDropRecordsMock.mockResolvedValue([record(), extremeOnly()])

    await loadDropsByRowKey(['ocid-1'], [row()], NOW)

    expect(depths).toEqual([1])
  })

  it('미완료 행이나 바꿀 것이 없는 행은 쓰지 않고 한 번만 읽는다', async () => {
    getBossDropRecordsMock.mockResolvedValue([record(), extremeOnly()])

    await loadDropsByRowKey(['ocid-1'], [row({ isComplete: false })], NOW)
    getBossDropRecordsMock.mockResolvedValue([record()])
    await loadDropsByRowKey(['ocid-1'], [row()], NOW)

    expect(settleMock).not.toHaveBeenCalled()
    expect(getBossDropRecordsMock).toHaveBeenCalledTimes(2)
  })
})

// 2026-09-17 패치. 교환권의 끝 기간만 적었으므로 패치 전 주의 기록은 정리되지 않는다.
describe('loadDropsByRowKey: 기간으로 정리한다', () => {
  const 교환권 = (periodKey: string) =>
    record({
      bossKey: 'guardian_angel_slime',
      boss: '가디언 엔젤 슬라임',
      difficulty: 'chaos',
      periodKey,
      category: 'consumable',
      itemKey: 'magical_weapon_scroll_voucher',
      itemName: '매지컬 무기 주문서 교환권',
    })
  const 가엔슬행 = (periodKey: string) =>
    row({ bossKey: 'guardian_angel_slime', bossName: '가디언 엔젤 슬라임', difficulty: 'chaos', periodKey })

  it('패치 전 주의 교환권 기록은 남고 DB 에 다시 안 쓴다', async () => {
    getBossDropRecordsMock.mockResolvedValue([교환권('2026-09-10')])

    const map = await loadDropsByRowKey(['ocid-1'], [가엔슬행('2026-09-10')], new Date('2026-09-12T00:00:00Z'))

    expect(map['ocid-1|guardian_angel_slime|chaos|2026-09-10']).toHaveLength(1)
    expect(settleMock).not.toHaveBeenCalled()
  })

  // 패치는 09-17 오전 10시인데 그 주는 00:00 에 열린다. 그 열 시간에 적은 기록을 지우면 안 되므로
  // 패치가 한가운데 든 09-17 주는 통째로 남기고, 그 다음 주부터 정리한다.
  it('패치 뒤의 주에 적힌 교환권은 정리된다', async () => {
    getBossDropRecordsMock.mockResolvedValue([교환권('2026-09-24')])

    await loadDropsByRowKey(['ocid-1'], [가엔슬행('2026-09-24')], new Date('2026-09-26T00:00:00Z'))

    expect(settleMock.mock.calls.map(([key, scope]) => [key.periodKey, scope])).toEqual([['2026-09-24', 'entry']])
  })
})

describe('migrateDropsToConfirmedDifficulty', () => {
  // 다른 난이도 수익 건의 드롭이 없으면 옮길 것이 없다. 처치한 수익 건 안의 정리는 기간을 읽을 때 한다.
  it('같은 캐릭터 · 보스 · 기간의 다른 난이도에 드롭이 있을 때만 묶음을 처치한 수익 건으로 모은다', async () => {
    const confirmed = { ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard' as const, periodKey: PERIOD }

    await migrateDropsToConfirmedDifficulty(confirmed, [record(), record({ ocid: 'ocid-2', difficulty: 'extreme' })], NOW)
    expect(settleMock).not.toHaveBeenCalled()

    await migrateDropsToConfirmedDifficulty(confirmed, [record(), record({ difficulty: 'extreme' })], NOW)
    expect(settleMock.mock.calls).toEqual([[confirmed, 'group', NOW.toISOString()]])
  })
})
