import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterBasicProfile, MapleCharacter, SchedulerCharacterState } from '@core/types'
import { NexonAuthError, NexonNetworkError, NexonRateLimitError } from '@core/nexon/errors'

const { fetchCharacterBasicMock, fetchSchedulerCharacterStateMock } = vi.hoisted(() => ({
  fetchCharacterBasicMock: vi.fn(),
  fetchSchedulerCharacterStateMock: vi.fn(),
}))

const {
  getCachedCharacterBasicMock,
  setCachedCharacterBasicMock,
  setCachedSchedulerStateMock,
  resolveCharacterEligibilityMock,
} = vi.hoisted(() => ({
  getCachedCharacterBasicMock: vi.fn(),
  setCachedCharacterBasicMock: vi.fn(),
  setCachedSchedulerStateMock: vi.fn(),
  resolveCharacterEligibilityMock: vi.fn(),
}))

vi.mock('@core/nexon/character', () => ({
  fetchCharacterBasic: fetchCharacterBasicMock,
}))

vi.mock('@core/nexon/schedule', () => ({
  fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock,
}))

// ADR-113 결정 1: 예열이 공유 통과 지점(features/schedule-sync/character-basic-fetch)을 거치므로
// 이제 캐시 **읽기**도 이 경로를 탄다 — 목이 그 함수를 안 주면 예열이 그 캐릭터를 실패로 삼킨다.
vi.mock('../../../storage/character-basic-cache', () => ({
  getCachedCharacterBasic: getCachedCharacterBasicMock,
  setCachedCharacterBasic: setCachedCharacterBasicMock,
}))

vi.mock('../../../storage/scheduler-cache', () => ({
  setCachedSchedulerState: setCachedSchedulerStateMock,
}))

vi.mock('../../schedule-sync/character-eligibility', () => ({
  resolveCharacterEligibility: resolveCharacterEligibilityMock,
}))

import { prefetchAccountData } from '../prefetch'
import {
  hasSyncAttemptedThisRun,
  resetSyncRunStateForTests,
} from '../../schedule-sync/sync-run-state'

const ACCOUNT = 'account-1'

function character(ocid: string): MapleCharacter {
  return { ocid, name: `캐릭터-${ocid}`, world: '베라', jobClass: '렌', level: 200 }
}

function profile(overrides: Partial<CharacterBasicProfile> = {}): CharacterBasicProfile {
  return { name: '낟낟', level: 293, imageUrl: 'https://example.com/1.png', accessFlag: true, ...overrides }
}

function schedulerState(): SchedulerCharacterState {
  return {
    asOf: '2026-07-12T00:00+09:00',
    characterName: '낟낟',
    world: '엘리시움',
    level: 293,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [],
    isDailyStale: false,
    isWeeklyStale: false,
    isWeeklyBossStale: false,
    isMonthlyBossStale: false,
  }
}

beforeEach(() => {
  // 모듈 수준 플래그라 테스트끼리 샌다(ADR-097 결정 3).
  resetSyncRunStateForTests()
  getCachedCharacterBasicMock.mockResolvedValue(null)
  setCachedCharacterBasicMock.mockResolvedValue(undefined)
  setCachedSchedulerStateMock.mockResolvedValue(undefined)
  resolveCharacterEligibilityMock.mockResolvedValue('eligible')
})

afterEach(() => {
  vi.resetAllMocks()
})

