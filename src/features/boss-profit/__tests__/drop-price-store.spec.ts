// 가격 기록 화면의 상태. 한 주를 놓고 값을 매기는 **쓰기** 화면이라,
// 히스토리(읽기 전용)와 달리 저장 경로가 함께 검증돼야 한다.
import { getCurrentBossProfitPeriod, getPeriodDateKeys } from '../../../lib/boss/boss-profit-period'
import type { BossDropRecord } from '../../../storage/boss-drops'

var mockModule0: Record<string, unknown>
jest.mock('../../../storage/boss-drops', () => {
  // `jest.resetModules` 가 레지스트리를 비워도 **같은 목**을 돌려준다.
  mockModule0 = mockModule0 ?? {
  getBossDropRecords: jest.fn(),
  replaceBossDropRecords: jest.fn(),
  // 창 표의 판. 이 스위트는 한 테스트 안에서 기록을 갈지 않으므로 고정이면 된다.
  getBossDropRecordsRevision: jest.fn(() => 0),
}
  return mockModule0
})
const {
  getBossDropRecords: getBossDropRecordsMock,
  replaceBossDropRecords: replaceBossDropRecordsMock,
  getBossDropRecordsRevision: getBossDropRecordsRevisionMock,
} = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>

// 서버 전송은 다른 기능이 소유한다(`features/server-sync`). 여기서는 **부르는지만** 본다 -
// 실제 전송을 태우면 이 스위트가 네트워크와 신원까지 짊어진다.
var mockServerSync: Record<string, unknown>
jest.mock('../../server-sync/drop-price-sync', () => {
  // 위 목들과 같은 이유다. `jest.resetModules` 뒤 다시 require 한 스토어가 **같은 목**을 봐야
  // 호출을 셀 수 있다. 팩토리에서 바로 만들면 회차마다 새 목이 생겨 호출 수가 늘 0 이다.
  mockServerSync = mockServerSync ?? { reportDropPrice: jest.fn() }
  return mockServerSync
})
const { reportDropPrice: reportDropPriceMock } = jest.requireMock(
  '../../server-sync/drop-price-sync',
) as Record<string, jest.Mock>
var mockModule1: Record<string, unknown>
jest.mock('../../../storage/boss-profit', () => {
  // `jest.resetModules` 가 레지스트리를 비워도 **같은 목**을 돌려준다.
  mockModule1 = mockModule1 ?? {
    getBossProfitRecords: jest.fn(),
    getRecordedCharacterOcids: jest.fn(),
    getWeeklyPeriodKeysWithRecords: jest.fn(),
    getBossProfitRecordsRevision: jest.fn(() => 0),
  }
  return mockModule1
})
const {
  getBossProfitRecords: getBossProfitRecordsMock,
  getRecordedCharacterOcids: getRecordedCharacterOcidsMock,
  getWeeklyPeriodKeysWithRecords: getWeeklyPeriodKeysWithRecordsMock,
} = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
var mockModule2: Record<string, unknown>
jest.mock('../../../storage/character-selection', () => {
  // `jest.resetModules` 가 레지스트리를 비워도 **같은 목**을 돌려준다.
  mockModule2 = mockModule2 ?? {
  getTrackedCharacterOcids: jest.fn(),
}
  return mockModule2
})
const { getTrackedCharacterOcids: getTrackedCharacterOcidsMock } = jest.requireMock('../../../storage/character-selection') as Record<string, jest.Mock>
var mockModule3: Record<string, unknown>
jest.mock('../../character-profile/resolve', () => {
  // `jest.resetModules` 가 레지스트리를 비워도 **같은 목**을 돌려준다.
  mockModule3 = mockModule3 ?? {
  resolveDisplayProfiles: jest.fn(),
}
  return mockModule3
})
const { resolveDisplayProfiles: resolveDisplayProfilesMock } = jest.requireMock('../../character-profile/resolve') as Record<string, jest.Mock>

