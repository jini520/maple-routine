// 아이템 가격 입력 버튼의 배지 수. 판이 바뀔 때마다 그 주 창을 다시 채우고, 다시 세는 동안에는 직전
// 수를 둔다. 한 번도 못 셌으면 모르는 수라 `null` 이다.
import { act, renderHook, waitFor } from '@testing-library/react-native'

import type { BossDropRecord } from '../../../storage/boss-drops'

var mockDropListeners: Set<() => void>
var mockDropRevision: { value: number }
var mockDropsModule: Record<string, unknown>
jest.mock('../../../storage/boss-drops', () => {
  mockDropListeners = mockDropListeners ?? new Set()
  mockDropRevision = mockDropRevision ?? { value: 0 }
  mockDropsModule = mockDropsModule ?? {
    getBossDropRecords: jest.fn(),
    replaceBossDropRecords: jest.fn(),
    getBossDropRecordsRevision: () => mockDropRevision.value,
    subscribeBossDropRecordsRevision: (listener: () => void) => {
      mockDropListeners.add(listener)
      return () => {
        mockDropListeners.delete(listener)
      }
    },
  }
  return mockDropsModule
})
var mockProfitModule: Record<string, unknown>
jest.mock('../../../storage/boss-profit', () => {
  mockProfitModule = mockProfitModule ?? {
    getBossProfitRecords: jest.fn(async () => []),
    getRecordedCharacterOcids: jest.fn(async () => []),
    getWeeklyPeriodKeysWithRecords: jest.fn(async () => []),
    getBossProfitRecordsRevision: () => 0,
    subscribeBossProfitRecordsRevision: () => () => {},
  }
  return mockProfitModule
})
jest.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: jest.fn(async () => ['ocid-1']),
}))
jest.mock('../../character-profile/resolve', () => ({
  resolveDisplayProfiles: jest.fn(async (ocids: readonly string[]) =>
    new Map([...new Set(ocids)].map((ocid) => [ocid, { name: '지내우시', imageUrl: null, world: null, worldKey: null, level: null }])),
  ),
}))

const getBossDropRecordsMock = jest.requireMock('../../../storage/boss-drops').getBossDropRecords as jest.Mock

import { useDropPriceStore } from '../drop-price-store'
import { useUnpricedDropCount } from '../use-unpriced-drop-count'

const PERIOD = '2026-08-06'

function record(dropIndex: number, overrides: Partial<BossDropRecord> = {}): BossDropRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: PERIOD,
    dropIndex,
    category: 'equipment',
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    slot: '얼굴장식',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-10T00:00:00.000Z',
    priceState: null,
    priceMeso: null,
    priceSplitMode: 'even',
    priceShare: null,
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: false,
    splitFeeAuto: false,
    ...overrides,
  }
}

/** 저장 계층의 쓰기 한 번. 판이 오르고 구독자가 불린다. */
function 쓰기(): void {
  mockDropRevision.value += 1
  for (const listener of [...mockDropListeners]) listener()
}

beforeEach(() => {
  getBossDropRecordsMock.mockReset().mockResolvedValue([record(0), record(1)])
  // 창과 센 수는 모듈 수준이라 테스트를 건너 산다. 판을 올려 앞 테스트의 창을 낡게 하고, 센 수는
  // 비워 한 번도 못 센 상태에서 시작한다.
  mockDropRevision.value += 1
  useDropPriceStore.setState({ unpricedCounts: {} })
})

describe('useUnpricedDropCount', () => {
  it('창을 읽기 전에는 모르는 수(null)이고, 읽으면 그 주의 미입력 건수다', async () => {
    let 풀기: (records: BossDropRecord[]) => void = () => {}
    getBossDropRecordsMock.mockReturnValue(new Promise<BossDropRecord[]>((resolve) => (풀기 = resolve)))
    const { result } = await renderHook(() => useUnpricedDropCount(PERIOD))

    expect(result.current).toBeNull()
    await act(async () => {
      풀기([record(0), record(1)])
    })
    await waitFor(() => expect(result.current).toBe(2))
  })

  it('쓰기로 판이 바뀌면 다시 세는 동안 직전 수를 두고, 다 세면 새 수로 바뀐다', async () => {
    const { result } = await renderHook(() => useUnpricedDropCount(PERIOD))
    await waitFor(() => expect(result.current).toBe(2))

    let 풀기: (records: BossDropRecord[]) => void = () => {}
    getBossDropRecordsMock.mockReturnValue(new Promise<BossDropRecord[]>((resolve) => (풀기 = resolve)))
    await act(async () => {
      쓰기()
    })

    expect(getBossDropRecordsMock).toHaveBeenCalledTimes(2)
    expect(result.current).toBe(2)
    await act(async () => {
      풀기([record(0), record(1, { priceState: 'entered', priceMeso: 1, priceShare: 1 })])
    })
    await waitFor(() => expect(result.current).toBe(1))
  })

  it('첫 읽기가 실패하면 모르는 수(null)다', async () => {
    getBossDropRecordsMock.mockRejectedValue(new Error('database is locked'))
    const { result } = await renderHook(() => useUnpricedDropCount(PERIOD))

    await waitFor(() => expect(getBossDropRecordsMock).toHaveBeenCalledTimes(1))
    await act(async () => {})
    expect(result.current).toBeNull()
  })

  // 배지에는 실패를 보일 자리가 없고, 미입력 신호가 사라지는 것보다 직전 수가 낫다(사용자 결정).
  it('직전 수가 있는데 다시 세기가 실패하면 직전 수를 둔다', async () => {
    const { result } = await renderHook(() => useUnpricedDropCount(PERIOD))
    await waitFor(() => expect(result.current).toBe(2))

    getBossDropRecordsMock.mockRejectedValue(new Error('database is locked'))
    await act(async () => {
      쓰기()
    })

    await waitFor(() => expect(getBossDropRecordsMock).toHaveBeenCalledTimes(2))
    await act(async () => {})
    expect(result.current).toBe(2)
  })

  it('보는 주가 바뀌면 그 주의 수를 낸다', async () => {
    getBossDropRecordsMock.mockResolvedValue([record(0), record(1), record(2, { periodKey: '2026-07-30' })])
    const { result, rerender } = await renderHook(
      (props: { periodKey: string }) => useUnpricedDropCount(props.periodKey),
      { initialProps: { periodKey: PERIOD } },
    )
    await waitFor(() => expect(result.current).toBe(2))

    await rerender({ periodKey: '2026-07-30' })

    await waitFor(() => expect(result.current).toBe(1))
  })
})
