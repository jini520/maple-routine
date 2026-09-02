import type { BossProfitRecord } from '../boss-profit'

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
    const { upsertBossProfitRecord } = require('../boss-profit') as typeof import('../boss-profit')

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
    const { getBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

    await expect(getBossProfitRecords([], ['2026-07'])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('periodKeys가 빈 배열이면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

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
    const { getBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

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
    const { getBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

    await expect(getBossProfitRecords(['ocid-1'], ['2026-07'])).resolves.toEqual([])
  })
})

// 월드는 기록 시점 스냅샷이다. 파생값(캐시된 character/basic)으로 두면 월드
// 리프가 모든 과거 주의 귀속을 소급 이동시킨다(분모 90 x 월드 수까지 바뀐다).
describe('world 스냅샷', () => {
  it('upsert가 world를 함께 쓰고, 아는 값이 없을 때는 기존 스냅샷을 지우지 않는다', async () => {
    const { upsertBossProfitRecord } = require('../boss-profit') as typeof import('../boss-profit')

    await upsertBossProfitRecord({ ...sampleRecord, world: '엘리시움' })

    const [sql, values] = runMock.mock.calls[0]
    expect(values.at(-1)).toBe('엘리시움')
    // 파티원 수만 고치는 경로처럼 world를 모르고 upsert하는 경우가 있다. 그때 null로 덮어쓰면
    // 이미 박아둔 스냅샷이 지워진다.
    expect(sql).toContain('world = COALESCE(excluded.world, boss_profit_records.world)')
  })

  it('컬럼 도입 전 기록(world 없음)은 null로 정규화해 읽는다', async () => {
    const { getBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')
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

  it('fillMissingRecordWorlds는 비어 있는 기록만 채운다. 멱등이라 리프 후에도 과거를 덮지 않는다', async () => {
    const { fillMissingRecordWorlds } = require('../boss-profit') as typeof import('../boss-profit')

    await fillMissingRecordWorlds(new Map([['ocid-1', '엘리시움'], ['ocid-2', '베라']]))

    expect(runMock).toHaveBeenCalledTimes(2)
    for (const [sql] of runMock.mock.calls) {
      expect(sql).toContain('world IS NULL')
    }
    expect(runMock.mock.calls[0][1]).toEqual(['엘리시움', 'ocid-1'])
  })

  it('채울 월드가 없으면 DB를 건드리지 않는다', async () => {
    const { fillMissingRecordWorlds } = require('../boss-profit') as typeof import('../boss-profit')

    await fillMissingRecordWorlds(new Map())

    expect(getBossProfitDbMock).not.toHaveBeenCalled()
  })
})

// 히스토리가 "처치 난이도가 확정된 조합"을 알아야 획득 불가 기록을 거를 수 있다.
// 수익 기록 행의 존재가 곧 확정이므로 키만 전 기간 조회한다.
describe('getAllBossProfitRecordKeys', () => {
  it('ocids가 비면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getAllBossProfitRecordKeys } = require('../boss-profit') as typeof import('../boss-profit')

    await expect(getAllBossProfitRecordKeys([])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
  })

  it('period_key 조건 없이 키 컬럼만 조회한다. 전체 행을 읽을 필요가 없다', async () => {
    const { getAllBossProfitRecordKeys } = require('../boss-profit') as typeof import('../boss-profit')

    await getAllBossProfitRecordKeys(['ocid-1', 'ocid-2'])

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('SELECT ocid, boss, difficulty, period_key FROM boss_profit_records')
    expect(sql).toContain('WHERE ocid IN (?, ?)')
    expect(sql).not.toContain('period_key IN')
    expect(values).toEqual(['ocid-1', 'ocid-2'])
  })

  it('행을 키 객체로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [{ ocid: 'ocid-1', boss: '스우', difficulty: '하드', period_key: '2026-07-09' }],
    })
    const { getAllBossProfitRecordKeys } = require('../boss-profit') as typeof import('../boss-profit')

    await expect(getAllBossProfitRecordKeys(['ocid-1'])).resolves.toEqual([
      { ocid: 'ocid-1', boss: '스우', difficulty: '하드', periodKey: '2026-07-09' },
    ])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getAllBossProfitRecordKeys } = require('../boss-profit') as typeof import('../boss-profit')

    await expect(getAllBossProfitRecordKeys(['ocid-1'])).resolves.toEqual([])
  })
})