var mockPartySettings: Record<string, unknown>
jest.mock('../../../storage/boss-party-settings', () => {
  // `jest.resetModules` 가 레지스트리를 비워도 **같은 목**을 돌려준다.
  mockPartySettings = mockPartySettings ?? { getBossPartySettings: jest.fn() }
  return mockPartySettings
})
const { getBossPartySettings: getBossPartySettingsMock } = jest.requireMock(
  '../../../storage/boss-party-settings',
) as Record<string, jest.Mock>
var mockPeriodOverrides: Record<string, unknown>
jest.mock('../../../storage/boss-party-period-overrides', () => {
  // `jest.resetModules` 가 레지스트리를 비워도 **같은 목**을 돌려준다.
  mockPeriodOverrides = mockPeriodOverrides ?? { getBossPartyPeriodOverrides: jest.fn() }
  return mockPeriodOverrides
})
const { getBossPartyPeriodOverrides: getBossPartyPeriodOverridesMock } = jest.requireMock(
  '../../../storage/boss-party-period-overrides',
) as Record<string, jest.Mock>

const PERIOD = '2026-08-06'
const MONTH = '2026-08'
/** 그 주에 실제로 든 날. 주차 경계를 테스트가 베끼지 않게 표에서 뽑는다. */
const 그주의날 = getPeriodDateKeys('weekly', PERIOD)[2]

function record(overrides: Partial<BossDropRecord> = {}): BossDropRecord {
  return {
    ocid: 'ocid-1',
    bossKey: 'lotus',
    boss: '스우',
    difficulty: 'hard',
    periodKey: PERIOD,
    dropIndex: 0,
    dropRecordId: 'drop-1',
    world: null,
    worldKey: null,
    category: 'equipment',
    itemKey: 'loose_control_machine_mark',
    itemName: '루즈 컨트롤 머신 마크',
    boxOriginKey: null,
    boxOrigin: null,
    ringLevel: null,
    quantity: 1,
    recordedAt: '2026-08-10T00:00:00.000Z',
    pricedAt: null,
    priceState: null,
    priceMeso: null,
    priceSplitMode: 'even',
    pricePartySize: null,
    priceShare: null,
    priceMyShare: null,
    saleFeePercent: null,
    splitFeePercent: null,
    saleFeeAuto: false,
    splitFeeAuto: false,
    ...overrides,
  }
}

beforeEach(async () => {
  // 실물은 다시 쓴 뒤 식별자 배열을 돌려준다. 목이 안 내주면 `undefined` 가 흘러 가격 저장이 던진다.
  replaceBossDropRecordsMock.mockResolvedValue([])
  jest.resetModules()
  getBossDropRecordsMock.mockReset().mockResolvedValue([record()])
  replaceBossDropRecordsMock.mockReset().mockResolvedValue(undefined)
  getBossDropRecordsRevisionMock.mockReset().mockReturnValue(0)
  getBossProfitRecordsMock.mockReset().mockResolvedValue([])
  getWeeklyPeriodKeysWithRecordsMock.mockReset().mockResolvedValue([])
  getTrackedCharacterOcidsMock.mockReset().mockResolvedValue(['ocid-1'])
  getRecordedCharacterOcidsMock.mockReset().mockResolvedValue([])
  getBossPartySettingsMock.mockReset().mockResolvedValue([])
  getBossPartyPeriodOverridesMock.mockReset().mockResolvedValue([])
  resolveDisplayProfilesMock
    .mockReset()
    .mockImplementation(async (ocids: readonly string[]) =>
      new Map(
        [...new Set(ocids)].map((ocid) => [
          ocid,
          { name: '지내우시', imageUrl: null, world: null, worldKey: null, level: null },
        ]),
      ),
    )
})

describe('load', () => {
  it('그 주의 드롭을 캐릭터별로 묶어 낸다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    const { status, groups } = useDropPriceStore.getState()
    expect(status).toBe('ready')
    // 그 주가 속한 달도 함께 읽는다. 그 달의 월간 보스가 이 주에 설 수 있다.
    expect(getBossDropRecordsMock).toHaveBeenCalledWith(
      ['ocid-1'],
      expect.arrayContaining([PERIOD, MONTH]),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].characterName).toBe('지내우시')
    expect(groups[0].entries[0].bossName).toBe('스우')
  })

  // 여기서 못 고치면 보스 수익과 가계부가 그 건수를 계속 `미입력 n` 으로 세는데 고칠 길이 없다.
  it('추적에서 빠진 캐릭터의 미입력 드롭도 조회 범위에 든다', async () => {
    getRecordedCharacterOcidsMock.mockResolvedValue(['ocid-1', 'ocid-해제'])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(getBossDropRecordsMock).toHaveBeenCalledWith(
      ['ocid-1', 'ocid-해제'],
      expect.arrayContaining([PERIOD, MONTH]),
    )
  })

  it('이름을 모르는 캐릭터는 그룹을 만들지 않는다. ocid 를 이름 대신 쓰지 않는다', async () => {
    resolveDisplayProfilesMock.mockResolvedValue(new Map())
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().groups).toEqual([])
  })

  it('조회가 실패하면 failed 다. 빈 목록으로 위장하지 않는다', async () => {
    getBossDropRecordsMock.mockRejectedValue(new Error('SQLite 실패'))
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().status).toBe('failed')
  })
})

