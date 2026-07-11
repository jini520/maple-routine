import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { BossContent } from '../../../types'
import type { BossProfitRecord } from '../../../storage/boss-profit'

const {
  syncSchedulesMock,
  getTrackedCharacterOcidsMock,
  getBossProfitRecordsMock,
  upsertBossProfitRecordMock,
  getLatestPartySizeMock,
} = vi.hoisted(() => ({
  syncSchedulesMock: vi.fn(),
  getTrackedCharacterOcidsMock: vi.fn(),
  getBossProfitRecordsMock: vi.fn(),
  upsertBossProfitRecordMock: vi.fn(),
  getLatestPartySizeMock: vi.fn(),
}))

vi.mock('../../schedule-sync/schedule-sync', () => ({
  syncSchedules: syncSchedulesMock,
}))

vi.mock('../../../storage/character-selection', () => ({
  getTrackedCharacterOcids: getTrackedCharacterOcidsMock,
}))

vi.mock('../../../storage/boss-profit', () => ({
  getBossProfitRecords: getBossProfitRecordsMock,
  upsertBossProfitRecord: upsertBossProfitRecordMock,
  getLatestPartySize: getLatestPartySizeMock,
}))

import { useBossProfitStore } from '../store'

function bossContent(overrides: Partial<BossContent> = {}): BossContent {
  return {
    name: '자쿰',
    difficulty: '카오스',
    cycle: 'weekly',
    isRegistered: true,
    isComplete: true,
    ...overrides,
  }
}

function syncResult(overrides: Partial<CharacterScheduleSync> = {}): CharacterScheduleSync {
  return {
    ocid: 'ocid-1',
    characterName: '캐릭터-ocid-1',
    state: {
      asOf: '2026-07-09T00:00+09:00',
      characterName: '캐릭터-ocid-1',
      world: '베라',
      level: 200,
      jobClass: '렌',
      dailyContents: [],
      weeklyContents: [],
      bossContents: [bossContent()],
      weeklyBossClearCount: 3,
      weeklyBossClearLimitCount: 12,
    },
    syncedAt: '2026-07-11T00:00:00.000Z',
    isStale: false,
    error: null,
    ...overrides,
  }
}

