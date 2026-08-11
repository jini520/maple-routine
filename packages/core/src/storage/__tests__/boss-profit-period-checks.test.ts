import { beforeEach, describe, expect, it, vi } from 'vitest'

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

describe('isPeriodChecked', () => {
  it('저장 전에는 false를 반환한다', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { isPeriodChecked } = await import('../boss-profit-period-checks')

    await expect(isPeriodChecked('ocid-1', 'weekly', '2026-06-04')).resolves.toBe(false)
  })

  it('조회 결과가 undefined여도 false를 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { isPeriodChecked } = await import('../boss-profit-period-checks')

    await expect(isPeriodChecked('ocid-1', 'weekly', '2026-06-04')).resolves.toBe(false)
  })

  it('ocid/cycle/period_key 조건으로 조회한다', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { isPeriodChecked } = await import('../boss-profit-period-checks')

    await isPeriodChecked('ocid-1', 'weekly', '2026-06-04')

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid = ? AND cycle = ? AND period_key = ?'),
      ['ocid-1', 'weekly', '2026-06-04'],
    )
  })

  it('markPeriodChecked 호출 후에는 true를 반환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          cycle: 'weekly',
          period_key: '2026-06-04',
          checked_at: '2026-07-14T00:00:00.000Z',
        },
      ],
    })
    const { isPeriodChecked, markPeriodChecked } = await import('../boss-profit-period-checks')

    await markPeriodChecked('ocid-1', 'weekly', '2026-06-04', '2026-07-14T00:00:00.000Z')

    await expect(isPeriodChecked('ocid-1', 'weekly', '2026-06-04')).resolves.toBe(true)
  })

  it('같은 ocid라도 다른 periodKey나 cycle은 서로 독립이다', async () => {
    // ocid-1/weekly/2026-06-04만 체크된 상태를 흉내낸다.
    queryMock.mockImplementation(async (_sql: string, params: unknown[]) => {
      const [ocid, cycle, periodKey] = params
      const isChecked = ocid === 'ocid-1' && cycle === 'weekly' && periodKey === '2026-06-04'
      return {
        values: isChecked
          ? [{ ocid, cycle, period_key: periodKey, checked_at: '2026-07-14T00:00:00.000Z' }]
          : [],
      }
    })
    const { isPeriodChecked, markPeriodChecked } = await import('../boss-profit-period-checks')

    await markPeriodChecked('ocid-1', 'weekly', '2026-06-04', '2026-07-14T00:00:00.000Z')

    await expect(isPeriodChecked('ocid-1', 'weekly', '2026-06-04')).resolves.toBe(true)
    await expect(isPeriodChecked('ocid-1', 'weekly', '2026-06-11')).resolves.toBe(false)
    await expect(isPeriodChecked('ocid-1', 'monthly', '2026-06-04')).resolves.toBe(false)
    await expect(isPeriodChecked('ocid-2', 'weekly', '2026-06-04')).resolves.toBe(false)
  })
})

describe('markPeriodChecked', () => {
  it('동일 키로 두 번 호출해도 에러 없이 ON CONFLICT DO UPDATE로 처리된다 (멱등성)', async () => {
    const { markPeriodChecked } = await import('../boss-profit-period-checks')

    await markPeriodChecked('ocid-1', 'weekly', '2026-06-04', '2026-07-14T00:00:00.000Z')
    await markPeriodChecked('ocid-1', 'weekly', '2026-06-04', '2026-07-14T01:00:00.000Z')

    expect(runMock).toHaveBeenCalledTimes(2)

    const [firstSql, firstValues] = runMock.mock.calls[0]
    expect(firstSql).toContain('ON CONFLICT(ocid, cycle, period_key) DO UPDATE SET')
    expect(firstValues).toEqual(['ocid-1', 'weekly', '2026-06-04', '2026-07-14T00:00:00.000Z'])

    const [secondSql, secondValues] = runMock.mock.calls[1]
    expect(secondSql).toBe(firstSql)
    expect(secondValues).toEqual(['ocid-1', 'weekly', '2026-06-04', '2026-07-14T01:00:00.000Z'])
  })
})