// 가격 카드의 분배 처음 값. 처치를 기록하기 전에 적은 드롭도 보스 관리의 파티 설정으로 열려야 한다.
describe('load: 분배 처음 값', () => {
  const 조합 = { ocid: 'ocid-1', bossKey: 'lotus', difficulty: 'hard' }

  async function 처음값() {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    return useDropPriceStore.getState().groups[0].entries[0].defaultShare
  }

  // 처치할 때 인원이나 비율을 고쳤다면 그 기록이 그 판을 가장 정확히 말한다.
  it('처치 기록이 있으면 파티 설정보다 그 기록의 인원과 비율이 먼저다', async () => {
    getBossProfitRecordsMock.mockResolvedValue([
      { ...조합, boss: '스우', periodKey: PERIOD, partySize: 2, crystalMyShare: 3, crystalSharesTotal: 4 },
    ])
    getBossPartySettingsMock.mockResolvedValue([
      { ...조합, partySize: 6, crystalMyShare: null, crystalSharesTotal: null },
    ])

    expect(await 처음값()).toEqual({ mode: 'ratio', partySize: 2, myShare: 3, sharesTotal: 4 })
  })

  it('처치 기록이 없으면 그 기간만 고친 값이 파티 설정보다 먼저다', async () => {
    getBossPartyPeriodOverridesMock.mockResolvedValue([
      { ...조합, periodKey: PERIOD, partySize: 4, crystalMyShare: null, crystalSharesTotal: null },
    ])
    getBossPartySettingsMock.mockResolvedValue([
      { ...조합, partySize: 6, crystalMyShare: 1, crystalSharesTotal: 2 },
    ])

    expect(await 처음값()).toEqual({ mode: 'even', partySize: 4, myShare: 2, sharesTotal: 3 })
  })

  it('처치 기록도 그 기간 값도 없으면 보스 관리의 파티 설정으로 연다', async () => {
    getBossPartyPeriodOverridesMock.mockResolvedValue([
      // 다른 기간의 값은 이 기간에 안 쓴다.
      { ...조합, periodKey: '2026-07-30', partySize: 4, crystalMyShare: null, crystalSharesTotal: null },
    ])
    getBossPartySettingsMock.mockResolvedValue([
      { ...조합, partySize: 6, crystalMyShare: 1, crystalSharesTotal: 2 },
    ])

    expect(await 처음값()).toEqual({ mode: 'ratio', partySize: 6, myShare: 1, sharesTotal: 2 })
  })

  it('셋 다 없으면 1인 기본이다', async () => {
    expect(await 처음값()).toEqual({ mode: 'even', partySize: 1, myShare: 2, sharesTotal: 3 })
  })

  // 처음 값 하나 때문에 가격을 못 매기는 것보다 1인으로 여는 편이 낫다.
  it('파티 설정 읽기가 실패해도 화면은 열리고 1인 기본이다', async () => {
    getBossPartySettingsMock.mockRejectedValue(new Error('SQLite 실패'))
    getBossPartyPeriodOverridesMock.mockRejectedValue(new Error('SQLite 실패'))

    expect(await 처음값()).toEqual({ mode: 'even', partySize: 1, myShare: 2, sharesTotal: 3 })
  })
})

