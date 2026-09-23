import type { BossPartySetting } from '../boss-party-settings'

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

const sampleSetting: BossPartySetting = {
  ocid: 'ocid-1',
  bossKey: 'black_mage',
  difficulty: 'extreme',
  partySize: 4,
  crystalMyShare: null,
  crystalSharesTotal: null,
  splitFeePercent: null,
  splitFeeAuto: false,
  updatedAt: '2026-07-13T00:05:00.000Z',
}

describe('setBossPartySetting', () => {
  it('동일 키로 두 번 호출하면 ON CONFLICT DO UPDATE로 최신 값을 덮어쓴다 (멱등성)', async () => {
    const { setBossPartySetting } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await setBossPartySetting({ ...sampleSetting, partySize: 4 })
    await setBossPartySetting({ ...sampleSetting, partySize: 2, updatedAt: '2026-07-13T01:00:00.000Z' })

    expect(runMock).toHaveBeenCalledTimes(2)

    const [firstSql, firstValues] = runMock.mock.calls[0]
    expect(firstSql).toContain('ON CONFLICT(ocid, boss_key, difficulty) DO UPDATE SET')
    // 이름 칸에는 보스 표의 이름을 함께 적는다.
    expect(firstValues).toEqual([
      'ocid-1',
      'black_mage',
      '검은 마법사',
      'extreme',
      4,
      null,
      null,
      null,
      // 송금 수수료가 등급을 따라가나. 손으로 고른 값이라 비어 있다.
      null,
      '2026-07-13T00:05:00.000Z',
    ])

    const [secondSql, secondValues] = runMock.mock.calls[1]
    expect(secondSql).toBe(firstSql)
    expect(secondValues[4]).toBe(2)
    expect(secondValues[9]).toBe('2026-07-13T01:00:00.000Z')
  })

  // 비율을 고치면 칸 셋이 함께 간다. 인원만 쓰고 비율을 두고 오면 화면과 DB 가 갈린다.
  it('비율과 수수료율을 함께 쓴다', async () => {
    const { setBossPartySetting } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await setBossPartySetting({
      ...sampleSetting,
      partySize: 2,
      crystalMyShare: 2,
      crystalSharesTotal: 3,
      splitFeePercent: 5,
    })

    const [sql, values] = runMock.mock.calls[0]
    for (const column of [
      'crystal_my_share',
      'crystal_shares_total',
      'split_fee_percent',
    ]) {
      expect(sql).toContain(column)
    }
    expect(values.slice(4, 8)).toEqual([2, 2, 3, 5])
  })

  // 균등으로 되돌리는 길은 NULL 로 덮는 것뿐이다. 지우는 API 를 따로 두지 않는다.
  it('균등으로 되돌리면 비율 칸이 NULL 이 된다', async () => {
    const { setBossPartySetting } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await setBossPartySetting({ ...sampleSetting, crystalMyShare: null, crystalSharesTotal: null })

    const [, values] = runMock.mock.calls[0]
    expect(values.slice(5, 8)).toEqual([null, null, null])
  })
})

describe('getBossPartySize', () => {
  it('조회 결과가 없으면 null을 반환한다 (설정 없음 = 솔로)', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { getBossPartySize } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await expect(getBossPartySize('ocid-1', 'black_mage', 'extreme')).resolves.toBeNull()
  })

  it('조회 결과가 undefined여도 null을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossPartySize } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await expect(getBossPartySize('ocid-1', 'black_mage', 'extreme')).resolves.toBeNull()
  })

  it('조회 결과가 있으면 party_size를 반환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'black_mage',
          boss: '검은 마법사',
          difficulty: 'extreme',
          party_size: 4,
          crystal_my_share: null,
          crystal_shares_total: null,
          split_fee_percent: null,
          updated_at: '2026-07-13T00:05:00.000Z',
        },
      ],
    })
    const { getBossPartySize } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await expect(getBossPartySize('ocid-1', 'black_mage', 'extreme')).resolves.toBe(4)
  })

  it('ocid/boss/difficulty 조건으로 조회한다', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { getBossPartySize } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await getBossPartySize('ocid-1', 'black_mage', 'extreme')

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid = ? AND boss_key = ? AND difficulty = ?'),
      ['ocid-1', 'black_mage', 'extreme'],
    )
  })
})

describe('getBossPartySettings', () => {
  it('ocids가 빈 배열이면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossPartySettings } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await expect(getBossPartySettings([])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('ocid IN (...) 조건으로 조회해 BossPartySetting[]으로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'black_mage',
          boss: '검은 마법사',
          difficulty: 'extreme',
          party_size: 4,
          crystal_my_share: null,
          crystal_shares_total: null,
          split_fee_percent: null,
          updated_at: '2026-07-13T00:05:00.000Z',
        },
      ],
    })
    const { getBossPartySettings } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    const result = await getBossPartySettings(['ocid-1', 'ocid-2'])

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid IN (?, ?)'),
      ['ocid-1', 'ocid-2'],
    )
    expect(result).toEqual([sampleSetting])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossPartySettings } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await expect(getBossPartySettings(['ocid-1'])).resolves.toEqual([])
  })

  // 칸이 붙기 전에 쓰인 행은 그 칸이 아예 없다. undefined 를 그대로 실어 나르면 균등 판정이
  // 갈린다.
  it('비율 칸이 없는 옛 행은 null 로 읽는다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'black_mage',
          boss: '검은 마법사',
          difficulty: 'extreme',
          party_size: 4,
          updated_at: '2026-07-13T00:05:00.000Z',
        },
      ],
    })
    const { getBossPartySettings } = require('../boss-party-settings') as typeof import('../boss-party-settings')

    await expect(getBossPartySettings(['ocid-1'])).resolves.toEqual([sampleSetting])
  })
})
