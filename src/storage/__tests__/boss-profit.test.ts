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
  world: null,
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
      null,
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
      null,
    ])
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

// ADR-069 결정 1·3: 월드는 기록 시점 스냅샷이다. 파생값(캐시된 character/basic)으로 두면 월드
// 리프가 모든 과거 주의 귀속을 소급 이동시킨다(분모 90 x 월드 수까지 바뀐다).
describe('world 스냅샷', () => {
  it('upsert가 world를 함께 쓰고, 아는 값이 없을 때는 기존 스냅샷을 지우지 않는다', async () => {
    const { upsertBossProfitRecord } = await import('../boss-profit')

    await upsertBossProfitRecord({ ...sampleRecord, world: '엘리시움' })

    const [sql, values] = runMock.mock.calls[0]
    expect(values.at(-1)).toBe('엘리시움')
    // 파티원 수만 고치는 경로처럼 world를 모르고 upsert하는 경우가 있다 — 그때 null로 덮어쓰면
    // 이미 박아둔 스냅샷이 지워진다.
    expect(sql).toContain('world = COALESCE(excluded.world, boss_profit_records.world)')
  })

  it('컬럼 도입 전 기록(world 없음)은 null로 정규화해 읽는다', async () => {
    const { getBossProfitRecords } = await import('../boss-profit')
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          period_key: '2026-07-30',
          party_size: 1,
          price_meso: 8_080_000,
          payout_meso: 8_080_000,
          recorded_at: '2026-07-30T00:00:00.000Z',
          // world 컬럼이 없던 시절의 행
        },
      ],
    })

    const [record] = await getBossProfitRecords(['ocid-1'], ['2026-07-30'])

    expect(record.world).toBeNull()
  })

  it('fillMissingRecordWorlds는 비어 있는 기록만 채운다 — 멱등이라 리프 후에도 과거를 덮지 않는다', async () => {
    const { fillMissingRecordWorlds } = await import('../boss-profit')

    await fillMissingRecordWorlds(new Map([['ocid-1', '엘리시움'], ['ocid-2', '베라']]))

    expect(runMock).toHaveBeenCalledTimes(2)
    for (const [sql] of runMock.mock.calls) {
      expect(sql).toContain('world IS NULL')
    }
    expect(runMock.mock.calls[0][1]).toEqual(['엘리시움', 'ocid-1'])
  })

  it('채울 월드가 없으면 DB를 건드리지 않는다', async () => {
    const { fillMissingRecordWorlds } = await import('../boss-profit')

    await fillMissingRecordWorlds(new Map())

    expect(getBossProfitDbMock).not.toHaveBeenCalled()
  })
})
