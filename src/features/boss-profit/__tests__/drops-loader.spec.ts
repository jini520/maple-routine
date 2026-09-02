// ⚠️ 가격이 조용히 사라지는 자리 그 ③ (의 정정. 변환기는 둘이 아니라 셋이다).
//
// 이 경로가 **가장 뜨겁다**. 기간을 로드할 때마다 돈다. 저장은 멀쩡한데 화면만 "미입력"으로
// 보이던 증상(사용자 보고 2026-08-10: "지난주 갔다 오니 아이템 수익이 사라진다")의 원인이었다.
// 시트에서 값을 넣은 직후에는 스토어가 들고 있는 값이라 보이고, 기간을 왕복하면 DB에서 다시
// 읽으면서 가격만 떨어져 나갔다.
import type { BossDropRecord } from '../../../storage/boss-drops'
import type { BossProfitRow } from '../rows'

jest.mock('../../../storage/boss-drops', () => ({
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
}))
const { getBossDropRecords: getBossDropRecordsMock, replaceBossDropRecords: replaceBossDropRecordsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>

const PERIOD = '2026-08-06'

function row(overrides: Partial<BossProfitRow> = {}): BossProfitRow {
  return {
    ocid: 'ocid-1',
    characterName: '지내우시',
    imageUrl: null,
    world: null,
    boss: '스우',
    difficulty: '하드',
    cycle: 'weekly',
    periodKey: PERIOD,
    periodLabel: '이번 주',
    priceMeso: 20_400_000_000,
    maxPartySize: 6,
    partySize: 3,
    payoutMeso: 6_800_000_000,
    isComplete: true,
    ...overrides,
  }
}

function record(overrides: Partial<BossDropRecord> = {}): BossDropRecord {
  return {
    ocid: 'ocid-1',
    boss: '스우',
    difficulty: '하드',
    periodKey: PERIOD,
    dropIndex: 0,
    category: 'equipment',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-10T00:00:00.000Z',
    priceState: 'entered',
    priceMeso: 15_000_000_000,
    priceShare: 3,
    ...overrides,
  }
}

beforeEach(() => {
  getBossDropRecordsMock.mockReset().mockResolvedValue([record()])
  replaceBossDropRecordsMock.mockReset().mockResolvedValue(undefined)
})

describe('loadDropsByRowKey: 가격 생존', () => {
  it('DB에서 읽은 가격을 화면 상태로 그대로 옮긴다', async () => {
    const { loadDropsByRowKey } = require('../drops-loader') as typeof import('../drops-loader')

    const map = await loadDropsByRowKey(['ocid-1'], [row()], new Date('2026-08-10T00:00:00Z'))

    expect(map[`ocid-1|스우|하드|${PERIOD}`]).toEqual([
      expect.objectContaining({
        itemName: '루즈 컨트롤 머신 마크',
        priceState: 'entered',
        priceMeso: 15_000_000_000,
        priceShare: 3,
      }),
    ])
  })

  it('스킵 상태도 옮긴다. 미입력으로 되돌아가면 다시 묻게 된다', async () => {
    getBossDropRecordsMock.mockResolvedValue([
      record({ priceState: 'excluded', priceMeso: null, priceShare: null }),
    ])
    const { loadDropsByRowKey } = require('../drops-loader') as typeof import('../drops-loader')

    const map = await loadDropsByRowKey(['ocid-1'], [row()], new Date('2026-08-10T00:00:00Z'))

    expect(map[`ocid-1|스우|하드|${PERIOD}`][0].priceState).toBe('excluded')
  })

  it('prune 이 DB에 다시 쓸 때도 살아남은 드롭의 가격을 함께 쓴다', async () => {
    // 컴플리트 언더컨트롤은 스우 익스트림 전용. 하드 확정 행에서는 탈락한다.
    getBossDropRecordsMock.mockResolvedValue([
      record({ dropIndex: 0 }),
      record({ dropIndex: 1, itemName: '컴플리트 언더컨트롤', slot: null, priceState: null, priceMeso: null, priceShare: null }),
    ])
    const { loadDropsByRowKey } = require('../drops-loader') as typeof import('../drops-loader')

    await loadDropsByRowKey(['ocid-1'], [row()], new Date('2026-08-10T00:00:00Z'))

    const [, , , , written] = replaceBossDropRecordsMock.mock.calls[0]
    expect(written).toEqual([
      expect.objectContaining({ itemName: '루즈 컨트롤 머신 마크', priceMeso: 15_000_000_000 }),
    ])
  })
})
