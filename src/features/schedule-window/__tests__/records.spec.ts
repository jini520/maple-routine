// 창의 관측으로 기록을 굳힌다. 이 파일이 지키는 것 셋.
//
// ① **그 기간의 확정 상태는 조회 가능한 마지막 날의 응답**이다. 한 기간에 관측이 여러 개라
//    어느 것이 처치 난이도를 확정하는지가 규칙이어야 한다.
// ② **이미 있는 행은 안 건드린다.** 파티원 수·가격을 사용자가 고쳐 둘 수 있다.
// ③ **주기가 다른 보스는 다른 기간에 든다.** 검은마법사는 달 키로, 나머지는 주 키로.

jest.mock('../../../storage/schedule-probe-ledger', () => {
  const actual = jest.requireActual<typeof import('../../../storage/schedule-probe-ledger')>(
    '../../../storage/schedule-probe-ledger',
  )
  return { ...actual, getScheduleProbeLedger: jest.fn() }
})
jest.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: jest.fn(),
  upsertBossProfitRecord: jest.fn(),
}))
jest.mock('../../../storage/boss-drops', () => ({ getBossDropRecords: jest.fn(), replaceBossDropRecords: jest.fn() }))
jest.mock('../../../storage/boss-party-settings', () => ({ getBossPartySize: jest.fn() }))
jest.mock('../../../storage/character-basic-cache', () => ({ getCachedCharacterBasic: jest.fn() }))

import { recordBossProfitFromWindow } from '../records'

const { getScheduleProbeLedger: getLedgerMock } = jest.requireMock('../../../storage/schedule-probe-ledger') as Record<string, jest.Mock>
const { getBossProfitRecords: getRecordsMock, upsertBossProfitRecord: upsertMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const { getBossDropRecords: getDropsMock, replaceBossDropRecords: replaceDropsMock } = jest.requireMock('../../../storage/boss-drops') as Record<string, jest.Mock>
const { getBossPartySize: getPartySizeMock } = jest.requireMock('../../../storage/boss-party-settings') as Record<string, jest.Mock>
const { getCachedCharacterBasic: getBasicMock } = jest.requireMock('../../../storage/character-basic-cache') as Record<string, jest.Mock>

// KST 2026-09-05(토). 창은 8/23 ~ 9/4. 이번 주는 09-03, 지난 주는 08-27, 그 앞은 08-20.
const NOW = new Date('2026-09-05T03:00:00.000Z')

function observed(bosses: string[]) {
  return { kind: 'observed' as const, hasCompletion: bosses.length > 0, sections: {}, bosses }
}

beforeEach(() => {
  getLedgerMock.mockReset().mockResolvedValue({ unavailable: false, dates: {} })
  getRecordsMock.mockReset().mockResolvedValue([])
  upsertMock.mockReset().mockResolvedValue(undefined)
  getDropsMock.mockReset().mockResolvedValue([])
  replaceDropsMock.mockReset().mockResolvedValue(undefined)
  getPartySizeMock.mockReset().mockResolvedValue(null)
  getBasicMock.mockReset().mockResolvedValue({ profile: { world: '스카니아' } })
})

const upserted = () =>
  upsertMock.mock.calls.map(([r]) => `${r.boss}|${r.difficulty}|${r.cycle}|${r.periodKey}`)

describe('그 기간의 확정 상태는 조회 가능한 마지막 날의 응답이다', () => {
  it('같은 주의 마지막 관측이 이긴다. 앞의 관측은 그 기간을 안 정한다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: {
        // 08-27 주(8/27~9/2). 앞날엔 하드, 마지막 날엔 익스트림으로 잡혀 있다.
        '2026-08-28': observed(['스우|하드']),
        '2026-09-02': observed(['스우|익스트림']),
      },
    })

    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upserted()).toContain('스우|익스트림|weekly|2026-08-27')
    expect(upserted()).not.toContain('스우|하드|weekly|2026-08-27')
  })

  it('주기가 다르면 다른 기간 키로 든다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: { '2026-09-04': observed(['스우|하드', '검은마법사|하드']) },
    })

    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upserted()).toContain('스우|하드|weekly|2026-09-03')
    expect(upserted()).toContain('검은마법사|하드|monthly|2026-09')
  })
})

describe('이미 있는 행은 안 건드린다', () => {
  it('같은 키의 기록이 있으면 다시 안 쓴다. 파티원 수를 덮으면 안 된다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: { '2026-09-04': observed(['스우|하드']) },
    })
    getRecordsMock.mockResolvedValue([
      { ocid: 'o1', boss: '스우', difficulty: '하드', cycle: 'weekly', periodKey: '2026-09-03', partySize: 3 },
    ])

    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upserted()).not.toContain('스우|하드|weekly|2026-09-03')
  })
})

describe('안 쓰는 길', () => {
  it('관측이 없으면 아무것도 안 쓴다', async () => {
    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('조회할 수 없는 캐릭터는 건너뛴다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: true,
      dates: { '2026-09-04': observed(['스우|하드']) },
    })

    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('그날 완료가 0건이면 그 기간엔 쓸 것이 없다', async () => {
    getLedgerMock.mockResolvedValue({ unavailable: false, dates: { '2026-09-04': observed([]) } })

    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upsertMock).not.toHaveBeenCalled()
  })
})

