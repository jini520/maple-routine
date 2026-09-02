// 가격 기록 화면의 상태. 한 주를 놓고 값을 매기는 **쓰기** 화면이라,
// 히스토리(읽기 전용)와 달리 저장 경로가 함께 검증돼야 한다.
import type { BossDropRecord } from '../../../storage/boss-drops'

var mockModule0: Record<string, unknown>
jest.mock('../../../storage/boss-drops', () => {
  // `jest.resetModules()` 가 레지스트리를 비워도 **같은 목**을 돌려준다. vitest 의
  // `vi.hoisted` 가 그 경계를 넘어 살아남던 것을 여기서 재현한다.
  mockModule0 = mockModule0 ?? {
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
}
  return mockModule0
})
const { getBossDropRecords: getBossDropRecordsMock, replaceBossDropRecords: replaceBossDropRecordsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>
var mockModule1: Record<string, unknown>
jest.mock('../../../storage/boss-profit', () => {
  // `jest.resetModules()` 가 레지스트리를 비워도 **같은 목**을 돌려준다. vitest 의
  // `vi.hoisted` 가 그 경계를 넘어 살아남던 것을 여기서 재현한다.
  mockModule1 = mockModule1 ?? { getBossProfitRecords: jest.fn() }
  return mockModule1
})
const { getBossProfitRecords: getBossProfitRecordsMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
var mockModule2: Record<string, unknown>
jest.mock('../../../storage/character-selection', () => {
  // `jest.resetModules()` 가 레지스트리를 비워도 **같은 목**을 돌려준다. vitest 의
  // `vi.hoisted` 가 그 경계를 넘어 살아남던 것을 여기서 재현한다.
  mockModule2 = mockModule2 ?? {
  getTrackedCharacterOcids: jest.fn(),
}
  return mockModule2
})
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
var mockModule3: Record<string, unknown>
jest.mock('../../../storage/character-basic-cache', () => {
  // `jest.resetModules()` 가 레지스트리를 비워도 **같은 목**을 돌려준다. vitest 의
  // `vi.hoisted` 가 그 경계를 넘어 살아남던 것을 여기서 재현한다.
  mockModule3 = mockModule3 ?? {
  getCachedCharacterBasic: jest.fn(),
}
  return mockModule3
})
const { getCachedCharacterBasic: getCachedCharacterBasicMock } = jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>

const PERIOD = '2026-08-06'

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
    priceState: null,
    priceMeso: null,
    priceShare: null,
    ...overrides,
  }
}

beforeEach(async () => {
  jest.resetModules()
  getBossDropRecordsMock.mockReset().mockResolvedValue([record()])
  replaceBossDropRecordsMock.mockReset().mockResolvedValue(undefined)
  getBossProfitRecordsMock.mockReset().mockResolvedValue([])
  getTrackedCharacterOcidsMock.mockReset().mockResolvedValue(['ocid-1'])
  getCachedCharacterBasicMock
    .mockReset()
    .mockResolvedValue({ profile: { name: '지내우시', imageUrl: null } })
})

describe('load', () => {
  it('그 주의 드롭을 캐릭터별로 묶어 낸다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    const { status, groups } = useDropPriceStore.getState()
    expect(status).toBe('ready')
    expect(getBossDropRecordsMock).toHaveBeenCalledWith(['ocid-1'], [PERIOD])
    expect(groups).toHaveLength(1)
    expect(groups[0].characterName).toBe('지내우시')
    expect(groups[0].entries[0].boss).toBe('스우')
  })

  it('분배 인원 기본값은 그 행의 파티원 수다 — 기록이 없으면 1인', async () => {
    getBossProfitRecordsMock.mockResolvedValue([
      { ocid: 'ocid-1', boss: '스우', difficulty: '하드', periodKey: PERIOD, partySize: 3 },
    ])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().groups[0].entries[0].partySize).toBe(3)
  })

  it('이름을 모르는 캐릭터는 그룹을 만들지 않는다 — ocid 를 이름 대신 쓰지 않는다', async () => {
    getCachedCharacterBasicMock.mockResolvedValue(null)
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().groups).toEqual([])
  })

  it('조회가 실패하면 failed 다 — 빈 목록으로 위장하지 않는다', async () => {
    getBossDropRecordsMock.mockRejectedValue(new Error('SQLite 실패'))
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().status).toBe('failed')
  })
})

