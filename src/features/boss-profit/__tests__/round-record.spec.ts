jest.mock('../../../storage/boss-profit', () => ({
  fillMissingRecordWorlds: jest.fn(async () => undefined),
  getBossProfitRecords: jest.fn(async () => []),
  getManualBossProfitRecordKeys: jest.fn(async () => []),
}))
jest.mock('../../../storage/boss-drops', () => ({ getBossDropRecords: jest.fn(async () => []) }))
jest.mock('../../../storage/manual-tracked-content', () => ({ getManualTrackedContent: jest.fn(async () => []) }))
jest.mock('../../../storage/tracking-mode', () => ({ getTrackingMode: jest.fn(async () => 'auto') }))
jest.mock('../../../storage/record-revision-batch', () => ({
  batchRecordWrites: async (write: () => Promise<unknown>) => {
    mockBatchDepth += 1
    try {
      return await write()
    } finally {
      mockBatchDepth -= 1
    }
  },
}))
var mockBatchDepth = 0
jest.mock('../../character-profile/resolve', () => ({
  resolveDisplayProfiles: jest.fn(async (ocids: string[]) =>
    new Map(ocids.map((ocid) => [ocid, { name: ocid, imageUrl: '', world: '스카니아', worldKey: 'scania', level: 280 }])),
  ),
}))
jest.mock('../auto-record', () => ({
  autoRecordRows: jest.fn(async ({ rows }: { rows: unknown[] }) => rows),
  nexonCompletedKeysOf: jest.fn(() => []),
}))
jest.mock('../orphan-drops', () => ({ sweepOrphanDrops: jest.fn(async () => 0) }))
jest.mock('../world-leap-records', () => ({ cleanUpWorldLeapDuplicates: jest.fn(async () => 0) }))
jest.mock('../../toast/store', () => ({ useToastStore: { getState: () => ({ showInfo: mockShowInfo }) } }))
const mockShowInfo = jest.fn()

import { bossesInSection } from '../../../lib/boss/bosses'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import { recordBossProfitFromRound } from '../round-record'

const { getBossProfitRecords: recordsMock } = jest.requireMock('../../../storage/boss-profit') as Record<string, jest.Mock>
const { autoRecordRows: autoRecordMock } = jest.requireMock('../auto-record') as Record<string, jest.Mock>
const { sweepOrphanDrops: sweepMock } = jest.requireMock('../orphan-drops') as Record<string, jest.Mock>
const { cleanUpWorldLeapDuplicates: cleanUpMock } = jest.requireMock('../world-leap-records') as Record<string, jest.Mock>

const NOW = new Date('2026-10-30T05:00:00.000Z')
const 주간보스 = bossesInSection('weekly')[0]

function result(ocid: string, overrides: Partial<CharacterScheduleSync> = {}): CharacterScheduleSync {
  return {
    ocid,
    characterName: ocid,
    worldKey: 'scania',
    state: {
      characterName: ocid,
      bossContents: [
        {
          bossKey: 주간보스.key,
          apiName: 주간보스.name,
          difficulty: 'hard',
          cycle: 'weekly',
          isRegistered: true,
          isComplete: true,
          ownComplete: true,
        },
      ],
    } as never,
    syncedAt: NOW.toISOString(),
    isStale: false,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  recordsMock.mockResolvedValue([])
  autoRecordMock.mockImplementation(async ({ rows }: { rows: unknown[] }) => rows)
  sweepMock.mockResolvedValue(0)
  cleanUpMock.mockResolvedValue(0)
})

it('캐시로 채운 캐릭터는 자동 기록과 고아 정리에서 뺀다', async () => {
  await recordBossProfitFromRound(['a', 'b'], [result('a'), result('b', { isStale: true, error: { kind: 'network' } })], NOW)

  const params = autoRecordMock.mock.calls[0][0] as { rows: { ocid: string }[]; isSourceCurrent: (row: { ocid: string }) => boolean }
  expect(params.rows.map((row) => row.ocid)).toEqual(['a', 'b'])
  expect(params.isSourceCurrent({ ocid: 'a' })).toBe(true)
  expect(params.isSourceCurrent({ ocid: 'b' })).toBe(false)
  expect(sweepMock).toHaveBeenCalledWith(expect.objectContaining({ ocids: ['a', 'b'], trustedOcids: new Set(['a']) }))
})

it('기록 조회가 실패하면 자동 기록에 `null` 을 넘기고 고아 정리는 안 한다', async () => {
  recordsMock.mockRejectedValue(new Error('sqlite'))

  await recordBossProfitFromRound(['a'], [result('a')], NOW)

  expect((autoRecordMock.mock.calls[0][0] as { records: unknown }).records).toBeNull()
  expect(sweepMock).not.toHaveBeenCalled()
})

it('쓰기 셋은 판 알림을 모으는 한 묶음 안에서 돈다', async () => {
  const depths: number[] = []
  autoRecordMock.mockImplementation(async ({ rows }: { rows: unknown[] }) => {
    depths.push(mockBatchDepth)
    return rows
  })
  cleanUpMock.mockImplementation(async () => {
    depths.push(mockBatchDepth)
    return 0
  })
  sweepMock.mockImplementation(async () => {
    depths.push(mockBatchDepth)
    return 0
  })

  await recordBossProfitFromRound(['a'], [result('a')], NOW)

  expect(depths).toEqual([1, 1, 1])
})

it('지운 드롭이 있으면 안내하고, 없으면 조용하다', async () => {
  await recordBossProfitFromRound(['a'], [result('a')], NOW)
  expect(mockShowInfo).not.toHaveBeenCalled()

  sweepMock.mockResolvedValue(2)
  await recordBossProfitFromRound(['a'], [result('a')], NOW)
  expect(mockShowInfo).toHaveBeenCalledWith('잡지 않은 보스의 아이템 기록 2건을 정리했어요')
})

it('추적이 없거나 결과가 없으면 아무것도 안 읽는다', async () => {
  await recordBossProfitFromRound([], [], NOW)
  await recordBossProfitFromRound(['a'], [], NOW)
  expect(recordsMock).not.toHaveBeenCalled()
})