// store.spec 에서 옮겨 온 커버리지 둘. 백필이 하던 일이 이 모듈로 왔다.
describe('처치 난이도 확정', () => {
  it('그룹당 실제 처치 난이도 하나만 기록한다. 이중 기록을 막는다', async () => {
    // 원장의 `bosses` 는 `selectBossProfitBosses` 를 이미 탄 값이라 그룹당 하나뿐이다.
    // 등록 난이도(하드)가 아니라 실제 처치 난이도(익스트림)가 온다.
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: { '2026-09-04': observed(['스우|익스트림']) },
    })

    await recordBossProfitFromWindow(['o1'], NOW)

    const 스우행 = upserted().filter((key) => key.startsWith('스우|'))
    expect(스우행).toEqual(['스우|익스트림|weekly|2026-09-03'])
  })

  it('확정 난이도로 옛 난이도 키의 드롭을 옮긴다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: { '2026-09-04': observed(['스우|익스트림']) },
    })
    getDropsMock.mockResolvedValue([
      {
        ocid: 'o1',
        boss: '스우',
        difficulty: '하드',
        periodKey: '2026-09-03',
        dropIndex: 0,
        category: 'equipment',
        itemName: '루즈 컨트롤 머신 마크',
        slot: '얼굴장식',
        boxOrigin: null,
        ringLevel: null,
        quantity: 1,
        recordedAt: '2026-09-04T00:00:00.000Z',
        priceState: null,
        priceMeso: null,
        priceShare: null,
      },
    ])

    await recordBossProfitFromWindow(['o1'], NOW)

    // 이관은 `이미 기록됨` 판정보다 앞이라 수익 행이 있든 없든 일어난다.
    expect(replaceDropsMock).toHaveBeenCalled()
  })
})

// ⚠️ 한 기간의 쓰기 실패가 나머지를 죽이면 안 된다. 쓰기는 타임아웃을 성공으로 위장하지 않아
// 실제로 던진다(`withSqliteTimeout`). 옛 백필은 (캐릭터, 기간)마다 자기 try 를 가졌다.
describe('한 기간이 죽어도 나머지는 산다', () => {
  it('앞 기간의 쓰기가 던져도 뒤 기간을 쓴다', async () => {
    getLedgerMock.mockResolvedValue({
      unavailable: false,
      dates: {
        '2026-09-04': observed(['스우|하드']),
        '2026-09-02': observed(['벨로나|노멀']),
      },
    })
    // 이번 주(2026-09-03)를 먼저 돈다. 그 쓰기만 던지게 한다.
    upsertMock.mockImplementation(async (record: { periodKey: string }) => {
      if (record.periodKey === '2026-09-03') throw new Error('sqlite timeout')
    })

    await recordBossProfitFromWindow(['o1'], NOW)

    expect(upserted()).toContain('벨로나|노멀|weekly|2026-08-27')
  })

  it('한 캐릭터가 죽어도 다음 캐릭터를 쓴다', async () => {
    getLedgerMock.mockImplementation(async (ocid: string) =>
      ocid === 'o1'
        ? Promise.reject(new Error('preferences'))
        : { unavailable: false, dates: { '2026-09-04': observed(['스우|하드']) } },
    )

    await recordBossProfitFromWindow(['o1', 'o2'], NOW)

    expect(upserted()).toContain('스우|하드|weekly|2026-09-03')
  })
})

// ⚠️ 실기기에서 본 상태 그대로. 기록만 지우는 캐시 삭제는 원장을 안 건드리므로, 원장에는
// 13일이 그대로 남아 있고 기록은 라이브 동기화가 만든 이번 주 것뿐이다. 그때 **지난 주 기록이
// 원장만으로 되살아나야** 한다. 되살아나지 않으면 화면이 그 주를 실패로 그린다.
it('기록만 지운 뒤 원장만으로 지난 주가 되살아난다', async () => {
  getLedgerMock.mockResolvedValue({
    unavailable: false,
    dates: {
      '2026-08-26': observed(['스우|하드']),
      '2026-09-02': observed(['벨로나|노멀']),
      '2026-09-04': observed(['카링|노멀']),
    },
  })
  // 이번 주만 이미 기록돼 있다(라이브 자동 기록).
  getRecordsMock.mockImplementation(async (_ocids: string[], keys: string[]) =>
    keys.includes('2026-09-03')
      ? [{ ocid: 'o1', boss: '카링', difficulty: '노멀', cycle: 'weekly', periodKey: '2026-09-03' }]
      : [],
  )

  await recordBossProfitFromWindow(['o1'], NOW)

  expect(upserted()).toContain('벨로나|노멀|weekly|2026-08-27')
  expect(upserted()).toContain('스우|하드|weekly|2026-08-20')
  // 이번 주는 이미 있으니 다시 안 쓴다.
  expect(upserted()).not.toContain('카링|노멀|weekly|2026-09-03')
})
