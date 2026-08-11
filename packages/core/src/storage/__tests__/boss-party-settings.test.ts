import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BossPartySetting } from '../boss-party-settings'

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

const sampleSetting: BossPartySetting = {
  ocid: 'ocid-1',
  boss: '검은 마법사',
  difficulty: '익스트림',
  partySize: 4,
  updatedAt: '2026-07-13T00:05:00.000Z',
}

describe('setBossPartySize', () => {
  it('동일 키로 두 번 호출하면 ON CONFLICT DO UPDATE로 최신 값을 덮어쓴다 (멱등성)', async () => {
    const { setBossPartySize } = await import('../boss-party-settings')

    await setBossPartySize('ocid-1', '검은 마법사', '익스트림', 4, '2026-07-13T00:05:00.000Z')
    await setBossPartySize('ocid-1', '검은 마법사', '익스트림', 2, '2026-07-13T01:00:00.000Z')

    expect(runMock).toHaveBeenCalledTimes(2)

    const [firstSql, firstValues] = runMock.mock.calls[0]
    expect(firstSql).toContain('ON CONFLICT(ocid, boss, difficulty) DO UPDATE SET')
    expect(firstValues).toEqual(['ocid-1', '검은 마법사', '익스트림', 4, '2026-07-13T00:05:00.000Z'])

    const [secondSql, secondValues] = runMock.mock.calls[1]
    expect(secondSql).toBe(firstSql)
    expect(secondValues).toEqual(['ocid-1', '검은 마법사', '익스트림', 2, '2026-07-13T01:00:00.000Z'])
  })
})

describe('getBossPartySize', () => {
  it('조회 결과가 없으면 null을 반환한다 (설정 없음 = 솔로)', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { getBossPartySize } = await import('../boss-party-settings')

    await expect(getBossPartySize('ocid-1', '검은 마법사', '익스트림')).resolves.toBeNull()
  })

  it('조회 결과가 undefined여도 null을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossPartySize } = await import('../boss-party-settings')

    await expect(getBossPartySize('ocid-1', '검은 마법사', '익스트림')).resolves.toBeNull()
  })

  it('조회 결과가 있으면 party_size를 반환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '검은 마법사',
          difficulty: '익스트림',
          party_size: 4,
          updated_at: '2026-07-13T00:05:00.000Z',
        },
      ],
    })
    const { getBossPartySize } = await import('../boss-party-settings')

    await expect(getBossPartySize('ocid-1', '검은 마법사', '익스트림')).resolves.toBe(4)
  })

  it('ocid/boss/difficulty 조건으로 조회한다', async () => {
    queryMock.mockResolvedValue({ values: [] })
    const { getBossPartySize } = await import('../boss-party-settings')

    await getBossPartySize('ocid-1', '검은 마법사', '익스트림')

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid = ? AND boss = ? AND difficulty = ?'),
      ['ocid-1', '검은 마법사', '익스트림'],
    )
  })
})

describe('getBossPartySettings', () => {
  it('ocids가 빈 배열이면 DB를 호출하지 않고 빈 배열을 반환한다', async () => {
    const { getBossPartySettings } = await import('../boss-party-settings')

    await expect(getBossPartySettings([])).resolves.toEqual([])
    expect(getBossProfitDbMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('ocid IN (...) 조건으로 조회해 BossPartySetting[]으로 변환한다', async () => {
    queryMock.mockResolvedValue({
      values: [
        {
          ocid: 'ocid-1',
          boss: '검은 마법사',
          difficulty: '익스트림',
          party_size: 4,
          updated_at: '2026-07-13T00:05:00.000Z',
        },
      ],
    })
    const { getBossPartySettings } = await import('../boss-party-settings')

    const result = await getBossPartySettings(['ocid-1', 'ocid-2'])

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('WHERE ocid IN (?, ?)'),
      ['ocid-1', 'ocid-2'],
    )
    expect(result).toEqual([sampleSetting])
  })

  it('조회 결과가 없으면 빈 배열을 반환한다', async () => {
    queryMock.mockResolvedValue({ values: undefined })
    const { getBossPartySettings } = await import('../boss-party-settings')

    await expect(getBossPartySettings(['ocid-1'])).resolves.toEqual([])
  })
})