describe('savePrice · excludePrice', () => {
  it('그 그룹 전체를 replace-all 하되 대상 한 건에만 가격을 박는다', async () => {
    getBossDropRecordsMock.mockResolvedValue([
      record({ dropIndex: 0, itemName: '루즈 컨트롤 머신 마크' }),
      record({ dropIndex: 1, itemName: '리스트레인트 링', boxOrigin: '홍옥의 보스 반지 상자', ringLevel: 3 }),
    ])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[1]

    await useDropPriceStore.getState().savePrice(target, 1_200_000_000, 1)

    const [, boss, difficulty, periodKey, drops] = replaceBossDropRecordsMock.mock.calls[0]
    expect([boss, difficulty, periodKey]).toEqual(['스우', '하드', PERIOD])
    // 같은 그룹의 다른 드롭은 손대지 않는다. replace-all 이라 함께 넘겨야 사라지지 않는다.
    expect(drops).toHaveLength(2)
    expect(drops[0].priceState).toBeUndefined()
    expect(drops[1]).toEqual(
      expect.objectContaining({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 1 }),
    )
  })

  it('저장하면 화면 상태도 즉시 갱신된다 — 재조회를 기다리지 않는다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await useDropPriceStore.getState().savePrice(target, 6_000_000_000, 2)

    expect(useDropPriceStore.getState().groups[0].entries[0].drop).toEqual(
      expect.objectContaining({ priceState: 'entered', priceMeso: 6_000_000_000, priceShare: 2 }),
    )
  })

  it('기록 안함은 금액 없이 상태만 남긴다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await useDropPriceStore.getState().excludePrice(target)

    const drop = useDropPriceStore.getState().groups[0].entries[0].drop
    expect(drop.priceState).toBe('excluded')
    expect(drop.priceMeso).toBeUndefined()
  })

  it('저장이 실패하면 던진다 — 화면이 토스트로 알릴 수 있어야 한다', async () => {
    replaceBossDropRecordsMock.mockRejectedValue(new Error('쓰기 실패'))
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await expect(useDropPriceStore.getState().savePrice(target, 1, 1)).rejects.toThrow()
  })
})

// 2026-08-10 사용자 보고 — "가격 입력하고 보스 수익으로 가면 새로고침해야 반영된다".
//
// 두 스토어가 같은 테이블(`boss_drop_records`)을 각자 캐시한다. 보스 수익은 스택 화면 왕복에도
// 마운트를 유지하므로 여기서 쓴 값을 **알려주지 않으면 옛 스냅샷을 계속 그린다**.
describe('보스 수익 스토어 동기화', () => {
  it('저장하면 보스 수익의 dropsByRowKey 도 함께 갱신된다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    const { useBossProfitStore } = require('../store') as typeof import('../store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await useDropPriceStore.getState().savePrice(target, 6_000_000_000, 2)

    expect(useBossProfitStore.getState().dropsByRowKey[`ocid-1|스우|하드|${PERIOD}`]).toEqual([
      expect.objectContaining({ priceState: 'entered', priceMeso: 6_000_000_000, priceShare: 2 }),
    ])
  })

  it('기록 안함도 마찬가지로 전파된다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    const { useBossProfitStore } = require('../store') as typeof import('../store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await useDropPriceStore.getState().excludePrice(target)

    expect(
      useBossProfitStore.getState().dropsByRowKey[`ocid-1|스우|하드|${PERIOD}`][0].priceState,
    ).toBe('excluded')
  })

  it('쓰기가 실패하면 전파하지 않는다 — 저장되지 않은 값이 화면에 남으면 안 된다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    const { useBossProfitStore } = require('../store') as typeof import('../store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]
    replaceBossDropRecordsMock.mockRejectedValue(new Error('쓰기 실패'))

    await expect(useDropPriceStore.getState().savePrice(target, 1, 1)).rejects.toThrow()

    expect(useBossProfitStore.getState().dropsByRowKey[`ocid-1|스우|하드|${PERIOD}`]).toBeUndefined()
  })
})