beforeEach(() => {
  useBossProfitStore.setState({
    status: 'idle',
    rows: [],
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
  })
  getBossProfitRecordsMock.mockResolvedValue([])
  upsertBossProfitRecordMock.mockResolvedValue(undefined)
  getLatestPartySizeMock.mockResolvedValue(null)
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('useBossProfitStore', () => {
  it('초기 상태는 idle이고 rows가 비어있다', () => {
    const state = useBossProfitStore.getState()
    expect(state.status).toBe('idle')
    expect(state.rows).toEqual([])
    expect(state.error).toBeNull()
    expect(state.staleCharacterNames).toEqual([])
  })

  it('refresh([])는 syncSchedules를 호출하지 않고 곧바로 loaded/빈 배열 상태가 된다', async () => {
    await useBossProfitStore.getState().refresh([])

    const state = useBossProfitStore.getState()
    expect(syncSchedulesMock).not.toHaveBeenCalled()
    expect(state.status).toBe('loaded')
    expect(state.rows).toEqual([])
    expect(state.staleCharacterNames).toEqual([])
  })

  it('미처치 보스는 rows에서 제외된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', isComplete: false }),
            bossContent({ name: '스우', difficulty: '노멀', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const rows = useBossProfitStore.getState().rows
    expect(rows).toHaveLength(1)
    expect(rows[0].boss).toBe('스우')
  })

  it('weekly·monthly 처치 보스가 모두 rows에 포함된다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [
            bossContent({ name: '자쿰', cycle: 'weekly', isComplete: true }),
            bossContent({ name: '검은 마법사', difficulty: '익스트림', cycle: 'monthly', isComplete: true }),
          ],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const rows = useBossProfitStore.getState().rows
    expect(rows.map((row) => row.boss).sort()).toEqual(['검은마법사', '자쿰'])
    expect(rows.find((row) => row.boss === '자쿰')?.cycle).toBe('weekly')
    expect(rows.find((row) => row.boss === '검은마법사')?.cycle).toBe('monthly')
  })

  it('시세표에 없는 보스는 priceMeso가 null이고 payoutMeso도 항상 null이다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '벨로나', difficulty: '이지', isComplete: true })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.priceMeso).toBeNull()
    expect(row.payoutMeso).toBeNull()
  })

  it('여러 캐릭터의 처치 보스가 하나의 rows 배열로 합쳐진다', async () => {
    syncSchedulesMock.mockResolvedValue([
      syncResult({ ocid: 'ocid-1', characterName: '캐릭터1' }),
      syncResult({
        ocid: 'ocid-2',
        characterName: '캐릭터2',
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', isComplete: true })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])

    const rows = useBossProfitStore.getState().rows
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.ocid).sort()).toEqual(['ocid-1', 'ocid-2'])
  })

  it('특정 캐릭터의 동기화 결과가 isStale이면 staleCharacterNames에 그 캐릭터명이 포함된다', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult({ characterName: '캐릭터1', isStale: true })])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().staleCharacterNames).toEqual(['캐릭터1'])
  })

  it('저장된 기록이 있으면 refresh 후 partySize/payoutMeso가 복원된다(멱등성)', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

    await useBossProfitStore.getState().refresh(['ocid-1'])
    const periodKey = useBossProfitStore.getState().rows[0].periodKey

    const record: BossProfitRecord = {
      ocid: 'ocid-1',
      boss: '자쿰',
      difficulty: '카오스',
      cycle: 'weekly',
      periodKey,
      partySize: 4,
      priceMeso: 8080000,
      payoutMeso: 2020000,
      recordedAt: '2026-07-09T00:00:00.000Z',
    }
    getBossProfitRecordsMock.mockResolvedValue([record])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.partySize).toBe(4)
    expect(row.payoutMeso).toBe(2020000)
  })

  describe('자동 파티원 수 기록 (ADR-014)', () => {
    it('기록이 전혀 없는 새 완료 보스는 partySize 1로 자동 기록된다', async () => {
      getLatestPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getLatestPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 1,
          priceMeso: 8080000,
          payoutMeso: 8080000,
        }),
      )
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(1)
      expect(row.payoutMeso).toBe(8080000)
    })

    it('과거 기록이 있으면 그 값을 기본 파티원 수로 이어 쓴다', async () => {
      getLatestPartySizeMock.mockResolvedValue(4)
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 4,
          priceMeso: 8080000,
          payoutMeso: 2020000,
        }),
      )
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(4)
      expect(row.payoutMeso).toBe(2020000)
    })

    it('이미 저장된 기록이 있는 조합은 자동 기록 로직을 건드리지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])
      const periodKey = useBossProfitStore.getState().rows[0].periodKey

      const record: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey,
        partySize: 4,
        priceMeso: 8080000,
        payoutMeso: 2020000,
        recordedAt: '2026-07-09T00:00:00.000Z',
      }
      getBossProfitRecordsMock.mockResolvedValue([record])
      getLatestPartySizeMock.mockClear()
      upsertBossProfitRecordMock.mockClear()

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getLatestPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(4)
      expect(row.payoutMeso).toBe(2020000)
    })

    it('priceMeso가 null인 보스는 자동 기록 대상이 아니다', async () => {
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [bossContent({ name: '벨로나', difficulty: '이지', isComplete: true })],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getLatestPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBeNull()
      expect(row.payoutMeso).toBeNull()
    })
  })

  describe('setPartySize', () => {
    async function seedRow(overrides: Partial<BossContent> = {}) {
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [bossContent({ name: '자쿰', isComplete: true, ...overrides })],
          },
        }),
      ])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      // refresh 자체의 자동 기록(ADR-014) 호출 이력을 지워, 아래 테스트들이 setPartySize 호출만 검증하게 한다.
      upsertBossProfitRecordMock.mockClear()
      return useBossProfitStore.getState().rows[0]
    }

    it('0 이하 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow()

      await expect(useBossProfitStore.getState().setPartySize(row, 0)).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('음수 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow()

      await expect(useBossProfitStore.getState().setPartySize(row, -1)).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('상한을 초과한 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow() // 자쿰: maxPartySize 기본값 6

      await expect(
        useBossProfitStore.getState().setPartySize(row, row.maxPartySize + 1),
      ).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('정수가 아닌 값은 에러를 던지고 저장하지 않는다', async () => {
      const row = await seedRow()

      await expect(useBossProfitStore.getState().setPartySize(row, 1.5)).rejects.toThrow()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('유효한 값은 payoutMeso를 계산해 저장하고 rows에 반영한다', async () => {
      const row = await seedRow() // 자쿰 카오스: priceMeso 8080000

      await useBossProfitStore.getState().setPartySize(row, 2)

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          partySize: 2,
          priceMeso: 8080000,
          payoutMeso: 4040000,
        }),
      )
      const updated = useBossProfitStore.getState().rows[0]
      expect(updated.partySize).toBe(2)
      expect(updated.payoutMeso).toBe(4040000)
    })

    it('priceMeso가 null인 보스는 upsert를 호출하지 않지만 partySize는 로컬 상태에 반영된다', async () => {
      const row = await seedRow({ name: '벨로나', difficulty: '이지' })

      await useBossProfitStore.getState().setPartySize(row, 3)

      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const updated = useBossProfitStore.getState().rows[0]
      expect(updated.partySize).toBe(3)
      expect(updated.payoutMeso).toBeNull()
    })
  })

  describe('추적 목록', () => {
    it('loadTrackedOcids는 storage에서 조회한 값을 trackedOcids 상태에 반영한다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(['ocid-1'])
      syncSchedulesMock.mockResolvedValue([syncResult()])

      await useBossProfitStore.getState().loadTrackedOcids()

      expect(getTrackedCharacterOcidsMock).toHaveBeenCalledWith('boss')
      expect(useBossProfitStore.getState().trackedOcids).toEqual(['ocid-1'])
    })

    it('loadTrackedOcids는 조회된 목록이 null이면 refresh를 호출하지 않는다', async () => {
      getTrackedCharacterOcidsMock.mockResolvedValue(null)

      await useBossProfitStore.getState().loadTrackedOcids()

      expect(syncSchedulesMock).not.toHaveBeenCalled()
      expect(useBossProfitStore.getState().trackedOcids).toBeNull()
    })
  })
})
