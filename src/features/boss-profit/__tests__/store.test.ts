import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterScheduleSync } from '../../schedule-sync/schedule-sync'
import type { BossContent, SchedulerCharacterState } from '../../../types'
import type { BossProfitRecord } from '../../../storage/boss-profit'
import type { CachedSchedulerEntry } from '../../../storage/scheduler-cache'

const {
  syncSchedulesMock,
  getTrackedCharacterOcidsMock,
  getBossProfitRecordsMock,
  upsertBossProfitRecordMock,
  getBossPartySizeMock,
  getCachedSchedulerStateMock,
  getCachedCharacterBasicMock,
  isPeriodCheckedMock,
  markPeriodCheckedMock,
  getAuthConfigMock,
  fetchSchedulerCharacterStateMock,
} = vi.hoisted(() => ({
  syncSchedulesMock: vi.fn(),
  getTrackedCharacterOcidsMock: vi.fn(),
  getBossProfitRecordsMock: vi.fn(),
  upsertBossProfitRecordMock: vi.fn(),
  getBossPartySizeMock: vi.fn(),
  getCachedSchedulerStateMock: vi.fn(),
  getCachedCharacterBasicMock: vi.fn(),
  isPeriodCheckedMock: vi.fn(),
  markPeriodCheckedMock: vi.fn(),
  getAuthConfigMock: vi.fn(),
  fetchSchedulerCharacterStateMock: vi.fn(),
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
}))

vi.mock('../../../storage/boss-party-settings', () => ({
  getBossPartySize: getBossPartySizeMock,
}))

vi.mock('../../../storage/scheduler-cache', () => ({
  getCachedSchedulerState: getCachedSchedulerStateMock,
}))

vi.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: getCachedCharacterBasicMock,
}))

vi.mock('../../../storage/boss-profit-period-checks', () => ({
  isPeriodChecked: isPeriodCheckedMock,
  markPeriodChecked: markPeriodCheckedMock,
}))

vi.mock('../../../storage/api-key', () => ({
  getAuthConfig: getAuthConfigMock,
}))

vi.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock,
}))

