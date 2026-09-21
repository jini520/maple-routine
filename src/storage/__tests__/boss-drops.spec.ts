import type { RecordedDrop } from '../../types/drops'

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

const drops: RecordedDrop[] = [
  { category: 'equipment', itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
  {
    category: 'consumable',
    itemKey: 'restraint_ring',
    itemName: '리스트레인트 링',
    boxOriginKey: 'red_boss_ring_box',
    boxOrigin: '홍옥의 보스 반지 상자',
    ringLevel: 3,
    quantity: 1,
  },
]

describe('replaceBossDropRecords', () => {
  it('기존 행을 DELETE한 뒤 drop_index 0..n으로 다시 INSERT한다', async () => {
    const { replaceBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await replaceBossDropRecords(
      'ocid-1',
      'lotus',
      'hard',
      '2026-W30',
      drops,
      '2026-07-26T00:00:00.000Z',
    )

    expect(runMock).toHaveBeenCalledTimes(3) // 1 DELETE + 2 INSERT

    const [delSql, delValues] = runMock.mock.calls[0]
    expect(delSql).toContain('DELETE FROM boss_drop_records')
    expect(delSql).toContain('WHERE ocid = ? AND boss_key = ? AND difficulty = ? AND period_key = ?')
    expect(delValues).toEqual(['ocid-1', 'lotus', 'hard', '2026-W30'])

    const [insSql, insValues0] = runMock.mock.calls[1]
    expect(insSql).toContain('INSERT INTO boss_drop_records')
    expect(insValues0).toEqual([
      'ocid-1',
      'lotus',
      // 이름 칸에는 보스 표의 이름을 함께 적는다.
      '스우',
      'hard',
      '2026-W30',
      0,
      'equipment',
      'loose_control_machine_mark',
      '루즈 컨트롤 머신 마크',
      '얼굴장식',
      null,
      null,
      null,
      1,
      '2026-07-26T00:00:00.000Z',
      null,
      null,
      null,
      // 내 비율. 안 적으면 1 이라 균등이다.
      null,
    ])

    const [, insValues1] = runMock.mock.calls[2]
    expect(insValues1).toEqual([
      'ocid-1',
      'lotus',
      '스우',
      'hard',
      '2026-W30',
      1,
      'consumable',
      'restraint_ring',
      '리스트레인트 링',
      null,
      'red_boss_ring_box',
      '홍옥의 보스 반지 상자',
      3,
      1,
      '2026-07-26T00:00:00.000Z',
      null,
      null,
      null,
      null,
    ])
  })

  it('드롭이 비면 DELETE만 하고 INSERT하지 않는다', async () => {
    const { replaceBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await replaceBossDropRecords('ocid-1', 'lotus', 'hard', '2026-W30', [], '2026-07-26T00:00:00.000Z')

    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0][0]).toContain('DELETE FROM boss_drop_records')
  })
})

// 아이템 가격 입력 버튼의 배지가 쓰기마다 그 주 창을 다시 채운다. 판을 물어보는 것만으로는 쓰기를
// 알 수 없어서 알림을 받는다.
describe('subscribeBossDropRecordsRevision', () => {
  it('쓰기가 끝나면 구독자를 부른다', async () => {
    const { replaceBossDropRecords, subscribeBossDropRecordsRevision } =
      require('../boss-drops') as typeof import('../boss-drops')
    const listener = jest.fn()
    const unsubscribe = subscribeBossDropRecordsRevision(listener)

    await replaceBossDropRecords('ocid-1', 'lotus', 'hard', '2026-W30', drops, '2026-07-26T00:00:00.000Z')

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('쓰기가 던지면 안 부른다', async () => {
    const { replaceBossDropRecords, subscribeBossDropRecordsRevision } =
      require('../boss-drops') as typeof import('../boss-drops')
    const listener = jest.fn()
    const unsubscribe = subscribeBossDropRecordsRevision(listener)
    runMock.mockRejectedValueOnce(new Error('database is locked'))

    await expect(
      replaceBossDropRecords('ocid-1', 'lotus', 'hard', '2026-W30', drops, '2026-07-26T00:00:00.000Z'),
    ).rejects.toThrow('database is locked')

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('구독을 풀면 더 안 부른다', async () => {
    const { replaceBossDropRecords, subscribeBossDropRecordsRevision } =
      require('../boss-drops') as typeof import('../boss-drops')
    const listener = jest.fn()
    subscribeBossDropRecordsRevision(listener)()

    await replaceBossDropRecords('ocid-1', 'lotus', 'hard', '2026-W30', [], '2026-07-26T00:00:00.000Z')

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('getBossDropRecords', () => {
  it('ocids가 비면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await expect(getBossDropRecords([], ['2026-W30'])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('periodKeys가 비면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await expect(getBossDropRecords(['ocid-1'], [])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
  })

  it('ocid IN (...)와 period_key IN (...) 조건으로 조회해 BossDropRecord[]로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'lotus',
          boss: '스우',
          difficulty: 'hard',
          period_key: '2026-W30',
          drop_index: 1,
          category: 'consumable',
          item_key: 'restraint_ring',
          item_name: '리스트레인트 링',
          slot: null,
          box_origin_key: 'red_boss_ring_box',
          box_origin: '홍옥의 보스 반지 상자',
          ring_level: 3,
          quantity: 1,
          recorded_at: '2026-07-26T00:00:00.000Z',
        },
      ],
    })
    const { getBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    const result = await getBossDropRecords(['ocid-1', 'ocid-2'], ['2026-W30'])

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid IN (?, ?) AND period_key IN (?)'),
      ['ocid-1', 'ocid-2', '2026-W30'],
    )
    expect(result).toEqual([
      {
        ocid: 'ocid-1',
        bossKey: 'lotus',
        boss: '스우',
        difficulty: 'hard',
        periodKey: '2026-W30',
        dropIndex: 1,
        category: 'consumable',
        itemKey: 'restraint_ring',
        itemName: '리스트레인트 링',
        slot: null,
        boxOriginKey: 'red_boss_ring_box',
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
        quantity: 1,
        recordedAt: '2026-07-26T00:00:00.000Z',
        priceState: null,
        priceMeso: null,
        priceShare: null,
        priceMyShare: null,
      },
    ])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await expect(getBossDropRecords(['ocid-1'], ['2026-W30'])).resolves.toEqual([])
  })
})

// 드롭 히스토리는 히스토리 전용 테이블이 아니라 이 테이블을 전 기간 조회한다.
describe('getAllBossDropRecords', () => {
  it('ocids가 비면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getAllBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await expect(getAllBossDropRecords([])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('period_key 조건 없이 ocid만 걸어 조회한다. "전 기간"을 볼 수단이다', async () => {
    const { getAllBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await getAllBossDropRecords(['ocid-1', 'ocid-2'])

    const [sql, values] = queryMock.mock.calls[0]
    expect(sql).toContain('WHERE ocid IN (?, ?)')
    expect(sql).not.toContain('period_key IN')
    expect(values).toEqual(['ocid-1', 'ocid-2'])
  })

  it('period_key DESC, drop_index 순으로 정렬한다. recorded_at은 그룹 재기록으로 뒤집힌다', async () => {
    const { getAllBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await getAllBossDropRecords(['ocid-1'])

    const [sql] = queryMock.mock.calls[0]
    expect(sql).toContain('ORDER BY period_key DESC')
    expect(sql).toContain('drop_index')
    expect(sql).not.toContain('recorded_at DESC')
  })

  it('행을 BossDropRecord[]로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'lotus',
          boss: '스우',
          difficulty: 'hard',
          period_key: '2026-07-09',
          drop_index: 0,
          category: 'equipment',
          item_name: '루즈 컨트롤 머신 마크',
          slot: '얼굴장식',
          box_origin: null,
          ring_level: null,
          quantity: 1,
          recorded_at: '2026-07-26T00:00:00.000Z',
        },
      ],
    })
    const { getAllBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await expect(getAllBossDropRecords(['ocid-1'])).resolves.toEqual([
      {
        ocid: 'ocid-1',
        bossKey: 'lotus',
        boss: '스우',
        difficulty: 'hard',
        periodKey: '2026-07-09',
        dropIndex: 0,
        category: 'equipment',
        // key 칸이 없던 옛 행이다. 읽을 때 `null` 로 선다.
        itemKey: null,
        itemName: '루즈 컨트롤 머신 마크',
        slot: '얼굴장식',
        boxOriginKey: null,
        boxOrigin: null,
        ringLevel: null,
        quantity: 1,
        recordedAt: '2026-07-26T00:00:00.000Z',
        priceState: null,
        priceMeso: null,
        priceShare: null,
        priceMyShare: null,
      },
    ])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getAllBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await expect(getAllBossDropRecords(['ocid-1'])).resolves.toEqual([])
  })
})

// 가격 컬럼 왕복. 저장한 값이 그대로 읽혀야 한다. 쓰기·읽기 어느 한쪽만
// 컬럼을 알면 값이 조용히 사라진다.
describe('가격 컬럼 왕복', () => {
  it('INSERT 에 price_state·price_meso·price_share 를 함께 싣는다', async () => {
    const { replaceBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await replaceBossDropRecords(
      'ocid-1',
      'lotus',
      'hard',
      '2026-08-06',
      [
        {
          category: 'equipment',
          itemKey: 'loose_control_machine_mark',
          itemName: '루즈 컨트롤 머신 마크',
          slot: '얼굴장식',
          quantity: 1,
          priceState: 'entered',
          priceMeso: 15_000_000_000,
          priceShare: 3,
        },
      ],
      '2026-08-10T00:00:00.000Z',
    )

    const insert = runMock.mock.calls.find(([sql]) => String(sql).includes('INSERT'))
    expect(insert?.[0]).toContain('price_state')
    expect(insert?.[1]).toEqual(expect.arrayContaining(['entered', 15_000_000_000, 3]))
  })

  it('가격이 없는 드롭은 세 컬럼을 NULL 로 넣는다. 0 이 아니다', async () => {
    const { replaceBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    await replaceBossDropRecords(
      'ocid-1',
      'lotus',
      'hard',
      '2026-08-06',
      [{ category: 'equipment', itemKey: 'loose_control_machine_mark', itemName: '루즈 컨트롤 머신 마크', quantity: 1 }],
      '2026-08-10T00:00:00.000Z',
    )

    const insert = runMock.mock.calls.find(([sql]) => String(sql).includes('INSERT'))
    // 마지막 세 자리가 가격 컬럼이다. 0 으로 넣으면 "0메소에 팔았다"가 되어 미입력과 구분이 사라진다.
    expect(insert?.[1].slice(-3)).toEqual([null, null, null])
  })

  it('조회 결과의 가격 컬럼을 BossDropRecord 로 옮긴다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss_key: 'lotus',
          boss: '스우',
          difficulty: 'hard',
          period_key: '2026-08-06',
          drop_index: 0,
          category: 'equipment',
          item_name: '루즈 컨트롤 머신 마크',
          slot: '얼굴장식',
          box_origin: null,
          ring_level: null,
          quantity: 1,
          recorded_at: '2026-08-10T00:00:00.000Z',
          price_state: 'entered',
          price_meso: 15_000_000_000,
          price_share: 3,
        },
      ],
    })
    const { getBossDropRecords } = require('../boss-drops') as typeof import('../boss-drops')

    const [record] = await getBossDropRecords(['ocid-1'], ['2026-08-06'])

    expect(record).toEqual(
      expect.objectContaining({ priceState: 'entered', priceMeso: 15_000_000_000, priceShare: 3 }),
    )
  })
})
