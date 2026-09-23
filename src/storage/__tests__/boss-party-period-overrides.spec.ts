import type { BossPartyPeriodOverride } from '../boss-party-period-overrides'

jest.mock('../sqlite/db', () => ({
  getBossProfitDb: jest.fn(),
}))
const { getBossProfitDb: getBossProfitDbMock } = jest.requireMock('../sqlite/db') as Record<string, jest.Mock>

const runMock = jest.fn()
const queryMock = jest.fn()

const fakeDb = { run: runMock, query: queryMock }

beforeEach(() => {
  runMock.mockReset().mockResolvedValue({ changes: { changes: 1 } })
  queryMock.mockReset().mockResolvedValue({ values: [] })
  getBossProfitDbMock.mockReset().mockResolvedValue(fakeDb)
})

const sample: BossPartyPeriodOverride = {
  ocid: 'ocid-1',
  bossKey: 'black_mage',
  difficulty: 'extreme',
  periodKey: '2026-W39',
  partySize: 3,
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
  splitFeeAuto: false,
  updatedAt: '2026-09-23T00:05:00.000Z',
}

describe('setBossPartyPeriodOverride', () => {
  it('같은 기간을 두 번 고치면 덮어쓴다', async () => {
    const { setBossPartyPeriodOverride } =
      require('../boss-party-period-overrides') as typeof import('../boss-party-period-overrides')

    await setBossPartyPeriodOverride(sample)
    await setBossPartyPeriodOverride({ ...sample, partySize: 2, updatedAt: '2026-09-23T01:00:00.000Z' })

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('ON CONFLICT(ocid, boss_key, difficulty, period_key) DO UPDATE SET')
    expect(values).toEqual([
      'ocid-1',
      'black_mage',
      'extreme',
      '2026-W39',
      3,
      null,
      null,
      null,
      null,
      '2026-09-23T00:05:00.000Z',
    ])
    expect(runMock.mock.calls[1][1][4]).toBe(2)
  })

  it('비율과 자동 수수료를 함께 적는다', async () => {
    const { setBossPartyPeriodOverride } =
      require('../boss-party-period-overrides') as typeof import('../boss-party-period-overrides')

    await setBossPartyPeriodOverride({
      ...sample,
      crystalMyShare: 2,
      crystalSharesTotal: 3,
      splitFeePercent: 5,
      splitFeeAuto: true,
    })

    const [, values] = runMock.mock.calls[0]
    expect(values.slice(5, 9)).toEqual([2, 3, 5, 1])
  })
})

describe('getBossPartyPeriodOverride', () => {
  it('그 조합의 줄이 없으면 null 이다', async () => {
    const { getBossPartyPeriodOverride } =
      require('../boss-party-period-overrides') as typeof import('../boss-party-period-overrides')

    await expect(getBossPartyPeriodOverride('ocid-1', 'black_mage', 'extreme', '2026-W39')).resolves.toBeNull()
  })

  it('줄이 있으면 칸을 그대로 읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'black_mage',
          difficulty: 'extreme',
          period_key: '2026-W39',
          party_size: 3,
          crystal_my_share: 2,
          crystal_shares_total: 3,
          split_fee_percent: 5,
          split_fee_auto: 1,
          updated_at: '2026-09-23T00:05:00.000Z',
        },
      ],
    })
    const { getBossPartyPeriodOverride } =
      require('../boss-party-period-overrides') as typeof import('../boss-party-period-overrides')

    await expect(getBossPartyPeriodOverride('ocid-1', 'black_mage', 'extreme', '2026-W39')).resolves.toEqual({
      ocid: 'ocid-1',
      bossKey: 'black_mage',
      difficulty: 'extreme',
      periodKey: '2026-W39',
      partySize: 3,
      crystalMyShare: 2,
      crystalSharesTotal: 3,
      splitFeePercent: 5,
      splitFeeAuto: true,
      updatedAt: '2026-09-23T00:05:00.000Z',
    })
  })
})

describe('getBossPartyPeriodOverrides', () => {
  it('캐릭터도 기간도 비어 있으면 조회하지 않는다', async () => {
    const { getBossPartyPeriodOverrides } =
      require('../boss-party-period-overrides') as typeof import('../boss-party-period-overrides')

    await expect(getBossPartyPeriodOverrides([], ['2026-W39'])).resolves.toEqual([])
    await expect(getBossPartyPeriodOverrides(['ocid-1'], [])).resolves.toEqual([])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('캐릭터 여럿과 기간 여럿을 한 번에 읽는다', async () => {
    const { getBossPartyPeriodOverrides } =
      require('../boss-party-period-overrides') as typeof import('../boss-party-period-overrides')

    await getBossPartyPeriodOverrides(['ocid-1', 'ocid-2'], ['2026-W39', '2026-09'])

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('ocid IN (?, ?)')
    expect(sql).toContain('period_key IN (?, ?)')
    expect(values).toEqual(['ocid-1', 'ocid-2', '2026-W39', '2026-09'])
  })
})