import {
  getAdjacentPeriodKey,
  getBackfillQueryDate,
  getCurrentBossProfitPeriod,
  getWeeklyPeriodKeysInMonth,
  MIN_SCHEDULER_DATE,
} from '../../../lib/boss-profit-period'
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
      isDailyStale: false,
      isWeeklyStale: false,
      isWeeklyBossStale: false,
      isMonthlyBossStale: false,
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
    tab: 'weekly',
    periodKey: getCurrentBossProfitPeriod('weekly', new Date()).periodKey,
    rows: [],
    weeklySubtotals: [],
    isPeriodLoading: false,
    periodUnavailable: false,
    error: null,
    staleCharacterNames: [],
    trackedOcids: null,
  })
  getBossProfitRecordsMock.mockResolvedValue([])
  upsertBossProfitRecordMock.mockResolvedValue(undefined)
  getBossPartySizeMock.mockResolvedValue(null)
  getCachedSchedulerStateMock.mockResolvedValue(null)
  getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
    profile: { name: `캐릭터-${ocid}`, level: 200, imageUrl: 'x', accessFlag: true },
    cachedAt: '2026-07-01T00:00:00.000Z',
  }))
  isPeriodCheckedMock.mockResolvedValue(false)
  markPeriodCheckedMock.mockResolvedValue(undefined)
  getAuthConfigMock.mockResolvedValue({ apiKey: 'test-key', selectedAccountId: 'acc-1' })
  fetchSchedulerCharacterStateMock.mockResolvedValue(null)
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

  it('weekly 탭에서는 weekly cycle 보스만, monthly 탭으로 전환하면 monthly cycle 보스만 rows에 노출된다', async () => {
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

    const weeklyRows = useBossProfitStore.getState().rows
    expect(weeklyRows.map((row) => row.boss)).toEqual(['자쿰'])
    expect(weeklyRows[0].cycle).toBe('weekly')

    await useBossProfitStore.getState().setTab('monthly')

    const monthlyRows = useBossProfitStore.getState().rows
    expect(monthlyRows.map((row) => row.boss)).toEqual(['검은마법사'])
    expect(monthlyRows[0].cycle).toBe('monthly')
    // setTab은 "현재 기간"으로만 이동하므로 API를 다시 호출하지 않는다(로컬 스냅샷에서 슬라이스).
    expect(syncSchedulesMock).toHaveBeenCalledTimes(1)
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

  it('row.imageUrl은 character-basic-cache의 character_image로 채워진다(캐릭터명은 character/list 출처를 유지)', async () => {
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: { name: `캐시된-${ocid}`, level: 200, imageUrl: `https://example.com/${ocid}.png`, accessFlag: true },
      cachedAt: '2026-07-01T00:00:00.000Z',
    }))
    syncSchedulesMock.mockResolvedValue([syncResult({ ocid: 'ocid-1', characterName: '라이브이름' })])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.characterName).toBe('라이브이름') // character/list 출처 유지(ADR-017, 정확도 우선)
    expect(row.imageUrl).toBe('https://example.com/ocid-1.png') // character-basic-cache 출처
  })

  it('character-basic-cache에 캐시가 없으면 row.imageUrl은 null이다', async () => {
    getCachedCharacterBasicMock.mockResolvedValue(null)
    syncSchedulesMock.mockResolvedValue([syncResult()])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    expect(useBossProfitStore.getState().rows[0].imageUrl).toBeNull()
  })

  it('캐릭터 순서는 레벨 내림차순으로 고정되며 ocids 인자·API 응답 순서와 무관하다', async () => {
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: {
        name: `캐릭터-${ocid}`,
        level: ocid === 'ocid-1' ? 100 : 250,
        imageUrl: 'x',
        accessFlag: true,
      },
      cachedAt: '2026-07-01T00:00:00.000Z',
    }))
    // syncSchedules는 낮은 레벨(ocid-1)을 먼저 반환하지만, 최종 rows는 레벨이 더 높은
    // ocid-2가 먼저 와야 한다 — API 응답 순서를 그대로 따르지 않는다.
    syncSchedulesMock.mockResolvedValue([
      syncResult({ ocid: 'ocid-1', characterName: '캐릭터-ocid-1' }),
      syncResult({
        ocid: 'ocid-2',
        characterName: '캐릭터-ocid-2',
        state: {
          ...syncResult().state!,
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', isComplete: true })],
        },
      }),
    ])

    await useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])

    expect(useBossProfitStore.getState().rows.map((row) => row.ocid)).toEqual(['ocid-2', 'ocid-1'])
  })

  it('캐시 우선 표시와 실시간 동기화 이후의 캐릭터 순서가 같다(응답 도착 후 순서가 바뀌지 않는다)', async () => {
    getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
      profile: {
        name: `캐릭터-${ocid}`,
        level: ocid === 'ocid-1' ? 100 : 250,
        imageUrl: 'x',
        accessFlag: true,
      },
      cachedAt: '2026-07-01T00:00:00.000Z',
    }))
    getCachedSchedulerStateMock.mockImplementation(async (ocid: string) => ({
      state: {
        ...syncResult().state!,
        characterName: `캐릭터-${ocid}`,
        bossContents: [bossContent({ isComplete: true })],
      },
      syncedAt: '2026-07-01T00:00:00.000Z',
    }))

    const pending = new Promise<CharacterScheduleSync[]>(() => {})
    syncSchedulesMock.mockReturnValue(pending)

    void useBossProfitStore.getState().refresh(['ocid-1', 'ocid-2'])
    await vi.waitFor(() => expect(useBossProfitStore.getState().rows.length).toBe(2))

    const cacheFirstOrder = useBossProfitStore.getState().rows.map((row) => row.ocid)
    expect(cacheFirstOrder).toEqual(['ocid-2', 'ocid-1']) // 레벨 내림차순(ocid-2가 250으로 더 높음)
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

  it('저장된 기록의 priceMeso가 라이브 시세와 다르면 기록값을 그대로 쓴다(과거 기록 재계산 방지, ADR-023)', async () => {
    syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, 라이브 priceMeso 8080000

    await useBossProfitStore.getState().refresh(['ocid-1'])
    const periodKey = useBossProfitStore.getState().rows[0].periodKey

    const record: BossProfitRecord = {
      ocid: 'ocid-1',
      boss: '자쿰',
      difficulty: '카오스',
      cycle: 'weekly',
      periodKey,
      partySize: 2,
      priceMeso: 7_000_000, // 과거 패치 시점 시세 — 지금의 라이브 시세(8080000)와 다르다
      payoutMeso: 3_500_000,
      recordedAt: '2026-07-09T00:00:00.000Z',
    }
    getBossProfitRecordsMock.mockResolvedValue([record])

    await useBossProfitStore.getState().refresh(['ocid-1'])

    const row = useBossProfitStore.getState().rows[0]
    expect(row.priceMeso).toBe(7_000_000)
    expect(row.partySize).toBe(2)
    expect(row.payoutMeso).toBe(3_500_000)
  })

  describe('자동 파티원 수 기록 (ADR-014, 기본값 소스는 ADR-019로 boss_party_settings 조회로 대체)', () => {
    it('기록도 파티 설정도 없는 새 완료 보스는 partySize 1(솔로)로 자동 기록된다', async () => {
      getBossPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getBossPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
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

    it('boss_party_settings에 설정된 값이 있으면 그 값을 기본 파티원 수로 쓴다', async () => {
      getBossPartySizeMock.mockResolvedValue(4)
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

    it('이미 저장된 기록이 있는 조합은 자동 기록 로직을 건드리지 않는다(주차별 override 유지)', async () => {
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
      getBossPartySizeMock.mockClear()
      upsertBossProfitRecordMock.mockClear()

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBe(4)
      expect(row.payoutMeso).toBe(2020000)
    })

    it('자동 기록 대상 보스가 여러 개여도 upsert 호출이 겹치지 않는다(동일 SQLite 커넥션 트랜잭션 충돌 방지)', async () => {
      let active = 0
      let sawOverlap = false
      upsertBossProfitRecordMock.mockImplementation(async () => {
        active += 1
        if (active > 1) sawOverlap = true
        await new Promise((resolve) => setTimeout(resolve, 0))
        active -= 1
      })
      getBossPartySizeMock.mockResolvedValue(null)
      syncSchedulesMock.mockResolvedValue([
        syncResult({
          state: {
            ...syncResult().state!,
            bossContents: [
              bossContent({ name: '자쿰', difficulty: '카오스', isComplete: true }),
              bossContent({ name: '스우', difficulty: '노멀', isComplete: true }),
            ],
          },
        }),
      ])

      await useBossProfitStore.getState().refresh(['ocid-1'])

      expect(upsertBossProfitRecordMock).toHaveBeenCalledTimes(2)
      expect(sawOverlap).toBe(false)
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

      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
      const row = useBossProfitStore.getState().rows[0]
      expect(row.partySize).toBeNull()
      expect(row.payoutMeso).toBeNull()
    })

    // 2026-07-17 실기기 재현: 데이터 초기화(리로드) 직후 보스 스케줄러에 캐릭터를 저장하면
    // SQLite 읽기는 되지만(loadPartySizes), 리로드 이후 이 커넥션에 대한 첫 "쓰기" 쿼리
    // (upsertBossProfitRecord)가 stale 네이티브 커넥션 탓에 막혀 보스 수익 화면이
    // "불러오는 중..."에서 영원히 멈췄다. refresh()가 SQLite 응답을 무한정 기다리지 않고
    // 타임아웃 후 기본값(파티원 1인)으로라도 화면을 완성해야 한다.
    it('upsertBossProfitRecord가 응답하지 않아도(hang) 타임아웃 후 기본 파티원 수로 loaded 상태가 된다', async () => {
      vi.useFakeTimers()
      try {
        getBossPartySizeMock.mockResolvedValue(null)
        upsertBossProfitRecordMock.mockImplementation(() => new Promise(() => {}))
        syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

        const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])
        await vi.advanceTimersByTimeAsync(5000)
        await refreshPromise

        const state = useBossProfitStore.getState()
        expect(state.status).toBe('loaded')
        expect(state.rows[0].partySize).toBe(1)
        expect(state.rows[0].payoutMeso).toBe(8080000)
      } finally {
        vi.useRealTimers()
      }
    })

    it('getBossProfitRecords가 응답하지 않아도(hang) 타임아웃 후 기록 없이 진행해 loaded 상태가 된다', async () => {
      vi.useFakeTimers()
      try {
        getBossProfitRecordsMock.mockImplementation(() => new Promise(() => {}))
        getBossPartySizeMock.mockResolvedValue(null)
        syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000

        const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])
        await vi.advanceTimersByTimeAsync(5000)
        await refreshPromise

        const state = useBossProfitStore.getState()
        expect(state.status).toBe('loaded')
        expect(state.rows[0].partySize).toBe(1)
        expect(state.rows[0].payoutMeso).toBe(8080000)
      } finally {
        vi.useRealTimers()
      }
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

  describe('캐시 우선 표시 (ADR-017)', () => {
    function cachedEntry(overrides: Partial<CachedSchedulerEntry['state']> = {}): CachedSchedulerEntry {
      return {
        state: {
          asOf: '2026-07-09T00:00+09:00',
          characterName: '캐시캐릭터',
          world: '베라',
          level: 200,
          jobClass: '렌',
          dailyContents: [],
          weeklyContents: [],
          bossContents: [bossContent()],
          isDailyStale: false,
          isWeeklyStale: false,
          isWeeklyBossStale: false,
          isMonthlyBossStale: false,
          ...overrides,
        },
        syncedAt: '2026-07-10T00:00:00.000Z',
      }
    }

    function flushMicrotasks() {
      return new Promise((resolve) => setTimeout(resolve, 0))
    }

    it('syncSchedules가 아직 끝나지 않아도 캐시된 완료 보스로 rows를 먼저 채우고, 캐시 단계에서는 자동 기록(upsert) 관련 함수를 호출하지 않는다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry())

      let resolveSync!: (value: CharacterScheduleSync[]) => void
      const pending = new Promise<CharacterScheduleSync[]>((resolve) => {
        resolveSync = resolve
      })
      syncSchedulesMock.mockReturnValue(pending)

      const refreshPromise = useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const midState = useBossProfitStore.getState()
      expect(midState.status).toBe('loading')
      expect(midState.rows).toHaveLength(1)
      expect(midState.rows[0].boss).toBe('자쿰')
      expect(midState.rows[0].ocid).toBe('ocid-1')
      expect(midState.rows[0].characterName).toBe('캐시캐릭터')
      expect(midState.rows[0].partySize).toBeNull()
      expect(midState.rows[0].payoutMeso).toBeNull()
      // 캐시 단계도 기존 기록 유무를 확인하려고 getBossProfitRecords는 호출한다(읽기 전용) —
      // 다만 자동 기록(upsert)·파티 설정 조회는 재검증 이후에만 수행한다.
      expect(getBossProfitRecordsMock).toHaveBeenCalled()
      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()

      resolveSync(
        [syncResult()], // 자쿰 카오스, priceMeso 8080000
      )
      await refreshPromise

      const finalState = useBossProfitStore.getState()
      expect(finalState.status).toBe('loaded')
      expect(finalState.rows).toHaveLength(1)
      expect(finalState.rows[0].partySize).toBe(1)
      expect(finalState.rows[0].payoutMeso).toBe(8080000)
      expect(getBossPartySizeMock).toHaveBeenCalledWith('ocid-1', '자쿰', '카오스')
      expect(upsertBossProfitRecordMock).toHaveBeenCalled()
    })

    it('캐시 단계에서도 이미 저장된 기록이 있으면 partySize/payoutMeso가 즉시 반영된다(0메소로 잠깐 보이는 깜빡임 방지)', async () => {
      // 실제 periodKey 계산값을 얻기 위해 먼저 한 번 정상적으로 refresh한다.
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, priceMeso 8080000
      getCachedSchedulerStateMock.mockResolvedValue(null)
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const periodKey = useBossProfitStore.getState().rows[0].periodKey

      const record: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey,
        partySize: 2,
        priceMeso: 8080000,
        payoutMeso: 4040000,
        recordedAt: '2026-07-10T00:00:00.000Z',
      }
      vi.clearAllMocks() // 위 준비용 refresh에서 쌓인 호출 기록(자동 기록 포함)을 지운다
      getBossProfitRecordsMock.mockResolvedValue([record])
      getCachedSchedulerStateMock.mockResolvedValue(cachedEntry())

      const pending = new Promise<CharacterScheduleSync[]>(() => {
        // 의도적으로 resolve하지 않음 — 캐시 단계 직후 상태만 확인
      })
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const midState = useBossProfitStore.getState()
      expect(midState.rows).toHaveLength(1)
      expect(midState.rows[0].partySize).toBe(2)
      expect(midState.rows[0].payoutMeso).toBe(4040000)
      expect(getBossPartySizeMock).not.toHaveBeenCalled()
      expect(upsertBossProfitRecordMock).not.toHaveBeenCalled()
    })

    it('캐시가 없는 ocid는 캐시 단계 rows에 포함되지 않는다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(null)

      const pending = new Promise<CharacterScheduleSync[]>(() => {
        // 의도적으로 resolve하지 않음 — 캐시 단계 직후 상태만 확인
      })
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      const midState = useBossProfitStore.getState()
      expect(midState.status).toBe('loading')
      expect(midState.rows).toEqual([])
    })

    it('캐시의 미처치 보스는 캐시 단계 rows에서 제외된다', async () => {
      getCachedSchedulerStateMock.mockResolvedValue(
        cachedEntry({ bossContents: [bossContent({ isComplete: false })] }),
      )

      const pending = new Promise<CharacterScheduleSync[]>(() => {})
      syncSchedulesMock.mockReturnValue(pending)

      void useBossProfitStore.getState().refresh(['ocid-1'])
      await flushMicrotasks()

      expect(useBossProfitStore.getState().rows).toEqual([])
    })

    it('월간 탭 캐시 단계에서도 이미 확정된 지난 주차 합계가 즉시 반영된다(syncSchedules 응답 전 weeklySubtotals 누락 방지)', async () => {
      // 이번 달에 반드시 "지난 주차"가 존재하도록 날짜를 고정한다(월초에 테스트를 실행하면
      // 지난 주차가 아예 없어 전제가 깨지는 걸 방지) — Date만 고정하고 타이머는 실제로 둬서
      // 아래 flushMicrotasks(실제 setTimeout 기반)가 그대로 동작하게 한다.
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-07-30T06:00:00.000Z'))

      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        await useBossProfitStore.getState().setTab('monthly')

        const monthPeriodKey = useBossProfitStore.getState().periodKey
        const currentWeeklyPeriodKey = getCurrentBossProfitPeriod('weekly', new Date()).periodKey
        const pastWeekKey = getWeeklyPeriodKeysInMonth(monthPeriodKey).find(
          (key) => key < currentWeeklyPeriodKey,
        )
        if (pastWeekKey === undefined) {
          throw new Error('테스트 전제 실패: 고정한 날짜 기준 이번 달에 지난 주차가 있어야 한다')
        }

        const pastRecord: BossProfitRecord = {
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '노멀',
          cycle: 'weekly',
          periodKey: pastWeekKey,
          partySize: 2,
          priceMeso: 4_000_000,
          payoutMeso: 2_000_000,
          recordedAt: '2026-07-01T00:00:00.000Z',
        }

        vi.clearAllMocks()
        getBossProfitRecordsMock.mockResolvedValue([pastRecord])
        getCachedSchedulerStateMock.mockResolvedValue(cachedEntry())
        getCachedCharacterBasicMock.mockImplementation(async (ocid: string) => ({
          profile: { name: `캐릭터-${ocid}`, level: 200, imageUrl: 'x', accessFlag: true },
          cachedAt: '2026-07-01T00:00:00.000Z',
        }))

        const pending = new Promise<CharacterScheduleSync[]>(() => {})
        syncSchedulesMock.mockReturnValue(pending)

        void useBossProfitStore.getState().refresh(['ocid-1'])
        await flushMicrotasks()

        const midState = useBossProfitStore.getState()
        expect(midState.status).toBe('loading')
        const pastSubtotal = midState.weeklySubtotals.find((subtotal) => subtotal.periodKey === pastWeekKey)
        expect(pastSubtotal).toBeDefined()
        expect(pastSubtotal?.totalMeso).toBe(2_000_000)
        expect(pastSubtotal?.state).toBe('confirmed')
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('기간 네비게이션 (ADR-023)', () => {
    function schedulerState(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
      return {
        asOf: '2026-06-04T00:00+09:00',
        characterName: '낟낟',
        world: '베라',
        level: 200,
        jobClass: '렌',
        dailyContents: [],
        weeklyContents: [],
        bossContents: [],
        isDailyStale: false,
        isWeeklyStale: false,
        isWeeklyBossStale: false,
        isMonthlyBossStale: false,
        ...overrides,
      }
    }

    it('goToPreviousPeriod: 이미 체크된 과거 주는 API 호출 없이 로컬 기록만으로 rows를 채운다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, 이번 주
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const currentPeriodKey = useBossProfitStore.getState().periodKey
      const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

      isPeriodCheckedMock.mockResolvedValue(true)
      const pastRecord: BossProfitRecord = {
        ocid: 'ocid-1',
        boss: '자쿰',
        difficulty: '카오스',
        cycle: 'weekly',
        periodKey: previousPeriodKey,
        partySize: 3,
        priceMeso: 8_080_000,
        payoutMeso: 2_693_333,
        recordedAt: '2026-06-01T00:00:00.000Z',
      }
      getBossProfitRecordsMock.mockResolvedValue([pastRecord])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { name: '낟낟', level: 200, imageUrl: 'x', accessFlag: true },
        cachedAt: '2026-06-01T00:00:00.000Z',
      })

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
      const state = useBossProfitStore.getState()
      expect(state.periodKey).toBe(previousPeriodKey)
      expect(state.rows).toHaveLength(1)
      expect(state.rows[0].characterName).toBe('낟낟')
      expect(state.rows[0].imageUrl).toBe('x') // 과거 기간도 character-basic-cache에서 이미지 복원(ADR-023)
      expect(state.rows[0].partySize).toBe(3)
      expect(state.rows[0].payoutMeso).toBe(2_693_333)
      expect(state.isPeriodLoading).toBe(false)
      expect(state.periodUnavailable).toBe(false)
    })

    // 2026-07-17 실기기 재현: SQLite 커넥션이 stale하면 isPeriodChecked가 응답 없이 멈추고,
    // periodKey 라벨만 "지난 주"로 바뀐 채 rows는 "이번 주" 값 그대로 남는(에러도 로딩 표시도 없는)
    // 증상으로 나타났다. loadPeriod도 refresh()와 동일하게 타임아웃 후 "체크 안 됨"으로 간주해
    // 백필을 진행해야 한다(멈추지 않고 끝까지 진행되는지가 핵심 — 고치기 전엔 아래 await promise가
    // 영원히 끝나지 않았다).
    it('goToPreviousPeriod: isPeriodChecked가 응답하지 않아도(hang) 타임아웃 후 백필을 진행해 멈추지 않는다', async () => {
      vi.useFakeTimers()
      try {
        syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, 이번 주
        await useBossProfitStore.getState().refresh(['ocid-1'])
        const currentPeriodKey = useBossProfitStore.getState().periodKey
        const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

        isPeriodCheckedMock.mockImplementation(() => new Promise(() => {}))
        getBossProfitRecordsMock.mockResolvedValue([])
        fetchSchedulerCharacterStateMock.mockResolvedValue(
          schedulerState({
            bossContents: [bossContent({ name: '스우', difficulty: '노멀', cycle: 'weekly', isComplete: true })],
          }),
        )

        const promise = useBossProfitStore.getState().goToPreviousPeriod()
        await vi.advanceTimersByTimeAsync(5000)
        await promise

        const state = useBossProfitStore.getState()
        expect(state.periodKey).toBe(previousPeriodKey)
        expect(fetchSchedulerCharacterStateMock).toHaveBeenCalled()
        expect(markPeriodCheckedMock).toHaveBeenCalledWith('ocid-1', 'weekly', previousPeriodKey, expect.any(String))
        expect(state.isPeriodLoading).toBe(false)
        expect(state.periodUnavailable).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    // 이미 체크된 과거 주라 백필 없이 buildRowsFromRecords로 바로 가는 경로에서도, 그 안의
    // getBossProfitRecords가 응답하지 않으면(hang) 같은 방식으로 멈춰있었다.
    it('goToPreviousPeriod: 이미 체크된 과거 주인데 getBossProfitRecords가 응답하지 않아도(hang) 타임아웃 후 멈추지 않는다', async () => {
      vi.useFakeTimers()
      try {
        syncSchedulesMock.mockResolvedValue([syncResult()])
        await useBossProfitStore.getState().refresh(['ocid-1'])
        const currentPeriodKey = useBossProfitStore.getState().periodKey
        const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

        isPeriodCheckedMock.mockResolvedValue(true)
        getBossProfitRecordsMock.mockImplementation(() => new Promise(() => {}))

        const promise = useBossProfitStore.getState().goToPreviousPeriod()
        await vi.advanceTimersByTimeAsync(5000)
        await promise

        const state = useBossProfitStore.getState()
        expect(state.periodKey).toBe(previousPeriodKey)
        expect(state.rows).toEqual([])
        expect(state.isPeriodLoading).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('goToPreviousPeriod: 체크된 적 없는 과거 주는 date 파라미터로 백필하고 완료 보스를 기록한 뒤 체크 표시한다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const currentPeriodKey = useBossProfitStore.getState().periodKey
      const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

      isPeriodCheckedMock.mockResolvedValue(false)
      getBossProfitRecordsMock.mockResolvedValue([])
      fetchSchedulerCharacterStateMock.mockResolvedValue(
        schedulerState({
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', cycle: 'weekly', isComplete: true })],
        }),
      )

      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith(
        'test-key',
        'ocid-1',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      )
      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '스우',
          difficulty: '노멀',
          cycle: 'weekly',
          periodKey: previousPeriodKey,
          partySize: 1,
        }),
      )
      expect(markPeriodCheckedMock).toHaveBeenCalledWith('ocid-1', 'weekly', previousPeriodKey, expect.any(String))
      expect(useBossProfitStore.getState().isPeriodLoading).toBe(false)
      expect(useBossProfitStore.getState().periodUnavailable).toBe(false)
    })

    it('goToPreviousPeriod: 백필 도중 isPeriodLoading이 true로 바뀐다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])

      isPeriodCheckedMock.mockResolvedValue(false)
      getBossProfitRecordsMock.mockResolvedValue([])

      let resolveFetch!: (value: SchedulerCharacterState) => void
      const pending = new Promise<SchedulerCharacterState>((resolve) => {
        resolveFetch = resolve
      })
      fetchSchedulerCharacterStateMock.mockReturnValue(pending)

      const promise = useBossProfitStore.getState().goToPreviousPeriod()

      await vi.waitFor(() => {
        expect(useBossProfitStore.getState().isPeriodLoading).toBe(true)
      })

      resolveFetch(schedulerState())
      await promise

      expect(useBossProfitStore.getState().isPeriodLoading).toBe(false)
    })

    it('goToPreviousPeriod: 백필이 실패하면 periodUnavailable이 true가 되고 markPeriodChecked를 호출하지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])

      isPeriodCheckedMock.mockResolvedValue(false)
      getBossProfitRecordsMock.mockResolvedValue([])
      fetchSchedulerCharacterStateMock.mockRejectedValue(new Error('network down'))

      await useBossProfitStore.getState().goToPreviousPeriod()

      const state = useBossProfitStore.getState()
      expect(state.periodUnavailable).toBe(true)
      expect(markPeriodCheckedMock).not.toHaveBeenCalled()
    })

    it('goToPreviousPeriod: MIN_SCHEDULER_DATE 이전 주는 물리적으로 이동할 수 없다(weekly)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])

      isPeriodCheckedMock.mockResolvedValue(false)
      getBossProfitRecordsMock.mockResolvedValue([])
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

      // MIN_SCHEDULER_DATE 이전으로 넘어가기 바로 전 주(더 갈 수 있는 마지막 주)까지 이동한다.
      for (let i = 0; i < 10; i += 1) {
        const before = useBossProfitStore.getState().periodKey
        const next = getAdjacentPeriodKey('weekly', before, 'prev')
        if (getBackfillQueryDate('weekly', next) < MIN_SCHEDULER_DATE) {
          break
        }
        await useBossProfitStore.getState().goToPreviousPeriod()
      }

      const boundaryPeriodKey = useBossProfitStore.getState().periodKey
      fetchSchedulerCharacterStateMock.mockClear()

      // 여기서 한 번 더 이전으로 가려고 하면 아무 것도 하지 않아야 한다(API 호출도, periodKey
      // 변경도 없음) — MIN_SCHEDULER_DATE 이전 기간은 애초에 도달 불가능하다.
      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(boundaryPeriodKey)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    })

    it('goToPreviousPeriod: 통째로 MIN_SCHEDULER_DATE 이전인 달로는 물리적으로 이동할 수 없다(monthly)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      await useBossProfitStore.getState().setTab('monthly')

      const monthBefore = useBossProfitStore.getState().periodKey
      fetchSchedulerCharacterStateMock.mockClear()

      // "이번 달"에서 "지난 달"로 가려고 하면, 그 달이 통째로 MIN_SCHEDULER_DATE 이전이면
      // 아무 것도 하지 않아야 한다(periodKey 변경도, API 호출도 없음).
      await useBossProfitStore.getState().goToPreviousPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(monthBefore)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    })

    it('먼저 시작된 느린 백필이 나중에 끝나도, 그 사이 시작된 더 최신 네비게이션 결과를 덮어쓰지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()]) // 자쿰 카오스, 이번 주
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const currentPeriodKey = useBossProfitStore.getState().periodKey

      isPeriodCheckedMock.mockResolvedValue(false)
      getBossProfitRecordsMock.mockResolvedValue([])

      // 이전 주 이동(백필)을 pending 상태로 묶어둔다 — 아직 응답이 오지 않은 "느린" 요청.
      let resolveSlowFetch!: (value: SchedulerCharacterState) => void
      const slowFetch = new Promise<SchedulerCharacterState>((resolve) => {
        resolveSlowFetch = resolve
      })
      fetchSchedulerCharacterStateMock.mockReturnValueOnce(slowFetch)

      const firstNavigation = useBossProfitStore.getState().goToPreviousPeriod()
      await vi.waitFor(() => expect(useBossProfitStore.getState().isPeriodLoading).toBe(true))

      // 응답을 기다리는 동안 사용자가 곧바로 이번 주로 돌아온다 — 로컬 스냅샷에서 즉시 끝난다.
      await useBossProfitStore.getState().goToNextPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(currentPeriodKey)
      expect(useBossProfitStore.getState().rows.map((row) => row.boss)).toEqual(['자쿰'])
      expect(useBossProfitStore.getState().isPeriodLoading).toBe(false)

      // 이제서야 먼저 시작됐던 "이전 주" 백필 응답이 뒤늦게 도착한다.
      resolveSlowFetch(
        schedulerState({
          bossContents: [bossContent({ name: '스우', difficulty: '노멀', isComplete: true })],
        }),
      )
      await firstNavigation

      // 화면은 여전히 "이번 주"를 보여줘야 한다 — 뒤늦게 도착한 이전 주 응답에 덮어써지면 안 된다.
      expect(useBossProfitStore.getState().periodKey).toBe(currentPeriodKey)
      expect(useBossProfitStore.getState().rows.map((row) => row.boss)).toEqual(['자쿰'])
      expect(useBossProfitStore.getState().isPeriodLoading).toBe(false)
    })

    it('goToNextPeriod: 이미 최신 기간이면 periodKey가 바뀌지 않고 아무 것도 호출하지 않는다', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const periodKeyBefore = useBossProfitStore.getState().periodKey

      await useBossProfitStore.getState().goToNextPeriod()

      expect(useBossProfitStore.getState().periodKey).toBe(periodKeyBefore)
      expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
      expect(isPeriodCheckedMock).not.toHaveBeenCalled()
    })

    it('setPartySize는 과거 기간의 row에도 정상 동작한다(읽기 전용 처리 없음)', async () => {
      syncSchedulesMock.mockResolvedValue([syncResult()])
      await useBossProfitStore.getState().refresh(['ocid-1'])
      const currentPeriodKey = useBossProfitStore.getState().periodKey
      const previousPeriodKey = getAdjacentPeriodKey('weekly', currentPeriodKey, 'prev')

      isPeriodCheckedMock.mockResolvedValue(true)
      getBossProfitRecordsMock.mockResolvedValue([
        {
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          cycle: 'weekly',
          periodKey: previousPeriodKey,
          partySize: 2,
          priceMeso: 8_080_000,
          payoutMeso: 4_040_000,
          recordedAt: '2026-06-01T00:00:00.000Z',
        } satisfies BossProfitRecord,
      ])
      getCachedCharacterBasicMock.mockResolvedValue({
        profile: { name: '낟낟', level: 200, imageUrl: 'x', accessFlag: true },
        cachedAt: '2026-06-01T00:00:00.000Z',
      })

      await useBossProfitStore.getState().goToPreviousPeriod()
      upsertBossProfitRecordMock.mockClear()
      const pastRow = useBossProfitStore.getState().rows[0]

      await useBossProfitStore.getState().setPartySize(pastRow, 3)

      expect(upsertBossProfitRecordMock).toHaveBeenCalledWith(
        expect.objectContaining({
          ocid: 'ocid-1',
          boss: '자쿰',
          difficulty: '카오스',
          periodKey: previousPeriodKey,
          partySize: 3,
        }),
      )
      expect(useBossProfitStore.getState().rows[0].partySize).toBe(3)
    })
  })
})
