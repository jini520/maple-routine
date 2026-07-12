import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BossProfitRecord } from '../boss-profit'

const { runMock, queryMock, getBossProfitDbMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  queryMock: vi.fn(),
  getBossProfitDbMock: vi.fn(),
}))

vi.mock('../sqlite/db', () => ({
  getBossProfitDb: getBossProfitDbMock,
}))

const fakeDb = { run: runMock, query: queryMock }

beforeEach(() => {
  runMock.mockReset().mockResolvedValue({ changes: { changes: 1 } })
  queryMock.mockReset().mockResolvedValue({ values: [] })
  getBossProfitDbMock.mockReset().mockResolvedValue(fakeDb)
})

const sampleRecord: BossProfitRecord = {
  ocid: 'ocid-1',
  boss: '검은 마법사',
  difficulty: '익스트림',
  cycle: 'monthly',
  periodKey: '2026-07',
  partySize: 2,
  priceMeso: 1_000_000,
  payoutMeso: 500_000,
  recordedAt: '2026-07-09T00:05:00.000Z',
}

describe('upsertBossProfitRecord', () => {
  it('동일 키로 두 번 호출하면 ON CONFLICT DO UPDATE로 최신 값을 덮어쓴다', async () => {
    const { upsertBossProfitRecord } = await import('../boss-profit')

    await upsertBossProfitRecord(sampleRecord)
    await upsertBossProfitRecord({ ...sampleRecord, partySize: 3, payoutMeso: 333_333 })

    expect(runMock).toHaveBeenCalledTimes(2)

    const [firstSql, firstValues] = runMock.mock.calls[0]
    expect(firstSql).toContain('ON CONFLICT(ocid, boss, difficulty, period_key) DO UPDATE SET')
    expect(firstValues).toEqual([
      'ocid-1',
      '검은 마법사',
      '익스트림',
      'monthly',
      '2026-07',
      2,
      1_000_000,
      500_000,
      '2026-07-09T00:05:00.000Z',
    ])

    const [secondSql, secondValues] = runMock.mock.calls[1]
    expect(secondSql).toBe(firstSql)
    expect(secondValues).toEqual([
      'ocid-1',
      '검은 마법사',
      '익스트림',
      'monthly',
      '2026-07',
      3,
      1_000_000,
      333_333,
      '2026-07-09T00:05:00.000Z',
    ])
  })
})

describe('getLatestPartySize', () => {
  it('조회 결과가 없으면 null을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { getLatestPartySize } = await import('../boss-profit')

    await expect(getLatestPartySize('ocid-1', '검은 마법사', '익스트림')).resolves.toBeNull()
  })

  it('조회 결과가 undefined여도 null을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getLatestPartySize } = await import('../boss-profit')

    await expect(getLatestPartySize('ocid-1', '검은 마법사', '익스트림')).resolves.toBeNull()
  })

  it('조회 결과가 있으면 가장 최근 레코드의 party_size를 반환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '검은 마법사',
          difficulty: '익스트림',
          cycle: 'monthly',
          period_key: '2026-07',
          party_size: 3,
          price_meso: 1_000_000,
          payout_meso: 333_333,
          recorded_at: '2026-07-09T00:05:00.000Z',
        },
      ],
    })
    const { getLatestPartySize } = await import('../boss-profit')

    await expect(getLatestPartySize('ocid-1', '검은 마법사', '익스트림')).resolves.toBe(3)
  })

  it('period_key 조건 없이 recorded_at DESC LIMIT 1로 조회하고 ocid/boss/difficulty 순서로 바인딩한다', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { getLatestPartySize } = await import('../boss-profit')

    await getLatestPartySize('ocid-1', '검은 마법사', '익스트림')

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY recorded_at DESC LIMIT 1'),
      ['ocid-1', '검은 마법사', '익스트림'],
    )

    const [sql] = queryMock.mock.calls[0]
    expect(sql).not.toMatch(/period_key/)
  })
})

describe('getBossProfitRecords', () => {
  it('ocids가 빈 배열이면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossProfitRecords } = await import('../boss-profit')

    await expect(getBossProfitRecords([], ['2026-07'])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('periodKeys가 빈 배열이면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossProfitRecords } = await import('../boss-profit')

    await expect(getBossProfitRecords(['ocid-1'], [])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('ocid IN (...)와 period_key IN (...) 조건으로 조회해 BossProfitRecord[]로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '검은 마법사',
          difficulty: '익스트림',
          cycle: 'monthly',
          period_key: '2026-07',
          party_size: 2,
          price_meso: 1_000_000,
          payout_meso: 500_000,
          recorded_at: '2026-07-09T00:05:00.000Z',
        },
      ],
    })
    const { getBossProfitRecords } = await import('../boss-profit')

    const result = await getBossProfitRecords(['ocid-1', 'ocid-2'], ['2026-07'])

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining(
        'WHERE ocid IN (?, ?) AND period_key IN (?)',
      ),
      ['ocid-1', 'ocid-2', '2026-07'],
    )
    expect(result).toEqual([sampleRecord])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossProfitRecords } = await import('../boss-profit')

    await expect(getBossProfitRecords(['ocid-1'], ['2026-07'])).resolves.toEqual([])
  })
})