describe('prefetchAccountData', () => {
  it('캐릭터가 없으면 아무 API도 호출하지 않고 progress {0,0}만 보고한다', async () => {
    const onProgress = vi.fn()
    await prefetchAccountData('key-1', ACCOUNT, [], onProgress)

    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
    expect(onProgress).toHaveBeenCalledWith({ completed: 0, total: 0 })
    expect(hasSyncAttemptedThisRun()).toBe(false)
  })

  it('예열도 이번 실행의 동기화로 친다 — 온보딩 직후 첫 진입이 방금 받은 것을 또 받지 않게 (ADR-097 결정 3)', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

    await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], vi.fn())

    expect(hasSyncAttemptedThisRun()).toBe(true)
  })

  it('basic+schedule 둘 다 조회하고 계정 인덱스에 함께 캐시한다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], onProgress)

    expect(fetchCharacterBasicMock).toHaveBeenCalledWith('key-1', 'ocid-1')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key-1', 'ocid-1')
    expect(setCachedCharacterBasicMock).toHaveBeenCalledWith(
      ACCOUNT,
      'ocid-1',
      expect.objectContaining({ profile: profile({ accessFlag: true }) }),
    )
    expect(setCachedSchedulerStateMock).toHaveBeenCalledWith(
      'ocid-1',
      expect.objectContaining({ state: schedulerState() }),
    )
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 2, total: 2 })
  })

  // ADR-113 결정 1: 계정 선택 프로브가 방금 같은 캐릭터를 받아 뒀으면 예열은 다시 받지 않는다.
  it('5분 TTL 안에 캐시된 캐릭터는 character/basic 네트워크를 타지 않는다 (ADR-113 결정 1)', async () => {
    const cached = profile({ name: '프로브가받아둠', accessFlag: false })
    getCachedCharacterBasicMock.mockResolvedValue({
      profile: cached,
      cachedAt: new Date(Date.now() - 1_000).toISOString(),
    })
    fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], onProgress)

    expect(fetchCharacterBasicMock).not.toHaveBeenCalled()
    expect(setCachedCharacterBasicMock).not.toHaveBeenCalled()
    // 건너뛴 것은 basic 하나뿐이다 — scheduler 예열도 자격 판정도 그대로 돈다.
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key-1', 'ocid-1')
    expect(resolveCharacterEligibilityMock).toHaveBeenCalledWith(
      'key-1',
      'ocid-1',
      false,
      expect.any(Date),
      schedulerState(),
    )
    expect(onProgress.mock.calls.at(-1)?.[0]).toEqual({ completed: 2, total: 2 })
  })

  describe('access_flag 게이트 폐기 (ADR-086 결정 3)', () => {
    it('access_flag: false여도 scheduler를 예열한다 — 받을 수 있는 데이터를 버리지 않는다', async () => {
      fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: false }))
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

      const onProgress = vi.fn()
      await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], onProgress)

      expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key-1', 'ocid-1')
      expect(setCachedSchedulerStateMock).toHaveBeenCalled()
      const last = onProgress.mock.calls.at(-1)?.[0]
      expect(last).toEqual({ completed: 2, total: 2 })
    })

    it('오늘 응답을 자격 판정에 넘겨 같은 호출을 두 번 하지 않는다 (ADR-086 결정 5)', async () => {
      fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: false }))
      fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

      await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], vi.fn())

      expect(resolveCharacterEligibilityMock).toHaveBeenCalledWith(
        'key-1',
        'ocid-1',
        false,
        expect.any(Date),
        schedulerState(),
      )
    })
  })

  it('character/basic 조회가 실패하면 캐시 없이 넘어가고 schedule도 조회하지 않는다', async () => {
    fetchCharacterBasicMock.mockRejectedValue(new NexonNetworkError('timeout'))

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], onProgress)

    expect(setCachedCharacterBasicMock).not.toHaveBeenCalled()
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
    expect(resolveCharacterEligibilityMock).not.toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 1, total: 1 })
  })

  it('scheduler 조회가 실패해도 그 캐릭터만 캐시 없이 넘어가고 진행은 계속된다', async () => {
    fetchCharacterBasicMock.mockResolvedValue(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonNetworkError('timeout'))

    const onProgress = vi.fn()
    await prefetchAccountData('key-1', ACCOUNT, [character('ocid-1')], onProgress)

    expect(setCachedSchedulerStateMock).not.toHaveBeenCalled()
    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 2, total: 2 })
  })

  it('401/429 같은 전역성 에러가 나도 그 캐릭터만 실패로 넘어가고 예외를 던지지 않는다', async () => {
    fetchCharacterBasicMock
      .mockRejectedValueOnce(new NexonAuthError('invalid'))
      .mockResolvedValueOnce(profile({ accessFlag: true }))
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonRateLimitError('rate limited'))

    const onProgress = vi.fn()
    await expect(
      prefetchAccountData('key-1', ACCOUNT, [character('ocid-1'), character('ocid-2')], onProgress),
    ).resolves.toBeUndefined()
  })

  it('여러 캐릭터를 Promise.all로 뭉쳐 기다리지 않고 각자 끝나는 대로 진행률을 갱신한다', async () => {
    const resolvers: Array<(profile: CharacterBasicProfile) => void> = []
    fetchCharacterBasicMock.mockImplementation(
      () =>
        new Promise<CharacterBasicProfile>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    fetchSchedulerCharacterStateMock.mockResolvedValue(schedulerState())

    const onProgress = vi.fn()
    const promise = prefetchAccountData(
      'key-1',
      ACCOUNT,
      [character('ocid-1'), character('ocid-2'), character('ocid-3')],
      onProgress,
    )

    await vi.waitFor(() => expect(fetchCharacterBasicMock).toHaveBeenCalledTimes(3))

    resolvers[0](profile({ accessFlag: false }))
    await vi.waitFor(() =>
      expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ completed: 1 })),
    )

    resolvers[1](profile({ accessFlag: false }))
    resolvers[2](profile({ accessFlag: false }))
    await promise

    const last = onProgress.mock.calls.at(-1)?.[0]
    expect(last).toEqual({ completed: 6, total: 6 })
  })
})
