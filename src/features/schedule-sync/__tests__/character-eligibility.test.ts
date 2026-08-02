import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NexonBadRequestError, NexonNetworkError } from '../../../nexon/errors'
import { clearScheduleProbeLedger, getScheduleProbeLedger } from '../../../storage/schedule-probe-ledger'
import type { SchedulerCharacterState } from '../../../types'
import { resolveCharacterEligibility } from '../character-eligibility'

vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>()
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({
        value: store.has(key) ? (store.get(key) as string) : null,
      })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value)
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key)
      }),
    },
  }
})

const { fetchSchedulerCharacterStateMock } = vi.hoisted(() => ({
  fetchSchedulerCharacterStateMock: vi.fn(),
}))

vi.mock('../../../nexon/schedule', () => ({
  fetchSchedulerCharacterState: fetchSchedulerCharacterStateMock,
}))

// KST 2026-08-03 12:00 → 백필 날짜는 2026-08-02 … 2026-07-21 (13일)
const NOW = new Date('2026-08-03T03:00:00.000Z')

function state(overrides: Partial<SchedulerCharacterState> = {}): SchedulerCharacterState {
  return {
    asOf: '2026-08-02T00:00+09:00',
    characterName: '내옆에최성일',
    world: '엘리시움',
    level: 200,
    jobClass: '렌',
    dailyContents: [],
    weeklyContents: [],
    bossContents: [],
    isDailyStale: true,
    isWeeklyStale: true,
    isWeeklyBossStale: true,
    isMonthlyBossStale: true,
    ...overrides,
  }
}

const COMPLETED = state({
  dailyContents: [
    {
      name: '[일일 퀘스트] 레헬른의 평온한 밤',
      kind: 'quest',
      isRegistered: true,
      nowCount: 0,
      maxCount: 0,
      questState: 2,
    },
  ],
  isDailyStale: false,
})

beforeEach(async () => {
  fetchSchedulerCharacterStateMock.mockReset()
  await clearScheduleProbeLedger('ocid-1')
})

describe('access_flag는 배제 게이트가 아니라 충분조건이다 (ADR-086 결정 3)', () => {
  it('access_flag: true면 API를 부르지 않고 곧바로 자격 O다', async () => {
    await expect(resolveCharacterEligibility('key', 'ocid-1', true, NOW)).resolves.toBe('eligible')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('access_flag: false여도 과거에 완료 기록이 있으면 자격 O다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(COMPLETED)
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')
  })
})

describe('과거 날짜 스윕', () => {
  it('완료를 발견하면 즉시 멈춘다 — 13일을 다 쓰지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(COMPLETED)

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key', 'ocid-1', '2026-08-02')
  })

  it('14일 내내 완료가 없으면 자격 X이고 13일을 모두 조회한다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)
  })

  it('오늘 응답을 이미 손에 쥔 호출부가 넘기면 그 완료만으로 통과한다 (호출 0회)', async () => {
    await expect(
      resolveCharacterEligibility('key', 'ocid-1', false, NOW, COMPLETED),
    ).resolves.toBe('eligible')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })
})

describe('같은 날짜를 두 번 조회하지 않는다 (ADR-086 결정 4 = 이슈 #87 문제 1)', () => {
  it('두 번째 판정은 원장에 없는 날짜만 조회한다 — 스윕 전체가 반복되지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())
    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(13)

    fetchSchedulerCharacterStateMock.mockClear()
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('하루가 지나면 새로 윈도우에 들어온 날짜 1개만 조회한다', async () => {
    fetchSchedulerCharacterStateMock.mockResolvedValue(state())
    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)

    fetchSchedulerCharacterStateMock.mockClear()
    const tomorrow = new Date('2026-08-04T03:00:00.000Z')
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, tomorrow)).resolves.toBe(
      'ineligible',
    )
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledWith('key', 'ocid-1', '2026-08-03')
  })
})

describe('실패 종류별 기록 정책 (ADR-086 결정 4)', () => {
  it('400 OPENAPI00003이면 조회 불가로 확정하고 나머지 날짜를 부르지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(
      new NexonBadRequestError('unavailable', 'OPENAPI00003'),
    )

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('unavailable')
    expect(fetchSchedulerCharacterStateMock).toHaveBeenCalledTimes(1)
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toMatchObject({ unavailable: true })
  })

  it('조회 불가로 확정된 캐릭터는 다음 판정에서 API를 아예 부르지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(
      new NexonBadRequestError('unavailable', 'OPENAPI00003'),
    )
    await resolveCharacterEligibility('key', 'ocid-1', false, NOW)

    fetchSchedulerCharacterStateMock.mockClear()
    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('unavailable')
    expect(fetchSchedulerCharacterStateMock).not.toHaveBeenCalled()
  })

  it('400 OPENAPI00004(구간 밖)는 그 날짜만 영구 기록하고 다음 날짜로 넘어간다', async () => {
    fetchSchedulerCharacterStateMock
      .mockRejectedValueOnce(new NexonBadRequestError('out of range', 'OPENAPI00004'))
      .mockResolvedValue(COMPLETED)

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('eligible')

    const ledger = await getScheduleProbeLedger('ocid-1', NOW)
    expect(ledger.dates['2026-08-02']).toEqual({ kind: 'outOfRange' })
  })

  it('400 OPENAPI00009(집계 전)는 기록하지 않는다 — 나중에 다시 시도한다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(
      new NexonBadRequestError('not collected', 'OPENAPI00009'),
    )

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })

  it('네트워크 실패도 기록하지 않는다 — 모르는 실패를 확정으로 굳히지 않는다', async () => {
    fetchSchedulerCharacterStateMock.mockRejectedValue(new NexonNetworkError('offline'))

    await expect(resolveCharacterEligibility('key', 'ocid-1', false, NOW)).resolves.toBe('ineligible')
    await expect(getScheduleProbeLedger('ocid-1', NOW)).resolves.toEqual({
      unavailable: false,
      dates: {},
    })
  })
})