// 월간 보스(검은마법사) 드롭의 `period_key` 는 **달**이라 주간 키 조회에 안 걸린다. 보스 수익은
// 이미 그 보스를 주간 탭의 그 주에 세우므로(`filterRowsForTab`), 값을 매기는 자리도 같은 주에
// 세워야 한다. 안 그러면 그 드롭에 닿을 길이 앱 안에 없다.
describe('load: 그 주에 서는 월간 보스', () => {
  const 월간드롭 = (overrides: Partial<BossDropRecord> = {}): BossDropRecord =>
    record({ bossKey: 'black_mage', boss: '검은 마법사', difficulty: 'hard', periodKey: MONTH, ...overrides })

  const 월간수익기록 = (defeatedOn: string | null) => ({
    ocid: 'ocid-1',
    bossKey: 'black_mage',
    boss: '검은 마법사',
    difficulty: 'hard',
    periodKey: MONTH,
    cycle: 'monthly' as const,
    partySize: 1,
    payoutMeso: 0,
    defeatedOn,
  })

  it('그 주에 잡은 월간 보스의 드롭이 목록에 든다', async () => {
    getBossDropRecordsMock.mockResolvedValue([월간드롭()])
    getBossProfitRecordsMock.mockResolvedValue([월간수익기록(그주의날)])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    const entries = useDropPriceStore.getState().groups.flatMap((group) => group.entries)
    expect(entries.map((entry) => entry.bossName)).toEqual(['검은 마법사'])
    expect(entries[0].periodKey).toBe(MONTH)
  })

  // 한 달에 한 주에만 선다. 안 거르면 같은 드롭이 그 달 네댓 주에 모두 뜬다.
  it('다른 주에 잡은 월간 보스의 드롭은 안 든다', async () => {
    const 다른주의날 = getPeriodDateKeys('weekly', '2026-08-20')[2]
    getBossDropRecordsMock.mockResolvedValue([월간드롭()])
    getBossProfitRecordsMock.mockResolvedValue([월간수익기록(다른주의날)])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().groups).toEqual([])
  })

  // 값은 매길 수 있고 돈으로는 안 센다. 둘이 어긋나지 않는다.
  it('아직 안 잡은 월간 보스의 드롭은 이번 주에 선다', async () => {
    const 이번주 = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
    const 이번달 = 이번주.slice(0, 7)
    getBossDropRecordsMock.mockResolvedValue([월간드롭({ periodKey: 이번달 })])
    getBossProfitRecordsMock.mockResolvedValue([])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(이번주)

    expect(useDropPriceStore.getState().groups.flatMap((group) => group.entries)).toHaveLength(1)
  })

  it('달 키로 열면 그 달 하나만 읽는다. 주기를 이어받는 길은 그대로다', async () => {
    getBossDropRecordsMock.mockResolvedValue([월간드롭()])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(MONTH)

    expect(getBossDropRecordsMock).toHaveBeenCalledWith(['ocid-1'], expect.arrayContaining([MONTH]))
    // 달 키 창은 달만 든다. 그 안의 주 키는 안 읽는다.
    const [, queriedKeys] = getBossDropRecordsMock.mock.calls[0] as [string[], string[]]
    expect(queriedKeys.every((key) => key.length === MONTH.length)).toBe(true)
    expect(useDropPriceStore.getState().groups.flatMap((group) => group.entries)).toHaveLength(1)
  })
})

// 이 화면의 화살표는 한 칸씩 걸으므로 달력의 앞뒤 두 달이 곧 갈 수 있는 곳이다. 창을 통째로
// 읽어 두면 그 안의 이동은 조회가 0회다.
describe('창을 미리 든다', () => {
  it('창 전체를 조회 한 번으로 읽는다. 기간마다 따로 안 읽는다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(getBossDropRecordsMock).toHaveBeenCalledTimes(1)
    const [, queriedKeys] = getBossDropRecordsMock.mock.calls[0] as [string[], string[]]
    // 앞뒤 두 달치 리셋 주가 한 목록에 든다.
    expect(queriedKeys).toContain('2026-07-30')
    expect(queriedKeys).toContain('2026-08-13')
  })

  it('창 안의 다른 주로 옮기면 다시 안 읽는다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    getBossDropRecordsMock.mockClear()

    await useDropPriceStore.getState().load('2026-07-30')

    expect(getBossDropRecordsMock).not.toHaveBeenCalled()
    expect(useDropPriceStore.getState().status).toBe('ready')
    expect(useDropPriceStore.getState().periodKey).toBe('2026-07-30')
  })

  it('warmWindow 는 화면 상태를 안 건드린다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().warmWindow(PERIOD)

    expect(useDropPriceStore.getState().status).toBe('idle')
    expect(useDropPriceStore.getState().periodKey).toBeNull()
    // 미리 채워 뒀으므로 화면이 열릴 때는 조회가 없다.
    getBossDropRecordsMock.mockClear()
    await useDropPriceStore.getState().load(PERIOD)
    expect(getBossDropRecordsMock).not.toHaveBeenCalled()
    expect(useDropPriceStore.getState().groups).toHaveLength(1)
  })
})

