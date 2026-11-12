jest.mock('../../../storage/boss-profit', () => ({
  fillMissingRecordWorlds: jest.fn(async () => undefined),
  getBossProfitRecords: jest.fn(async () => []),
  getManualBossProfitRecordKeys: jest.fn(async () => []),
  deleteBossProfitRecord: jest.fn(async () => undefined),
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

import { getAdjacentPeriodKey, getCurrentBossProfitPeriod } from '../../../lib/boss/boss-profit-period'
import { bossesInSection } from '../../../lib/boss/bosses'
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { BossContent } from '../../../types'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import { recordBossProfitFromRound } from '../round-record'

const { getBossProfitRecords: recordsMock, deleteBossProfitRecord: deleteRecordMock } = jest.requireMock(
  '../../../storage/boss-profit',
) as Record<string, jest.Mock>
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
  await recordBossProfitFromRound(['a', 'b'], [result('a'), result('b', { isStale: true, error: { kind: 'network' } })], NOW, NOW)

  const params = autoRecordMock.mock.calls[0][0] as { rows: { ocid: string }[]; isSourceCurrent: (row: { ocid: string }) => boolean }
  expect(params.rows.map((row) => row.ocid)).toEqual(['a', 'b'])
  expect(params.isSourceCurrent({ ocid: 'a' })).toBe(true)
  expect(params.isSourceCurrent({ ocid: 'b' })).toBe(false)
  expect(sweepMock).toHaveBeenCalledWith(expect.objectContaining({ ocids: ['a', 'b'], trustedOcids: new Set(['a']) }))
})

it('기록 조회가 실패하면 자동 기록에 `null` 을 넘기고 고아 정리는 안 한다', async () => {
  recordsMock.mockRejectedValue(new Error('sqlite'))

  await recordBossProfitFromRound(['a'], [result('a')], NOW, NOW)

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

  await recordBossProfitFromRound(['a'], [result('a')], NOW, NOW)

  expect(depths).toEqual([1, 1, 1])
})

it('지운 드롭이 있으면 안내하고, 없으면 조용하다', async () => {
  await recordBossProfitFromRound(['a'], [result('a')], NOW, NOW)
  expect(mockShowInfo).not.toHaveBeenCalled()

  sweepMock.mockResolvedValue(2)
  await recordBossProfitFromRound(['a'], [result('a')], NOW, NOW)
  expect(mockShowInfo).toHaveBeenCalledWith('잡지 않은 보스의 기록 2건을 정리했어요')
})

it('추적이 없거나 결과가 없으면 아무것도 안 읽는다', async () => {
  await recordBossProfitFromRound([], [], NOW, NOW)
  await recordBossProfitFromRound(['a'], [], NOW, NOW)
  expect(recordsMock).not.toHaveBeenCalled()
})

describe('넥슨에 묻기 시작한 시각과 기간이 다른 회차', () => {
  // 수요일 밤에 받은 지난주 완료를 목요일 0시 뒤에 기록하면 이번 주 처치가 되고, 한 번 적히면 남는다.
  it('수요일 밤에 묻고 목요일 0시 뒤에 기록하는 회차는 완료를 기록하지 않고 드롭 정리도 믿지 않는다', async () => {
    const requestedAt = new Date('2026-11-11T23:59:00+09:00')
    const now = new Date('2026-11-12T00:30:00+09:00')

    await recordBossProfitFromRound(['a'], [result('a')], now, requestedAt)

    const params = autoRecordMock.mock.calls[0][0] as { isSourceCurrent: (row: { ocid: string }) => boolean }
    expect(params.isSourceCurrent({ ocid: 'a' })).toBe(false)
    expect(sweepMock).toHaveBeenCalledWith(expect.objectContaining({ trustedOcids: new Set() }))
  })
})

describe('넥슨이 미완료라고 준 이번 기간 자동 기록', () => {
  const WEEK = getCurrentBossProfitPeriod('weekly', NOW).periodKey

  function record(overrides: Partial<BossProfitRecord> = {}): BossProfitRecord {
    return {
      ocid: 'a',
      bossKey: 주간보스.key,
      boss: 주간보스.name,
      difficulty: 'hard',
      cycle: 'weekly',
      periodKey: WEEK,
      partySize: 1,
      priceMeso: 10_000_000,
      payoutMeso: 10_000_000,
      crystalMyShare: null,
      crystalSharesTotal: null,
      splitFeePercent: null,
      recordedAt: NOW.toISOString(),
      world: null,
      worldKey: null,
      source: 'auto',
      ...overrides,
    } as BossProfitRecord
  }

  function boss(difficulty: BossContent['difficulty'], ownComplete: boolean): BossContent {
    return {
      bossKey: 주간보스.key,
      apiName: 주간보스.name,
      difficulty,
      cycle: 'weekly',
      isRegistered: true,
      isComplete: ownComplete,
      ownComplete,
    }
  }

  /** 넥슨이 그 보스를 담아 보냈고 하드가 미완료인 응답. */
  function reportedIncomplete(overrides: Partial<CharacterScheduleSync> = {}): CharacterScheduleSync {
    return result('a', {
      state: { characterName: 'a', bossContents: [boss('hard', false)] } as never,
      reportedBossKeys: [주간보스.key],
      ...overrides,
    })
  }

  it('넥슨이 담아 보낸 보스가 어느 난이도도 완료가 아니면 알리지 않고 지우고, 자동 기록에 그 기록을 넘기지 않는다', async () => {
    recordsMock.mockResolvedValue([record()])

    await recordBossProfitFromRound(['a'], [reportedIncomplete()], NOW, NOW)

    expect(deleteRecordMock).toHaveBeenCalledWith({ ocid: 'a', bossKey: 주간보스.key, difficulty: 'hard', periodKey: WEEK })
    expect((autoRecordMock.mock.calls[0][0] as { records: unknown[] }).records).toEqual([])
    expect(mockShowInfo).not.toHaveBeenCalled()
  })

  it.each<[string, BossProfitRecord, CharacterScheduleSync]>([
    // 넥슨이 완료를 주지 않는 보스를 위해 사용자가 적은 것이다.
    ['직접 적은 완료', record({ source: 'manual' }), reportedIncomplete()],
    ['다른 난이도가 완료인 보스', record(), reportedIncomplete({ state: { characterName: 'a', bossContents: [boss('hard', false), boss('chaos', true)] } as never })],
    // 병합이 캐시에서 되살린 보스는 미완료로 섞여 있다. 넥슨이 보낸 것이 아니다.
    ['이번 응답에 없는 보스', record(), reportedIncomplete({ reportedBossKeys: [] })],
    ['캐시로 채운 캐릭터', record(), reportedIncomplete({ isStale: true, error: { kind: 'network' }, reportedBossKeys: undefined })],
    ['지난 기간 기록', record({ periodKey: getAdjacentPeriodKey('weekly', WEEK, 'prev') }), reportedIncomplete()],
  ])('%s 는 지우지 않는다', async (_name, existing, synced) => {
    recordsMock.mockResolvedValue([existing])

    await recordBossProfitFromRound(['a'], [synced], NOW, NOW)

    expect(deleteRecordMock).not.toHaveBeenCalled()
  })

  it('넥슨에 묻기 시작한 시각과 기간이 다른 회차에서는 지우지 않는다', async () => {
    recordsMock.mockResolvedValue([record()])

    await recordBossProfitFromRound(['a'], [reportedIncomplete()], NOW, new Date('2026-10-28T23:59:00+09:00'))

    expect(deleteRecordMock).not.toHaveBeenCalled()
  })
})
