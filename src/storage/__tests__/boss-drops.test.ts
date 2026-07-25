import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecordedDrop } from '../../types/drops'

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

const drops: RecordedDrop[] = [
  { category: 'equipment', itemName: '루즈 컨트롤 머신 마크', slot: '얼굴장식', quantity: 1 },
  {
    category: 'consumable',
    itemName: '리스트레인트 링',
    boxOrigin: '홍옥의 보스 반지 상자',
    ringLevel: 3,
    quantity: 1,
  },
]

describe('replaceBossDropRecords', () => {
  it('기존 행을 DELETE한 뒤 drop_index 0..n으로 다시 INSERT한다', async () => {
    const { replaceBossDropRecords } = await import('../boss-drops')

    await replaceBossDropRecords(
      'ocid-1',
      '스우',
      '하드',
      '2026-W30',
      drops,
      '2026-07-26T00:00:00.000Z',
    )

    expect(runMock).toHaveBeenCalledTimes(3) // 1 DELETE + 2 INSERT

    const [delSql, delValues] = runMock.mock.calls[0]
    expect(delSql).toContain('DELETE FROM boss_drop_records')
    expect(delSql).toContain('WHERE ocid = ? AND boss = ? AND difficulty = ? AND period_key = ?')
    expect(delValues).toEqual(['ocid-1', '스우', '하드', '2026-W30'])

    const [insSql, insValues0] = runMock.mock.calls[1]
    expect(insSql).toContain('INSERT INTO boss_drop_records')
    expect(insValues0).toEqual([
      'ocid-1',
      '스우',
      '하드',
      '2026-W30',
      0,
      'equipment',
      '루즈 컨트롤 머신 마크',
      '얼굴장식',
      null,
      null,
      1,
      '2026-07-26T00:00:00.000Z',
    ])

    const [, insValues1] = runMock.mock.calls[2]
    expect(insValues1).toEqual([
      'ocid-1',
      '스우',
      '하드',
      '2026-W30',
      1,
      'consumable',
      '리스트레인트 링',
      null,
      '홍옥의 보스 반지 상자',
      3,
      1,
      '2026-07-26T00:00:00.000Z',
    ])
  })

  it('드롭이 비면 DELETE만 하고 INSERT하지 않는다', async () => {
    const { replaceBossDropRecords } = await import('../boss-drops')

    await replaceBossDropRecords('ocid-1', '스우', '하드', '2026-W30', [], '2026-07-26T00:00:00.000Z')

    expect(runMock).toHaveBeenCalledTimes(1)
    expect(runMock.mock.calls[0][0]).toContain('DELETE FROM boss_drop_records')
  })
})

describe('getBossDropRecords', () => {
  it('ocids가 비면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossDropRecords } = await import('../boss-drops')

    await expect(getBossDropRecords([], ['2026-W30'])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('periodKeys가 비면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossDropRecords } = await import('../boss-drops')

    await expect(getBossDropRecords(['ocid-1'], [])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
  })

  it('ocid IN (...)와 period_key IN (...) 조건으로 조회해 BossDropRecord[]로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '하드',
          period_key: '2026-W30',
          drop_index: 1,
          category: 'consumable',
          item_name: '리스트레인트 링',
          slot: null,
          box_origin: '홍옥의 보스 반지 상자',
          ring_level: 3,
          quantity: 1,
          recorded_at: '2026-07-26T00:00:00.000Z',
        },
      ],
    })
    const { getBossDropRecords } = await import('../boss-drops')

    const result = await getBossDropRecords(['ocid-1', 'ocid-2'], ['2026-W30'])

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid IN (?, ?) AND period_key IN (?)'),
      ['ocid-1', 'ocid-2', '2026-W30'],
    )
    expect(result).toEqual([
      {
        ocid: 'ocid-1',
        boss: '스우',
        difficulty: '하드',
        periodKey: '2026-W30',
        dropIndex: 1,
        category: 'consumable',
        itemName: '리스트레인트 링',
        slot: null,
        boxOrigin: '홍옥의 보스 반지 상자',
        ringLevel: 3,
        quantity: 1,
        recordedAt: '2026-07-26T00:00:00.000Z',
      },
    ])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossDropRecords } = await import('../boss-drops')

    await expect(getBossDropRecords(['ocid-1'], ['2026-W30'])).resolves.toEqual([])
  })
})