// 아이템 가격 입력 버튼의 배지가 읽는 값. 창은 모듈 변수라 구독할 수 없어서, 채울 때 기간마다 센
// 수를 상태로 낸다. 배지 숫자는 그 주 화면에 서는 `입력` 알약 수와 같아야 한다.
describe('창을 채우면 기간마다 미입력 건수를 낸다', () => {
  it('값을 안 매긴 드롭만 센다. 입력함과 기록 안함은 안 센다', async () => {
    getBossDropRecordsMock.mockResolvedValue([
      record({ dropIndex: 0 }),
      record({ dropIndex: 1 }),
      record({ dropIndex: 2, priceState: 'entered', priceMeso: 1_000, priceShare: 1 }),
      record({ dropIndex: 3, priceState: 'excluded' }),
    ])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().warmWindow(PERIOD)

    expect(useDropPriceStore.getState().unpricedCounts[PERIOD]).toBe(2)
    // 창 안의 드롭 없는 주는 0 이다. 읽었더니 없더라 는 아는 수다.
    expect(useDropPriceStore.getState().unpricedCounts['2026-07-30']).toBe(0)
  })

  // 읽는 사이 쓰기가 끼면 그 답은 옛 판의 것이다. 옛 수를 내면 배지가 틀린 수를 말한다.
  it('읽는 사이 판이 바뀌면 그 수를 안 낸다', async () => {
    getBossDropRecordsMock.mockImplementation(async () => {
      getBossDropRecordsRevisionMock.mockReturnValue(1)
      return [record()]
    })
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().warmWindow(PERIOD)

    expect(useDropPriceStore.getState().unpricedCounts[PERIOD]).toBeUndefined()
  })

  it('읽기가 실패하면 수를 안 낸다. 모르는 수를 0 으로 말하지 않는다', async () => {
    getBossDropRecordsMock.mockRejectedValue(new Error('database is locked'))
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().warmWindow(PERIOD)

    expect(useDropPriceStore.getState().unpricedCounts[PERIOD]).toBeUndefined()
  })

  // 배지에는 실패를 보일 자리가 없고, 미입력 신호가 사라지는 것보다 직전 수가 낫다(사용자 결정).
  it('직전 수가 있는데 다시 읽기가 실패하면 직전 수를 둔다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().warmWindow(PERIOD)
    expect(useDropPriceStore.getState().unpricedCounts[PERIOD]).toBe(1)

    getBossDropRecordsRevisionMock.mockReturnValue(1)
    getBossDropRecordsMock.mockRejectedValue(new Error('database is locked'))
    await useDropPriceStore.getState().warmWindow(PERIOD)

    expect(getBossDropRecordsMock).toHaveBeenCalledTimes(2)
    expect(useDropPriceStore.getState().unpricedCounts[PERIOD]).toBe(1)
  })

  it('가격 입력 화면의 load 가 창을 채워도 같은 수를 낸다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')

    await useDropPriceStore.getState().load(PERIOD)

    expect(useDropPriceStore.getState().unpricedCounts[PERIOD]).toBe(1)
  })

  // 자동 기록처럼 쓰기가 몰려 오면 쓰기마다 창을 읽게 된다. 도는 채우기가 끝난 뒤 한 번만 다시 읽는다.
  it('채우는 중에 여러 번 불러도 끝난 뒤 한 번만 다시 채운다', async () => {
    let 판 = 0
    getBossDropRecordsRevisionMock.mockImplementation(() => 판)
    getBossDropRecordsMock.mockImplementation(async () => {
      판 += 1
      return [record()]
    })
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    const store = useDropPriceStore.getState()

    const first = store.warmWindow(PERIOD)
    void store.warmWindow(PERIOD)
    void store.warmWindow(PERIOD)
    await first
    // 줄 선 다시 채우기가 끝날 때까지 기다린다.
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(getBossDropRecordsMock).toHaveBeenCalledTimes(2)
  })
})