// 처치 날짜. `BossProfitRecord` 자체는 안 바뀐다(넣는 자리들이 날짜를 모른다).
// 대신 **읽는 질문 둘**과 **채우는 쓰기 하나**가 는다.
describe('처치 날짜', () => {
  it('upsert 는 defeated_on 을 안 건드린다. 자동 기록이 캐 놓은 날짜를 지우면 안 된다', async () => {
    const { upsertBossProfitRecord } = require('../boss-profit') as typeof import('../boss-profit')

    await upsertBossProfitRecord(sampleRecord)

    const [sql] = runMock.mock.calls[0]
    expect(sql).not.toContain('defeated_on')
  })

  it('getDatedBossProfitRecords 는 날짜 범위로 자르고 NULL 을 뺀다', async () => {
    const { getDatedBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

    await getDatedBossProfitRecords(['ocid-1', 'ocid-2'], '2026-08-01', '2026-08-31')

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('WHERE ocid IN (?, ?)')
    expect(sql).toContain('defeated_on IS NOT NULL')
    expect(sql).toContain('defeated_on BETWEEN ? AND ?')
    expect(values).toEqual(['ocid-1', 'ocid-2', '2026-08-01', '2026-08-31'])
  })

  it('getDatedBossProfitRecords 는 행을 날짜 붙은 기록으로 옮긴다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '하드',
          period_key: '2026-08-20',
          payout_meso: 210_000_000,
          defeated_on: '2026-08-21',
        },
      ],
    })
    const { getDatedBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

    await expect(getDatedBossProfitRecords(['ocid-1'], '2026-08-01', '2026-08-31')).resolves.toEqual([
      {
        ocid: 'ocid-1',
        boss: '스우',
        difficulty: '하드',
        periodKey: '2026-08-20',
        payoutMeso: 210_000_000,
        defeatedOn: '2026-08-21',
      },
    ])
  })

  it('getUndatedBossProfitRecords 는 기간을 걸고 NULL 인 것만 고른다', async () => {
    const { getUndatedBossProfitRecords } = require('../boss-profit') as typeof import('../boss-profit')

    await getUndatedBossProfitRecords(['ocid-1'], ['2026-08-20', '2026-08'])

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('defeated_on IS NULL')
    expect(sql).toContain('period_key IN (?, ?)')
    expect(values).toEqual(['ocid-1', '2026-08-20', '2026-08'])
  })

  it('빈 목록에는 조회를 안 던진다. IN () 은 문법 오류다', async () => {
    const { getDatedBossProfitRecords, getUndatedBossProfitRecords } =
      require('../boss-profit') as typeof import('../boss-profit')

    await expect(getDatedBossProfitRecords([], '2026-08-01', '2026-08-31')).resolves.toEqual([])
    await expect(getUndatedBossProfitRecords(['ocid-1'], [])).resolves.toEqual([])
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('setBossProfitDefeatedOn 은 키 넷으로 그 행 하나만 고친다', async () => {
    const { setBossProfitDefeatedOn } = require('../boss-profit') as typeof import('../boss-profit')

    await setBossProfitDefeatedOn(
      { ocid: 'ocid-1', boss: '스우', difficulty: '하드', periodKey: '2026-08-20' },
      '2026-08-21',
    )

    const [sql, values] = runMock.mock.calls[0]
    expect(sql).toContain('UPDATE boss_profit_records SET defeated_on = ?')
    expect(sql).toContain('WHERE ocid = ? AND boss = ? AND difficulty = ? AND period_key = ?')
    expect(values).toEqual(['2026-08-21', 'ocid-1', '스우', '하드', '2026-08-20'])
  })
})

/**
 * 표가 바뀐 것을 **읽는 쪽이 물을 수 있어야 한다**. `boss_drop_records` 가
 * 먼저 갖고 있던 그 수를 이 표에도 단다.
 */
describe('getBossProfitRecordsRevision', () => {
  beforeEach(() => {
    const { resetBossProfitRecordsRevisionForTests } =
      require('../boss-profit') as typeof import('../boss-profit')
    resetBossProfitRecordsRevisionForTests()
  })

  it('쓰기 셋이 저마다 판을 올린다', async () => {
    const {
      fillMissingRecordWorlds,
      getBossProfitRecordsRevision,
      setBossProfitDefeatedOn,
      upsertBossProfitRecord,
    } = require('../boss-profit') as typeof import('../boss-profit')

    expect(getBossProfitRecordsRevision()).toBe(0)

    await upsertBossProfitRecord(sampleRecord)
    expect(getBossProfitRecordsRevision()).toBe(1)

    await fillMissingRecordWorlds(new Map([['ocid-1', '스카니아']]))
    expect(getBossProfitRecordsRevision()).toBe(2)

    await setBossProfitDefeatedOn(
      { ocid: 'ocid-1', boss: '스우', difficulty: '하드', periodKey: '2026-08-20' },
      '2026-08-21',
    )
    expect(getBossProfitRecordsRevision()).toBe(3)
  })

  it('읽기로는 안 오른다. 판은 **바뀌었나** 이지 **봤나** 가 아니다', async () => {
    const { getBossProfitRecordsRevision, getDatedBossProfitRecords } =
      require('../boss-profit') as typeof import('../boss-profit')

    await getDatedBossProfitRecords(['ocid-1'], '2026-08-01', '2026-08-31')

    expect(getBossProfitRecordsRevision()).toBe(0)
  })

  it('채울 월드가 없으면 안 오른다. 그 길은 SQL 을 한 줄도 안 던진다', async () => {
    const { fillMissingRecordWorlds, getBossProfitRecordsRevision } =
      require('../boss-profit') as typeof import('../boss-profit')

    await fillMissingRecordWorlds(new Map())

    expect(getBossProfitRecordsRevision()).toBe(0)
  })

  it('쓰기가 던지면 안 오른다. 표가 안 바뀌었는데 올리면 읽는 쪽이 헛일한다', async () => {
    const { getBossProfitRecordsRevision, upsertBossProfitRecord } =
      require('../boss-profit') as typeof import('../boss-profit')
    runMock.mockRejectedValueOnce(new Error('database is locked'))

    await expect(upsertBossProfitRecord(sampleRecord)).rejects.toThrow('database is locked')

    expect(getBossProfitRecordsRevision()).toBe(0)
  })
})