describe('savePrice · excludePrice', () => {
  it('그 그룹 전체를 replace-all 하되 대상 한 건에만 가격을 박는다', async () => {
    getBossDropRecordsMock.mockResolvedValue([
      record({ dropIndex: 0, itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크' }),
      record({
        dropIndex: 1,
        itemKey: 'restraint_ring',
        itemName: '리스트레인트 링',
        boxOriginKey: 'red_boss_ring_box',
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
      }),
    ])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[1]

    await useDropPriceStore.getState().savePrice(target, 1_200_000_000, { mode: 'even' as const, partySize: 1, myShare: 1, sharesTotal: 1 })

    const [, boss, difficulty, periodKey, drops] = replaceBossDropRecordsMock.mock.calls[0]
    expect([boss, difficulty, periodKey]).toEqual(['lotus', 'hard', PERIOD])
    // 같은 그룹의 다른 드롭은 손대지 않는다. replace-all 이라 함께 넘겨야 사라지지 않는다.
    expect(drops).toHaveLength(2)
    expect(drops[0].priceState).toBeUndefined()
    expect(drops[1]).toEqual(
      expect.objectContaining({ priceState: 'entered', priceMeso: 1_200_000_000, priceShare: 1 }),
    )
    // 저장이 끝난 뒤 그 한 건을 서버로 보낸다. 식별자만 넘기고 값은 전송 쪽이 다시 읽는다.
    expect(reportDropPriceMock).toHaveBeenCalledWith('drop-1', expect.any(Date))
    // 가격만 고친다. 다시 쓰면서 key 를 빠뜨리면 그 기록이 그림과 판정을 잃는다.
    expect(drops[0]).toEqual(expect.objectContaining({ itemKey: 'loose_control_machine_mark' }))
    expect(drops[1]).toEqual(
      expect.objectContaining({ itemKey: 'restraint_ring', boxOriginKey: 'red_boss_ring_box' }),
    )
  })

  // 비율 칸 값은 카드가 비율 씨앗으로 들고 온 것이다. 균등 기록에 남으면 수수료 계산이 비율 식으로 샌다.
  it('기본으로 저장하면 내 비율 칸을 비운다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await useDropPriceStore.getState().savePrice(target, 1_200_000_000, { mode: 'even' as const, partySize: 3, myShare: 2, sharesTotal: 3 })

    const [, , , , drops] = replaceBossDropRecordsMock.mock.calls[0]
    expect(drops[0]).toEqual(expect.objectContaining({ priceSplitMode: 'even', pricePartySize: 3 }))
    expect(drops[0].priceMyShare).toBeUndefined()
  })

  it('메모리의 드롭에 식별자가 없으면 저장소가 돌려준 식별자로 보낸다', async () => {
    // 시트에서 방금 기록한 드롭은 식별자가 없다. INSERT 에서 처음 생기므로 저장 뒤 돌려받은 값을 쓴다.
    getBossDropRecordsMock.mockResolvedValue([
      record({ dropIndex: 0, itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크' }),
      record({ dropIndex: 1, itemKey: 'restraint_ring', itemName: '리스트레인트 링', boxOriginKey: 'red_boss_ring_box', boxOrigin: '홍옥의 보스 반지 상자', ringLevel: 3 }),
    ])
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const groups = useDropPriceStore.getState().groups
    useDropPriceStore.setState({
      groups: groups.map((group) => ({
        ...group,
        entries: group.entries.map((entry) => ({ ...entry, drop: { ...entry.drop, dropRecordId: null } })),
      })),
    })
    replaceBossDropRecordsMock.mockResolvedValue(['id-0', 'id-1'])
    const target = useDropPriceStore.getState().groups[0].entries[1]

    await useDropPriceStore.getState().savePrice(target, 1_200_000_000, { mode: 'even' as const, partySize: 1, myShare: 1, sharesTotal: 1 })

    expect(reportDropPriceMock).toHaveBeenCalledWith('id-1', expect.any(Date))
  })

  it('저장하면 화면 상태도 즉시 갱신된다. 재조회를 기다리지 않는다', async () => {
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await useDropPriceStore.getState().savePrice(target, 6_000_000_000, { mode: 'even' as const, partySize: 2, myShare: 1, sharesTotal: 2 })

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

  it('저장이 실패하면 던진다. 화면이 토스트로 알릴 수 있어야 한다', async () => {
    replaceBossDropRecordsMock.mockRejectedValue(new Error('쓰기 실패'))
    const { useDropPriceStore } = require('../drop-price-store') as typeof import('../drop-price-store')
    await useDropPriceStore.getState().load(PERIOD)
    const target = useDropPriceStore.getState().groups[0].entries[0]

    await expect(useDropPriceStore.getState().savePrice(target, 1, { mode: 'even' as const, partySize: 1, myShare: 1, sharesTotal: 1 })).rejects.toThrow()
  })
})
